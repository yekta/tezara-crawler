import { randomUUID } from "crypto";
import {
  appendFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { dirname, extname, resolve } from "path";
import postgres from "postgres";
import { fileURLToPath } from "url";
import { config } from "dotenv";

config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not defined in the .env file.");
  process.exit(1);
}

// Initialize PostgreSQL connection
const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const processedFilesPath = resolve(__dirname, "../../progress-postgres.txt");
const folderPath = resolve(__dirname, "../../jsons-extended");

// Function to get processed files
function getProcessedFiles(): Set<string> {
  if (!existsSync(processedFilesPath)) {
    writeFileSync(processedFilesPath, "", "utf-8");
  }
  const fileContents = readFileSync(processedFilesPath, "utf-8");
  return new Set(fileContents.split("\n").filter((line) => line.trim()));
}

// Function to log a processed file
function logProcessedFile(fileName: string): void {
  appendFileSync(processedFilesPath, `${fileName}\n`, "utf-8");
}

// Function to insert data from a JSON file
async function insertThesisData(filePath: string) {
  const data = JSON.parse(readFileSync(filePath, "utf-8"));

  for (const thesis of data) {
    try {
      await sql.begin(async (transaction) => {
        // Insert or fetch author with UUID
        const [author] = await transaction`
          WITH ins AS (
            INSERT INTO authors (id, name)
            VALUES (${randomUUID()}, ${thesis.name})
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id, name
          )
          SELECT id, name FROM ins
          UNION ALL
          SELECT id, name FROM authors WHERE name = ${
            thesis.name
          } AND NOT EXISTS (SELECT 1 FROM ins)
          LIMIT 1
        `;

        // Insert or fetch language with UUID
        const [language] = await transaction`
          WITH ins AS (
            INSERT INTO languages (id, name)
            VALUES (${randomUUID()}, ${thesis.language})
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id, name
          )
          SELECT id, name FROM ins
          UNION ALL
          SELECT id, name FROM languages WHERE name = ${
            thesis.language
          } AND NOT EXISTS (SELECT 1 FROM ins)
          LIMIT 1
        `;

        // Insert or fetch university with UUID
        const [university] = await transaction`
          WITH ins AS (
            INSERT INTO universities (id, name)
            VALUES (${randomUUID()}, ${thesis.university})
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id, name
          )
          SELECT id, name FROM ins
          UNION ALL
          SELECT id, name FROM universities WHERE name = ${
            thesis.university
          } AND NOT EXISTS (SELECT 1 FROM ins)
          LIMIT 1
        `;

        // Insert thesis (using integer ID from the data)
        const [thesisResult] = await transaction`
          INSERT INTO theses (
            id, author_id, language_id, title_original, title_translated, 
            year, university_id, detail_id_1, detail_id_2, page_count
          ) VALUES (
            ${thesis.thesis_id}, ${author.id}, ${language.id}, 
            ${thesis.title_original}, ${thesis.title_translated}, 
            ${thesis.year}, ${university.id}, ${thesis.id_1}, 
            ${thesis.id_2}, ${thesis.page_count || 0}
          )
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `;

        if (!thesisResult?.id) {
          console.log(`Thesis with id ${thesis.thesis_id} already exists`);
          return;
        }

        // Insert subjects (Turkish) with UUID
        if (thesis.subjects_turkish) {
          for (const subject of thesis.subjects_turkish) {
            const [subjectResult] = await transaction`
              WITH ins AS (
                INSERT INTO subjects_turkish (id, name)
                VALUES (${randomUUID()}, ${subject})
                ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                RETURNING id, name
              )
              SELECT id, name FROM ins
              UNION ALL
              SELECT id, name FROM subjects_turkish WHERE name = ${subject} AND NOT EXISTS (SELECT 1 FROM ins)
              LIMIT 1
            `;

            await transaction`
              INSERT INTO thesis_subjects_turkish (thesis_id, subject_id) 
              VALUES (${thesisResult.id}, ${subjectResult.id})
              ON CONFLICT DO NOTHING
            `;
          }
        }

        // Insert keywords (Turkish) with UUID
        if (thesis.keywords_turkish) {
          for (const keyword of thesis.keywords_turkish) {
            const [keywordResult] = await transaction`
              WITH ins AS (
                INSERT INTO keywords_turkish (id, name)
                VALUES (${randomUUID()}, ${keyword})
                ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                RETURNING id, name
              )
              SELECT id, name FROM ins
              UNION ALL
              SELECT id, name FROM keywords_turkish WHERE name = ${keyword} AND NOT EXISTS (SELECT 1 FROM ins)
              LIMIT 1
            `;

            await transaction`
              INSERT INTO thesis_keywords_turkish (thesis_id, keyword_id) 
              VALUES (${thesisResult.id}, ${keywordResult.id})
              ON CONFLICT DO NOTHING
            `;
          }
        }

        // Insert keywords (English) with UUID
        if (thesis.keywords_english) {
          for (const keyword of thesis.keywords_english) {
            const [keywordResult] = await transaction`
              WITH ins AS (
                INSERT INTO keywords_english (id, name)
                VALUES (${randomUUID()}, ${keyword})
                ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                RETURNING id, name
              )
              SELECT id, name FROM ins
              UNION ALL
              SELECT id, name FROM keywords_english WHERE name = ${keyword} AND NOT EXISTS (SELECT 1 FROM ins)
              LIMIT 1
            `;

            await transaction`
              INSERT INTO thesis_keywords_english (thesis_id, keyword_id) 
              VALUES (${thesisResult.id}, ${keywordResult.id})
              ON CONFLICT DO NOTHING
            `;
          }
        }
      });
    } catch (err) {
      console.error(`Error processing ${filePath}:`, err);
    }
  }
}

// Main function
async function main() {
  const processedFiles = getProcessedFiles();
  const files = readdirSync(folderPath);

  for (const file of files) {
    if (extname(file) === ".json" && !processedFiles.has(file)) {
      console.log(`Processing file: ${file}`);
      try {
        await insertThesisData(resolve(folderPath, file));
        logProcessedFile(file);
        console.log(`Successfully processed: ${file}`);
      } catch (err) {
        console.error(`Failed to process file: ${file}`, err);
      }
    } else {
      console.log(`Skipping already processed file: ${file}`);
    }
  }

  console.log("Processing complete.");
  await sql.end();
}

main();
