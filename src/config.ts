import { CrawlerConfig } from "./types.js";

export const config: CrawlerConfig = {
  parallelWorkers: 3,
  baseUrl: "https://tez.yok.gov.tr/UlusalTezMerkezi/tarama.jsp",
  downloadDir: "./downloads",
  logsDir: "./logs",
  progressFile: "progress.txt",
  delayMs: 2000,
  maxRetries: 3,
};
