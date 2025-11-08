import * as cheerio from "cheerio";
import crypto from "crypto";
import fs from "fs";
import { fileURLToPath } from "node:url";
import path from "path";
import { cleanAdvisors, cleanUniversity } from "../helpers";
import { Thesis, ThesisExtended } from "../types";
import {
  cleanText,
  extractAbstractAndKeywords,
  parseLocationInfo,
  shapeThesis,
} from "./helpers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extraFields = {
  abstract_original: null,
  abstract_translated: null,
  advisors: null,
  branch: null,
  department: null,
  institute: null,
  keywords_english: null,
  keywords_turkish: null,
  pages: null,
  pdf_url: null,
  status: null,
  tez_no: null,
};

function parseThesisExtended(htmlContent: string): ThesisExtended {
  const $ = cheerio.load(htmlContent, { xml: { decodeEntities: true } });

  if (htmlContent.includes("Tez hazırlanmakta veya işlemi devam etmektedir.")) {
    console.warn("This thesis is not finished yet.");
  }

  if (htmlContent.includes("Sizlere daha iyi bir hizmet")) {
    console.warn("Blocked. Please try again later.");
    throw new Error("Blocked. Please try again later.");
  }

  const result: ThesisExtended = {
    thesis_id: null,
    id_1: null,
    id_2: null,
    name: null,
    year: null,
    title_original: null,
    title_translated: null,
    university: null,
    language: null,
    thesis_type: null,
    subjects_turkish: null,
    subjects_english: null,
    ...extraFields,
  };

  let mainTable = $("table:has(td#td0)");
  if (!mainTable.length) return result;

  const mainRow = mainTable.find("tr.renkp").eq(0);
  const cells = mainRow.find("td");

  if (cells.length >= 4) {
    const tezNo = cleanText(cells.eq(0).text());
    result.tez_no =
      tezNo !== undefined && tezNo !== null ? Number(tezNo) : null;

    const pdfUrl = cells.eq(1).find("a[href]").attr("href");
    result.pdf_url = pdfUrl
      ? `https://tez.yok.gov.tr/UlusalTezMerkezi/${pdfUrl}`
      : null;

    const infoText = cells.eq(2).text();

    const advisorMatch = infoText.match(/Danışman:\s*([^\n]+)/i);
    if (advisorMatch) {
      const advisors = cleanAdvisors(
        advisorMatch[1]
          .split(";")
          .map((advisor) => cleanText(advisor))
          .filter(Boolean)
      );
      result.advisors = advisors && advisors.length > 0 ? advisors : null;
    }

    const locationMatch = infoText.match(/Yer Bilgisi:\s*([^\n]+)/i);
    if (locationMatch) {
      const { university, institute, department, branch } = parseLocationInfo(
        locationMatch[1]
      );
      result.university = cleanUniversity(university);
      result.institute = institute;
      result.department = department;
      result.branch = branch;
    }

    const statusText = cleanText(cells.eq(3).text());
    result.status = statusText || null;
    const pagesMatch = statusText.match(/(\d+)\s*s\./);
    if (pagesMatch) {
      const match = pagesMatch[1];
      result.pages =
        match !== undefined && match !== null ? Number(match) : null;
    }
  }

  const originalCell = mainTable.find("td#td0");
  if (originalCell.length) {
    const [abstractOrig, keywordsTurk] = extractAbstractAndKeywords(
      originalCell.text()
    );
    result.abstract_original = cleanText(abstractOrig) || null;
    const arr = cleanText(keywordsTurk)
      .split(",")
      .map((i) => i.trim())
      .filter(Boolean);
    result.keywords_turkish = arr.length ? arr : null;
  }

  const translatedCell = mainTable.find("td#td1");
  if (translatedCell.length) {
    const [abstractTrans, keywordsEng] = extractAbstractAndKeywords(
      translatedCell.text()
    );
    result.abstract_translated = cleanText(abstractTrans) || null;
    const arr = cleanText(keywordsEng)
      .split(",")
      .map((i) => i.trim())
      .filter(Boolean);
    result.keywords_english = arr.length ? arr : null;
  }

  return result;
}

async function fetchThesisDetails(thesis: Thesis): Promise<ThesisExtended> {
  if (!thesis.id_1 || !thesis.id_2) {
    console.warn(
      `Skipping: cannot derive URL (id_1 or id_2 not found).`,
      thesis
    );
    return {
      ...extraFields,
      ...shapeThesis(thesis),
    };
  }

  const detailsUrl = `https://tez.yok.gov.tr/UlusalTezMerkezi/tezDetay.jsp?id=${thesis.id_1}&no=${thesis.id_2}`;

  const maxRetries = 20;
  let retryCount = 0;
  let retryDelay = 50;

  while (retryCount < maxRetries) {
    try {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      const response = await fetch(detailsUrl);

      if (response.ok) {
        console.log("response is okay for", detailsUrl);
        const htmlContent = await response.text();
        const extendedData = parseThesisExtended(htmlContent);

        return {
          ...extendedData,
          ...shapeThesis(thesis),
        };
      } else {
        retryCount++;
        if (retryCount === maxRetries) {
          console.warn(
            `Failed after ${maxRetries} attempts. Last status ${response.status} for ${detailsUrl}`
          );
        } else {
          console.info(
            `Attempt ${retryCount}/${maxRetries} => status ${response.status}. Retrying...`
          );
          retryDelay *= 2;
        }
      }
    } catch (error: any) {
      retryCount++;
      if (retryCount === maxRetries) {
        console.error(
          `Failed after ${maxRetries} attempts. Last error for ${detailsUrl}: ${error}`
        );
      } else {
        console.info(
          `Attempt ${retryCount}/${maxRetries} => error: ${error}. Retrying...`
        );
        retryDelay *= 2;
      }
    }
  }

  return { ...extraFields, ...shapeThesis(thesis) };
}

function generateBatchHash(batch: Thesis[]): string {
  const keys = batch
    .map((thesis) => `${thesis.thesis_id}|||${thesis.id_1}|||${thesis.id_2}`)
    .join("|||");
  return crypto.createHash("md5").update(keys).digest("hex");
}

function writeBatchJSON(
  theses: ThesisExtended[],
  outputDir: string,
  batchHash: string
): void {
  const outputFile = path.join(outputDir, `${batchHash}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(theses, null, 2), {
    encoding: "utf-8",
  });
  console.info(`Batch ${batchHash} saved - ${theses.length} records`);
}

function isBatchProcessed(outputDir: string, batchHash: string): boolean {
  return fs.existsSync(path.join(outputDir, `${batchHash}.json`));
}

async function processBatchParallel(
  batch: Thesis[]
): Promise<ThesisExtended[]> {
  const promises: Promise<ThesisExtended>[] = batch.map(async (item) => {
    return fetchThesisDetails(item);
  });

  return await Promise.all(promises);
}

async function main(batchSize = 200): Promise<void> {
  try {
    const inputDir = path.join(__dirname, "..", "..", "jsons");
    const outputDir = path.join(__dirname, "..", "..", "jsons-extended");

    if (!fs.existsSync(inputDir)) {
      throw new Error(`Directory not found: ${inputDir}`);
    }

    const jsonFiles = fs
      .readdirSync(inputDir)
      .filter((file) => file.toLowerCase().endsWith(".json"));

    let allTheses: Thesis[] = [];
    for (const file of jsonFiles) {
      const filePath = path.join(inputDir, file);
      const rawData = fs.readFileSync(filePath, "utf-8");
      const data: Thesis[] = JSON.parse(rawData);
      allTheses.push(...data);
    }

    console.info(`Loaded ${allTheses.length} thesis records from input.`);

    allTheses.sort((a, b) => {
      const aId = parseInt(a.thesis_id ?? "0", 10) || 0;
      const bId = parseInt(b.thesis_id ?? "0", 10) || 0;
      return bId - aId;
    });

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let startIndex = 0;
    while (startIndex < allTheses.length) {
      const endIndex = Math.min(startIndex + batchSize, allTheses.length);
      const currentBatch = allTheses.slice(startIndex, endIndex);
      const batchHash = generateBatchHash(currentBatch);

      console.info(
        `Processing batch: ${startIndex + 1} - ${endIndex} of ${
          allTheses.length
        }  - ${batchHash}`
      );

      if (!isBatchProcessed(outputDir, batchHash)) {
        const batchResults = await processBatchParallel(currentBatch);
        writeBatchJSON(batchResults, outputDir, batchHash);
      } else {
        console.log(`Skipping already processed batch: ${batchHash}`);
      }

      startIndex = endIndex;
    }

    console.info(`Finished extending theses. Output files are in ${outputDir}`);
  } catch (err) {
    console.error("Error in main():", err);
  }
}

if (process.argv[1] === __filename) {
  main().catch((err) => {
    console.error("Unhandled error in main:", err);
    process.exit(1);
  });
}
