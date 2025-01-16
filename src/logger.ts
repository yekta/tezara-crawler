import fs from "node:fs";
import path from "node:path";
import { getPath } from "./utils";
import { config } from "./config";

const now = new Date().toISOString();

const logToFile = (message: string) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  const logsPath = getPath(config.logsDir);
  const logFilePath = path.join(logsPath, `${now}.txt`);
  fs.appendFileSync(logFilePath, logMessage, { encoding: "utf8" });
};

export const logger = {
  info: (...props: Parameters<typeof console.info>) => {
    console.log(...props);
    logToFile(`INFO: ${props.join(" ")}`);
  },
  warn: (...props: Parameters<typeof console.warn>) => {
    console.warn(...props);
    logToFile(`WARN: ${props.join(" ")}`);
  },
  error: (...props: Parameters<typeof console.info>) => {
    console.error(...props);
    logToFile(`ERROR: ${props.join(" ")}`);
  },
};
