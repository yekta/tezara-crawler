import { promises as fs } from "node:fs";
import path from "node:path";
import type { Page } from "puppeteer";
import type { CrawlerConfig, University } from "./types.js";
import {
  getDownloadPath,
  markAsCrawled,
  sanitizeFilename,
  sleep,
} from "./utils";
import { config } from "./config.js";

export const getUniversities = async (page: Page): Promise<University[]> => {
  console.log("🎓 Fetching list of universities...");

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

  console.log("Popup opened, waiting for content...");
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

  console.log(`Found ${universities.length} universities.`);
  await popup.close();
  return universities;
};

export const selectUniversity = async (
  page: Page,
  university: University
): Promise<void> => {
  console.log(
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
  console.log(`📅 Getting available years...`);
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

export const crawlUniversitiesByYear = async (
  page: Page,
  universities: University[],
  config: CrawlerConfig
): Promise<void> => {
  console.log("🎓 Starting year-by-year crawl...");

  // Get all unique years available across all universities
  const allYearsSet = new Set<string>();

  for (const university of universities) {
    await selectUniversity(page, university);
    const years = await getYears(page);
    years.forEach((year) => allYearsSet.add(year));
  }

  // Convert to array and sort in descending order (newest first)
  const allYears = Array.from(allYearsSet).sort(
    (a, b) => parseInt(b) - parseInt(a)
  );

  // Process universities year by year, starting with the most recent
  for (const year of allYears) {
    console.log(`📅 Processing year ${year} for all universities...`);

    for (const university of universities) {
      try {
        // Check if we've already crawled this combination
        const filename = `${sanitizeFilename(
          `${university.name}-${year}`
        )}.html`;
        const filepath = path.join(
          getDownloadPath(config.downloadDir),
          filename
        );

        try {
          await fs.access(filepath);
          console.log(
            `Already crawled ${university.name} for year ${year}, skipping...`
          );
          continue;
        } catch {
          // File doesn't exist, proceed with crawling
        }

        await selectUniversity(page, university);
        await crawlUniversity(page, university, year, config);
      } catch (error) {
        console.error(
          `Error processing ${university.name} - Year: ${year}`,
          error
        );
      }
    }

    // Optional: Add a small delay between years to prevent overwhelming the server
    await sleep(1000);
  }

  console.log("🎉 Year-by-year crawl complete.");
};

export const crawlUniversity = async (
  page: Page,
  university: University,
  year: string,
  config: CrawlerConfig
): Promise<void> => {
  console.log(`🎓 Crawling ${university.name} for year ${year}`);
  try {
    const html = await searchTheses(page, university, year);
    if (html) {
      const filename = `${sanitizeFilename(`${university.name}-${year}`)}.html`;
      const filepath = path.join(getDownloadPath(config.downloadDir), filename);
      await fs.writeFile(filepath, html);
      await markAsCrawled(university, year, config.progressFile);
    }
  } catch (error) {
    console.error(`Error crawling ${university.name} for year ${year}`, error);
  }
};

export const searchTheses = async (
  page: Page,
  university: University,
  year: string
): Promise<string> => {
  console.log(`🔎 Searching theses for ${university.name}, Year: ${year}`);
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

  await page.waitForNavigation({
    waitUntil: "domcontentloaded",
    timeout: 5000,
  });

  return page.content();
};
