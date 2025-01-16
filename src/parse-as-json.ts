import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";
import { parse } from "acorn";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extracts `var doc` objects from a single HTML file
const extractVarDocs = (html: string): object[] => {
  const varDocs: object[] = [];

  const dom = new JSDOM(html);
  const scriptElements = dom.window.document.querySelectorAll("script");

  scriptElements.forEach((script) => {
    if (script.textContent) {
      try {
        const ast = parse(script.textContent, { ecmaVersion: "latest" });

        traverseAST(ast, (node) => {
          if (
            node.type === "VariableDeclaration" &&
            node.declarations &&
            node.declarations[0].id.name === "doc"
          ) {
            const initNode = node.declarations[0].init;

            if (initNode && initNode.type === "ObjectExpression") {
              const jsonObject = astNodeToJson(initNode);
              if (jsonObject) {
                varDocs.push(jsonObject);
              }
            }
          }
        });
      } catch (error) {
        console.error("Error parsing JavaScript:", error);
      }
    }
  });

  return varDocs;
};

// Traverse the AST
const traverseAST = (node: any, callback: (node: any) => void) => {
  callback(node);
  for (const key in node) {
    if (node[key] && typeof node[key] === "object") {
      traverseAST(node[key], callback);
    }
  }
};

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

// Process all HTML files in the `../downloads` folder
const processFiles = async () => {
  const downloadsDir = path.resolve(__dirname, "../downloads");
  const jsonsDir = path.resolve(__dirname, "../jsons");

  if (!fs.existsSync(jsonsDir)) {
    fs.mkdirSync(jsonsDir, { recursive: true });
  }

  const files = fs
    .readdirSync(downloadsDir)
    .filter((file) => file.endsWith(".html"));

  for (const file of files) {
    const filePath = path.join(downloadsDir, file);
    const outputFilePath = path.join(jsonsDir, file.replace(".html", ".json"));

    try {
      const htmlContent = fs.readFileSync(filePath, "utf8");
      const extractedDocs = extractVarDocs(htmlContent);

      // Write the extracted docs to a JSON file
      fs.writeFileSync(
        outputFilePath,
        JSON.stringify(extractedDocs, null, 2),
        "utf8"
      );
      console.log(`Processed ${file} -> ${outputFilePath}`);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }
};

// Run the script
processFiles().catch((err) => console.error(err));
