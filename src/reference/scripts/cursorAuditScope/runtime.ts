import {
  analyzeCursorAuditWords,
  loadCursorAuditPolicy,
  renderCursorAuditScopeHeader
} from "../shared/cursorAuditPolicy";

type CursorAuditScopeCliOptions = {
  words: string[];
};

function usage(): string {
  return [
    "Usage:",
    "  node scripts/cursor-audit-scope.mjs --word='זה'",
    "  node scripts/cursor-audit-scope.mjs --words='העץ,זה'",
    "  node scripts/cursor-audit-scope.mjs --text='ומפרי העץ אשר בתוך הגן'"
  ].join("\n");
}

function splitCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function splitWhitespaceSeparated(value: string): string[] {
  return value
    .split(/\s+/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function parseArgs(argv: string[]): CursorAuditScopeCliOptions {
  const words: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--help" || arg === "-h") {
      throw new Error(usage());
    }
    if (arg.startsWith("--word=")) {
      words.push(arg.slice("--word=".length));
      continue;
    }
    if (arg === "--word") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--word requires a value");
      }
      words.push(next);
      index += 1;
      continue;
    }
    if (arg.startsWith("--words=")) {
      words.push(...splitCommaSeparated(arg.slice("--words=".length)));
      continue;
    }
    if (arg === "--words") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--words requires a value");
      }
      words.push(...splitCommaSeparated(next));
      index += 1;
      continue;
    }
    if (arg.startsWith("--text=")) {
      words.push(...splitWhitespaceSeparated(arg.slice("--text=".length)));
      continue;
    }
    if (arg === "--text") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--text requires a value");
      }
      words.push(...splitWhitespaceSeparated(next));
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}\n${usage()}`);
  }

  if (words.length === 0) {
    throw new Error(`At least one --word, --words, or --text input is required.\n${usage()}`);
  }

  return { words };
}

export async function main(argv: string[]): Promise<void> {
  const opts = parseArgs(argv);
  const policy = loadCursorAuditPolicy();
  const scope = analyzeCursorAuditWords(opts.words, policy);
  process.stdout.write(`${renderCursorAuditScopeHeader(scope)}\n`);
}
