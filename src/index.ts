import { promises as fs } from "node:fs";
import * as puppeteer from "puppeteer";
import { config } from "./config";
import {
  crawlCombination,
  getInstitutes,
  getUniversities,
  getYears,
} from "./crawler";
import { logger } from "./logger";
import type { University } from "./types";
import { getPath, isAlreadyCrawled } from "./utils";

const main = async () => {
  await fs.mkdir(getPath(config.downloadDir), { recursive: true });
  await fs.mkdir(getPath(config.logsDir), { recursive: true });
  logger.info("Starting crawler...");

  mainLoop();
};

// index.ts
async function mainLoop() {
  logger.info("🚀 Starting main loop...");
  let browser: puppeteer.Browser | undefined = undefined;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(config.baseUrl);

    // Get initial data
    const universities = await getUniversities(page);
    const institutes = await getInstitutes(page);
    const years = await getYears(page);

    logger.info(
      `Found ${universities.length} universities, ${institutes.length} institutes, and ${years.length} years`
    );

    // Generate university + year combinations
    const combinations: Array<{
      university: University;
      year: string;
    }> = [];

    for (const year of years) {
      for (const university of universities) {
        combinations.push({ university, year });
      }
    }

    logger.info(`Generated ${combinations.length} combinations to process`);

    // Process all combinations
    for (const combo of combinations) {
      // Check if any institute combination for this university and year is not crawled
      let allCrawled = true;
      for (const institute of institutes) {
        const isCrawled = await isAlreadyCrawled({
          university: combo.university,
          institute,
          year: combo.year,
          progressFile: config.progressFile,
        });
        if (!isCrawled) {
          allCrawled = false;
          break;
        }
      }

      if (allCrawled) {
        logger.info(
          `\n⏭️ Already crawled all institutes | ${combo.university.name} | ${combo.year}`
        );
        continue;
      }

      logger.info(`\n🔄 Processing: ${combo.university.name} | ${combo.year}`);
      await crawlCombination(
        page,
        combo.university,
        institutes,
        combo.year,
        config
      );
    }

    logger.info("🚀🟢 Main loop completed successfully!");
    process.exit(0);
  } catch (error) {
    logger.error("🚀🔴 Error in main loop:", error);
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        logger.error("🚀🔴 Error closing browser:", error);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
    mainLoop();
  }
}

main();
