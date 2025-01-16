import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { University } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const sanitizeFilename = (filename: string): string =>
  filename.replace(/[^a-z0-9]/gi, "_").toLowerCase();

export const getProgressFilePath = (progressFile: string): string =>
  path.join(path.dirname(__dirname), progressFile);

export const getDownloadPath = (downloadDir: string): string =>
  path.join(path.dirname(__dirname), downloadDir);

export const isAlreadyCrawled = async (
  university: University,
  year: string,
  progressFile: string
): Promise<boolean> => {
  try {
    const progress = await fs.readFile(
      getProgressFilePath(progressFile),
      "utf-8"
    );
    return progress.includes(`${university.id} - ${year}`);
  } catch {
    return false;
  }
};

export const markAsCrawled = async (
  university: University,
  year: string,
  progressFile: string
): Promise<void> => {
  await fs.appendFile(
    getProgressFilePath(progressFile),
    `${university.id} - ${year}\n`
  );
};
