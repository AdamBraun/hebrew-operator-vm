import fs from "node:fs/promises";
import path from "node:path";
import { createInitialState } from "../../state/state";
import { runProgram } from "../../vm/vm";
import { sanitizeHebrewText } from "../shared/hebrewSanitizer";

export const DEFAULT_INPUT = path.resolve(process.cwd(), "data", "torah.json");

type LangOption = "he" | "en" | "both";

export type IterateTorahOptions = {
  input: string;
  lang: LangOption;
  normalizeFinals: boolean;
  keepTeamim: boolean;
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
  console.log("  node scripts/iterate-torah.mjs [--keep-teamim|--strip-teamim]");
  console.log("  node scripts/iterate-torah.mjs [--allow-runtime-errors]");
  console.log("");
  console.log("Defaults:");
  console.log(`  --input=${DEFAULT_INPUT}`);
  console.log("  --lang=he");
  console.log("  normalize-finals=false");
  console.log("  keep-teamim=false");
  console.log("  allow-runtime-errors=false (fail fast on RuntimeError)");
}

export function parseArgs(argv: string[]): IterateTorahOptions {
  const opts: IterateTorahOptions = {
    input: DEFAULT_INPUT,
    lang: "he",
    normalizeFinals: false,
    keepTeamim: false,
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
    if (arg === "--keep-teamim") {
      opts.keepTeamim = true;
      continue;
    }
    if (arg === "--strip-teamim") {
      opts.keepTeamim = false;
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
  return sanitizeHebrewText(text, {
    keepTeamim: opts.keepTeamim,
    normalizeFinals: opts.normalizeFinals
  });
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
