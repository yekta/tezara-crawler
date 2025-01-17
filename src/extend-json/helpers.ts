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
  };
}

export type Thesis = {
  thesis_id: string | null;
  id_1: string | null;
  id_2: string | null;
  name: string | null;
  year: string | null;
  title_original: string | null;
  title_translated: string | null;
  university: string | null;
  language: string | null;
  thesis_type: string | null;
  subjects_turkish: string[] | null;
  subjects_english: string[] | null;
};

export type Extention = {
  tez_no: number | null;
  pdf_url: string | null;
  advisors: string[] | null;
  pages: number | null;
  abstract_original: string | null;
  abstract_translated: string | null;
  keywords_turkish: string[] | null;
  keywords_english: string[] | null;
  status: string | null;
  institute: string | null;
  department: string | null;
  branch: string | null;
};

export type ThesisExtended = Omit<Thesis, "thesis_id" | "year"> &
  Extention & {
    thesis_id: number | null;
    year: number | null;
  };
