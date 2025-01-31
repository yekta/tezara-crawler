import { promises as fs } from "node:fs";
import path from "node:path";
import pRetry from "p-retry";
import type { Page } from "puppeteer";
import { config } from "./config";
import { logger } from "./logger";
import type { CrawlerConfig, Subject, University } from "./types";
import {
  getPath,
  isAlreadyCrawled,
  markSubjectAsCrawled,
  markUniversityAsCrawled,
} from "./utils";

export const MAX_RECORD_COUNT = 2000;
export const MIN_YEAR = 1940;

export async function crawl({
  page,
  universities,
  years,
  subjects,
  config,
  progressFileContent,
}: {
  page: Page;
  universities: University[];
  subjects: Subject[];
  years: string[];
  config: CrawlerConfig;
  progressFileContent: string;
}) {
  for (const year of years) {
    for (const university of universities) {
      const isUniversityCrawled = isAlreadyCrawled({
        university,
        year,
        progressFileContent,
      });

      if (isUniversityCrawled) {
        logger.info(
          `⏩ University + Year already crawled | ${university.name} | ${year}`
        );
        continue;
      }

      await crawlCombination({
        page,
        university,
        subjects,
        year,
        config,
        progressFileContent,
      });
    }
  }
}

export async function crawlCombination({
  page,
  university,
  subjects,
  year,
  config,
  progressFileContent,
}: {
  page: Page;
  university: University;
  subjects: Subject[];
  year: string;
  config: CrawlerConfig;
  progressFileContent: string;
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

  // If we're here, we need to try with subjects
  logger.info(
    `⚠️ Record count (${recordCount}) exceeds limit. Trying with subjects...`
  );

  for (const subject of subjects) {
    // Skip if already crawled
    const isSubjectCrawled = isAlreadyCrawled({
      university,
      year,
      subject,
      progressFileContent,
    });
    if (isSubjectCrawled) {
      logger.info(
        `⏩ Subject already crawled | ${university.name} | ${year} | ${subject.name}`
      );
      continue;
    }

    const { html, recordCount } = await safeSearchThesesFull({
      page,
      university,
      year,
      subject,
    });

    if (recordCount === 0) {
      logger.info(
        `📜🟡 No results found | ${university.name} | ${subject.name} | ${year}`
      );
      markSubjectAsCrawled({
        university,
        subject,
        year,
        progressFile: config.progressFile,
      });
      continue;
    } else if (recordCount <= MAX_RECORD_COUNT) {
      const filepath = generateFilePath({
        dir: config.downloadDir,
        university,
        subject,
        year,
      });
      await fs.writeFile(filepath, html);
      logger.info(
        `📜🟢 Created HTML file | ${university.name} | ${subject.name} | ${year}`
      );
      markSubjectAsCrawled({
        university,
        subject,
        year,
        progressFile: config.progressFile,
      });
    } else {
      logger.warn(
        `⚠️ Record count exceeds limit of ${MAX_RECORD_COUNT} | ${university.name} | ${subject.name} | ${year}`
      );
      throw new Error(
        `🔴 This shouldn't have happened. Record count still exceeds limit of ${MAX_RECORD_COUNT} | ${university.name} | ${subject.name} | ${year}`
      );
    }
  }

  // Only mark university as fully crawled after all subjects are done
  await markUniversityAsCrawled({
    university,
    year,
    progressFile: config.progressFile,
  });
}

function generateFilePath({
  dir,
  university,
  subject,
  year,
}: {
  dir: string;
  university: University;
  year: string;
  subject?: Subject;
}) {
  const parts = [encodeURIComponent(university.name.replaceAll(" ", ""))];

  if (subject) {
    parts.push(encodeURIComponent(subject.name.replaceAll(" ", "")));
  }

  parts.push(year);

  return path.join(getPath(dir), parts.join("_") + ".html");
}

async function searchThesesFull({
  page,
  university,
  year,
  subject,
}: {
  page: Page;
  university: University;
  year: string;
  subject: Subject;
}): Promise<{ html: string; recordCount: number }> {
  logger.info(
    `🔎 Searching theses for ${university.name} - ${subject.name}, Year: ${year}`
  );

  if (page.url() !== config.baseUrl) {
    await page.goto(config.baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });
  }

  await page.evaluate(
    (uni, yr, subject) => {
      const universeInput = document.querySelector(
        'input[name="Universite"]'
      ) as HTMLInputElement;

      const subjectInput = document.querySelector(
        'input[name="Konu"]'
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
      if (subjectInput) subjectInput.value = subject;
      form?.submit();
    },
    university.id,
    year,
    subject.name
  );

  try {
    await page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 5000,
    });
  } catch (error) {
    logger.error(
      `Navigation failed for ${university.name} - ${subject.name}, Year: ${year}`,
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
      `⚠️ Maintenance page detected for ${university.name} - ${subject.name}, Year: ${year}. Retrying later...`
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
      `⚠️ Record count exceeds limit of ${MAX_RECORD_COUNT} | ${university.name} | ${subject.name} | ${year}`
    );
  }

  const html = await page.content();

  if (!html.includes("getData()")) {
    logger.error(
      `❌ No getData() found for ${university.name} - ${subject.name}, Year: ${year}. Throwing error.`
    );
    throw new Error(
      `No getData() found for ${university.name} - ${subject.name}, Year: ${year}`
    );
  }

  return { html, recordCount };
}

async function safeSearchThesesFull({
  page,
  university,
  year,
  subject,
  retries = 1,
}: {
  page: Page;
  university: University;
  year: string;
  subject: Subject;
  retries?: number;
}) {
  return pRetry(() => searchThesesFull({ page, university, subject, year }), {
    retries,
    onFailedAttempt: (error) => {
      logger.warn(
        `Attempt ${error.attemptNumber} failed | ${university.name} | ${subject.name} | ${year} | ${error.retriesLeft} retries left.`
      );
    },
  });
}

async function searchByUniversityAndYear({
  page,
  university,
  year,
}: {
  page: Page;
  university: University;
  year: string;
}): Promise<{ html: string; recordCount: number }> {
  logger.info(`🔎 Searching theses for ${university.name}, Year: ${year}`);

  if (page.url() !== config.baseUrl) {
    await page.goto(config.baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
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
  retries = 3, // Increased retries
}: {
  page: Page;
  university: University;
  year: string;
  retries?: number;
}) {
  return pRetry(() => searchByUniversityAndYear({ page, university, year }), {
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
  });
}
