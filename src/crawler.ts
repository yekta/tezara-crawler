import { promises as fs } from "node:fs";
import path from "node:path";
import pRetry from "p-retry";
import type { Page } from "puppeteer";
import { config } from "./config";
import { logger } from "./logger";
import type { CrawlerConfig, Institute, ThesisType, University } from "./types";
import {
  getPath,
  markInstituteAsCrawled,
  markThesisTypeAsCrawled,
  markUniversityAsCrawled,
} from "./utils";

const MAX_RECORD_COUNT = 2000;
const MIN_YEAR = 1940;

export async function getUniversities(page: Page): Promise<University[]> {
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
}

export async function getInstitutes(page: Page): Promise<Institute[]> {
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
}

export async function getYears(page: Page): Promise<string[]> {
  logger.info(`📅 Getting available years...`);
  const years = await page.evaluate(() => {
    const yearSelect = document.querySelector('select[name="yil1"]');
    if (!yearSelect) return [];

    return Array.from(yearSelect.querySelectorAll("option"))
      .map((option) => option.value)
      .filter((value) => value !== "0")
      .sort((a, b) => Number(b) - Number(a));
  });
  return years.filter((year) => parseInt(year, 10) >= MIN_YEAR);
}

export async function getThesisTypes(page: Page): Promise<ThesisType[]> {
  logger.info("📚 Fetching available thesis types...");

  const thesisTypes = await page.evaluate(() => {
    const select = document.querySelector('select[name="Tur"]');
    if (!select) return [];

    return Array.from(select.querySelectorAll("option"))
      .map((option) => ({
        id: option.value,
        name: option.textContent?.trim() || "",
      }))
      .filter((type) => type.id !== "0" && type.name);
  });

  logger.info(`Found ${thesisTypes.length} thesis types`);
  return thesisTypes;
}

export async function crawlCombination({
  page,
  university,
  institutes,
  year,
  thesisTypes,
  config,
}: {
  page: Page;
  university: University;
  institutes: Institute[];
  year: string;
  thesisTypes: ThesisType[];
  config: CrawlerConfig;
}): Promise<void> {
  logger.info(`🎓 Checking ${university.name} for year ${year}`);

  // First try university + year combination
  const { html, recordCount } = await safeSearchByUniversityAndYear({
    page,
    university,
    year,
  });

  if (recordCount === 0) {
    logger.info(`📜🟡 No results found | ${university.name} | ${year}`);
    await markUniversityAsCrawled({
      university,
      year,
      progressFile: config.progressFile,
    });
    return;
  }

  if (recordCount <= MAX_RECORD_COUNT) {
    // If under limit, save the university-level results and we're done
    const filepath = generateFilePath({
      dir: config.downloadDir,
      university,
      year,
    });
    await fs.writeFile(filepath, html);
    logger.info(`📜🟢 Created HTML file | ${university.name} | ${year}`);

    await markUniversityAsCrawled({
      university,
      year,
      progressFile: config.progressFile,
    });
    return;
  }

  // If we're here, we need to try with thesis types
  logger.info(
    `⚠️ Record count (${recordCount}) exceeds limit. Trying with thesis types...`
  );

  // Try each thesis type separately
  for (const thesisType of thesisTypes) {
    const { html: thesisTypeHtml, recordCount: thesisTypeRecordCount } =
      await safeSearchByUniversityAndYear({
        page,
        university,
        year,
        thesisType, // Fixed: Pass thesis type to search
      });

    if (thesisTypeRecordCount === 0) {
      await markThesisTypeAsCrawled({
        university,
        year,
        thesisType,
        progressFile: config.progressFile,
      });
      continue;
    }

    if (thesisTypeRecordCount > MAX_RECORD_COUNT) {
      logger.info(
        `⚠️ Record count (${thesisTypeRecordCount}) exceeds limit for thesis type ${thesisType.name}. Checking individual institutes...`
      );

      // If still over limit, check each institute separately with thesis type
      for (const institute of institutes) {
        const { html: instituteHtml, recordCount: instituteRecordCount } =
          await safeSearchTheses({
            page,
            university,
            institute,
            year,
            thesisType,
          });

        if (instituteRecordCount > 0) {
          const filepath = generateFilePath({
            dir: config.downloadDir,
            university,
            institute,
            thesisType,
            year,
          });
          await fs.writeFile(filepath, instituteHtml);
          logger.info(
            `📜🟢 Created HTML file | ${university.name} | ${institute.name} | ${thesisType.name} | ${year}`
          );
        }

        await markInstituteAsCrawled({
          university,
          institute,
          thesisType,
          year,
          progressFile: config.progressFile,
        });
      }
    } else {
      // Save thesis type level results
      const filepath = generateFilePath({
        dir: config.downloadDir,
        university,
        thesisType,
        year,
      });
      await fs.writeFile(filepath, thesisTypeHtml);
      logger.info(
        `📜🟢 Created HTML file | ${university.name} | ${thesisType.name} | ${year}`
      );

      await markThesisTypeAsCrawled({
        university,
        year,
        thesisType,
        progressFile: config.progressFile,
      });
    }
  }
}

function generateFilePath({
  dir,
  university,
  institute,
  thesisType,
  year,
}: {
  dir: string;
  university: University;
  institute?: Institute;
  thesisType?: ThesisType;
  year: string;
}) {
  const parts = [encodeURIComponent(university.name.replaceAll(" ", ""))];

  if (institute) {
    parts.push(encodeURIComponent(institute.name.replaceAll(" ", "")));
  }

  if (thesisType) {
    parts.push(encodeURIComponent(thesisType.name.replaceAll(" ", "")));
  }

  parts.push(year);

  return path.join(getPath(dir), parts.join("_") + ".html");
}

async function searchTheses({
  page,
  university,
  institute,
  thesisType,
  year,
}: {
  page: Page;
  university: University;
  institute: Institute;
  thesisType: ThesisType;
  year: string;
}): Promise<{ html: string; recordCount: number }> {
  logger.info(
    `🔎 Searching theses for ${university.name} - ${institute.name}, Year: ${year}`
  );

  if (page.url() !== config.baseUrl) {
    await page.goto(config.baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });
  }

  await page.evaluate(
    (uni, inst, yr, type) => {
      const universeInput = document.querySelector(
        'input[name="Universite"]'
      ) as HTMLInputElement;
      const instituteInput = document.querySelector(
        'input[name="Enstitu"]'
      ) as HTMLInputElement;
      const year1Select = document.querySelector(
        'select[name="yil1"]'
      ) as HTMLSelectElement;
      const year2Select = document.querySelector(
        'select[name="yil2"]'
      ) as HTMLSelectElement;
      const thesisTypeSelect = document.querySelector(
        'select[name="Tur"]'
      ) as HTMLSelectElement;
      const form = document.querySelector(
        'form[name="GForm"]'
      ) as HTMLFormElement;

      if (universeInput) universeInput.value = uni;
      if (instituteInput) instituteInput.value = inst;
      if (year1Select) year1Select.value = yr;
      if (year2Select) year2Select.value = yr;
      if (thesisTypeSelect) thesisTypeSelect.value = type;
      form?.submit();
    },
    university.id,
    institute.id,
    year,
    thesisType.id
  );

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

  return { html, recordCount };
}

async function safeSearchTheses({
  page,
  university,
  institute,
  thesisType,
  year,
  retries = 1,
}: {
  page: Page;
  university: University;
  institute: Institute;
  thesisType: ThesisType;
  year: string;
  retries?: number;
}) {
  return pRetry(
    () => searchTheses({ page, university, thesisType, institute, year }),
    {
      retries,
      onFailedAttempt: (error) => {
        logger.warn(
          `Attempt ${error.attemptNumber} failed | ${university.name} | ${institute.name} | ${year} | ${error.retriesLeft} retries left.`
        );
      },
    }
  );
}

async function searchByUniversityAndYear({
  page,
  university,
  year,
  thesisType,
}: {
  page: Page;
  university: University;
  year: string;
  thesisType?: ThesisType;
}): Promise<{ html: string; recordCount: number }> {
  logger.info(`🔎 Searching theses for ${university.name}, Year: ${year}`);

  if (page.url() !== config.baseUrl) {
    await page.goto(config.baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });
  }

  await page.evaluate(
    (uni, yr, type) => {
      const universeInput = document.querySelector(
        'input[name="Universite"]'
      ) as HTMLInputElement;
      const year1Select = document.querySelector(
        'select[name="yil1"]'
      ) as HTMLSelectElement;
      const year2Select = document.querySelector(
        'select[name="yil2"]'
      ) as HTMLSelectElement;
      const thesisTypeSelect = document.querySelector(
        'select[name="Tur"]'
      ) as HTMLSelectElement;
      const form = document.querySelector(
        'form[name="GForm"]'
      ) as HTMLFormElement;

      if (universeInput) universeInput.value = uni;
      if (year1Select) year1Select.value = yr;
      if (year2Select) year2Select.value = yr;
      if (thesisTypeSelect && type) thesisTypeSelect.value = type;
      form?.submit();
    },
    university.id,
    year,
    thesisType?.id
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
    return textContent.replace(/\s+/g, " ").replace(/\n/g, " ").trim();
  });

  const match = cleanedText.match(/(\d+) kayıt/);
  const recordCount = match ? parseInt(match[1], 10) : 0;
  logger.info(`Found ${recordCount} records.`);

  const html = await page.content();

  if (!html.includes("getData()")) {
    logger.error(
      `❌ No getData() found for ${university.name}, Year: ${year}. Throwing error.`
    );
    throw new Error(`No getData() found for ${university.name}, Year: ${year}`);
  }

  return { html, recordCount };
}

async function safeSearchByUniversityAndYear({
  page,
  university,
  year,
  thesisType,
  retries = 3, // Increased retries
}: {
  page: Page;
  university: University;
  year: string;
  thesisType?: ThesisType;
  retries?: number;
}) {
  return pRetry(
    () => searchByUniversityAndYear({ page, university, year, thesisType }),
    {
      retries,
      onFailedAttempt: (error) => {
        logger.warn(
          `Attempt ${error.attemptNumber} failed | ${university.name} | ${year} | ${error.retriesLeft} retries left.`
        );
        // Add delay between retries for maintenance pages
        if (error.message.includes("maintenance")) {
          return new Promise((resolve) => setTimeout(resolve, 30000));
        }
      },
    }
  );
}
