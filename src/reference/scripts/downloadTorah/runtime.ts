import fs from "node:fs/promises";
import path from "node:path";

export const API_BASE = "https://www.sefaria.org/api/texts/";
export const BOOKS = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"] as const;
export const DEFAULT_OUT = path.resolve(process.cwd(), "data", "torah.json");

type LangOption = "he" | "en" | "both";

export type DownloadTorahOptions = {
  out: string;
  lang: LangOption;
  heVersion: string | null;
  enVersion: string | null;
};

type SefariaPayload = {
  he?: unknown;
  text?: unknown;
  heVersionTitle?: string | null;
  versionTitle?: string | null;
  heVersionSource?: string | null;
  versionSource?: string | null;
};

type FetchedBook = {
  he: unknown;
  en: unknown;
  meta: {
    he: SefariaPayload | null;
    en: SefariaPayload | null;
  };
};

type VersePayload = {
  n: number;
  he?: string;
  en?: string;
};

type ChapterPayload = {
  n: number;
  verses: VersePayload[];
};

type BookPayload = {
  name: string;
  chapters: ChapterPayload[];
  meta: {
    heVersionTitle: string | null;
    heVersionSource: string | null;
    enVersionTitle: string | null;
    enVersionSource: string | null;
  };
};

export function printHelp(): void {
  console.log("Usage:");
  console.log("  node scripts/download-torah.mjs [--out=path] [--lang=he|en|both]");
  console.log('  node scripts/download-torah.mjs --he-version="..." --en-version="..."');
  console.log("");
  console.log("Defaults:");
  console.log(`  --out=${DEFAULT_OUT}`);
  console.log("  --lang=both");
}

export function parseArgs(argv: string[]): DownloadTorahOptions {
  const opts: DownloadTorahOptions = {
    out: DEFAULT_OUT,
    lang: "both",
    heVersion: null,
    enVersion: null
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg.startsWith("--out=")) {
      opts.out = arg.slice("--out=".length);
      continue;
    }
    if (arg.startsWith("--lang=")) {
      const lang = arg.slice("--lang=".length);
      if (lang === "he" || lang === "en" || lang === "both") {
        opts.lang = lang;
        continue;
      }
      throw new Error(`Invalid --lang value: ${lang}`);
    }
    if (arg.startsWith("--he-version=")) {
      opts.heVersion = arg.slice("--he-version=".length);
      continue;
    }
    if (arg.startsWith("--en-version=")) {
      opts.enVersion = arg.slice("--en-version=".length);
      continue;
    }
  }

  return opts;
}

export function normalizeChapters(input: unknown): string[][] {
  if (Array.isArray(input)) {
    if (input.length === 0) {
      return [];
    }
    if (Array.isArray(input[0])) {
      return input.map((chapter) =>
        Array.isArray(chapter) ? chapter.map((verse) => String(verse)) : [String(chapter)]
      );
    }
    return [input.map((verse) => String(verse))];
  }
  if (typeof input === "string") {
    return [[input]];
  }
  return [];
}

export async function fetchJson(url: string, retries = 3): Promise<SefariaPayload> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return (await response.json()) as SefariaPayload;
    } catch (err) {
      lastError = err;
      const delayMs = 200 * attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

export function buildUrl(book: string, lang: string | null, version: string | null): string {
  const params = new URLSearchParams({
    pad: "0",
    commentary: "0",
    context: "0"
  });
  if (lang) {
    params.set("lang", lang);
  }
  if (version) {
    params.set("version", version);
  }
  return `${API_BASE}${encodeURIComponent(book)}?${params.toString()}`;
}

export async function fetchBook(book: string, opts: DownloadTorahOptions): Promise<FetchedBook> {
  if (opts.lang === "he") {
    const data = await fetchJson(buildUrl(book, "he", opts.heVersion));
    return { he: data.he ?? [], en: null, meta: { he: data, en: null } };
  }
  if (opts.lang === "en") {
    const data = await fetchJson(buildUrl(book, "en", opts.enVersion));
    return { he: null, en: data.text ?? [], meta: { he: null, en: data } };
  }

  if (opts.heVersion || opts.enVersion) {
    const [heData, enData] = await Promise.all([
      fetchJson(buildUrl(book, "he", opts.heVersion)),
      fetchJson(buildUrl(book, "en", opts.enVersion))
    ]);
    return { he: heData.he ?? [], en: enData.text ?? [], meta: { he: heData, en: enData } };
  }

  const data = await fetchJson(buildUrl(book, null, null));
  return { he: data.he ?? [], en: data.text ?? [], meta: { he: data, en: data } };
}

export function buildChapters(he: unknown, en: unknown, lang: LangOption): ChapterPayload[] {
  const heChapters = normalizeChapters(he ?? []);
  const enChapters = normalizeChapters(en ?? []);
  const maxChapters = Math.max(heChapters.length, enChapters.length);
  const chapters: ChapterPayload[] = [];

  for (let chapterIndex = 0; chapterIndex < maxChapters; chapterIndex += 1) {
    const heVerses = heChapters[chapterIndex] ?? [];
    const enVerses = enChapters[chapterIndex] ?? [];
    const maxVerses = Math.max(heVerses.length, enVerses.length);
    const verses: VersePayload[] = [];

    for (let verseIndex = 0; verseIndex < maxVerses; verseIndex += 1) {
      const verse: VersePayload = { n: verseIndex + 1 };
      if (lang !== "en") {
        verse.he = heVerses[verseIndex] ?? "";
      }
      if (lang !== "he") {
        verse.en = enVerses[verseIndex] ?? "";
      }
      verses.push(verse);
    }

    chapters.push({ n: chapterIndex + 1, verses });
  }

  return chapters;
}

function toBookPayload(book: string, fetched: FetchedBook, lang: LangOption): BookPayload {
  const heMeta = fetched.meta.he;
  const enMeta = fetched.meta.en;
  return {
    name: book,
    chapters: buildChapters(fetched.he, fetched.en, lang),
    meta: {
      heVersionTitle: heMeta?.heVersionTitle ?? heMeta?.versionTitle ?? null,
      heVersionSource: heMeta?.heVersionSource ?? heMeta?.versionSource ?? null,
      enVersionTitle: enMeta?.versionTitle ?? enMeta?.heVersionTitle ?? null,
      enVersionSource: enMeta?.versionSource ?? enMeta?.heVersionSource ?? null
    }
  };
}

export async function main(rawArgv: string[] = process.argv.slice(2)): Promise<void> {
  const opts = parseArgs(rawArgv);
  const outPath = path.resolve(opts.out);
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  const books: BookPayload[] = [];
  for (const book of BOOKS) {
    books.push(toBookPayload(book, await fetchBook(book, opts), opts.lang));
  }

  const payload = {
    source: "Sefaria Texts API",
    fetched_at: new Date().toISOString(),
    lang: opts.lang,
    books
  };

  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Saved Torah to ${outPath}`);
}
