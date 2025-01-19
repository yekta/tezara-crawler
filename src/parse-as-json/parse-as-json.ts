import { parse as acornParse } from "acorn";
import { simple as walk } from "acorn-walk";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const parseErrors: string[] = [];

// Convert AST ObjectExpression to JSON
const astNodeToJson = (node: any): object | null => {
  if (node.type !== "ObjectExpression") return null;

  const result: any = {};
  node.properties.forEach((prop: any) => {
    if (prop.type === "Property" && prop.key.type === "Identifier") {
      const key = prop.key.name;
      let value: any = null;

      switch (prop.value.type) {
        case "Literal":
          value = prop.value.value;
          break;
        case "ObjectExpression":
          value = astNodeToJson(prop.value);
          break;
        default:
          console.warn(`Unsupported value type: ${prop.value.type}`);
      }

      result[key] = value;
    }
  });

  return result;
};

// Extract `var doc` and detect `getData` function
const extractDataFromScript = (scriptContent: string) => {
  let hasGetData = false;
  const varDocs: object[] = [];

  try {
    const ast = acornParse(scriptContent, {
      ecmaVersion: "latest",
      sourceType: "script",
    });

    walk(ast, {
      // Detect `getData` function
      FunctionDeclaration(node: any) {
        if (node.id?.name === "getData") {
          hasGetData = true;
        }
      },
      // Detect `var doc = { ... }`
      VariableDeclaration(node: any) {
        node.declarations.forEach((decl: any) => {
          if (
            decl.id?.name === "doc" &&
            decl.init?.type === "ObjectExpression"
          ) {
            const jsonObject = astNodeToJson(decl.init);
            if (jsonObject) {
              varDocs.push(jsonObject);
            }
          }
        });
      },
    });
  } catch (error) {
    console.error("Error parsing script content:", error);
    // Do not throw, since we handle it further up
  }

  return { hasGetData, varDocs };
};

let totalExtractedCount = 0;

// Process a single HTML file
const processFile = (filePath: string, outputDir: string) => {
  try {
    const htmlContent = fs.readFileSync(filePath, "utf8");

    // 1. Use Cheerio to parse the HTML
    let $ = cheerio.load(htmlContent);

    // 2. Extract all <script> tags
    const scriptElements = $("script");
    console.log(`Found ${scriptElements.length} script tags in ${filePath}`);

    let hasGetData = false;
    const extractedDocs: object[] = [];

    scriptElements.each((_, scriptEl) => {
      const scriptContent = $(scriptEl).text().trim();
      if (scriptContent) {
        const { hasGetData: foundGetData, varDocs } =
          extractDataFromScript(scriptContent);

        if (foundGetData) {
          hasGetData = true;
        }
        extractedDocs.push(...varDocs);
      }
    });

    // Ensure `getData` exists, or record parse error
    if (!hasGetData) {
      console.error(`Error: Missing "getData" function in ${filePath}`);
      parseErrors.push(filePath);
      // Clean up
      $ = null as any;
      return;
    }

    // If no "var doc" found, skip writi ng JSON
    if (extractedDocs.length === 0) {
      console.log(`No "var doc" found in ${filePath}, skipping.`);
      // Clean up
      $ = null as any;
      return;
    }

    // Accumulate counts for global tracking
    const transformedDocs = extractedDocs.map((doc) => transformDoc(doc));
    totalExtractedCount += extractedDocs.length;

    // Write results to the corresponding JSON file
    const outputFileName = path.basename(filePath, ".html") + ".json";
    const outputPath = path.join(outputDir, outputFileName);

    fs.writeFileSync(outputPath, JSON.stringify(transformedDocs, null, 2));
    console.log(
      `Processed ${filePath} -> ${outputPath}. Entries extracted: ${transformedDocs.length}`
    );

    // Release Cheerio references
    $ = null as any;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    parseErrors.push(filePath);
  }
};

// Process all files
const processAllFiles = () => {
  // We assume this script is under src/, so ../downloads will be the correct path
  const inputDir = path.resolve(__dirname, "../downloads");
  const outputDir = path.resolve(__dirname, "../jsons");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files = fs
    .readdirSync(inputDir)
    .filter((file) => file.endsWith(".html"));

  files.forEach((file) => {
    const filePath = path.join(inputDir, file);
    processFile(filePath, outputDir);
  });

  console.log(
    `\nTotal extracted entries across all files: ${totalExtractedCount}`
  );

  // Write parse-errors.txt if there are any
  if (parseErrors.length > 0) {
    // Use outputDir, then go one level up (..) so parse-errors.txt sits at the same level as jsons.
    const errorsPath = path.join(outputDir, "../json-parse-errors.txt");

    fs.writeFileSync(errorsPath, parseErrors.join("\n"), "utf8");
    console.log(
      `\nEncountered errors in ${parseErrors.length} file(s). Names saved to ${errorsPath}`
    );
  }
};

// Execute the script
processAllFiles();

function parseUserId(userIdHtml: string) {
  const match = userIdHtml.match(
    /onclick=tezDetay\('([^']+)','([^']+)'\)>(.*?)<\/span>/
  );
  if (!match) {
    return { thesis_id: null, id1: null, id2: null };
  }
  const [, id_1, id_2, thesisId] = match;
  return {
    thesis_id: thesisId,
    id_1,
    id_2,
  };
}

function parseTitles(weightHtml: string) {
  const $ = cheerio.load(weightHtml || "");
  const translatedSpan = $("span[style*='font-style: italic']");
  const title_translated = translatedSpan.text().trim();

  translatedSpan.remove();

  $("br").replaceWith(" ");

  const title_original = $.root().text().trim();

  return { title_original, title_translated };
}

function parseSubjects(someDate: string) {
  const subjectPairs = (someDate || "").split(";").map((x) => x.trim());

  const subjects_turkish: string[] = [];
  const subjects_english: string[] = [];

  subjectPairs.forEach((pair) => {
    // e.g. "Biyoloji = Biology"
    const [turk, eng] = pair.split("=").map((x) => x.trim());
    if (turk) subjects_turkish.push(turk);
    if (eng) subjects_english.push(eng);
  });

  return { subjects_turkish, subjects_english };
}

function transformDoc(originalDoc: any) {
  const { thesis_id, id_1, id_2 } = parseUserId(originalDoc.userId || "");

  const { title_original, title_translated } = parseTitles(
    originalDoc.weight || ""
  );

  const { subjects_turkish, subjects_english } = parseSubjects(
    originalDoc.someDate || ""
  );

  return {
    thesis_id,
    id_1,
    id_2,
    name: originalDoc.name,
    year: originalDoc.age,
    title_original,
    title_translated,
    university: originalDoc.uni,
    language: originalDoc.height,
    thesis_type: originalDoc.important,
    subjects_turkish,
    subjects_english,
  };
}
