import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { FinalThesisSchema } from "../../clean-json/schema";
import { createClient } from "@clickhouse/client";
import { NodeClickHouseClient } from "@clickhouse/client/dist/client";
import { createSchema } from "./create-schema";

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inputDir = path.join(__dirname, "..", "..", "..", "jsons-cleaned/json");

export type Thesis = z.infer<typeof FinalThesisSchema>;
export type KeywordOrSubjectLanguage = "Turkish" | "English";
export type Keyword = {
  name: string;
  language: KeywordOrSubjectLanguage;
};
export type Subject = {
  name: string;
  language: KeywordOrSubjectLanguage;
};

async function insertInBatches<T>(
  client: NodeClickHouseClient,
  table: string,
  data: T[],
  batchSize: number
): Promise<void> {
  console.log(`Inserting into ${table} in batches of ${batchSize}...`);
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const batchCount = Math.ceil(data.length / batchSize);
    try {
      await client.insert({
        table,
        values: batch,
        format: "JSONEachRow",
      });
      console.log(
        `Inserted batch: ${i / batchSize + 1}/${batchCount} | Table: ${table}`
      );
    } catch (err) {
      console.error(
        `Error inserting batch: ${i / batchSize + 1} | Table: ${table}`,
        err
      );
    }
  }
}

async function main(): Promise<void> {
  const client = createClient({
    url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
    username: process.env.CLICKHOUSE_USERNAME || "default",
    password: process.env.CLICKHOUSE_PASSWORD || "",
  });

  const batchSize = parseInt(process.env.BATCH_SIZE || "10000", 10); // Default batch size: 1000

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

    // Process keywords and subjects
    for (const thesis of json) {
      for (const subject of thesis.subjects_turkish) {
        subjects.set(subject, { name: subject, language: "Turkish" });
      }
      for (const subject of thesis.subjects_english) {
        subjects.set(subject, { name: subject, language: "English" });
      }
      for (const keyword of thesis.keywords_turkish) {
        keywords.set(keyword, { name: keyword, language: "Turkish" });
      }
      for (const keyword of thesis.keywords_english) {
        keywords.set(keyword, { name: keyword, language: "English" });
      }
    }
  }

  console.log("Total theses:", theses.length.toLocaleString());
  console.log("Total unique keywords:", keywords.size.toLocaleString());
  console.log("Total unique subjects:", subjects.size.toLocaleString());

  // Insert data into ClickHouse in batches
  try {
    await createSchema(client);

    const simpleTheses = theses.map((thesis) => ({
      id: thesis.id,
      title_original: thesis.title_original,
      author: thesis.author,
      university: thesis.university,
      institute: thesis.institute,
      year: thesis.year,
      thesis_type: thesis.thesis_type,
      language: thesis.language,
    }));
    await insertInBatches(client, "theses", simpleTheses, batchSize);

    const subjectsArray = Array.from(subjects.values());
    await insertInBatches(client, "subjects", subjectsArray, batchSize);

    const keywordsArray = Array.from(keywords.values());
    await insertInBatches(client, "keywords", keywordsArray, batchSize);

    const thesisKeywordMappings = [];
    for (const thesis of theses) {
      for (const keyword of thesis.keywords_turkish) {
        thesisKeywordMappings.push({ thesis_id: thesis.id, keyword });
      }
      for (const keyword of thesis.keywords_english) {
        thesisKeywordMappings.push({ thesis_id: thesis.id, keyword });
      }
    }
    await insertInBatches(
      client,
      "thesis_keywords",
      thesisKeywordMappings,
      batchSize
    );

    console.log("Data successfully inserted into ClickHouse!");
  } catch (err) {
    console.error("Error inserting data into ClickHouse:", err);
  } finally {
    await client.close();
  }
}

if (process.argv[1] === __filename) {
  main().catch((err) => {
    console.error("Unhandled error in main:", err);
    process.exit(1);
  });
}
