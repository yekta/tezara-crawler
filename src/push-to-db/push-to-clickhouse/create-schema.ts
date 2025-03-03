import { NodeClickHouseClient } from "@clickhouse/client/dist/client";
import { client } from "./client";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);

export async function createSchema(
  client: NodeClickHouseClient
): Promise<void> {
  const queries = [
    `CREATE TABLE IF NOT EXISTS advisors (
        name String
    ) ENGINE = MergeTree()
    ORDER BY name`,

    `CREATE TABLE IF NOT EXISTS theses (
        id UInt32,
        author String,
        university String,
        institute String,
        year UInt32,
        thesis_type String,
        language String,
        page_count Nullable(UInt32),
        department Nullable(String),
        branch Nullable(String)
    ) ENGINE = MergeTree()
    ORDER BY id`,

    `CREATE TABLE IF NOT EXISTS subjects (
        name String,
        language String
    ) ENGINE = MergeTree()
    ORDER BY name`,

    `CREATE TABLE IF NOT EXISTS keywords (
        name String,
        language String
    ) ENGINE = MergeTree()
    ORDER BY name`,

    `CREATE TABLE IF NOT EXISTS thesis_keywords (
        thesis_id UInt32,
        keyword_name String
    ) ENGINE = MergeTree()
    ORDER BY (thesis_id, keyword_name)`,

    `CREATE TABLE IF NOT EXISTS thesis_subjects (
        thesis_id UInt32,
        subject_name String
    ) ENGINE = MergeTree()
    ORDER BY (thesis_id, subject_name)`,

    `CREATE TABLE IF NOT EXISTS thesis_advisors (
        thesis_id UInt32,
        advisor_name String
    ) ENGINE = MergeTree()
    ORDER BY (thesis_id, advisor_name)`,

    `DROP TABLE IF EXISTS thesis_subjects_by_university`,
    `CREATE MATERIALIZED VIEW thesis_subjects_by_university
      ENGINE = SummingMergeTree()
      ORDER BY (university, subject_name, subject_language)
      POPULATE
      AS
      SELECT 
          t.university,
          ts.subject_name,
          s.language as subject_language,
          count() AS count
      FROM theses t
          INNER JOIN thesis_subjects ts ON t.id = ts.thesis_id
          INNER JOIN subjects s ON ts.subject_name = s.name
          GROUP BY t.university, ts.subject_name, s.language`,

    `DROP TABLE IF EXISTS thesis_keywords_by_university`,
    `CREATE MATERIALIZED VIEW IF NOT EXISTS thesis_keywords_by_university
      ENGINE = SummingMergeTree()
      ORDER BY (university, keyword_name, keyword_language)
      POPULATE
      AS
      SELECT 
          t.university,
          tk.keyword_name,
          k.language as keyword_language,
          count() AS count
      FROM theses t
          INNER JOIN thesis_keywords tk ON t.id = tk.thesis_id
          INNER JOIN keywords k ON tk.keyword_name = k.name
          GROUP BY t.university, tk.keyword_name, k.language`,

    `DROP TABLE IF EXISTS universities`,
    `CREATE MATERIALIZED VIEW IF NOT EXISTS universities
      ENGINE = SummingMergeTree()
      ORDER BY (name)
      POPULATE
      AS
      SELECT
          t.university AS name,
          countDistinct(t.id) AS thesis_count,
          countDistinct(t.language) AS language_count,
          countDistinct(t.author) AS author_count,
          countDistinct(t.thesis_type) AS thesis_type_count,
          countDistinct(t.institute) AS institute_count,
          countDistinct(t.department) AS department_count,
          countDistinct(t.branch) AS branch_count,
          countDistinctIf(tk.keyword_name, k.language = 'Turkish' OR k.language IS NULL) AS keyword_count_turkish,
          countDistinctIf(ts.subject_name, s.language = 'Turkish' OR s.language IS NULL) AS subject_count_turkish,
          countDistinctIf(tk.keyword_name, k.language = 'English' OR k.language IS NULL) AS keyword_count_english,
          countDistinctIf(ts.subject_name, s.language = 'English' OR s.language IS NULL) AS subject_count_english,
          MIN(t.year) AS year_start,
          MAX(t.year) AS year_end
      FROM theses t
      LEFT JOIN thesis_keywords tk
          ON t.id = tk.thesis_id
      LEFT JOIN thesis_subjects ts
          ON t.id = ts.thesis_id
      LEFT JOIN keywords AS k
          ON k.name = tk.keyword_name
      LEFT JOIN subjects AS s
          ON s.name = ts.subject_name
      GROUP BY t.university
      ORDER BY thesis_count DESC`,

    `DROP TABLE IF EXISTS subject_stats`,
    `CREATE MATERIALIZED VIEW IF NOT EXISTS subject_stats
      ENGINE = SummingMergeTree()
      ORDER BY (name)
      POPULATE
      AS
      SELECT
        s.name AS name,
        s.language AS language,
        countDistinct (t.id) AS thesis_count,
        countDistinct (t.language) AS language_count,
        countDistinct (t.author) AS author_count,
        countDistinct (t.thesis_type) AS thesis_type_count,
        countDistinct (t.university) AS university_count,
        countDistinct (t.institute) AS institute_count,
        countDistinct (t.department) AS department_count,
        countDistinct (t.branch) AS branch_count,
        countDistinctIf (
          tk.keyword_name,
          k.language = 'Turkish'
          OR k.language IS NULL
        ) AS keyword_count_turkish,
        countDistinctIf (
          tk.keyword_name,
          k.language = 'English'
          OR k.language IS NULL
        ) AS keyword_count_english,
        MIN(t.year) AS year_start,
        MAX(t.year) AS year_end
      FROM
        theses t
        LEFT JOIN thesis_keywords tk ON t.id = tk.thesis_id
        INNER JOIN thesis_subjects ts ON t.id = ts.thesis_id
        LEFT JOIN keywords AS k ON k.name = tk.keyword_name
        INNER JOIN subjects AS s ON s.name = ts.subject_name
      GROUP BY
        s.name,
        s.language
      ORDER BY
        thesis_count DESC`,
  ];

  for (const query of queries) {
    try {
      await client.query({ query });
      console.log("Table created/exists");
    } catch (err) {
      console.error("Error creating table:", err);
    }
  }
}

if (process.argv[1] === __filename) {
  createSchema(client).catch((err) => {
    console.error("Unhandled error in main:", err);
    process.exit(1);
  });
}
