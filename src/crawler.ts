import { promises as fs } from "node:fs";
import path from "node:path";
import pRetry from "p-retry";
import type { Page } from "puppeteer";
import { config } from "./config";
import type { CrawlerConfig, University } from "./types";
import { getPath, markAsCrawled, sanitizeFilename } from "./utils";
import { logger } from "./logger";

export const getUniversities = async (page: Page): Promise<University[]> => {
  logger.info("🎓 Fetching list of universities...");

  const [popup] = await Promise.all([
    new Promise<Page | null>((resolve) =>
      page.browser().once("targetcreated", async (target) => {
        const newPage = await target.page();
        resolve(newPage);
      })
    ),
    page.click('input[onclick="uniEkle();"]'), // Trigger popup
  ]);

  if (!popup) {
    throw new Error("Failed to open university selection popup");
  }

  logger.info("Popup opened, waiting for content...");
  await popup.waitForSelector("table#sf"); // Ensure table is loaded

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

export const selectUniversity = async (
  page: Page,
  university: University
): Promise<void> => {
  logger.info(
    `🔍 Selecting university: ${university.name} (ID: ${university.id})`
  );

  await page.evaluate((uni) => {
    const selector = `a[onclick*="eklecikar('${uni.name}','${uni.id}')"]`;
    const link = document.querySelector(selector);
    if (link) {
      (link as HTMLElement).click();
    }
  }, university);

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

export const getYears = async (page: Page): Promise<string[]> => {
  logger.info(`📅 Getting available years...`);
  const years = await page.evaluate(() => {
    const yearSelect = document.querySelector('select[name="yil1"]');
    if (!yearSelect) return [];

    return Array.from(yearSelect.querySelectorAll("option"))
      .map((option) => option.value)
      .filter((value) => value !== "0")
      .sort((a, b) => Number(b) - Number(a)); // Sort years in descending order
  });
  return years;
};

export const crawlUniversity = async (
  page: Page,
  university: University,
  year: string,
  config: CrawlerConfig
): Promise<void> => {
  logger.info(`🎓 Crawling ${university.name} for year ${year}`);
  try {
    const html = await safeSearchTheses(page, university, year);
    if (html) {
      const filename = `${sanitizeFilename(
        `${university.name}-${university.id}-${year}`
      )}.html`;
      const filepath = path.join(getPath(config.downloadDir), filename);
      await fs.writeFile(filepath, html);
      await markAsCrawled(university, year, config.progressFile);
    }
  } catch (error) {
    logger.error(`Error crawling ${university.name} for year ${year}`, error);
  }
};

export const searchTheses = async (
  page: Page,
  university: University,
  year: string
): Promise<string> => {
  logger.info(`🔎 Searching theses for ${university.name}, Year: ${year}`);
  if (page.url() !== config.baseUrl) {
    await page.goto(config.baseUrl, {
      waitUntil: "domcontentloaded",
    });
  }

  await page.evaluate(
    (uni, yr) => {
      const universeInput = document.querySelector(
        'input[name="Universite"]'
      ) as HTMLInputElement;
      const year1Select = document.querySelector(
        'select[name="yil1"]'
      ) as HTMLSelectElement;
      const year2Select = document.querySelector(
        'select[name="yil2"]'
      ) as HTMLSelectElement;
      const form = document.querySelector(
        'form[name="GForm"]'
      ) as HTMLFormElement;

      if (universeInput) universeInput.value = uni;
      if (year1Select) year1Select.value = yr;
      if (year2Select) year2Select.value = yr;
      form?.submit();
    },
    university.id,
    year
  );

  try {
    await page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 5000,
    });
  } catch (error) {
    logger.error(
      `Navigation failed for ${university.name}, Year: ${year}`,
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
      `⚠️ Maintenance page detected for ${university.name}, Year: ${year}. Retrying later...`
    );
    throw new Error("Maintenance page detected");
  }

  const cleanedText = await page.evaluate(() => {
    const textContent = document.body.textContent || "";
    return textContent
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/\n/g, " ") // Replace newlines
      .trim();
  });

  const match = cleanedText.match(/(\d+) kayıt/);
  const recordCount = match ? parseInt(match[1], 10) : 0;
  logger.info(`Found ${recordCount} records.`);

  return page.content();
};

export const safeSearchTheses = async (
  page: Page,
  university: University,
  year: string,
  retries = 5
): Promise<string> => {
  return pRetry(() => searchTheses(page, university, year), {
    retries,
    onFailedAttempt: (error) => {
      logger.warn(
        `Attempt ${error.attemptNumber} failed for ${university.name}, Year: ${year}. ${error.retriesLeft} retries left.`
      );
    },
  });
};
