export interface University {
  id: string;
  name: string;
}

export interface CrawlerConfig {
  baseUrl: string;
  downloadDir: string;
  logsDir: string;
  progressFile: string;
  delayMs: number;
  maxRetries: number;
}
