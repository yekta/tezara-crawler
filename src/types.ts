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

export type Thesis = {
  thesis_id: string | null;
  id_1: string | null;
  id_2: string | null;
  name: string | null;
  year: string | null;
  title_original: string | null;
  title_translated: string | null;
  university: string | null;
  language: string | null;
  thesis_type: string | null;
  subjects_turkish: string[] | null;
  subjects_english: string[] | null;
};

export type Extention = {
  tez_no: number | null;
  pdf_url: string | null;
  advisors: string[] | null;
  pages: number | null;
  abstract_original: string | null;
  abstract_translated: string | null;
  keywords_turkish: string[] | null;
  keywords_english: string[] | null;
  status: string | null;
  institute: string | null;
  department: string | null;
  branch: string | null;
};

export type ThesisExtended = Omit<Thesis, "thesis_id" | "year"> &
  Extention & {
    thesis_id: number | null;
    year: number | null;
  };
