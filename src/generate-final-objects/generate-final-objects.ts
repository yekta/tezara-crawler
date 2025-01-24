import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { FinalThesisSchema } from "../clean-json/schema";
import { config } from "dotenv";
import { md5Hash } from "../helpers";
import {
  processKeywords,
  processSubjects,
  writeArrayToJsonFile,
} from "./helpers";
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inputDir = path.join(__dirname, "..", "..", "jsons-cleaned/json");
const outputDir = path.join(__dirname, "..", "..", "jsons-final");

export type Thesis = z.infer<typeof FinalThesisSchema>;
export type KeywordOrSubjectLanguage = "Turkish" | "English";
export type Keyword = {
  keyword: string;
  id: string;
  language: KeywordOrSubjectLanguage;
  thesis_count: number;
  thesis_count_by_year: { [year: string]: number };
};
export type Subject = {
  subject: string;
  id: string;
  language: KeywordOrSubjectLanguage;
  thesis_count: number;
  thesis_count_by_year: { [year: string]: number };
};

async function main(): Promise<void> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const theses: Thesis[] = [];
  const keywords = new Map<string, Keyword>();
  const subjects = new Map<string, Subject>();

  const files = fs.readdirSync(inputDir);
  for (const file of files) {
    const filePath = path.join(inputDir, file);
    const data = fs.readFileSync(filePath, "utf-8");
    const json: Thesis[] = JSON.parse(data);
    theses.push(...json);
    console.log(
      "File loaded:",
      file,
      "| Thesis count:",
      json.length.toLocaleString()
    );
  }

  for (const thesis of theses) {
    processKeywords({
      keywords: thesis.keywords_turkish,
      keywordsMap: keywords,
      thesis,
      language: "Turkish",
    });
    processKeywords({
      keywords: thesis.keywords_english,
      keywordsMap: keywords,
      thesis,
      language: "English",
    });

    processSubjects({
      subjects: thesis.subjects_turkish,
      subjectsMap: subjects,
      thesis,
      language: "Turkish",
    });
    processSubjects({
      subjects: thesis.subjects_english,
      subjectsMap: subjects,
      thesis,
      language: "English",
    });
  }

  // write to json
  writeArrayToJsonFile({
    array: Array.from(subjects.values()).sort(
      (a, b) => b.thesis_count - a.thesis_count
    ),
    fileName: "subjects",
    outputDir,
  });
  writeArrayToJsonFile({
    array: Array.from(keywords.values()).sort(
      (a, b) => b.thesis_count - a.thesis_count
    ),
    fileName: "keywords",
    outputDir,
  });
}

if (process.argv[1] === __filename) {
  main().catch((err) => {
    console.error("Unhandled error in main:", err);
    process.exit(1);
  });
}
