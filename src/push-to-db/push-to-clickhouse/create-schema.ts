import { NodeClickHouseClient } from "@clickhouse/client/dist/client";

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
    `CREATE MATERIALIZED VIEW thesis_subject_counts
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
    `CREATE MATERIALIZED VIEW IF NOT EXISTS thesis_keyword_counts
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
