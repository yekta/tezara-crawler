import { promises as fs } from "node:fs";
import * as puppeteer from "puppeteer";
import { config } from "./config";
import { crawl } from "./crawler";
import { getSubjects, getThesisTypes, getUniversities, getYears } from "./get";
import { logger } from "./logger";
import { getPath } from "./utils";

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
    // if there is no progress file, create one
    try {
      await fs.access(getPath(config.progressFile));
    } catch (error) {
      await fs.writeFile(getPath(config.progressFile), "");
    }

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(config.baseUrl);

    // Get initial data
    const universities = await getUniversities(page);
    const years = await getYears(page);
    const subjects = await getSubjects(page);
    const thesisTypes = await getThesisTypes(page);

    logger.info(
      `Found ${universities.length} universities, ${years.length} years, ${subjects.length} subjects, and ${thesisTypes.length} thesis types.`
    );

    const progressFileContent = await fs.readFile(
      getPath(config.progressFile),
      "utf-8"
    );

    await crawl({
      page,
      universities,
      years,
      subjects,
      thesisTypes,
      progressFileContent,
      config,
    });

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
