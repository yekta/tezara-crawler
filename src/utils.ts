import { promises as fs } from "node:fs";
import path from "node:path";
import type { Institute, University } from "./types.js";
import { fileURLToPath } from "node:url";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const getPath = (name: string): string =>
  path.join(path.dirname(__dirname), name);

export const getKey = ({
  university,
  institute,
  year,
}: {
  university: University;
  institute: Institute;
  year: string;
}): string =>
  `${university.id}|||${university.name}|||${institute.id}|||${institute.name}|||${year}`;

export const isAlreadyCrawled = async ({
  university,
  institute,
  year,
  progressFile,
}: {
  university: University;
  institute: Institute;
  year: string;
  progressFile: string;
}): Promise<boolean> => {
  try {
    const progress = await fs.readFile(getPath(progressFile), "utf-8");
    const key = getKey({ university, institute, year });
    return progress.includes(key);
  } catch {
    return false;
  }
};

export const markAsCrawled = async ({
  university,
  institute,
  year,
  progressFile,
}: {
  university: University;
  institute: Institute;
  year: string;
  progressFile: string;
}): Promise<void> => {
  const key = getKey({ university, institute, year });
  logger.info(`🖊️ Marking as crawled | ${key}`);
  await fs.appendFile(getPath(progressFile), key + "\n");
};
