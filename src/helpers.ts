import { createHash } from "node:crypto";

export function cleanUniversity(
  university: string | null | undefined
): string | null {
  if (!university) return null;
  if (university.length < 1) return null;
  return university.startsWith(",") ? university.slice(1) : university;
}

export function cleanAdvisors(
  advisors: string[] | null | undefined
): string[] | null {
  if (!advisors) return null;
  if (advisors.length < 1) return null;
  return advisors.filter((a) => !a.includes("Yer Bilgisi:"));
}

export function md5Hash(data: string) {
  return createHash("md5").update(data).digest("hex");
}
