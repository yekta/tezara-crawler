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

  try {
    const browser = await puppeteer.launch({
      headless: true,
    });
    await mainLoop(browser);
    browser.close();
  } catch (error) {
    logger.error("Fatal error:", error);
    process.exit(1);
  }
};

async function mainLoop(browser: puppeteer.Browser) {
  try {
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
  } catch (error) {
    logger.error("Error in main loop:", error);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    mainLoop(browser);
  }
}

main();
