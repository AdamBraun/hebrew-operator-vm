import fs from "node:fs/promises";
import path from "node:path";
import { createInitialState } from "../../state/state";
import { runProgram } from "../../vm/vm";

export const DEFAULT_INPUT = path.resolve(process.cwd(), "data", "torah.json");

const FINAL_MAP: Record<string, string> = {
  ך: "כ",
  ם: "מ",
  ן: "נ",
  ף: "פ",
  ץ: "צ"
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
  "\u05B0",
  "\u05B1",
  "\u05B2",
  "\u05B3",
  "\u05B4",
  "\u05B5",
  "\u05B6",
  "\u05B7",
  "\u05B8",
  "\u05B9",
  "\u05BB",
  "\u05BC",
  "\u05C1",
  "\u05C2"
]);

type LangOption = "he" | "en" | "both";

export type IterateTorahOptions = {
  input: string;
  lang: LangOption;
  normalizeFinals: boolean;
  allowRuntimeErrors: boolean;
};

type Verse = {
  he?: string;
  en?: string;
};

type Chapter = {
  verses?: Verse[];
};

type Book = {
  chapters?: Chapter[];
};

export type TorahPayload = {
  books?: Book[];
};

export type IterateSummary = {
  total: number;
  skipped: number;
  sanitized: number;
  runtimeErrors: number;
};

function isRuntimeError(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  return "name" in value && (value as { name?: unknown }).name === "RuntimeError";
}

export function printHelp(): void {
  console.log("Usage:");
  console.log(
    "  node scripts/iterate-torah.mjs [--input=path] [--lang=he|en|both] [--normalize-finals]"
  );
  console.log("  node scripts/iterate-torah.mjs [--allow-runtime-errors]");
  console.log("");
  console.log("Defaults:");
  console.log(`  --input=${DEFAULT_INPUT}`);
  console.log("  --lang=he");
  console.log("  normalize-finals=false");
  console.log("  allow-runtime-errors=false (fail fast on RuntimeError)");
}

export function parseArgs(argv: string[]): IterateTorahOptions {
  const opts: IterateTorahOptions = {
    input: DEFAULT_INPUT,
    lang: "he",
    normalizeFinals: false,
    allowRuntimeErrors: false
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
      const lang = arg.slice("--lang=".length);
      if (lang === "he" || lang === "en" || lang === "both") {
        opts.lang = lang;
        continue;
      }
      throw new Error(`Invalid --lang value: ${lang}`);
    }
    if (arg === "--normalize-finals") {
      opts.normalizeFinals = true;
      continue;
    }
    if (arg === "--no-normalize-finals") {
      opts.normalizeFinals = false;
      continue;
    }
    if (arg === "--allow-runtime-errors") {
      opts.allowRuntimeErrors = true;
      continue;
    }
  }

  return opts;
}

export function sanitizeText(text: unknown, opts: IterateTorahOptions): string {
  if (!text) {
    return "";
  }
  let cleaned = String(text);
  cleaned = cleaned.replace(/<[^>]*>/g, " ");
  cleaned = cleaned.replace(/&[^;]+;/g, " ");
  cleaned = cleaned.normalize("NFD");

  cleaned = cleaned.replace(/\u05C7/g, "\u05B8");
  cleaned = cleaned.replace(/\u05BE/g, " ");
  cleaned = cleaned.replace(/\u05C3/g, " ");
  cleaned = cleaned.replace(/\u05C0/g, " ");
  cleaned = cleaned.replace(/\u05F3|\u05F4/g, "");

  let out = "";
  let lastWasLetter = false;
  for (const ch of cleaned) {
    if (HEBREW_LETTERS.has(ch) || FINAL_MAP[ch]) {
      const normalized = opts.normalizeFinals && FINAL_MAP[ch] ? FINAL_MAP[ch] : ch;
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

function resolveRawText(verse: Verse | undefined, lang: LangOption): string | undefined {
  if (!verse) {
    return undefined;
  }
  if (lang === "en") {
    return verse.en;
  }
  if (lang === "both") {
    return verse.he ?? verse.en;
  }
  return verse.he;
}

export function iteratePayload(
  payload: TorahPayload,
  opts: IterateTorahOptions,
  deps: {
    runProgram: (source: string, state?: unknown) => unknown;
    createInitialState: () => unknown;
  }
): IterateSummary {
  let total = 0;
  let skipped = 0;
  let sanitized = 0;
  let runtimeErrors = 0;

  for (const book of payload.books ?? []) {
    for (const chapter of book.chapters ?? []) {
      for (const verse of chapter.verses ?? []) {
        total += 1;
        const rawText = resolveRawText(verse, opts.lang);
        const cleaned = sanitizeText(rawText, opts);
        if (!cleaned) {
          skipped += 1;
          continue;
        }
        if (cleaned !== rawText) {
          sanitized += 1;
        }
        try {
          deps.runProgram(cleaned, deps.createInitialState());
        } catch (err) {
          if (opts.allowRuntimeErrors && isRuntimeError(err)) {
            runtimeErrors += 1;
            continue;
          }
          throw err;
        }
      }
    }
  }

  return {
    total,
    skipped,
    sanitized,
    runtimeErrors
  };
}

export async function main(rawArgv: string[] = process.argv.slice(2)): Promise<void> {
  const opts = parseArgs(rawArgv);
  const inputPath = path.resolve(opts.input);
  const raw = await fs.readFile(inputPath, "utf8");
  const payload = JSON.parse(raw) as TorahPayload;

  const summary = iteratePayload(payload, opts, {
    runProgram: (source: string, state?: unknown) => runProgram(source, state as never),
    createInitialState: () => createInitialState()
  });

  console.log(
    `done: verses=${summary.total} sanitized=${summary.sanitized} skipped=${summary.skipped} runtimeErrors=${summary.runtimeErrors} ` +
      `lang=${opts.lang} normalizeFinals=${opts.normalizeFinals} allowRuntimeErrors=${opts.allowRuntimeErrors}`
  );
}
