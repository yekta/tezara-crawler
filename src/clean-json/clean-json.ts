import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { ThesisExtended } from "../types";
import { FinalThesisSchema } from "./schema";
import { z } from "zod";
import {
  cleanAfter,
  createOrAppendToFile,
  includesAll,
  parseNumberedStringAsList,
  replaceCharacters,
  splitBy,
} from "./helpers";
import {
  cleanKeywords,
  cleanWordsWithSplit,
  splitArrayIntoBeforeAndAfter,
} from "./clean-keywords";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(batchSize = 100): Promise<void> {
  try {
    const inputDir = path.join(__dirname, "..", "..", "jsons-extended");
    const outputDir = path.join(__dirname, "..", "..", "jsons-cleaned");

    if (!fs.existsSync(inputDir)) {
      throw new Error(`Directory not found: ${inputDir}`);
    }

    const jsonFiles = fs
      .readdirSync(inputDir)
      .filter((file) => file.toLowerCase().endsWith(".json"));

    console.log(`Found ${jsonFiles.length} JSON files in input.`);

    let processedFileCount = 0;
    let grandTotalProblems = 0;

    const universities = new Set<string>();
    const institutes = new Set<string>();
    const departments = new Set<string>();
    const branches = new Set<string>();
    const thesisTypes = new Set<string>();
    const languages = new Set<string>();
    const pageCounts = new Set<string>();
    const years = new Set<string>();

    for (let i = 0; i < jsonFiles.length; i += batchSize) {
      console.log(
        `Processing batch: ${i.toLocaleString()} to ${(
          i + batchSize
        ).toLocaleString()}`
      );
      const {
        fileCount,
        totalProblems,
        universities: universitiesBatch,
        institutes: institutesBatch,
        departments: departmentsBatch,
        branches: branchesBatch,
        thesisTypes: thesisTypesBatch,
        languages: languagesBatch,
        pageCounts: pageCountsBatch,
        years: yearsBatch,
      } = processBatch({
        files: jsonFiles.slice(i, i + batchSize),
        inputDir,
        outputDir,
      });

      universitiesBatch.forEach((u) => universities.add(u));
      institutesBatch.forEach((i) => institutes.add(i));
      departmentsBatch.forEach((d) => departments.add(d));
      branchesBatch.forEach((b) => branches.add(b));
      thesisTypesBatch.forEach((t) => thesisTypes.add(t));
      languagesBatch.forEach((l) => languages.add(l));
      pageCountsBatch.forEach((p) => pageCounts.add(p));
      yearsBatch.forEach((y) => years.add(y));

      grandTotalProblems += totalProblems;
      processedFileCount += fileCount;

      console.log(
        `Finished processing batch: ${i.toLocaleString()}-${(
          i + batchSize
        ).toLocaleString()}`
      );
    }

    const universitiesFilePath = path.join(
      outputDir,
      "txt",
      "universities.txt"
    );
    createOrAppendToFile({
      data: Array.from(universities),
      path: universitiesFilePath,
    });

    const institutesFilePath = path.join(outputDir, "txt", "institutes.txt");
    createOrAppendToFile({
      data: Array.from(institutes),
      path: institutesFilePath,
    });

    const departmentsFilePath = path.join(outputDir, "txt", "departments.txt");
    createOrAppendToFile({
      data: Array.from(departments),
      path: departmentsFilePath,
    });

    const branchesFilePath = path.join(outputDir, "txt", "branches.txt");
    createOrAppendToFile({
      data: Array.from(branches),
      path: branchesFilePath,
    });

    const thesisTypesFilePath = path.join(outputDir, "txt", "thesis_types.txt");
    createOrAppendToFile({
      data: Array.from(thesisTypes),
      path: thesisTypesFilePath,
    });

    const languagesFilePath = path.join(outputDir, "txt", "languages.txt");
    createOrAppendToFile({
      data: Array.from(languages),
      path: languagesFilePath,
    });

    const pageCountsFilePath = path.join(outputDir, "txt", "page_counts.txt");
    createOrAppendToFile({
      data: Array.from(pageCounts),
      path: pageCountsFilePath,
    });

    const yearsFilePath = path.join(outputDir, "txt", "years.txt");
    createOrAppendToFile({
      data: Array.from(years),
      path: yearsFilePath,
    });

    console.info(
      `\n\n\n🟢 Processed ${processedFileCount.toLocaleString()} thesis records from input.`
    );
    console.log(
      `🟢 Total problems fixed: ${grandTotalProblems.toLocaleString()}`
    );

    console.info(
      `✅ Finished cleaning theses. Output files are in ${outputDir}`
    );
  } catch (err) {
    console.error("Error in main():", err);
  }
}

function processBatch({
  files,
  inputDir,
  outputDir,
}: {
  files: string[];
  inputDir: string;
  outputDir: string;
}) {
  const allTheses: ThesisExtended[] = [];
  let totalProblems = 0;
  for (const file of files) {
    const filePath = path.join(inputDir, file);
    const rawData = fs.readFileSync(filePath, "utf-8");
    const data: ThesisExtended[] = JSON.parse(rawData);
    allTheses.push(...data);
  }

  const cleanedAllTheses: z.infer<typeof FinalThesisSchema>[] = [];

  for (let i = 0; i < allTheses.length; i++) {
    const { thesis, problemsCount } = cleanThesis(allTheses[i]);
    cleanedAllTheses.push(thesis);
    totalProblems += problemsCount;
  }

  const authors = new Set<string>();
  const advisors = new Set<string>();
  const titles = new Set<string>();
  const translatedTitles = new Set<string>();
  const pdfUrls = new Set<string>();
  const detailIds = new Set<string>();
  const subjectsTurkish = new Set<string>();
  const subjectsEnglish = new Set<string>();
  const keywordsTurkish = new Set<string>();
  const keywordsEnglish = new Set<string>();

  // These are the batch specific sets that don't write to txt
  const universities = new Set<string>();
  const institutes = new Set<string>();
  const departments = new Set<string>();
  const branches = new Set<string>();
  const thesisTypes = new Set<string>();
  const languages = new Set<string>();
  const pageCounts = new Set<string>();
  const years = new Set<string>();

  cleanedAllTheses.forEach((thesis) => {
    authors.add(thesis.author);
    thesis.advisors.forEach((a) => advisors.add(a));
    titles.add(thesis.title_original);
    if (thesis.title_translated) {
      translatedTitles.add(thesis.title_translated);
    }
    if (thesis.pdf_url) {
      pdfUrls.add(thesis.pdf_url);
    }

    //
    universities.add(thesis.university);
    institutes.add(thesis.institute);
    if (thesis.department) {
      departments.add(thesis.department);
    }
    if (thesis.branch) {
      branches.add(thesis.branch);
    }
    thesisTypes.add(thesis.thesis_type);
    languages.add(thesis.language);
    if (thesis.page_count) {
      pageCounts.add(thesis.page_count.toString());
    }
    years.add(thesis.year.toString());

    detailIds.add(`${thesis.detail_id_1} ||| ${thesis.detail_id_2}`);

    if (thesis.subjects_turkish && thesis.subjects_turkish.length > 0) {
      subjectsTurkish.add(thesis.subjects_turkish.join(" ||| "));
    }
    if (thesis.subjects_english && thesis.subjects_english.length > 0) {
      subjectsEnglish.add(thesis.subjects_english.join(" ||| "));
    }
    if (thesis.keywords_turkish && thesis.keywords_turkish.length > 0) {
      keywordsTurkish.add(thesis.keywords_turkish.join(" ||| "));
    }
    if (thesis.keywords_english && thesis.keywords_english.length > 0) {
      keywordsEnglish.add(thesis.keywords_english.join(" ||| "));
    }
  });

  const authorsFilePath = path.join(outputDir, "txt", "authors.txt");
  createOrAppendToFile({ path: authorsFilePath, data: Array.from(authors) });

  const advisorsFilePath = path.join(outputDir, "txt", "advisors.txt");
  createOrAppendToFile({ path: advisorsFilePath, data: Array.from(advisors) });

  const titlesFilePath = path.join(outputDir, "txt", "titles.txt");
  createOrAppendToFile({ path: titlesFilePath, data: Array.from(titles) });

  const translatedTitlesFilePath = path.join(
    outputDir,
    "txt",
    "translated_titles.txt"
  );
  createOrAppendToFile({
    path: translatedTitlesFilePath,
    data: Array.from(translatedTitles),
  });

  const pdfUrlsFilePath = path.join(outputDir, "txt", "pdf_urls.txt");
  createOrAppendToFile({ path: pdfUrlsFilePath, data: Array.from(pdfUrls) });

  const detailIdsFilePath = path.join(outputDir, "txt", "detail_ids.txt");
  createOrAppendToFile({
    path: detailIdsFilePath,
    data: Array.from(detailIds),
  });

  const subjectsTurkishFilePath = path.join(
    outputDir,
    "txt",
    "subjects_turkish.txt"
  );
  createOrAppendToFile({
    path: subjectsTurkishFilePath,
    data: Array.from(subjectsTurkish),
  });

  const subjectsEnglishFilePath = path.join(
    outputDir,
    "txt",
    "subjects_english.txt"
  );
  createOrAppendToFile({
    path: subjectsEnglishFilePath,
    data: Array.from(subjectsEnglish),
  });

  const keywordsTurkishFilePath = path.join(
    outputDir,
    "txt",
    "keywords_turkish.txt"
  );
  createOrAppendToFile({
    path: keywordsTurkishFilePath,
    data: Array.from(keywordsTurkish),
  });

  const keywordsEnglishFilePath = path.join(
    outputDir,
    "txt",
    "keywords_english.txt"
  );
  createOrAppendToFile({
    path: keywordsEnglishFilePath,
    data: Array.from(keywordsEnglish),
  });

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Processed ${allTheses.length.toLocaleString()} theses.`);
  console.log(`Problem count for the batch: ${totalProblems.toLocaleString()}`);
  return {
    fileCount: cleanedAllTheses.length,
    totalProblems,
    universities,
    institutes,
    departments,
    branches,
    thesisTypes,
    languages,
    pageCounts,
    years,
  };
}

function cleanThesis(thesis: ThesisExtended) {
  let problemsCount = 0;
  if (thesis.name?.includes("<")) {
    console.log("🟡 Author includes '<'  :", thesis.name);
    thesis.name = thesis.name.slice(1);
    console.log("🟢 Author after cleaning:", `"${thesis.name}"`);
    problemsCount++;
  }

  const startsWithNumberRegex = /^\d/;
  if (thesis.name && startsWithNumberRegex.test(thesis.name)) {
    console.log("🟡 Author starts with a number:", thesis.name);
    thesis.name = thesis.name.replace(/^\d+/, "");
    thesis.name = thesis.name.trim();
    console.log("🟢 Author after cleaning:", `"${thesis.name}"`);
    problemsCount++;
  }

  if (!thesis.name) {
    console.log("🔴 Author is missing:", thesis.name);
    problemsCount++;
  }

  // there is a url like this in the name, replace it
  // http://172.16.3.193:8102/UlusalTezMerkezi/YonetimPaneli/tezDetay.jsp?sira=1427
  const urlRegex = /http.*UlusalTezMerkezi.*?(?=\s|$)/g;
  if (thesis.name && urlRegex.test(thesis.name)) {
    console.log("🟡 Author includes a URL:", thesis.name);
    thesis.name = thesis.name.replace(urlRegex, "");
    thesis.name = thesis.name.trim();
    console.log("🟢 Author after cleaning:", `"${thesis.name}"`);
    problemsCount++;
  }

  // replace all double+ spaces with single space
  if (thesis.name) {
    thesis.name = thesis.name.replace(/\s{2,}/g, " ");
  }

  if (thesis.name) {
    thesis.name = thesis.name.trim();
  }

  if (!thesis.title_original) {
    if (!thesis.title_translated) {
      console.log(
        "🔴 Title original and translated are missing:",
        thesis.thesis_id
      );
    } else {
      console.log(
        "🟡 Title original is missing:",
        thesis.title_original,
        thesis.title_translated,
        thesis.thesis_id
      );
      thesis.title_original = thesis.title_translated;
      thesis.title_original = thesis.title_original.trim();
      console.log(
        "🟢 Title original after cleaning:",
        `"${thesis.title_original}"`
      );
    }
    problemsCount++;
  }

  const invisibleCharRegex = /‎/g;

  if (thesis.title_original && invisibleCharRegex.test(thesis.title_original)) {
    console.log(
      "🟡 Title includes invisible character [U+200E]:",
      thesis.title_original
    );
    thesis.title_original = thesis.title_original.replace(
      invisibleCharRegex,
      ""
    );
    console.log("🟢 Title after cleaning:", `"${thesis.title_original}"`);
    problemsCount++;
  }

  if (
    thesis.title_translated &&
    invisibleCharRegex.test(thesis.title_translated)
  ) {
    console.log(
      "🟡 Translated title includes invisible character [U+200E]:",
      thesis.title_translated
    );
    thesis.title_translated = thesis.title_translated.replace(
      invisibleCharRegex,
      ""
    );
    console.log(
      "🟢 Translated title after cleaning:",
      `"${thesis.title_translated}"`
    );
    thesis.title_translated;
  }

  if (thesis.title_original) {
    thesis.title_original = thesis.title_original.trim();
  }

  if (thesis.title_translated) {
    thesis.title_translated = thesis.title_translated.trim();
  }

  if (!thesis.university) {
    console.log("🔴 University is missing:", thesis.university);
    problemsCount++;
  }
  if (thesis.university && thesis.university.startsWith(",")) {
    console.log("🟡 University starts with a comma:", thesis.university);
    thesis.university = thesis.university.slice(1);
    problemsCount++;
    console.log("🟢 University after cleaning:", `"${thesis.university}"`);
  }
  if (thesis.university) {
    thesis.university = thesis.university.trim();
  }

  if (!thesis.institute) {
    console.log("🔴 Institute is missing:", thesis.institute);
    problemsCount++;
  }
  if (thesis.institute?.includes(")") && !thesis.institute?.includes("(")) {
    console.log("🟡 Institute includes ')' but not '(':", thesis.institute);
    thesis.institute = thesis.institute.replace(")", "");
    problemsCount++;
    console.log("🟢 Institute after cleaning:", `"${thesis.institute}"`);
  }
  if (thesis.institute) {
    thesis.institute = thesis.institute.trim();
  }

  if (thesis.branch) {
    thesis.branch = thesis.branch.trim();
  }

  if (thesis.department) {
    thesis.department = thesis.department.trim();
  }

  if (
    thesis.advisors &&
    thesis.advisors.some((a) => a.includes("Yer Bilgisi:"))
  ) {
    /* console.log(
      "\n\n🟡 Advisors include 'Yer Bilgisi:'",
      thesis.advisors,
      `\nUniversity: ${thesis.university}`,
      `\nInstitute: ${thesis.institute}`,
      `\nDepartment: ${thesis.department}`,
      `\nBranch: ${thesis.branch}`,
      `\nThesis ID: ${thesis.thesis_id}`
    ); */
    thesis.advisors = thesis.advisors
      .filter((a) => !a.includes("Yer Bilgisi:"))
      .map((a) => a.trim());
    problemsCount++;
  }
  if (thesis.advisors && thesis.advisors.some((a) => a.startsWith("null "))) {
    /* console.log("🟡 Advisors include 'null '", thesis.advisors); */
    thesis.advisors = thesis.advisors.map((a) => a.slice(5));
    thesis.advisors = thesis.advisors.map((a) => a.trim());
    problemsCount++;
  }
  if (!thesis.advisors || thesis.advisors.length < 1) {
    /* console.log("🟡 Advisors is missing:", thesis.thesis_id); */
    thesis.advisors = [];
    problemsCount++;
  }
  if (!thesis.id_1) {
    console.log("🔴 ID_1 is missing:", thesis.thesis_id);
    problemsCount++;
  }
  if (!thesis.id_2) {
    console.log("🔴 ID_2 is missing:", thesis.thesis_id);
    problemsCount++;
  }
  if (!thesis.year) {
    console.log("🔴 Year is missing:", thesis.thesis_id);
    problemsCount++;
  }
  if (!thesis.thesis_type) {
    console.log("🔴 Thesis type is missing:", thesis.thesis_id);
    problemsCount++;
  }
  if (!thesis.language) {
    console.log("🔴 Language is missing:", thesis.thesis_id);
    problemsCount++;
  }

  if (thesis.keywords_turkish) {
    thesis.keywords_turkish = cleanKeywords({
      keywords: thesis.keywords_turkish,
    });
    thesis.keywords_turkish = cleanWordsWithSplit({
      input: thesis.keywords_turkish,
    });
    const { beforeSplit, afterSplit } = splitArrayIntoBeforeAndAfter({
      input: thesis.keywords_turkish,
    });
    if (beforeSplit.length > 0 && afterSplit.length > 0) {
      thesis.keywords_turkish = beforeSplit
        .map((s) => s.trim())
        .filter((s) => s);
      thesis.keywords_english = afterSplit
        .map((s) => s.trim())
        .filter((s) => s);
    }
  }

  if (thesis.keywords_english) {
    thesis.keywords_english = cleanKeywords({
      keywords: thesis.keywords_english,
    });
  }

  //////////////////////////////
  //////////////////////////////

  if (thesis.subjects_turkish) {
    thesis.subjects_turkish = thesis.subjects_turkish
      .map((s) => s.trim())
      .map((s) => (s.endsWith(".") ? s.slice(0, -1) : s))
      .map((s) => s.trim())
      .filter((s) => s);
  }

  if (thesis.subjects_english) {
    thesis.subjects_english = thesis.subjects_english
      .map((s) => s.trim())
      .map((s) => (s.endsWith(".") ? s.slice(0, -1) : s))
      .map((s) => s.trim())
      .filter((s) => s);
  }

  if (!thesis.title_translated) {
    thesis.title_translated = null;
  }
  if (!thesis.subjects_turkish) {
    thesis.subjects_turkish = [];
  }
  if (!thesis.subjects_english) {
    thesis.subjects_english = [];
  }
  if (!thesis.keywords_turkish) {
    thesis.keywords_turkish = [];
  }
  if (!thesis.keywords_english) {
    thesis.keywords_english = [];
  }
  if (!thesis.pages) {
    thesis.pages = null;
  }
  if (!thesis.pdf_url) {
    thesis.pdf_url = null;
  }
  if (!thesis.abstract_original) {
    thesis.abstract_original = null;
  }
  if (!thesis.abstract_translated) {
    thesis.abstract_translated = null;
  }

  const cleanedThesis = FinalThesisSchema.parse({
    title_original: thesis.title_original,
    author: thesis.name,
    advisors: thesis.advisors,
    university: thesis.university,
    institute: thesis.institute,
    detail_id_1: thesis.id_1,
    detail_id_2: thesis.id_2,
    year: thesis.year,
    thesis_type: thesis.thesis_type,
    language: thesis.language,
    subjects_turkish: thesis.subjects_turkish,
    subjects_english: thesis.subjects_english,
    keywords_turkish: thesis.keywords_turkish,
    keywords_english: thesis.keywords_english,

    // Can be null
    title_translated: thesis.title_translated,
    abstract_original: thesis.abstract_original,
    abstract_translated: thesis.abstract_translated,
    page_count: thesis.pages,
    pdf_url: thesis.pdf_url,
    department: thesis.department,
    branch: thesis.department,
  });
  return { thesis: cleanedThesis, problemsCount };
}

if (process.argv[1] === __filename) {
  main().catch((err) => {
    console.error("Unhandled error in main:", err);
    process.exit(1);
  });
}
