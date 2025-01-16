import { promises as fs } from "node:fs";
import * as puppeteer from "puppeteer";
import { config } from "./config";
import { getUniversities, getYears, crawlUniversity } from "./crawler";
import { getPath, isAlreadyCrawled } from "./utils";
import { logger } from "./logger";

const main = async () => {
  await fs.mkdir(getPath(config.downloadDir), { recursive: true });
  await fs.mkdir(getPath(config.logsDir), { recursive: true });
  logger.info("Starting crawler...");

  mainLoop();
};

async function mainLoop() {
  logger.info("🚀 Starting main loop...");
  let browser: puppeteer.Browser | undefined = undefined;

  try {
    browser = await puppeteer.launch({
      headless: true,
    });
    const page = await browser.newPage();
    await page.goto(config.baseUrl);

    const universities = await getUniversities(page);
    const years = await getYears(page);

    // Loop through years first, then universities
    for (const year of years) {
      logger.info(`\n\n📅 Processing year ${year}\n`);

      for (const university of universities) {
        const isCrawled = await isAlreadyCrawled(
          university,
          year,
          config.progressFile
        );
        if (isCrawled) {
          logger.info(`\n⏭️ ${university.name} - Already crawled`);
          continue;
        }

        logger.info(`\n🔄 ${university.name} - Crawling...`);
        await crawlUniversity(page, university, year, config);
      }
    }
    logger.info("🚀🟢 Main loop completed successfully!");
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
