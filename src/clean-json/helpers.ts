import fs from "node:fs";

export function createOrAppendToFile({
  path,
  data,
}: {
  path: string;
  data: string[];
}) {
  if (!fs.existsSync(path)) {
    fs.writeFileSync(path, data.join("\n"));
  } else {
    fs.appendFileSync(path, "\n" + data.join("\n"));
  }
}
