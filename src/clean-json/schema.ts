import { z } from "zod";

export const FinalThesisSchema = z.object({
  // Has to be there
  title_original: z.string().nonempty(),
  author: z.string().nonempty(),
  advisors: z.array(z.string()),
  university: z.string().nonempty(),
  institute: z.string().nonempty(),
  detail_id_1: z.string().nonempty(),
  detail_id_2: z.string().nonempty(),
  year: z.number().min(1),
  thesis_type: z.string().nonempty(),
  language: z.string().nonempty(),
  subjects_turkish: z.array(z.string()),
  subjects_english: z.array(z.string()),
  keywords_turkish: z.array(z.string()),
  keywords_english: z.array(z.string()),

  // Can be null
  title_translated: z.string().nonempty().nullable(),
  abstract_original: z.string().nonempty().nullable(),
  abstract_translated: z.string().nonempty().nullable(),
  pages: z.number().min(1).nullable(),
  pdf_url: z.string().nonempty().nullable(),
  department: z.string().nonempty().nullable(),
  branch: z.string().nonempty().nullable(),
});
