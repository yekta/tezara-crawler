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

    for (let i = 0; i < jsonFiles.length; i += batchSize) {
      console.log(
        `Processing batch: ${i.toLocaleString()} to ${(
          i + batchSize
        ).toLocaleString()}`
      );
      const { fileCount } = processBatch(
        i,
        jsonFiles.slice(i, i + batchSize),
        inputDir,
        outputDir
      );
      processedFileCount += fileCount;
      console.log(
        `Finished processing batch: ${i.toLocaleString()}-${(
          i + batchSize
        ).toLocaleString()}`
      );
    }

    console.info(
      `🟢 Processed ${processedFileCount.toLocaleString()} thesis records from input.`
    );

    console.info(
      `✅ Finished cleaning theses. Output files are in ${outputDir}`
    );
  } catch (err) {
    console.error("Error in main():", err);
  }
}

function processBatch(
  i: number,
  files: string[],
  inputDir: string,
  outputDir: string
) {
  let allTheses: ThesisExtended[] = [];
  for (const file of files) {
    const filePath = path.join(inputDir, file);
    const rawData = fs.readFileSync(filePath, "utf-8");
    const data: ThesisExtended[] = JSON.parse(rawData);
    allTheses.push(...data);
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  console.log(`Processed ${allTheses.length.toLocaleString()} theses.`);
  return { fileCount: allTheses.length };
}

if (process.argv[1] === __filename) {
  main().catch((err) => {
    console.error("Unhandled error in main:", err);
    process.exit(1);
  });
}
