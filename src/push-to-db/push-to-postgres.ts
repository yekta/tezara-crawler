import { config } from "dotenv";
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
import { ThesisExtended } from "../types";

config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not defined in the .env file.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
  prepare: true,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const processedFilesPath = resolve(__dirname, "../../progress-postgres.txt");
const folderPath = resolve(__dirname, "../../jsons-extended");

if (!existsSync(processedFilesPath)) {
  writeFileSync(processedFilesPath, "", "utf-8");
}

function getProcessedFiles() {
  const fileContents = readFileSync(processedFilesPath, "utf-8");
  return new Set(fileContents.split("\n").filter((line) => line.trim()));
}

function logProcessedFile(fileName: string) {
  appendFileSync(processedFilesPath, `${fileName}\n`, "utf-8");
}

async function batchUpsertNames(
  transaction: any,
  tableName: string,
  names: any[]
) {
  const uniqueNames = [...new Set(names)].filter(Boolean);
  if (uniqueNames.length === 0) return new Map();

  console.log(`Upserting ${uniqueNames.length} records into ${tableName}`);

  const result: { id: string; name: string }[] = await transaction`
    WITH input_values AS (
      SELECT DISTINCT name, gen_random_uuid() as id
      FROM unnest(${sql.array(uniqueNames)}::text[]) AS name
    )
    INSERT INTO ${sql(tableName)} (id, name)
    SELECT id, name FROM input_values
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, name
  `;

  console.log(
    `Successfully upserted ${result.length} records into ${tableName}`
  );
  return new Map(result.map((row) => [row.name, row.id]));
}

async function insertThesisData(filePath: string) {
  const data: ThesisExtended[] = JSON.parse(readFileSync(filePath, "utf-8"));
  const batchSize = 50;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    console.log(
      `Processing batch ${i / batchSize + 1} of ${Math.ceil(
        data.length / batchSize
      )}`
    );

    await sql.begin(async (transaction) => {
      try {
        // Extract all names and terms for batch upsert
        const authors = batch.map((t) => t.name);
        const languages = batch.map((t) => t.language);
        const universities = batch.map((t) => t.university);
        const advisors = batch.flatMap((t) => t.advisors || []);
        const thesisTypes = batch.map((t) => t.thesis_type).filter(Boolean);
        const departments = batch.map((t) => t.department).filter(Boolean);
        const institutes = batch.map((t) => t.institute).filter(Boolean);
        const branches = batch.map((t) => t.branch).filter(Boolean);

        const subjectsTurkish = batch.flatMap((t) => t.subjects_turkish || []);
        const subjectsEnglish = batch.flatMap((t) => t.subjects_english || []);
        const keywordsTurkish = batch.flatMap((t) => t.keywords_turkish || []);
        const keywordsEnglish = batch.flatMap((t) => t.keywords_english || []);

        // Batch upsert all entities and get their ID mappings
        const [
          authorMap,
          languageMap,
          universityMap,
          advisorMap,
          thesisTypeMap,
          departmentMap,
          instituteMap,
          branchMap,
          subjectsTurkishMap,
          subjectsEnglishMap,
          keywordsTurkishMap,
          keywordsEnglishMap,
        ] = await Promise.all([
          batchUpsertNames(transaction, "authors", authors),
          batchUpsertNames(transaction, "languages", languages),
          batchUpsertNames(transaction, "universities", universities),
          batchUpsertNames(transaction, "advisors", advisors),
          batchUpsertNames(transaction, "thesis_types", thesisTypes),
          batchUpsertNames(transaction, "departments", departments),
          batchUpsertNames(transaction, "institutes", institutes),
          batchUpsertNames(transaction, "branches", branches),
          batchUpsertNames(transaction, "subjects_turkish", subjectsTurkish),
          batchUpsertNames(transaction, "subjects_english", subjectsEnglish),
          batchUpsertNames(transaction, "keywords_turkish", keywordsTurkish),
          batchUpsertNames(transaction, "keywords_english", keywordsEnglish),
        ]);

        // Prepare thesis values with proper foreign key references
        const thesesValues = batch
          .map((thesis) => {
            const authorId = authorMap.get(thesis.name);
            if (!authorId) {
              console.warn(`No author ID found for name: ${thesis.name}`);
            }

            return {
              id: thesis.thesis_id,
              author_id: authorId,
              language_id: languageMap.get(thesis.language),
              title_original: thesis.title_original,
              title_translated: thesis.title_translated,
              abstract_original: thesis.abstract_original,
              abstract_translated: thesis.abstract_translated,
              year: thesis.year,
              university_id: universityMap.get(thesis.university),
              institute_id: instituteMap.get(thesis.institute) || null,
              department_id: departmentMap.get(thesis.department) || null,
              branch_id: branchMap.get(thesis.branch) || null,
              thesis_type_id: thesisTypeMap.get(thesis.thesis_type) || null,
              detail_id_1: thesis.id_1,
              detail_id_2: thesis.id_2,
              page_count: thesis.pages || 0,
              pdf_url: thesis.pdf_url,
            };
          })
          .filter(
            (thesis) =>
              thesis.author_id && thesis.language_id && thesis.university_id
          );

        console.log(`Prepared ${thesesValues.length} valid thesis entries`);

        const uniqueThesesValues = Array.from(
          new Map(thesesValues.map((t) => [t.id, t])).values()
        );

        if (uniqueThesesValues.length > 0) {
          // Insert theses
          await transaction`
            INSERT INTO theses (
              id, author_id, language_id, title_original, title_translated,
              abstract_original, abstract_translated, year, university_id,
              institute_id, department_id, branch_id, thesis_type_id, detail_id_1,
              detail_id_2, page_count, pdf_url
            )
            SELECT * FROM unnest(
              ${sql.array(uniqueThesesValues.map((t) => t.id))}::integer[],
              ${sql.array(uniqueThesesValues.map((t) => t.author_id))}::uuid[],
              ${sql.array(
                uniqueThesesValues.map((t) => t.language_id)
              )}::uuid[],
              ${sql.array(
                uniqueThesesValues.map((t) => t.title_original)
              )}::text[],
              ${sql.array(
                uniqueThesesValues.map((t) => t.title_translated)
              )}::text[],
              ${sql.array(
                uniqueThesesValues.map((t) => t.abstract_original)
              )}::text[],
              ${sql.array(
                uniqueThesesValues.map((t) => t.abstract_translated)
              )}::text[],
              ${sql.array(uniqueThesesValues.map((t) => t.year))}::integer[],
              ${sql.array(
                uniqueThesesValues.map((t) => t.university_id)
              )}::uuid[],
              ${sql.array(
                uniqueThesesValues.map((t) => t.institute_id || null)
              )}::uuid[],
              ${sql.array(
                uniqueThesesValues.map((t) => t.department_id || null)
              )}::uuid[],
              ${sql.array(
                uniqueThesesValues.map((t) => t.branch_id || null)
              )}::uuid[],
              ${sql.array(
                uniqueThesesValues.map((t) => t.thesis_type_id || null)
              )}::uuid[],
              ${sql.array(
                uniqueThesesValues.map((t) => t.detail_id_1)
              )}::text[],
              ${sql.array(
                uniqueThesesValues.map((t) => t.detail_id_2)
              )}::text[],
              ${sql.array(
                uniqueThesesValues.map((t) => t.page_count)
              )}::integer[],
              ${sql.array(uniqueThesesValues.map((t) => t.pdf_url))}::text[]
            ) AS t(
              id, author_id, language_id, title_original, title_translated,
              abstract_original, abstract_translated, year, university_id,
              institute_id, department_id, branch_id, thesis_type_id, detail_id_1,
              detail_id_2, page_count, pdf_url
            )
            ON CONFLICT (id) DO UPDATE SET
              author_id = EXCLUDED.author_id,
              language_id = EXCLUDED.language_id,
              title_original = EXCLUDED.title_original,
              title_translated = EXCLUDED.title_translated,
              abstract_original = EXCLUDED.abstract_original,
              abstract_translated = EXCLUDED.abstract_translated,
              year = EXCLUDED.year,
              university_id = EXCLUDED.university_id,
              institute_id = EXCLUDED.institute_id,
              department_id = EXCLUDED.department_id,
              branch_id = EXCLUDED.branch_id,
              thesis_type_id = EXCLUDED.thesis_type_id,
              detail_id_1 = EXCLUDED.detail_id_1,
              detail_id_2 = EXCLUDED.detail_id_2,
              page_count = EXCLUDED.page_count,
              pdf_url = EXCLUDED.pdf_url
          `;
        }

        // Function to insert relation records
        const insertRelations = async (
          tableName: string,
          values: any[],
          idColumn: any
        ) => {
          if (values.length === 0) return;

          const uniqueValues = Array.from(
            new Map(
              values.map((v) => [`${v.thesis_id}-${v[idColumn]}`, v])
            ).values()
          ).filter((v) => v.thesis_id && v[idColumn]); // Ensure both IDs exist

          if (uniqueValues.length === 0) return;

          console.log(
            `Inserting ${uniqueValues.length} relations into ${tableName}`
          );

          await transaction`
            INSERT INTO ${sql(tableName)} (thesis_id, ${sql(idColumn)})
            SELECT * FROM unnest(
              ${sql.array(uniqueValues.map((v) => v.thesis_id))}::integer[],
              ${sql.array(uniqueValues.map((v) => v[idColumn]))}::uuid[]
            )
            ON CONFLICT DO NOTHING
          `;
        };

        // Insert all relations in parallel
        await Promise.all([
          // Insert advisor relations
          insertRelations(
            "thesis_advisors",
            batch.flatMap((thesis) =>
              (thesis.advisors || []).map((advisor) => ({
                thesis_id: thesis.thesis_id,
                advisor_id: advisorMap.get(advisor),
              }))
            ),
            "advisor_id"
          ),
          insertRelations(
            "thesis_subjects_turkish",
            batch.flatMap((thesis) =>
              (thesis.subjects_turkish || []).map((subject) => ({
                thesis_id: thesis.thesis_id,
                subject_id: subjectsTurkishMap.get(subject),
              }))
            ),
            "subject_id"
          ),
          insertRelations(
            "thesis_subjects_english",
            batch.flatMap((thesis) =>
              (thesis.subjects_english || []).map((subject) => ({
                thesis_id: thesis.thesis_id,
                subject_id: subjectsEnglishMap.get(subject),
              }))
            ),
            "subject_id"
          ),
          insertRelations(
            "thesis_keywords_turkish",
            batch.flatMap((thesis) =>
              (thesis.keywords_turkish || []).map((keyword) => ({
                thesis_id: thesis.thesis_id,
                keyword_id: keywordsTurkishMap.get(keyword),
              }))
            ),
            "keyword_id"
          ),
          insertRelations(
            "thesis_keywords_english",
            batch.flatMap((thesis) =>
              (thesis.keywords_english || []).map((keyword) => ({
                thesis_id: thesis.thesis_id,
                keyword_id: keywordsEnglishMap.get(keyword),
              }))
            ),
            "keyword_id"
          ),
        ]);

        console.log(`Successfully processed batch of ${batch.length} theses`);
      } catch (err) {
        console.error(`Error processing batch in file ${filePath}:`, err);
        throw err;
      }
    });
  }
}

async function main() {
  try {
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
  } catch (error) {
    console.error("An error occurred during processing:", error);
  } finally {
    await sql.end();
  }
}

main();
