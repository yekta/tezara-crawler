export type University = {
  id: string;
  name: string;
};

export type Subject = {
  id: string;
  name: string;
};

export type ThesisType = {
  id: string;
  name: string;
};

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
  id_1: string | null; // DONE
  id_2: string | null; // DONE
  name: string | null; // DONE
  year: string | null; // DONE
  title_original: string | null; // DONE
  title_translated: string | null; // DONE
  university: string | null; // DONE
  language: string | null; // DONE
  thesis_type: string | null; // DONE
  subjects_turkish: string[] | null;
  subjects_english: string[] | null;
};

export type Extention = {
  tez_no: number | null; // NOT NEEDED
  pdf_url: string | null; // DONE
  advisors: string[] | null; // DONE
  pages: number | null; // DONE
  abstract_original: string | null; // DONE
  abstract_translated: string | null; // DONE
  keywords_turkish: string[] | null;
  keywords_english: string[] | null;
  status: string | null; // NOT NEEDED
  institute: string | null; // DONE
  department: string | null; // DONE
  branch: string | null; // DONE
};

export type ThesisExtended = Omit<Thesis, "thesis_id" | "year"> &
  Extention & {
    thesis_id: number | null;
    year: number | null;
  };
