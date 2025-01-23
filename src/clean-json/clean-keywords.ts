import {
  cleanAfter,
  includesAll,
  parseNumberedStringAsList,
  replaceCharacters,
  splitBy,
} from "./helpers";

export function cleanKeywords({ keywords }: { keywords: string[] }) {
  let cleanedKeywords = [...keywords];

  cleanedKeywords = cleanAfter({
    items: cleanedKeywords,
    words: [
      "Özet:",
      "ÖZET",
      "Özet :",
      "özet:",
      "Bu çalışma",
      "Bu çalısma",
      ": Bu araştırma",
      "Bu araştırma",
      "ABSTRACT",
      "OBJECTIVES",
      "İÇİNDEKİLER",
      "JÜRİ:",
      "SUMMARY",
      ". Anahtar Sözcükler:",
      "Anahtar Sözcükler:",
      "Amaç:",
      "Bu Çalışma",
    ],
  });

  cleanedKeywords = splitBy({
    items: cleanedKeywords,
    by: ";",
  });

  const isDottedList = includesAll({
    array: cleanedKeywords,
    keywords: ["1.", "2.", "3."],
  });
  const isParenthesesList = includesAll({
    array: cleanedKeywords,
    keywords: ["1)", "2)", "3)"],
  });
  const isBothParenthesesList = includesAll({
    array: cleanedKeywords,
    keywords: ["(1)", "(2)", "(3)"],
  });
  const isDashedList = includesAll({
    array: cleanedKeywords,
    keywords: ["1-", "2-", "3-"],
  });

  if (
    cleanedKeywords &&
    (isDottedList || isParenthesesList || isBothParenthesesList || isDashedList)
  ) {
    cleanedKeywords = parseNumberedStringAsList(cleanedKeywords.join(" "));
  }

  let longKeywordIndex = -1;
  for (let i = 0; i < cleanedKeywords.length; i++) {
    if (cleanedKeywords[i].length > 90) {
      longKeywordIndex = i;
      break;
    }
  }
  if (longKeywordIndex !== -1) {
    cleanedKeywords = cleanedKeywords.slice(0, longKeywordIndex);
  }

  cleanedKeywords = replaceCharacters({
    array: cleanedKeywords,
    characters: [
      {
        toReplace: " ",
        replaceWith: "",
      },
      {
        toReplace: "‎",
        replaceWith: "",
      },
      {
        toReplace: "",
        replaceWith: "ı",
      },
      {
        toReplace: "",
        replaceWith: "",
      },
      {
        toReplace: "",
        replaceWith: "",
      },
      {
        toReplace: "",
        replaceWith: "ı",
      },
      {
        toReplace: "",
        replaceWith: "",
      },
      {
        toReplace: "",
        replaceWith: "",
      },
      {
        toReplace: "",
        replaceWith: "",
      },
      {
        toReplace: "",
        replaceWith: "",
      },
    ],
  });

  cleanedKeywords = cleanedKeywords
    .map((s) => s.trim())
    .map((s) => (s.endsWith(".") ? s.slice(0, -1) : s))
    .map((s) => s.trim())
    .filter((s) => s);

  return cleanedKeywords;
}
