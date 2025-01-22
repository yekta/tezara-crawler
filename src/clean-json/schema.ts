import { z } from "zod";

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

export const FinalThesisSchema = z.object({
  // Has to be there
  title_original: z.string().nonempty(),
  author: z.string().nonempty(),
  advisors: z.array(z.string()).nonempty(),
  university: z.string().nonempty(),
  institute: z.string().nonempty(),
  detail_id_1: z.string().nonempty(),
  detail_id_2: z.string().nonempty(),
  year: z.number().min(1),
  thesis_type: z.string().nonempty(),
  language: z.string().nonempty(),
  subjects_turkish: z.array(z.string().nonempty()),
  subjects_english: z.array(z.string().nonempty()),
  keywords_turkish: z.array(z.string().nonempty()),
  keywords_english: z.array(z.string().nonempty()),

  // Can be null
  title_translated: z.string().nullable(),
  abstract_original: z.string().nullable(),
  abstract_translated: z.string().nullable(),
  pages: z.number().min(1).nullable(),
  pdf_url: z.string().nullable(),
  department: z.string().nullable(),
  branch: z.string().nullable(),
});
