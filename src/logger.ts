import fs from "node:fs";
import path from "node:path";

const now = new Date().toISOString();
const logFilePath = path.resolve(`logs-${now}.txt`);

const logToFile = (message: string) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
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
