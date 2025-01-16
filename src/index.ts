import { promises as fs } from "node:fs";
import * as puppeteer from "puppeteer";
import { config } from "./config.js";
import { getUniversities, getYears, crawlUniversity } from "./crawler";
import { getDownloadPath, isAlreadyCrawled } from "./utils";

const main = async () => {
  console.log("Starting crawler...");
  try {
    // Create downloads directory
    await fs.mkdir(getDownloadPath(config.downloadDir), { recursive: true });

    const browser = await puppeteer.launch({
      headless: false,
    });

    try {
      const page = await browser.newPage();
      await page.goto(config.baseUrl);

      const universities = await getUniversities(page);
      const years = await getYears(page);

      for (const university of universities) {
        for (const year of years) {
          if (await isAlreadyCrawled(university, year, config.progressFile)) {
            console.log(
              `Skipping ${university.name} - ${year} (already crawled)`
            );
            continue;
          }

          console.log(`Crawling ${university.name} - ${year}...`);
          await crawlUniversity(page, university, year, config);
        }
      }
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
};

main();
