import { config } from "dotenv";
config();

import { createHash } from "crypto";
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
import { cleanAdvisors, cleanUniversity } from "../helpers";
import { ThesisExtended } from "../types";
import { TIndex } from "./types";

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

const indexes: Record<
  TIndex,
  {
    filterable?: string[];
    sortable?: string[];
    shape: (doc: ThesisExtended) => null | undefined | any | any[];
    bulk?: boolean;
    maxTotalHits: number;
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
    ],
    sortable: ["id", "year"],
    shape: (doc) => {
      const {
        thesis_id,
        id_1,
        id_2,
        tez_no,
        status,
        university,
        name,
        advisors,
        ...rest
      } = doc;
      return {
        id: thesis_id,
        detail_id_1: id_1,
        detail_id_2: id_2,
        author: name,
        university: cleanUniversity(university),
        advisors: cleanAdvisors(advisors),
        ...rest,
      };
    },
  },
  universities: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    shape: (doc) =>
      doc.university
        ? { name: doc.university, id: md5Hash(doc.university) }
        : null,
    bulk: true,
  },
  institutes: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    shape: (doc) =>
      doc.institute
        ? { name: doc.institute, id: md5Hash(doc.institute) }
        : null,
    bulk: true,
  },
  departments: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    shape: (doc) =>
      doc.department
        ? { name: doc.department, id: md5Hash(doc.department) }
        : null,
    bulk: true,
  },
  branches: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    shape: (doc) =>
      doc.branch ? { name: doc.branch, id: md5Hash(doc.branch) } : null,
    bulk: true,
  },
  languages: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    shape: (doc) =>
      doc.language ? { name: doc.language, id: md5Hash(doc.language) } : null,
    bulk: true,
  },
  thesis_types: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    shape: (doc) =>
      doc.thesis_type
        ? { name: doc.thesis_type, id: md5Hash(doc.thesis_type) }
        : null,
    bulk: true,
  },
  subjects_turkish: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    shape: (doc) =>
      doc.subjects_turkish
        ?.filter((i) => i)
        .map((name) => ({ name, id: md5Hash(name) })),
    bulk: true,
  },
  subjects_english: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    shape: (doc) =>
      doc.subjects_english
        ?.filter((i) => i)
        .map((name) => ({ name, id: md5Hash(name) })),
    bulk: true,
  },
  authors: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    shape: (doc) =>
      doc.name ? { name: doc.name, id: md5Hash(doc.name) } : null,
  },
  advisors: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    shape: (doc) =>
      doc.advisors
        ?.filter((i) => i)
        .map((name) => ({ name, id: md5Hash(name) })),
  },
  keywords_turkish: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    shape: (doc) =>
      doc.keywords_turkish
        ?.filter((i) => i)
        .map((name) => ({ name, id: md5Hash(name) })),
  },
  keywords_english: {
    maxTotalHits: 5_000,
    sortable: ["name"],
    shape: (doc) =>
      doc.keywords_english
        ?.filter((i) => i)
        .map((name) => ({ name, id: md5Hash(name) })),
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

  for (const indexName in indexes) {
    const typedIndex = indexName as TIndex;
    const shape = indexes[typedIndex].shape;
    const processedFiles = getProcessedFiles(typedIndex);
    const files = readdirSync(folderPath);

    for (const file of files) {
      if (
        extname(file) === ".json" &&
        !processedFiles.has(`${typedIndex}|||${file}`)
      ) {
        console.log(`Index: ${typedIndex} | Processing file: ${file}`);
        try {
          await processFile(file, client, typedIndex, shape);
          logProcessedFile(file, typedIndex);
        } catch (error) {
          console.error(
            `Index: ${typedIndex} | Error processing file: ${file}`
          );
          console.error(error);
        }
      } else {
        console.log(
          `Index: ${typedIndex} | Skipping already processed file: ${file}`
        );
      }
    }

    console.log(`✅ Index: ${typedIndex} | Done processing all files.`);
  }

  console.log("✅✅✅ Processing complete. ✅✅✅");
}

main();

async function processFile(
  fileName: string,
  client: MeiliSearch,
  indexName: TIndex,
  shape: (doc: ThesisExtended) => any
) {
  const fileContents = readFileSync(resolve(folderPath, fileName), "utf-8");
  const data: ThesisExtended[] = JSON.parse(fileContents);

  const index = client.index(indexName);
  const mappedData = data
    .map(shape)
    .filter((d) => d !== undefined && d !== null);
  let flatData: any[] = [];

  mappedData.forEach((d) => {
    if (Array.isArray(d)) {
      flatData.push(...d);
    } else {
      flatData.push(d);
    }
  });

  const finalData = flatData.filter((d) => d !== undefined && d !== null);
  const finalMap = new Map<string, any>();
  finalData.forEach((d) => {
    finalMap.set(d.id, d);
  });
  const finalDataArray = Array.from(finalMap.values());

  const res = await index.addDocuments(finalDataArray);

  console.log(res);
  console.log(
    `Index: ${indexName} | ${indexName} Added ${finalDataArray.length} documents to index: ${indexName}`
  );
}

function getProcessedFiles(key: TIndex) {
  const fileContents = readFileSync(processedFilesPath, "utf-8");
  return new Set(
    fileContents
      .split("\n")
      .filter((line) => line.trim())
      .filter((line) => line.startsWith(`${key}|||`))
  );
}

function logProcessedFile(fileName: string, index: TIndex) {
  const adjustedFileName = `${index}|||${fileName}`;

  appendFileSync(processedFilesPath, `${adjustedFileName}\n`, "utf-8");
  console.log(`Index: ${index} | Logged processed file: ${adjustedFileName}`);
}

function md5Hash(data: string) {
  return createHash("md5").update(data).digest("hex");
}
