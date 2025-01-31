// crawler.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import pRetry from "p-retry";
import type { Page } from "puppeteer";
import { config } from "./config";
import { logger } from "./logger";
import type { CrawlerConfig, University, Institute } from "./types";
import { getPath, markAsCrawled } from "./utils";

const MAX_RECORD_COUNT = 2000;

export const getUniversities = async (page: Page): Promise<University[]> => {
  logger.info("🎓 Fetching list of universities...");

  const [popup] = await Promise.all([
    new Promise<Page | null>((resolve) =>
      page.browser().once("targetcreated", async (target) => {
        const newPage = await target.page();
        resolve(newPage);
      })
    ),
    page.click('input[onclick="uniEkle();"]'),
  ]);

  if (!popup) {
    throw new Error("Failed to open university selection popup");
  }

  logger.info("Popup opened, waiting for content...");
  await popup.waitForSelector("table#sf", { timeout: 10000 });

  const universities = await popup.$$eval('a[href*="eklecikar"]', (links) =>
    links
      .map((link) => {
        const href = link.getAttribute("href");
        const name = link.textContent?.trim();
        if (!href || !name) return null;

        const match = href.match(/eklecikar\('(.+?)','(\d+)'/);
        if (!match) return null;

        return { name: match[1], id: match[2] };
      })
      .filter((uni): uni is University => uni !== null)
  );

  logger.info(`Found ${universities.length} universities.`);
  await popup.close();
  return universities;
};

export const getInstitutes = async (page: Page): Promise<Institute[]> => {
  logger.info("🏛️ Fetching list of institutes...");

  const [popup] = await Promise.all([
    new Promise<Page | null>((resolve) =>
      page.browser().once("targetcreated", async (target) => {
        const newPage = await target.page();
        resolve(newPage);
      })
    ),
    page.click('input[onclick="ensEkle();"]'),
  ]);

  if (!popup) {
    throw new Error("Failed to open institute selection popup");
  }

  logger.info("Institute popup opened, waiting for content...");
  await popup.waitForSelector("table#sf", { timeout: 10000 });

  const institutes = await popup.$$eval('a[href*="eklecikar"]', (links) =>
    links
      .map((link) => {
        const href = link.getAttribute("href");
        const name = link.textContent?.trim();
        if (!href || !name) return null;

        const match = href.match(/eklecikar\('(.+?)','(\d+)'/);
        if (!match) return null;

        return { name: match[1], id: match[2] };
      })
      .filter((inst): inst is Institute => inst !== null)
  );

  logger.info(`Found ${institutes.length} institutes`);
  await popup.close();
  return institutes;
};

export const selectUniversity = async (
  page: Page,
  university: University
): Promise<void> => {
  logger.info(
    `🔍 Selecting university: ${university.name} (ID: ${university.id})`
  );

  // Clear any existing selection first
  await page.evaluate(() => {
    const input = document.querySelector(
      'input[name="uniad"]'
    ) as HTMLInputElement;
    if (input) input.value = "";
  });

  const [popup] = await Promise.all([
    new Promise<Page | null>((resolve) =>
      page.browser().once("targetcreated", async (target) => {
        const newPage = await target.page();
        resolve(newPage);
      })
    ),
    page.click('input[onclick="uniEkle();"]'),
  ]);

  if (!popup) {
    throw new Error("Failed to open university selection popup");
  }

  await popup.waitForSelector("table#sf", { timeout: 10000 });

  await popup.evaluate((uni) => {
    const selector = `a[onclick*="eklecikar('${uni.name}','${uni.id}')"]`;
    const link = document.querySelector(selector);
    if (link) {
      (link as HTMLElement).click();
    }
  }, university);

  await popup.close();

  await page.waitForFunction(
    (uniName) => {
      const input = document.querySelector(
        'input[name="uniad"]'
      ) as HTMLInputElement;
      return input && input.value === uniName;
    },
    {},
    university.name
  );
};

export const selectInstitute = async (
  page: Page,
  institute: Institute
): Promise<void> => {
  logger.info(
    `🏛️ Selecting institute: ${institute.name} (ID: ${institute.id})`
  );

  // Clear any existing selection first
  await page.evaluate(() => {
    const input = document.querySelector(
      'input[name="ensad"]'
    ) as HTMLInputElement;
    if (input) input.value = "";
  });

  const [popup] = await Promise.all([
    new Promise<Page | null>((resolve) =>
      page.browser().once("targetcreated", async (target) => {
        const newPage = await target.page();
        resolve(newPage);
      })
    ),
    page.click('input[onclick="ensEkle();"]'),
  ]);

  if (!popup) {
    throw new Error("Failed to open institute selection popup");
  }

  await popup.waitForSelector("table#sf", { timeout: 10000 });

  await popup.evaluate((inst) => {
    const selector = `a[onclick*="eklecikar('${inst.name}','${inst.id}')"]`;
    const link = document.querySelector(selector);
    if (link) {
      (link as HTMLElement).click();
    }
  }, institute);

  await popup.close();

  await page.waitForFunction(
    (instName) => {
      const input = document.querySelector(
        'input[name="ensad"]'
      ) as HTMLInputElement;
      return input && input.value === instName;
    },
    {},
    institute.name
  );
};

export const getYears = async (page: Page): Promise<string[]> => {
  logger.info(`📅 Getting available years...`);
  const years = await page.evaluate(() => {
    const yearSelect = document.querySelector('select[name="yil1"]');
    if (!yearSelect) return [];

    return Array.from(yearSelect.querySelectorAll("option"))
      .map((option) => option.value)
      .filter((value) => value !== "0")
      .sort((a, b) => Number(b) - Number(a));
  });
  return years;
};

export const crawlCombination = async (
  page: Page,
  university: University,
  institute: Institute,
  year: string,
  config: CrawlerConfig
): Promise<void> => {
  logger.info(
    `🎓 Crawling ${university.name} - ${institute.name} for year ${year}`
  );
  const html = await safeSearchTheses(page, university, institute, year);
  if (!html) return;

  const encodedUniversityName = encodeURIComponent(university.name);
  const encodedInstituteName = encodeURIComponent(institute.name);
  const separator = "___";
  const filename = `${encodedUniversityName}${separator}${university.id}${separator}${encodedInstituteName}${separator}${institute.id}${separator}${year}.html`;
  const filepath = path.join(getPath(config.downloadDir), filename);
  await fs.writeFile(filepath, html);
  await markAsCrawled({
    university,
    institute,
    year,
    progressFile: config.progressFile,
  });
};

export const searchTheses = async (
  page: Page,
  university: University,
  institute: Institute,
  year: string
): Promise<string> => {
  logger.info(
    `🔎 Searching theses for ${university.name} - ${institute.name}, Year: ${year}`
  );

  if (page.url() !== config.baseUrl) {
    await page.goto(config.baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });
  }

  // Select university first
  await selectUniversity(page, university);

  // Then select institute
  await selectInstitute(page, institute);

  await page.evaluate((yr) => {
    const year1Select = document.querySelector(
      'select[name="yil1"]'
    ) as HTMLSelectElement;
    const year2Select = document.querySelector(
      'select[name="yil2"]'
    ) as HTMLSelectElement;
    const form = document.querySelector(
      'form[name="GForm"]'
    ) as HTMLFormElement;

    if (year1Select) year1Select.value = yr;
    if (year2Select) year2Select.value = yr;
    form?.submit();
  }, year);

  try {
    await page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 5000,
    });
  } catch (error) {
    logger.error(
      `Navigation failed for ${university.name} - ${institute.name}, Year: ${year}`,
      error
    );
    throw error;
  }

  const isMaintenancePage = await page.evaluate(() => {
    const bodyText = document.body.textContent || "";
    return (
      bodyText.includes("BAKIM CALISMASI") ||
      bodyText.includes("undergoing maintenance")
    );
  });

  if (isMaintenancePage) {
    logger.warn(
      `⚠️ Maintenance page detected for ${university.name} - ${institute.name}, Year: ${year}. Retrying later...`
    );
    throw new Error("Maintenance page detected");
  }

  const cleanedText = await page.evaluate(() => {
    const textContent = document.body.textContent || "";
    return textContent.replace(/\s+/g, " ").replace(/\n/g, " ").trim();
  });

  const match = cleanedText.match(/(\d+) kayıt/);
  const recordCount = match ? parseInt(match[1], 10) : 0;
  logger.info(`Found ${recordCount} records.`);
  if (recordCount > MAX_RECORD_COUNT) {
    logger.warn(
      `⚠️ Record count exceeds limit of ${MAX_RECORD_COUNT} | ${university.name} | ${institute.name} | ${year}`
    );
  }

  const html = await page.content();

  if (!html.includes("getData()")) {
    logger.error(
      `❌ No getData() found for ${university.name} - ${institute.name}, Year: ${year}. Throwing error.`
    );
    throw new Error(
      `No getData() found for ${university.name} - ${institute.name}, Year: ${year}`
    );
  }

  return html;
};

export const safeSearchTheses = async (
  page: Page,
  university: University,
  institute: Institute,
  year: string,
  retries = 1
): Promise<string> => {
  return pRetry(() => searchTheses(page, university, institute, year), {
    retries,
    onFailedAttempt: (error) => {
      logger.warn(
        `Attempt ${error.attemptNumber} failed for ${university.name} - ${institute.name}, Year: ${year}. ${error.retriesLeft} retries left.`
      );
    },
  });
};
