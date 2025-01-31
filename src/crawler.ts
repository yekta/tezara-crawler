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
  const { html, recordCount } = await searchAndCrawl({
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

  const uniAndYearFilePath = generateFilePath({
    dir: config.downloadDir,
    university,
    year,
  });
  await fs.writeFile(uniAndYearFilePath, html);

  if (recordCount <= MAX_RECORD_COUNT) {
    // If under limit, mark as crawled and return
    logger.info(
      `📜🟢 Created HTML file, marking uni as crawled | ${university.name} | ${year}`
    );
    await markUniversityAsCrawled({
      university,
      year,
      progressFile: config.progressFile,
    });
    return;
  } else {
    logger.info(
      `📜🔵 Created HTML file, continuing to crawl | ${university.name} | ${year}`
    );
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

    const { html, recordCount } = await searchAndCrawl({
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
    } else {
      const filepath = generateFilePath({
        dir: config.downloadDir,
        university,
        subject,
        year,
      });
      await fs.writeFile(filepath, html);

      if (recordCount <= MAX_RECORD_COUNT) {
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

async function _searchAndCrawl({
  page,
  university,
  year,
  subject,
}: {
  page: Page;
  university: University;
  year: string;
  subject?: Subject;
}): Promise<{ html: string; recordCount: number }> {
  logger.info(
    `🔎 Searching theses | ${university.name} | Year: ${year}${
      subject ? ` | ${subject.name}` : ""
    }`
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

      // If subject is provided, fill it
      if (subjectInput && subject) subjectInput.value = subject;
      form?.submit();
    },
    university.id,
    year,
    subject?.name
  );

  try {
    await page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 5000,
    });
  } catch (error) {
    logger.error(
      `Navigation failed | ${university.name} | Year: ${year}${
        subject ? ` | ${subject.name}` : ""
      }`,
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
      `⚠️ Maintenance page detected | ${university.name} | Year: ${year}${
        subject ? ` | ${subject.name}` : ""
      } | Retrying later...`
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
      `⚠️ Record count exceeds limit of ${MAX_RECORD_COUNT} | ${
        university.name
      } | Year: ${year}${subject ? ` | ${subject.name}` : ""}`
    );
  }

  const html = await page.content();

  if (!html.includes("getData()")) {
    logger.error(
      `❌ No getData() found | ${university.name} | Year: ${year}${
        subject ? ` | ${subject.name}` : ""
      } | Throwing error.`
    );
    throw new Error(
      `No getData() found | ${university.name} | Year: ${year}${
        subject ? ` | ${subject.name}` : ""
      }`
    );
  }

  return { html, recordCount };
}

async function searchAndCrawl({
  page,
  university,
  year,
  subject,
  retries = 1,
}: {
  page: Page;
  university: University;
  year: string;
  subject?: Subject;
  retries?: number;
}) {
  return pRetry(() => _searchAndCrawl({ page, university, subject, year }), {
    retries,
    onFailedAttempt: (error) => {
      logger.warn(
        `Attempt ${error.attemptNumber} failed | ${university.name} | ${year}${
          subject ? ` | ${subject.name}` : ""
        } | ${error.retriesLeft} retries left.`
      );
    },
  });
}
