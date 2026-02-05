#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const API_BASE = "https://www.sefaria.org/api/texts/";
const BOOKS = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"];
const DEFAULT_OUT = path.resolve(process.cwd(), "data", "torah.json");

function printHelp() {
  console.log("Usage:");
  console.log("  node scripts/download-torah.mjs [--out=path] [--lang=he|en|both]");
  console.log("  node scripts/download-torah.mjs --he-version=\"...\" --en-version=\"...\"");
  console.log("");
  console.log("Defaults:");
  console.log(`  --out=${DEFAULT_OUT}`);
  console.log("  --lang=both");
}

function parseArgs(argv) {
  const opts = {
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
      opts.lang = arg.slice("--lang=".length);
      continue;
    }
    if (arg.startsWith("--he-version=")) {
      opts.heVersion = arg.slice("--he-version=".length);
      continue;
    }
    if (arg.startsWith("--en-version=")) {
      opts.enVersion = arg.slice("--en-version=".length);
    }
  }

  if (!["he", "en", "both"].includes(opts.lang)) {
    throw new Error(`Invalid --lang value: ${opts.lang}`);
  }

  return opts;
}

function normalizeChapters(input) {
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

async function fetchJson(url, retries = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
      const delayMs = 200 * attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

function buildUrl(book, lang, version) {
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

async function fetchBook(book, opts) {
  if (opts.lang === "he") {
    const data = await fetchJson(buildUrl(book, "he", opts.heVersion));
    return { he: data.he, en: null, meta: { he: data, en: null } };
  }
  if (opts.lang === "en") {
    const data = await fetchJson(buildUrl(book, "en", opts.enVersion));
    return { he: null, en: data.text, meta: { he: null, en: data } };
  }

  if (opts.heVersion || opts.enVersion) {
    const [heData, enData] = await Promise.all([
      fetchJson(buildUrl(book, "he", opts.heVersion)),
      fetchJson(buildUrl(book, "en", opts.enVersion))
    ]);
    return { he: heData.he, en: enData.text, meta: { he: heData, en: enData } };
  }

  const data = await fetchJson(buildUrl(book, null, null));
  return { he: data.he, en: data.text, meta: { he: data, en: data } };
}

function buildChapters(he, en, lang) {
  const heChapters = normalizeChapters(he ?? []);
  const enChapters = normalizeChapters(en ?? []);
  const maxChapters = Math.max(heChapters.length, enChapters.length);
  const chapters = [];

  for (let c = 0; c < maxChapters; c += 1) {
    const heVerses = heChapters[c] ?? [];
    const enVerses = enChapters[c] ?? [];
    const maxVerses = Math.max(heVerses.length, enVerses.length);
    const verses = [];
    for (let v = 0; v < maxVerses; v += 1) {
      const verse = { n: v + 1 };
      if (lang !== "en") {
        verse.he = heVerses[v] ?? "";
      }
      if (lang !== "he") {
        verse.en = enVerses[v] ?? "";
      }
      verses.push(verse);
    }
    chapters.push({ n: c + 1, verses });
  }

  return chapters;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const outPath = path.resolve(opts.out);
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  const books = [];
  for (const book of BOOKS) {
    const { he, en, meta } = await fetchBook(book, opts);
    const heMeta = meta?.he ?? null;
    const enMeta = meta?.en ?? null;
    books.push({
      name: book,
      chapters: buildChapters(he, en, opts.lang),
      meta: {
        heVersionTitle: heMeta?.heVersionTitle ?? heMeta?.versionTitle ?? null,
        heVersionSource: heMeta?.heVersionSource ?? heMeta?.versionSource ?? null,
        enVersionTitle: enMeta?.versionTitle ?? enMeta?.heVersionTitle ?? null,
        enVersionSource: enMeta?.versionSource ?? enMeta?.heVersionSource ?? null
      }
    });
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
