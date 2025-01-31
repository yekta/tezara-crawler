import { promises as fs } from "node:fs";
import path from "node:path";
import type { Subject, University } from "./types.js";
import { fileURLToPath } from "node:url";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const getPath = (name: string): string =>
  path.join(path.dirname(__dirname), name);

export function getUniversityKey({
  university,
  year,
}: {
  university: University;
  year: string;
}): string {
  return `[${university.id}|${university.name.replaceAll(" ", "")}|${year}]`;
}

export function getSubjectKey({
  university,
  subject,
  year,
}: {
  university: University;
  subject: Subject;
  year: string;
}): string {
  return `[${university.id}|${university.name.replaceAll(" ", "")}|${year}|${
    subject.id
  }|${subject.name.replaceAll(" ", "")}]`;
}

export function isAlreadyCrawled({
  university,
  year,
  subject,
  progressFileContent,
}: {
  university: University;
  year: string;
  subject?: Subject;
  progressFileContent: string;
}): boolean {
  // Check if we have a university-level entry
  const uniKey = getUniversityKey({ university, year });
  if (progressFileContent.includes(uniKey)) {
    return true;
  }

  // Check if we have a subject-level entry
  if (subject) {
    const subjectKey = getSubjectKey({ university, subject, year });
    if (progressFileContent.includes(subjectKey)) {
      return true;
    }
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
  const key = getUniversityKey({ university, year });
  logger.info(`🖊️ Marking university as crawled | ${key}`);
  await fs.appendFile(getPath(progressFile), key + "\n");
}

export async function markSubjectAsCrawled({
  university,
  subject,
  year,
  progressFile,
}: {
  university: University;
  subject: Subject;
  year: string;
  progressFile: string;
}): Promise<void> {
  const key = getSubjectKey({ university, subject, year });
  logger.info(`🖊️ Marking subject as crawled | ${key}`);
  await fs.appendFile(getPath(progressFile), key + "\n");
}
