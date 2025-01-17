import { config } from "dotenv";
config();

import { MeiliSearch } from "meilisearch";
import {
  appendFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ThesisExtended } from "../types";

const host = process.env.MEILI_HOST || "";
const apiKey = process.env.MEILI_API_KEY || "";
if (!host || !apiKey) {
  throw new Error("Please provide MEILI_HOST and MEILI_API_KEY in .env file");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const processedFilesPath = resolve(__dirname, "../../progress-meili.txt");
const folderPath = resolve(__dirname, "../../jsons-extended");

if (!existsSync(processedFilesPath)) {
  writeFileSync(processedFilesPath, "", "utf-8");
}

const thesesIndex = "theses";

async function main() {
  const client = new MeiliSearch({
    host,
    apiKey,
  });
  const res = await client.createIndex(thesesIndex, { primaryKey: "id" });
  console.log(res);

  const processedFiles = getProcessedFiles();
  const files = readdirSync(folderPath);

  for (const file of files) {
    if (extname(file) === ".json" && !processedFiles.has(file)) {
      console.log(`Processing file: ${file}`);
      try {
        await processFile(file, client);
        logProcessedFile(file);
      } catch (error) {
        console.error(`Error processing file: ${file}`);
        console.error(error);
      }
    } else {
      console.log(`Skipping already processed file: ${file}`);
    }
  }

  console.log("Processing complete.");
}

main();

async function processFile(fileName: string, client: MeiliSearch) {
  const fileContents = readFileSync(resolve(folderPath, fileName), "utf-8");
  const data: ThesisExtended[] = JSON.parse(fileContents);

  const index = client.index(thesesIndex);
  const res = await index.addDocuments(
    data.map((doc) => {
      const { thesis_id, id_1, id_2, tez_no, status, name, ...rest } = doc;
      return {
        id: thesis_id,
        detail_id_1: id_1,
        detail_id_2: id_2,
        author: name,
        ...rest,
      };
    })
  );
  console.log(res);
  console.log(`Added ${data.length} documents to index: ${thesesIndex}`);
}

function getProcessedFiles() {
  const fileContents = readFileSync(processedFilesPath, "utf-8");
  return new Set(fileContents.split("\n").filter((line) => line.trim()));
}

function logProcessedFile(fileName: string) {
  appendFileSync(processedFilesPath, `${fileName}\n`, "utf-8");
  console.log(`Logged processed file: ${fileName}`);
}
