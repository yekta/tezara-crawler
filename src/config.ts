import { CrawlerConfig } from "./types.js";

export const config: CrawlerConfig = {
  baseUrl: "https://tez.yok.gov.tr/UlusalTezMerkezi/tarama.jsp",
  downloadDir: "./downloads",
  progressFile: "progress.txt",
  delayMs: 2000,
  maxRetries: 3,
};
