import { createHash } from "node:crypto";
import { Browser, Puppeteer } from "puppeteer";
import { config } from "./config";

export function cleanUniversity(
  university: string | null | undefined
): string | null {
  if (!university) return null;
  if (university.length < 1) return null;
  return university.startsWith(",") ? university.slice(1) : university;
}

export function cleanAdvisors(
  advisors: string[] | null | undefined
): string[] | null {
  if (!advisors) return null;
  if (advisors.length < 1) return null;
  return advisors.filter((a) => !a.includes("Yer Bilgisi:"));
}

export function md5Hash(data: string) {
  return createHash("md5").update(data).digest("hex");
}

export function chunkArray<T>(array: T[], chunks: number): T[][] {
  const result: T[][] = [];
  const chunkSize = Math.ceil(array.length / chunks);

  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }

  return result;
}

export async function createIsolatedContext(browser: Browser) {
  // Create a new isolated context
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.goto(config.baseUrl);
  return { context, page };
}
