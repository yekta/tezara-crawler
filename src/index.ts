import { promises as fs } from "node:fs";
import * as puppeteer from "puppeteer";
import { config } from "./config";
import {
  crawlCombination,
  getInstitutes,
  getThesisTypes,
  getUniversities,
  getYears,
} from "./crawler";
import { logger } from "./logger";
import type { University } from "./types";
import {
  getPath,
  isAlreadyCrawled,
  getUniversityYearKey,
  getUniversityYearThesisTypeKey,
} from "./utils";

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
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(config.baseUrl);

    // Get initial data
    const universities = await getUniversities(page);
    const institutes = await getInstitutes(page);
    const years = await getYears(page);
    const thesisTypes = await getThesisTypes(page);

    logger.info(
      `Found ${universities.length} universities, ${institutes.length} institutes, ${thesisTypes.length} thesis types, and ${years.length} years`
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
      const progress = await fs.readFile(getPath(config.progressFile), "utf-8");

      // First check if university+year is already done (fastest check)
      const uniYearKey = getUniversityYearKey({
        university: combo.university,
        year: combo.year,
      });

      if (progress.includes(uniYearKey)) {
        logger.info(
          `\n⏭️ Already crawled at university level | ${combo.university.name} | ${combo.year}`
        );
        continue;
      }

      // Get uncrawled thesis types
      const uncrawledThesisTypes = thesisTypes.filter((thesisType) => {
        const thesisTypeKey = getUniversityYearThesisTypeKey({
          university: combo.university,
          year: combo.year,
          thesisType,
        });
        return !progress.includes(thesisTypeKey);
      });

      if (uncrawledThesisTypes.length === 0) {
        logger.info(
          `\n⏭️ Already crawled all thesis types | ${combo.university.name} | ${combo.year}`
        );
        continue;
      }

      // For each uncrawled thesis type, check which institutes need crawling
      const workItems = [];
      for (const thesisType of uncrawledThesisTypes) {
        const uncrawledInstitutes = [];
        for (const institute of institutes) {
          const isCrawled = await isAlreadyCrawled({
            university: combo.university,
            institute,
            thesisType,
            year: combo.year,
            progressFile: config.progressFile,
          });
          if (!isCrawled) {
            uncrawledInstitutes.push(institute);
          }
        }
        if (uncrawledInstitutes.length > 0) {
          workItems.push({
            thesisType,
            institutes: uncrawledInstitutes,
          });
        }
      }

      if (workItems.length === 0) {
        logger.info(
          `\n⏭️ Already crawled all institute combinations | ${combo.university.name} | ${combo.year}`
        );
        continue;
      }

      logger.info(
        `\n🔄 Processing: ${combo.university.name} | ${combo.year} | ${workItems.length} thesis types with uncrawled institutes`
      );

      // Pass the work items to crawlCombination
      await crawlCombination({
        page,
        university: combo.university,
        year: combo.year,
        config,
        thesisTypes: uncrawledThesisTypes,
        institutes: workItems.flatMap((item) => item.institutes),
      });
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
