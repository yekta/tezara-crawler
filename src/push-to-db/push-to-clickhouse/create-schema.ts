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
        branch Nullable(String),
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
  ];

  for (const query of queries) {
    try {
      const res = await client.query({ query });
      const json = await res.json();
      console.log("Table created/exists:", json);
    } catch (err) {
      console.error("Error creating table:", err);
    }
  }
}
