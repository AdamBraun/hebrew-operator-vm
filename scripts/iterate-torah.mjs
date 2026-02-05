#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const DEFAULT_INPUT = path.resolve(process.cwd(), "data", "torah.json");
const FINAL_MAP = {
  "ך": "כ",
  "ם": "מ",
  "ן": "נ",
  "ף": "פ",
  "ץ": "צ"
};

const HEBREW_LETTERS = new Set([
  "א",
  "ב",
  "ג",
  "ד",
  "ה",
  "ו",
  "ז",
  "ח",
  "ט",
  "י",
  "כ",
  "ך",
  "ל",
  "מ",
  "ם",
  "נ",
  "ן",
  "ס",
  "ע",
  "פ",
  "ף",
  "צ",
  "ץ",
  "ק",
  "ר",
  "ש",
  "ת"
]);

const ALLOWED_MARKS = new Set([
  "\u05B0", // shva
  "\u05B1", // hataf segol
  "\u05B2", // hataf patach
  "\u05B3", // hataf kamatz
  "\u05B4", // hiriq
  "\u05B5", // tzere
  "\u05B6", // segol
  "\u05B7", // patach
  "\u05B8", // kamatz
  "\u05B9", // holam
  "\u05BB", // kubutz
  "\u05BC", // dagesh
  "\u05C1", // shin dot right
  "\u05C2" // shin dot left
]);

function printHelp() {
  console.log("Usage:");
  console.log(
    "  node scripts/iterate-torah.mjs [--input=path] [--lang=he|en|both] [--strict]"
  );
  console.log("  node scripts/iterate-torah.mjs [--no-normalize-finals]");
  console.log("");
  console.log("Defaults:");
  console.log(`  --input=${DEFAULT_INPUT}`);
  console.log("  --lang=he");
  console.log("  normalize-finals=true");
  console.log("  strict=false (runtime errors are counted and skipped)");
}

function parseArgs(argv) {
  const opts = {
    input: DEFAULT_INPUT,
    lang: "he",
    normalizeFinals: true,
    strict: false
  };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg.startsWith("--input=")) {
      opts.input = arg.slice("--input=".length);
      continue;
    }
    if (arg.startsWith("--lang=")) {
      opts.lang = arg.slice("--lang=".length);
      continue;
    }
    if (arg === "--normalize-finals") {
      opts.normalizeFinals = true;
      continue;
    }
    if (arg === "--no-normalize-finals") {
      opts.normalizeFinals = false;
      continue;
    }
    if (arg === "--strict") {
      opts.strict = true;
    }
  }
  if (!["he", "en", "both"].includes(opts.lang)) {
    throw new Error(`Invalid --lang value: ${opts.lang}`);
  }
  return opts;
}

function sanitizeText(text, opts) {
  if (!text) {
    return "";
  }
  let cleaned = String(text);
  cleaned = cleaned.replace(/<[^>]*>/g, " ");
  cleaned = cleaned.replace(/&[^;]+;/g, " ");
  cleaned = cleaned.normalize("NFD");

  cleaned = cleaned.replace(/\u05C7/g, "\u05B8"); // qamats qatan -> kamatz
  cleaned = cleaned.replace(/\u05BE/g, " "); // maqaf
  cleaned = cleaned.replace(/\u05C3/g, " "); // sof pasuq
  cleaned = cleaned.replace(/\u05C0/g, " "); // paseq
  cleaned = cleaned.replace(/\u05F3|\u05F4/g, ""); // geresh/gershayim

  let out = "";
  let lastWasLetter = false;
  for (const ch of cleaned) {
    if (HEBREW_LETTERS.has(ch) || FINAL_MAP[ch]) {
      const normalized =
        opts.normalizeFinals && FINAL_MAP[ch] ? FINAL_MAP[ch] : ch;
      if (!HEBREW_LETTERS.has(normalized)) {
        continue;
      }
      out += normalized;
      lastWasLetter = true;
      continue;
    }
    if (ALLOWED_MARKS.has(ch)) {
      if (lastWasLetter) {
        out += ch;
      }
      continue;
    }
    if (/\s/u.test(ch)) {
      out += " ";
      lastWasLetter = false;
    }
  }

  return out.replace(/\s+/g, " ").trim();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(opts.input);
  const raw = await fs.readFile(inputPath, "utf8");
  const data = JSON.parse(raw);

  const require = createRequire(import.meta.url);
  const { runProgram } = require(path.resolve(process.cwd(), "impl/reference/dist/vm/vm"));
  const { createInitialState } = require(
    path.resolve(process.cwd(), "impl/reference/dist/state/state")
  );

  let total = 0;
  let skipped = 0;
  let sanitized = 0;
  let runtimeErrors = 0;

  for (const book of data.books ?? []) {
    for (const chapter of book.chapters ?? []) {
      for (const verse of chapter.verses ?? []) {
        total += 1;
        const rawText =
          opts.lang === "en" ? verse.en : opts.lang === "both" ? verse.he ?? verse.en : verse.he;
        const cleaned = sanitizeText(rawText, opts);
        if (!cleaned) {
          skipped += 1;
          continue;
        }
        if (cleaned !== rawText) {
          sanitized += 1;
        }
        try {
          runProgram(cleaned, createInitialState());
        } catch (err) {
          if (!opts.strict && err && err.name === "RuntimeError") {
            runtimeErrors += 1;
            continue;
          }
          throw err;
        }
      }
    }
  }

  console.log(
    `done: verses=${total} sanitized=${sanitized} skipped=${skipped} runtimeErrors=${runtimeErrors} ` +
      `lang=${opts.lang} normalizeFinals=${opts.normalizeFinals} strict=${opts.strict}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
