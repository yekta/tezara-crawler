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

export const getUniversityYearKey = ({
  university,
  year,
}: {
  university: University;
  year: string;
}): string => `${university.id}|||${university.name}|||${year}`;

export const getInstituteKey = ({
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
    // Check if we have a university-level entry
    const uniKey = getUniversityYearKey({ university, year });
    if (progress.includes(uniKey)) {
      return true;
    }
    // If not, check for specific institute entry
    const instKey = getInstituteKey({ university, institute, year });
    return progress.includes(instKey);
  } catch {
    return false;
  }
};

export const markUniversityYearAsCrawled = async ({
  university,
  year,
  progressFile,
}: {
  university: University;
  year: string;
  progressFile: string;
}): Promise<void> => {
  const key = getUniversityYearKey({ university, year });
  logger.info(`🖊️ Marking university+year as crawled | ${key}`);
  await fs.appendFile(getPath(progressFile), key + "\n");
};

export const markInstituteAsCrawled = async ({
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
  const key = getInstituteKey({ university, institute, year });
  logger.info(`🖊️ Marking institute as crawled | ${key}`);
  await fs.appendFile(getPath(progressFile), key + "\n");
};
