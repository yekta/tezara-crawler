import { cleanUniversity } from "../helpers";
import { Thesis } from "../types";

export function cleanText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[\r\n\t\f\v]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s?"([^\"]*)"\s?/g, "“$1”")
    .trim();
}

export function parseLocationInfo(locationText: string): {
  university: string | null;
  institute: string | null;
  department: string | null;
  branch: string | null;
} {
  if (!locationText) {
    return {
      university: null,
      institute: null,
      department: null,
      branch: null,
    };
  }

  const parts = locationText
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return {
    university: parts[0] || null,
    institute: parts[1] || null,
    department: parts[2] || null,
    branch: parts[3] || null,
  };
}

export function extractAbstractAndKeywords(
  text: string
): [string, string | null] {
  if (!text) {
    return ["", null];
  }

  const keywordMarkers = [
    "Anahtar Kelimeler:",
    "Anahtar kelimeler:",
    "Anahtar Sözcükler:",
    "Anahtar sözcükler:",
    "Keywords:",
    "Key Words:",
    "Key words:",
    "Anahtar kavramlar:",
    "Key terms:",
  ];

  let splitIndex = -1;
  let foundMarker = "";

  for (const marker of keywordMarkers) {
    const pos = text.indexOf(marker);
    if (pos !== -1 && (splitIndex === -1 || pos < splitIndex)) {
      splitIndex = pos;
      foundMarker = marker;
    }
  }

  if (splitIndex === -1) {
    return [text.trim(), null];
  }

  const abstract = text.slice(0, splitIndex).trim();
  let keywords = text.slice(splitIndex + foundMarker.length).trim();

  keywords = keywords.replace(/^[:\s,]+/, "").replace(/[\s,]+$/, "");

  return [abstract, keywords];
}

export function shapeThesis(thesis: Thesis) {
  const id = thesis.thesis_id;
  const year = thesis.year;
  return {
    ...thesis,
    thesis_id: id !== undefined && id !== null ? Number(id) : null,
    year: year !== undefined && year !== null ? Number(year) : null,
    university: cleanUniversity(thesis.university),
  };
}
