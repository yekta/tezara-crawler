import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { ThesisExtended } from "../types";
import { FinalThesisSchema } from "./schema";
import { z } from "zod";
import { createOrAppendToFile } from "./helpers";

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
      } = processBatch({
        files: jsonFiles.slice(i, i + batchSize),
        inputDir,
        outputDir,
      });

      universitiesBatch.forEach((u) => universities.add(u));
      institutesBatch.forEach((i) => institutes.add(i));
      departmentsBatch.forEach((d) => departments.add(d));
      branchesBatch.forEach((b) => branches.add(b));

      grandTotalProblems += totalProblems;
      processedFileCount += fileCount;

      console.log(
        `Finished processing batch: ${i.toLocaleString()}-${(
          i + batchSize
        ).toLocaleString()}`
      );
    }

    const universitiesFilePath = path.join(outputDir, "universities.txt");
    createOrAppendToFile({
      data: Array.from(universities),
      path: universitiesFilePath,
    });

    const institutesFilePath = path.join(outputDir, "institutes.txt");
    createOrAppendToFile({
      data: Array.from(institutes),
      path: institutesFilePath,
    });

    const departmentsFilePath = path.join(outputDir, "departments.txt");
    createOrAppendToFile({
      data: Array.from(departments),
      path: departmentsFilePath,
    });

    const branchesFilePath = path.join(outputDir, "branches.txt");
    createOrAppendToFile({
      data: Array.from(branches),
      path: branchesFilePath,
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
  const universities = new Set<string>();
  const institutes = new Set<string>();
  const departments = new Set<string>();
  const branches = new Set<string>();

  cleanedAllTheses.forEach((thesis) => {
    authors.add(thesis.author);
    universities.add(thesis.university);
    institutes.add(thesis.institute);
    if (thesis.department) {
      departments.add(thesis.department);
    }
    if (thesis.branch) {
      branches.add(thesis.branch);
    }
  });

  const authorsFilePath = path.join(outputDir, "authors.txt");
  createOrAppendToFile({ path: authorsFilePath, data: Array.from(authors) });

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
  };
}

function cleanThesis(thesis: ThesisExtended) {
  let problemsCount = 0;
  if (thesis.name?.includes("<")) {
    console.log("🟡 Thesis author includes '<'  :", thesis.name);
    thesis.name = thesis.name.slice(1);
    console.log("🟢 Thesis author after cleaning:", `"${thesis.name}"`);
    problemsCount++;
  }

  const startsWithNumberRegex = /^\d/;
  if (thesis.name && startsWithNumberRegex.test(thesis.name)) {
    console.log("🟡 Thesis author starts with a number:", thesis.name);
    thesis.name = thesis.name.replace(/^\d+/, "");
    thesis.name = thesis.name.trim();
    console.log("🟢 Thesis author after cleaning:", `"${thesis.name}"`);
    problemsCount++;
  }

  if (!thesis.name) {
    console.log("🔴 Thesis author is missing:", thesis.name);
    problemsCount++;
  }

  // there is a url like this in the name, replace it
  // http://172.16.3.193:8102/UlusalTezMerkezi/YonetimPaneli/tezDetay.jsp?sira=1427
  const urlRegex = /http.*UlusalTezMerkezi.*?(?=\s|$)/g;
  if (thesis.name && urlRegex.test(thesis.name)) {
    console.log("🟡 Thesis author includes a URL:", thesis.name);
    thesis.name = thesis.name.replace(urlRegex, "");
    thesis.name = thesis.name.trim();
    console.log("🟢 Thesis author after cleaning:", `"${thesis.name}"`);
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

  if (!thesis.pages) {
    problemsCount++;
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
    pages: thesis.pages,
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
