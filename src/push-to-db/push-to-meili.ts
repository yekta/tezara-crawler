import { config } from "dotenv";
config();

import { MeiliSearch } from "meilisearch";
import { existsSync, writeFileSync } from "node:fs";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TFinalThesis } from "../clean-json/schema";
import { md5Hash } from "../helpers";
import { TIndex } from "./types";
import fs from "node:fs";
import pRetry from "p-retry";

const host = process.env.MEILI_HOST || "";
const apiKey = process.env.MEILI_API_KEY || "";
if (!host || !apiKey) {
  throw new Error("Please provide MEILI_HOST and MEILI_API_KEY in .env file");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const processedFilesPath = resolve(__dirname, "../../progress-meili.txt");
const inputDir = resolve(__dirname, "../../jsons-cleaned/json");

if (!existsSync(processedFilesPath)) {
  writeFileSync(processedFilesPath, "", "utf-8");
}

type DocReturn = Record<string, any> & { id: number | string };

const LANGUAGE_TURKISH = "Turkish";
const LANGUAGE_ENGLISH = "English";

const indexes: Record<
  TIndex,
  {
    filterable?: string[];
    sortable?: string[];
    shape: (doc: TFinalThesis) => DocReturn | DocReturn[] | null;
    maxTotalHits: number;
    batchSize?: number;
    xOrder?: number;
  }
> = {
  theses: {
    maxTotalHits: 1_500_000,
    filterable: [
      "year",
      "thesis_type",
      "university",
      "institute",
      "department",
      "branch",
      "language",
      "advisors",
      "author",
      "keywords",
      "subjects",
    ],
    sortable: ["id", "year"],
    shape: (doc) => doc,
    batchSize: 1_000,
    xOrder: -1,
  },
  universities: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    filterable: ["name"],
    shape: (doc) => ({ name: doc.university, id: md5Hash(doc.university) }),
  },
  institutes: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    filterable: ["name"],
    shape: (doc) =>
      doc.institute
        ? { name: doc.institute, id: md5Hash(doc.institute) }
        : null,
  },
  departments: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    filterable: ["name"],
    shape: (doc) =>
      doc.department
        ? { name: doc.department, id: md5Hash(doc.department) }
        : null,
  },
  branches: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    filterable: ["name"],
    shape: (doc) =>
      doc.branch ? { name: doc.branch, id: md5Hash(doc.branch) } : null,
  },
  languages: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    filterable: ["name"],
    shape: (doc) => ({ name: doc.language, id: md5Hash(doc.language) }),
  },
  authors: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    filterable: ["name"],
    shape: (doc) => ({ name: doc.author, id: md5Hash(doc.author) }),
    batchSize: 10_000,
  },
  advisors: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    filterable: ["name"],
    shape: (doc) => doc.advisors.map((name) => ({ name, id: md5Hash(name) })),
    batchSize: 10_000,
  },
  thesis_types: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    filterable: ["name"],
    shape: (doc) => ({ name: doc.thesis_type, id: md5Hash(doc.thesis_type) }),
  },
  keywords: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    filterable: ["name"],
    shape: (doc) => [
      ...doc.keywords_english.map((name) => ({
        name,
        id: md5Hash(name),
        language: LANGUAGE_ENGLISH,
      })),
      ...doc.keywords_turkish.map((name) => ({
        name,
        id: md5Hash(name),
        language: LANGUAGE_TURKISH,
      })),
    ],
    batchSize: 10_000,
  },
  subjects: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    filterable: ["name"],
    shape: (doc) => [
      ...doc.subjects_english.map((name) => ({
        name,
        id: md5Hash(name),
        language: LANGUAGE_ENGLISH,
      })),
      ...doc.subjects_turkish.map((name) => ({
        name,
        id: md5Hash(name),
        language: LANGUAGE_TURKISH,
      })),
    ],
  },
} as const;

async function main() {
  const client = new MeiliSearch({
    host,
    apiKey,
  });

  for (const indexName in indexes) {
    const typedIndex = indexName as TIndex;
    const res = await client.createIndex(indexName, {
      primaryKey: "id",
    });
    console.log(res);

    const filterables = indexes[typedIndex].filterable;
    if (filterables) {
      const index = client.index(indexName);
      console.log(
        `Index: ${typedIndex} | Updating filterable attributes`,
        filterables
      );
      const filterableRes = await index.updateFilterableAttributes(filterables);
      console.log(filterableRes);
    }

    const sortables = indexes[typedIndex].sortable;
    if (sortables) {
      const index = client.index(indexName);
      console.log(
        `Index: ${typedIndex} | Updating sortable attributes`,
        sortables
      );
      const sortableRes = await index.updateSortableAttributes(sortables);
      console.log(sortableRes);
    }

    const maxTotalHits = indexes[typedIndex].maxTotalHits;
    const index = client.index(indexName);
    console.log(
      `Index: ${typedIndex} | Updating maxTotalHits to ${maxTotalHits}`
    );
    const maxTotalHitsRes = await index.updateSettings({
      pagination: {
        maxTotalHits,
      },
    });
    console.log(maxTotalHitsRes);
  }

  console.log("⏳ Loading all files into memory...");
  const allThesis: TFinalThesis[] = [];
  const files = fs.readdirSync(inputDir);
  for (const file of files) {
    const filePath = path.join(inputDir, file);
    const data = fs.readFileSync(filePath, "utf-8");
    const json: TFinalThesis[] = JSON.parse(data);
    console.log(
      "File loaded:",
      file,
      "| Thesis count:",
      json.length.toLocaleString()
    );
    allThesis.push(...json);
  }
  console.log("🟢 All files loaded. Thesis count:", allThesis.length);

  const sortedIndexes = Object.keys(indexes).sort(
    (a, b) =>
      indexes[b as TIndex].xOrder || 0 - (indexes[a as TIndex].xOrder || 0)
  );
  for (const indexName of sortedIndexes) {
    console.log(`🔍 Index: ${indexName} | Processing all files...`);

    const typedIndex = indexName as TIndex;
    const shape = indexes[typedIndex].shape;
    const dataMap = new Map<string, any>();
    for (const thesis of allThesis) {
      const shaped = shape(thesis);
      if (Array.isArray(shaped)) {
        for (const doc of shaped) {
          dataMap.set(String(doc.id), doc);
        }
      } else if (shaped) {
        dataMap.set(String(shaped.id), shaped);
      }
    }
    const data = Array.from(dataMap.values());

    console.log(`🔍 Index: ${typedIndex} | Processing ${data.length} docs...`);

    await processIndex({
      indexName: typedIndex,
      data,
      client,
      batchSize: indexes[typedIndex].batchSize,
    });

    console.log(`✅ Index: ${typedIndex} | Done processing all files.`);
  }

  console.log("✅✅✅ Processing complete. ✅✅✅");
}

main();

async function processIndex({
  indexName,
  data,
  batchSize,
  client,
}: {
  indexName: TIndex;
  data: any[];
  batchSize?: number;
  client: MeiliSearch;
}) {
  const index = client.index(indexName);
  const finalBatchSize = batchSize || data.length;

  if (finalBatchSize) {
    console.log(
      `Index: ${indexName} | Splitting into batches of ${finalBatchSize}`
    );
  }

  for (let i = 0; i < data.length; i += finalBatchSize) {
    const batch = data.slice(i, i + finalBatchSize);
    console.log(
      `Index: ${indexName} | Adding batch ${
        i / finalBatchSize + 1
      } of ${Math.ceil(data.length / finalBatchSize)}`
    );
    const res = await pRetry(() => index.addDocuments(batch), {
      retries: 5,
      factor: 2,
    });
    console.log(res);
  }
}
