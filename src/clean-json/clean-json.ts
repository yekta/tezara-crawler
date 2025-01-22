import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { ThesisExtended } from "../types";
import { FinalThesisSchema } from "./schema";
import { z } from "zod";

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

    for (let i = 0; i < jsonFiles.length; i += batchSize) {
      console.log(
        `Processing batch: ${i.toLocaleString()} to ${(
          i + batchSize
        ).toLocaleString()}`
      );
      const { fileCount, totalProblems } = processBatch(
        jsonFiles.slice(i, i + batchSize),
        inputDir,
        outputDir
      );
      grandTotalProblems += totalProblems;
      processedFileCount += fileCount;
      console.log(
        `Finished processing batch: ${i.toLocaleString()}-${(
          i + batchSize
        ).toLocaleString()}`
      );
    }

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

function processBatch(files: string[], inputDir: string, outputDir: string) {
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

  const authors = cleanedAllTheses.map((t) => t.author);

  // create an authors.txt if it doesn't exist
  // in the output directory and write all authors to it
  // if it does, append the new authors to it
  const authorsFilePath = path.join(outputDir, "authors.txt");
  if (!fs.existsSync(authorsFilePath)) {
    fs.writeFileSync(authorsFilePath, authors.join("\n"));
  } else {
    fs.appendFileSync(authorsFilePath, "\n" + authors.join("\n"));
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Processed ${allTheses.length.toLocaleString()} theses.`);
  console.log(`Problem count for the batch: ${totalProblems.toLocaleString()}`);
  return { fileCount: cleanedAllTheses.length, totalProblems };
}

function cleanThesis(thesis: ThesisExtended) {
  let problemsCount = 0;
  if (thesis.name?.includes("<")) {
    console.log("🟡 Thesis author includes '<'  :", thesis.name);
    thesis.name = thesis.name.slice(1);
    thesis.name = thesis.name.trim();
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
  if (!thesis.university) {
    console.log("🔴 University is missing:", thesis.university);
    problemsCount++;
  }
  if (thesis.university && thesis.university.startsWith(",")) {
    console.log("🟡 University starts with a comma:", thesis.university);
    thesis.university = thesis.university.slice(1);
    thesis.university = thesis.university.trim();
    problemsCount++;
    console.log("🟢 University after cleaning:", `"${thesis.university}"`);
  }
  if (!thesis.institute) {
    console.log("🔴 Institute is missing:", thesis.institute);
    problemsCount++;
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
