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
      "Tezin sayfa adedi:",
      "Sayfa sayısı :",
      "Sayfa Sayısı :",
      "Sayfa Adedi:",
      "Sayfa Adedi :",
      "Sayfa adedi",
      "Tez danışmanı:",
      "Destekleyen kurum ve kuruluşlar:",
      "Destekleyen kurumlar :",
      "Destekleyen Kurumlar :",
      "Destekleyen Kuruluş:",
      "Destekleyen kurum: ",
      "Destekleyen kuruluşlar:",
      "Destekleyen kuruluş:",
      "Destekleyen Kurumlar:",
      "Destekleyen kurumlar:",
      "Destekleyen Kuruluşlar:",
      "Destekleyen Kurum:",
      "Destek Kuruluş :",
      "Danışman:",
      "OBJECTIVES",
      "İÇİNDEKİLER",
      "İletişim adresi:",
      "JÜRİ:",
      "SUMMARY",
      ". Anahtar Sözcükler:",
      "Anahtar Sözcükler:",
      "Amaç:",
      "Bu Çalışma",
      "Supported by",
      "Abstract:",
      "Pages:",
      "Thesis Supervisor:",
      "Thesis Advisor:",
      "Advisor:",
      "Page Number:",
      "Page number :",
      "Sayfa Numarası : ",
      "Number:",
      "Anabilim Dalı Sayısal Kodu:",
      "Anabil im Dalı sayısal kodu:",
      "Anabilin Dalı Sayısal Kodu:",
      "Anabilim dalı Sayısal Kodu:",
      "Anabil im Dalı Kodu:",
      "Anabilim Sayısal Kodu:",
      "Bilim dalı sayısal kodu :",
      "Sayısal Bilim Kodları : ",
      "Sayı sal Bi l i m Kodu:",
      "Bilim Dalx Sayxsal Kodu :",
      "BİLİM DALI SAYISAL KODU:",
      "Bi lim Sayısal Kodu:",
      "Bilim Dalı sayısal Kodu :",
      "Bilim Balı Sayısal kodu:",
      "Bilim Dalı Sayısal Kodları :",
      "Bilim DaÛ Sayisal Kodu:",
      "Bilim Dali Sayısal Kodu:",
      "Biim Dalı Sayısal Kodu:",
      "Bilim Dali Sayisal Kodu:",
      "Bilim Dalı Sayısal Kodlan:",
      "Bilim Dalı Sayısal kodu:",
      "Bilim dalı sayısal kodu:",
      "Bilim dal i sayisal kodu:",
      "Bilim Sayısal Kodu:",
      "Bilim Dalı Sayısal Kodu :",
      "Bilim Dalı Sayısal Kodu:",
      "Bilim Dalı sayısal Kodu:",
      "Bilîmdah sayısal kodu:",
      "Bilim Dah Sayısal Kodu:",
      "Bilim Pah Sayısal Kodu:",
      "Bilim Dal Saysal Kodu:",
      "Bilim dalı kodu:",
      "Bilim Dalı kodu:",
      "Bilim sayısal kodu:",
      "Bilim Dalı Kodu :",
      "Bilimdalı Kodu:",
      "Bilim kodu :",
      "Bilim Dalı Kodu:",
      "Bilim Alanı Kodu:",
      "Bilim Dall Saylsal Kodu:",
      "Bilim Dalı SayısalKodu:",
      "Anabilim Dalı KLodu:",
      "Bilim Dal i Şayi sal Kodu:",
      "Bilim Dalı Sayışıl Kodu:",
      "Anabil im dalı kodu:",
      "Bilim Sayisal Kodu:",
      "Bilim dala kodu:",
      "Bilin Kodu:",
      "BBim Kodu:",
      "Bilim Kodu :",
      "Bilim kodu:",
      "Bilim Kodu:",
      "Bilimsel Kod:",
      "Büim Kodu",
      "Biüm Kodu",
      "Sayısal Kod:",
      "Sayısal Kodu :",
      "Science Code:",
      "Scientific Code:",
      "Sicience Code:",
      "Numeric Code:",
      "Selence Code:",
      "Science Code :",
      "ScienceCode:",
      "Seience Code:",
      "Scieııce Code:",
      "Sayısal Kodlar:",
      "Bilim Dalı Sayisal Kodu:",
      "Bilim dali Sayisal Kodu:",
      "JEL Sınıflaması:",
      "Sayısal Kodu:",
      "Ana Bilini Dalı Kodu:",
      "Bilimdab sayısal kodlan :",
      "Bilim Dalı Sayısal Kudu:",
      "Bili m Kod u :",
      "BİLİM SAYISAL KODU :",
      "JEL KODLARI:",
      "Jel Kodları:",
      "JEL Kodu:",
      "Anabilim Dalı Kodu:",
      "Bilim Sayısal kodu",
      "Bilimdalı sayısal kodu:",
      "Bilim Dah sayısal Kodu:",
      "Bilim Dalı sayısal kodu:",
      "Bilim Dalı Sayıal Kodu:",
      "Bilim Dalx Kodu:",
      "BİLİM DALI SAYISAL KDDU:",
      "Bilim Dalı Sayısı Kodu:",
      "Anabilim Dalı Saysal Kodu:",
      "Bilim kodları:",
      "Bilim Dali Kodu:",
      "Anabilim Dalı sayısal Kodu:",
      "Bilim Dalı Kodları:",
      "Bilim Dalı Sayısal kodu :",
      "Bilim Dalı Saysal Kodu :",
      "Bilim Dalı Sayısal Codu:",
      "Bilim dalı Sayisal Kodu:",
      "Bilim Dalı Sayısal Kodları:",
      "Bilim Dafi Saysal kodu:",
      "Anabilim dalı sayısal kodu:",
      "Bili aa -Ddı ^ayı^rl &du:",
      "Bilim Dalı sayısal Kodu:",
      "Bilim Dah Kodu:",
      "Bilim Sayı Kodu:",
      "Bilim Kodu",
      "Bilim Codu :",
      "Bilim Dalı Savısal Kodu:",
      "Kod:",
      "code:",
      "Kodu:",
      "JEL Classification Codes:",
      "JEL Sınıflandırması:",
      "JEL Classification:",
      "JEL classification:",
      "JEL Codes:",
      "JEL Code:",
      "JEL Kod:",
      "JEL cods:",
      "Ana BUİm Dalı Koda:",
      "JEL Kodları:",
      "Jel Sınıflandırması:",
      "Tezin Sayfa Adeti:",
      "Sayfa sayısı:",
      "Sayfa Adeti:",
      "Sayfası Adedi:",
      "Sayfa:",
      "Sayfa Sayısı:",
      "Teşekkür:",
      "Elektronik posta adresi:",
      "e-mail:",
      "e-mail :",
      "E-posta :",
      "e-posta:",
      "E-posta:",
      "E-mail:",
      "E mail:",
      "e- mail:",
      "e-posta :",
      "İletişim Adresi:",
      "Yazar Adı :",
      "Yazar adı:",
      "Yazar Adı:",
      "Yazar:",
      "Yazar :",
      "YardımcıDanıman:",
      "Tez Danışmanı:",
      "Tez yöneticisi:",
      "Danışmanlar:",
      "Danısmanlar:",
      "Danisman:",
      "Danışman :",
      "Danış man:",
      "Danıman:",
      "Danı man:",
      "Dan man:",
      "Danısman:",
      "Danışmanı :",
      "Danışmanı:",
      "Supervisor:",
      "Kabul Edildiği Yıl:",
      "ĠletiĢim Adresi:",
      "Tezin Başlığı:",
      "Tarih:",
      "Tarih :",
      "This document was",
      "Not:",
      "sayfa:",
      "Tez Yöneticisi:",
      "Tezi Hazırlayan:",
      "Yazışma Adresi:",
      "Yıl:",
      "Yıl :",
      "Konu:",
      "Yazan:",
      "Araştırma Proje No:",
      "(proje no:",
      "(Proje no:",
      "Proje no:",
      "GİRİŞ:",
      "Bu proje",
      "İletişim adresleri:",
      "İletişim:",
      "http://",
      "özet :",
      "Tez Yöneticisi :",
      "JURİ:",
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
      {
        toReplace: "",
        replaceWith: "",
      },
      {
        toReplace: "",
        replaceWith: "",
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

function cleanWordWithSplit({
  input,
  wordToRemove,
}: {
  input: string[];
  wordToRemove: string;
}) {
  const array = [...input];
  return array.flatMap((item) => {
    const parts = item.split(wordToRemove).map((part) => part.trim());
    return parts.length > 1 ? parts : item;
  });
}

export function cleanWordsWithSplit({ input }: { input: string[] }) {
  const wordsToRemove = [
    "Anahtar Kelimeler:",
    "Anahtar kelimeler:",
    "Anahtar sözcükler:",
    "Anahtar Ek Kelimeler:",
    "Kelimeler:",
  ];
  let array = [...input];
  for (const wordToRemove of wordsToRemove) {
    array = cleanWordWithSplit({ input: array, wordToRemove });
  }
  array = array.filter((s) => s);
  return array;
}

function splitIntoBeforeAndAfter({
  input,
  keyword,
}: {
  input: string[];
  keyword: string;
}) {
  const array = [...input];

  const beforeSplit: string[] = [];
  const afterSplit: string[] = [];
  let keywordFound = false; // Tracks if the keyword has been encountered

  array.forEach((item) => {
    if (keywordFound) {
      // Once the keyword is found, all subsequent items go to afterSplit
      afterSplit.push(item.trim());
    } else if (item.includes(keyword)) {
      // If the keyword is in the current item, split it
      const keywordIndex = item.indexOf(keyword);
      const beforePart = item.slice(0, keywordIndex).trim();
      const afterPart = item.slice(keywordIndex + keyword.length).trim();

      if (beforePart) beforeSplit.push(beforePart);
      if (afterPart) afterSplit.push(afterPart);

      // Mark that the keyword has been found
      keywordFound = true;
    } else {
      // Items before the keyword go to beforeSplit
      beforeSplit.push(item.trim());
    }
  });

  return { beforeSplit, afterSplit };
}

export function splitArrayIntoBeforeAndAfter({ input }: { input: string[] }) {
  const keywords = ["Keywords:", "Key Words:"];
  for (const keyword of keywords) {
    const { beforeSplit, afterSplit } = splitIntoBeforeAndAfter({
      input,
      keyword,
    });
    if (beforeSplit.length > 0 && afterSplit.length > 0) {
      return {
        beforeSplit,
        afterSplit,
      };
    }
  }
  return {
    beforeSplit: input,
    afterSplit: [],
  };
}
