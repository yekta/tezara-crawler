import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { ThesisExtended } from "../types";

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
  for (let i = 0; i < allTheses.length; i++) {
    const { thesis, problemsCount } = cleanThesis(allTheses[i]);
    allTheses[i] = thesis;
    totalProblems += problemsCount;
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  console.log(`Processed ${allTheses.length.toLocaleString()} theses.`);
  console.log(`Problem count for the batch: ${totalProblems.toLocaleString()}`);
  return { fileCount: allTheses.length, totalProblems };
}

function cleanThesis(thesis: ThesisExtended) {
  let problemsCount = 0;
  if (thesis.name?.includes("<")) {
    console.log("🟡 Thesis author includes '<'  :", thesis.name);
    problemsCount++;
  }
  const startsWithNumberRegex = /^\d/;
  if (thesis.name && startsWithNumberRegex.test(thesis.name)) {
    console.log("🟡 Thesis author starts with a number:", thesis.name);
    problemsCount++;
  }
  if (!thesis.name) {
    console.log("🔴 Thesis author is missing:", thesis.name);
    problemsCount++;
  }
  if (!thesis.title_original) {
    console.log(
      "🔴 Title original is missing:",
      thesis.title_original,
      thesis.title_translated,
      thesis.thesis_id
    );
    problemsCount++;
  }
  if (!thesis.university) {
    console.log("🔴 University is missing:", thesis.university);
    problemsCount++;
  }
  if (thesis.university && thesis.university.startsWith(",")) {
    console.log("🟡 University starts with a comma:", thesis.university);
    problemsCount++;
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
    problemsCount++;
  }
  if (thesis.advisors && thesis.advisors.some((a) => a.includes("null "))) {
    /* console.log("🟡 Advisors include 'null '", thesis.advisors); */
    problemsCount++;
  }
  if (!thesis.advisors || thesis.advisors.length < 1) {
    console.log("🔴 Advisors is missing:", thesis.thesis_id);
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
  return { thesis, problemsCount };
}

if (process.argv[1] === __filename) {
  main().catch((err) => {
    console.error("Unhandled error in main:", err);
    process.exit(1);
  });
}
