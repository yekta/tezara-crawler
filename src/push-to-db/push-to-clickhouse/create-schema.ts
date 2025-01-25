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

    `DROP TABLE IF EXISTS thesis_subject_counts`,
    `DROP TABLE IF EXISTS thesis_subject_stats`,
    `CREATE MATERIALIZED VIEW thesis_subject_stats
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

    `DROP TABLE IF EXISTS thesis_keyword_counts`,
    `DROP TABLE IF EXISTS thesis_keyword_stats`,
    `CREATE MATERIALIZED VIEW IF NOT EXISTS thesis_keyword_stats
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
      ORDER BY (university)
      POPULATE
      AS
      SELECT 
          university,
          COUNT() AS thesis_count,
          COUNT(DISTINCT language) AS language_count,
          COUNT(DISTINCT author) AS author_count,
          COUNT(DISTINCT thesis_type) AS thesis_type_count,
          MIN(year) AS year_start,
	        MAX(year) AS year_end
      FROM theses
      GROUP BY university`,

    `DROP TABLE IF EXISTS university_stats`,
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
