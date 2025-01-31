import { promises as fs } from "node:fs";
import path from "node:path";
import type { Institute, ThesisType, University } from "./types.js";
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
}): string =>
  `[${university.id}|${university.name.replaceAll(" ", "")}|${year}]`;

export const getThesisTypeKey = ({
  university,
  year,
  thesisType,
}: {
  university: University;
  year: string;
  thesisType: ThesisType;
}): string => {
  return `[${university.id}|${university.name.replaceAll(" ", "")}|${year}|${
    thesisType.id
  }|${thesisType.name.replaceAll(" ", "")}]`;
};

export const getInstituteKey = ({
  university,
  institute,
  thesisType,
  year,
}: {
  university: University;
  institute: Institute;
  thesisType: ThesisType;
  year: string;
}): string => {
  return `[${university.id}|${university.name.replaceAll(" ", "")}|${year}|${
    thesisType.id
  }|${thesisType.name.replaceAll(" ", "")}|${
    institute.id
  }|${institute.name.replaceAll(" ", "")}]`;
};

export function isAlreadyCrawled({
  university,
  institute,
  thesisType,
  year,
  progressFileContent,
}: {
  university: University;
  institute?: Institute;
  thesisType?: ThesisType;
  year: string;
  progressFileContent: string;
}): boolean {
  // Check if we have a university-level entry
  const uniKey = getUniversityYearKey({ university, year });
  if (progressFileContent.includes(uniKey)) {
    return true;
  }

  // If thesis type is provided, check university+thesis_type entry
  if (thesisType) {
    const uniThesisTypeKey = getThesisTypeKey({
      university,
      thesisType,
      year,
    });
    if (progressFileContent.includes(uniThesisTypeKey)) {
      return true;
    }
  }

  // If both institute and thesis type are provided, check for specific institute entry
  if (institute && thesisType) {
    const instKey = getInstituteKey({
      university,
      institute,
      thesisType,
      year,
    });
    return progressFileContent.includes(instKey);
  }

  return false;
}

export async function markUniversityAsCrawled({
  university,
  year,
  progressFile,
}: {
  university: University;
  year: string;
  progressFile: string;
}): Promise<void> {
  const key = getUniversityYearKey({ university, year });
  logger.info(`🖊️ Marking university as crawled | ${key}`);
  await fs.appendFile(getPath(progressFile), key + "\n");
}

export async function markInstituteAsCrawled({
  university,
  institute,
  year,
  thesisType,
  progressFile,
}: {
  university: University;
  institute: Institute;
  thesisType: ThesisType;
  year: string;
  progressFile: string;
}): Promise<void> {
  const key = getInstituteKey({ university, thesisType, institute, year });
  logger.info(
    `🖊️ Marking university+thesis_type+institute as crawled | ${key}`
  );
  await fs.appendFile(getPath(progressFile), key + "\n");
}

export async function markThesisTypeAsCrawled({
  university,
  year,
  thesisType,
  progressFile,
}: {
  university: University;
  year: string;
  thesisType: ThesisType;
  progressFile: string;
}): Promise<void> {
  const key = getThesisTypeKey({ university, year, thesisType });
  logger.info(`🖊️ Marking university+thesis_type as crawled | ${key}`);
  await fs.appendFile(getPath(progressFile), key + "\n");
}
