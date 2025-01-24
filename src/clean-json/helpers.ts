import fs from "node:fs";

export function createOrAppendToFile({
  path,
  data,
}: {
  path: string;
  data: string[];
}) {
  const dir = path.substring(0, path.lastIndexOf("/"));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(path)) {
    fs.writeFileSync(path, data.join("\n"));
  } else {
    fs.appendFileSync(path, "\n" + data.join("\n"));
  }
}

export function cleanAfter({
  items,
  words,
}: {
  items: string[];
  words: string[];
}) {
  words.forEach((word) => {
    items = cleanAfterWord({ items, word });
  });
  return items;
}

function cleanAfterWord({
  items,
  word,
}: {
  items: string[];
  word: string;
}): string[] {
  if (items.some((keyword) => keyword.includes(word))) {
    const index = items.findIndex((keyword) => keyword.includes(word));
    const characterIndex = items[index].indexOf(word);
    items[index] = items[index].slice(0, characterIndex);
    items = items.slice(0, index + 1);
  }
  return items;
}

export function splitBy({
  items,
  by,
}: {
  items: string[];
  by: string;
}): string[] {
  let all: string[] = [];
  items.forEach((item) => {
    all = all.concat(item.split(by));
  });
  return all;
}

export function parseNumberedStringAsList(input: string): string[] {
  if (!input.match(/^(?:1[\.\)\-]|\(1\))/)) {
    return [input];
  }

  const regex =
    /(?:\d+[\.\)\-]|\(\d+\))\s*([^\d\.\)\-\(]+?)(?=\s*(?:\d+[\.\)\-]|\(\d+\))|$)/g;
  const matches = Array.from(input.matchAll(regex)).map((m) => m[1].trim());

  return matches.length ? matches : [];
}

export function includesAll({
  array,
  keywords,
}: {
  array: string[];
  keywords: string[];
}): boolean {
  for (const keyword of keywords) {
    if (!array.join(" ").includes(keyword)) {
      return false;
    }
  }
  return true;
}

export function replaceCharacters({
  array,
  characters,
}: {
  array: string[];
  characters: { toReplace: string; replaceWith: string }[];
}): string[] {
  return array.map((item) => {
    characters.forEach((c) => {
      item = item.replaceAll(c.toReplace, c.replaceWith);
    });
    return item;
  });
}

export function trimStrings(input: string, toTrim: string[]): string {
  const escapeRegExp = (str: string) =>
    str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedTrim = toTrim.map(escapeRegExp).join("|");
  const regex = new RegExp(`^(?:${escapedTrim})+|(?:${escapedTrim})+$`, "g");
  return input.replace(regex, "");
}
