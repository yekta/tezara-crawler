import { createClient } from "@clickhouse/client";
import { NodeClickHouseClient } from "@clickhouse/client/dist/client";
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSchema } from "./create-schema";
import { TFinalThesis } from "../../clean-json/schema";

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inputDir = path.join(__dirname, "..", "..", "..", "jsons-cleaned/json");

type Keyword = {
  name: string;
  language: string;
};
type Subject = {
  name: string;
  language: string;
};
type Advisor = {
  name: string;
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
    await client.insert({
      table,
      values: batch,
      format: "JSONEachRow",
    });
    console.log(
      `Inserted batch: ${i / batchSize + 1}/${batchCount} | Table: ${table}`
    );
  }
}

async function main(): Promise<void> {
  const client = createClient({
    url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
    username: process.env.CLICKHOUSE_USERNAME || "default",
    password: process.env.CLICKHOUSE_PASSWORD || "",
  });

  const batchSize = parseInt(process.env.BATCH_SIZE || "10000", 10); // Default batch size: 1000

  const theses: TFinalThesis[] = [];
  const keywords = new Map<string, Keyword>();
  const subjects = new Map<string, Subject>();
  const advisors = new Map<string, Advisor>();

  const files = fs.readdirSync(inputDir);
  for (const file of files) {
    const filePath = path.join(inputDir, file);
    const data = fs.readFileSync(filePath, "utf-8");
    const json: TFinalThesis[] = JSON.parse(data);
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
      for (const advisor of thesis.advisors) {
        advisors.set(advisor, { name: advisor });
      }
    }
  }

  console.log("Total theses:", theses.length.toLocaleString());
  console.log("Total unique keywords:", keywords.size.toLocaleString());
  console.log("Total unique subjects:", subjects.size.toLocaleString());
  console.log("Total unique advisors:", advisors.size.toLocaleString());

  // Insert data into ClickHouse in batches
  try {
    await createSchema(client);

    const simpleTheses = theses.map((thesis) => ({
      id: thesis.id,
      author: thesis.author,
      university: thesis.university,
      institute: thesis.institute,
      year: thesis.year,
      thesis_type: thesis.thesis_type,
      language: thesis.language,
      page_count: thesis.page_count,
      department: thesis.department,
      branch: thesis.branch,
    }));
    await insertInBatches(client, "theses", simpleTheses, batchSize);

    //////////////////
    //// KEYWORDS ////
    //////////////////
    const keywordsArray = Array.from(keywords.values());
    await insertInBatches(client, "keywords", keywordsArray, batchSize);

    const thesisKeywordMappings: { thesis_id: number; keyword_name: string }[] =
      [];
    for (const thesis of theses) {
      for (const keyword of thesis.keywords_turkish) {
        thesisKeywordMappings.push({
          thesis_id: thesis.id,
          keyword_name: keyword,
        });
      }
      for (const keyword of thesis.keywords_english) {
        thesisKeywordMappings.push({
          thesis_id: thesis.id,
          keyword_name: keyword,
        });
      }
    }
    await insertInBatches(
      client,
      "thesis_keywords",
      thesisKeywordMappings,
      batchSize
    );

    //////////////////
    //// SUBJECTS ////
    //////////////////
    const subjectsArray = Array.from(subjects.values());
    await insertInBatches(client, "subjects", subjectsArray, batchSize);

    const thesisSubjectMappings: { thesis_id: number; subject_name: string }[] =
      [];
    for (const thesis of theses) {
      for (const subject of thesis.subjects_turkish) {
        thesisSubjectMappings.push({
          thesis_id: thesis.id,
          subject_name: subject,
        });
      }
      for (const subject of thesis.subjects_english) {
        thesisSubjectMappings.push({
          thesis_id: thesis.id,
          subject_name: subject,
        });
      }
    }
    await insertInBatches(
      client,
      "thesis_subjects",
      thesisSubjectMappings,
      batchSize
    );

    //////////////////
    //// ADVISORS ////
    //////////////////
    const advisorsArray = Array.from(advisors.values());
    await insertInBatches(client, "advisors", advisorsArray, batchSize);

    const thesisAdvisorMappings: { thesis_id: number; advisor_name: string }[] =
      [];
    for (const thesis of theses) {
      for (const advisor of thesis.advisors) {
        thesisAdvisorMappings.push({
          thesis_id: thesis.id,
          advisor_name: advisor,
        });
      }
    }
    await insertInBatches(
      client,
      "thesis_advisors",
      thesisAdvisorMappings,
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
