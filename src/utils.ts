import { promises as fs } from "node:fs";
import path from "node:path";
import type { University } from "./types.js";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const getPath = (name: string): string =>
  path.join(path.dirname(__dirname), name);

export const getKeyForUniversity = (
  university: University,
  year: string
): string => `${university.id}|||${university.name}|||${year}`;

export const isAlreadyCrawled = async (
  university: University,
  year: string,
  progressFile: string
): Promise<boolean> => {
  try {
    const progress = await fs.readFile(getPath(progressFile), "utf-8");
    const key = getKeyForUniversity(university, year);
    return progress.includes(key);
  } catch {
    return false;
  }
};

export const markAsCrawled = async (
  university: University,
  year: string,
  progressFile: string
): Promise<void> => {
  const key = getKeyForUniversity(university, year);
  console.log("🖊️ Marking as crawled:", key);
  await fs.appendFile(getPath(progressFile), key + "\n");
};
