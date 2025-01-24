import { md5Hash } from "../helpers";
import {
  Keyword,
  KeywordOrSubjectLanguage,
  Subject,
  Thesis,
} from "./generate-final-objects";
import fs from "node:fs";
import path from "node:path";

export function writeArrayToJsonFile<T>({
  array,
  fileName,
  outputDir,
}: {
  array: T[];
  fileName: string;
  outputDir: string;
}) {
  console.log(
    `\nSize of "${fileName}" array: ${array.length.toLocaleString()}`
  );
  const finalPath = path.join(outputDir, `${fileName}.json`);
  fs.writeFileSync(finalPath, JSON.stringify(array, null, 2));
  console.log(`🟢 Saved file to: ${finalPath}`);
}

export function processKeywords({
  keywords,
  keywordsMap,
  thesis,
  language,
}: {
  keywords: string[];
  keywordsMap: Map<string, Keyword>;
  thesis: Thesis;
  language: KeywordOrSubjectLanguage;
}) {
  for (const keyword of keywords) {
    const obj = keywordsMap.get(keyword);
    processKeyword({
      keyword,
      keywordObject: obj,
      keywordsMap,
      thesis,
      language,
    });
  }
}

export function processKeyword({
  keyword,
  keywordObject,
  keywordsMap,
  thesis,
  language,
}: {
  keyword: string;
  keywordObject: Keyword | undefined;
  keywordsMap: Map<string, Keyword>;
  thesis: Thesis;
  language: KeywordOrSubjectLanguage;
}) {
  if (keywordObject) {
    keywordObject.thesis_count++;
    if (keywordObject.thesis_count_by_year[thesis.year]) {
      keywordObject.thesis_count_by_year[thesis.year]++;
    } else {
      keywordObject.thesis_count_by_year[thesis.year] = 1;
    }
  } else {
    keywordsMap.set(keyword, {
      keyword,
      id: md5Hash(keyword),
      language: language,
      thesis_count: 1,
      thesis_count_by_year: { [thesis.year]: 1 },
    });
  }
}

export function processSubjects({
  subjects,
  subjectsMap,
  thesis,
  language,
}: {
  subjects: string[];
  subjectsMap: Map<string, Subject>;
  thesis: Thesis;
  language: KeywordOrSubjectLanguage;
}) {
  for (const subject of subjects) {
    const obj = subjectsMap.get(subject);
    processSubject({
      subject,
      subjectObject: obj,
      subjectsMap,
      thesis,
      language,
    });
  }
}

export function processSubject({
  subject,
  subjectObject,
  subjectsMap,
  thesis,
  language,
}: {
  subject: string;
  subjectObject: Subject | undefined;
  subjectsMap: Map<string, Subject>;
  thesis: Thesis;
  language: KeywordOrSubjectLanguage;
}) {
  if (subjectObject) {
    subjectObject.thesis_count++;
    if (subjectObject.thesis_count_by_year[thesis.year]) {
      subjectObject.thesis_count_by_year[thesis.year]++;
    } else {
      subjectObject.thesis_count_by_year[thesis.year] = 1;
    }
  } else {
    subjectsMap.set(subject, {
      subject,
      id: md5Hash(subject),
      language: language,
      thesis_count: 1,
      thesis_count_by_year: { [thesis.year]: 1 },
    });
  }
}
