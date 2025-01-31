import { Page } from "puppeteer";
import { MIN_YEAR } from "./crawler";
import { logger } from "./logger";
import { ThesisType, University } from "./types";

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

export async function getSubjects(page: Page): Promise<University[]> {
  logger.info("🗂️ Fetching list of subjects...");

  const [popup] = await Promise.all([
    new Promise<Page | null>((resolve) =>
      page.browser().once("targetcreated", async (target) => {
        const newPage = await target.page();
        resolve(newPage);
      })
    ),
    page.click('img[onclick="konuEkle();"]'),
  ]);

  if (!popup) {
    throw new Error("Failed to open subject selection popup");
  }

  logger.info("Popup opened, waiting for content...");
  await popup.waitForSelector("table#sf", { timeout: 10000 });

  const subjects = await popup.$$eval('a[href*="eklecikar"]', (links) =>
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

  logger.info(`Found ${subjects.length} subjects.`);
  await popup.close();
  return subjects;
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
