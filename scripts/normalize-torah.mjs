#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const DEFAULT_INPUT = path.resolve(process.cwd(), "data", "torah.json");
const DEFAULT_OUT = path.resolve(process.cwd(), "data", "torah.normalized.txt");
const DEFAULT_SHA = path.resolve(process.cwd(), "data", "torah.normalized.sha256");
const DEFAULT_REPORT = path.resolve(process.cwd(), "reports", "normalization_report.md");

const TEAMIM_RANGES = [{ start: 0x0591, end: 0x05af }];
const COMBINING_MARK = /\p{M}/u;

function printHelp() {
  console.log("Usage:");
  console.log(
    "  node scripts/normalize-torah.mjs [--input=path] [--out=path] [--sha-out=path] [--report-out=path]"
  );
  console.log("  node scripts/normalize-torah.mjs [--keep-teamim]");
  console.log("");
  console.log("Defaults:");
  console.log(`  --input=${DEFAULT_INPUT}`);
  console.log(`  --out=${DEFAULT_OUT}`);
  console.log(`  --sha-out=${DEFAULT_SHA}`);
  console.log(`  --report-out=${DEFAULT_REPORT}`);
  console.log("  keep-teamim=false (strip U+0591-U+05AF)");
}

function parseArgs(argv) {
  const opts = {
    input: DEFAULT_INPUT,
    out: DEFAULT_OUT,
    shaOut: DEFAULT_SHA,
    reportOut: DEFAULT_REPORT,
    keepTeamim: false
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
    if (arg.startsWith("--out=")) {
      opts.out = arg.slice("--out=".length);
      continue;
    }
    if (arg.startsWith("--sha-out=")) {
      opts.shaOut = arg.slice("--sha-out=".length);
      continue;
    }
    if (arg.startsWith("--report-out=")) {
      opts.reportOut = arg.slice("--report-out=".length);
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
  }

  return opts;
}

function isInRanges(codePoint, ranges) {
  for (const range of ranges) {
    if (codePoint >= range.start && codePoint <= range.end) {
      return true;
    }
  }
  return false;
}

function isTeamim(mark) {
  const codePoint = mark.codePointAt(0);
  return codePoint !== undefined && isInRanges(codePoint, TEAMIM_RANGES);
}

function categoryForMark(mark) {
  const codePoint = mark.codePointAt(0);
  if (codePoint === undefined) {
    return "unknown";
  }
  if (isInRanges(codePoint, TEAMIM_RANGES)) {
    return "teamim";
  }
  if (codePoint === 0x05bc) {
    return "dagesh_or_mappiq";
  }
  if (codePoint === 0x05c1 || codePoint === 0x05c2) {
    return "shin_or_sin_dot";
  }
  if ((codePoint >= 0x05b0 && codePoint <= 0x05bb) || codePoint === 0x05c7) {
    return "niqqud";
  }
  if (codePoint >= 0x0591 && codePoint <= 0x05c7) {
    return "other_hebrew_mark";
  }
  return "other_mark";
}

function increment(map, key, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function sortedEntries(map) {
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "en"));
}

function normalizeLineBreaks(text) {
  return String(text ?? "").replace(/\r\n?/g, "\n");
}

function stripMarkupAndEntities(text) {
  let out = text.replace(/<[^>]*>/g, " ");
  out = out.replace(/&[^;]+;/g, " ");
  out = out.replace(/\u00A0/g, " ");
  out = out.replace(/[ \t\f\v]+/g, " ");
  out = out.replace(/ *\n */g, "\n");
  return out.trim();
}

function normalizeVerse(text, keepTeamim) {
  const lineStable = normalizeLineBreaks(text);
  const stripped = stripMarkupAndEntities(lineStable);
  const nfd = stripped.normalize("NFD");

  let out = "";
  let removedTeamim = 0;
  const keptByCategory = new Map();
  const removedByCategory = new Map();
  let combiningBefore = 0;
  let combiningAfter = 0;

  for (const ch of nfd) {
    if (!COMBINING_MARK.test(ch)) {
      out += ch;
      continue;
    }

    combiningBefore += 1;
    const category = categoryForMark(ch);
    const shouldRemove = !keepTeamim && isTeamim(ch);

    if (shouldRemove) {
      removedTeamim += 1;
      increment(removedByCategory, category);
      continue;
    }

    out += ch;
    combiningAfter += 1;
    increment(keptByCategory, category);
  }

  return {
    normalized: out,
    stats: {
      codepointsBefore: [...nfd].length,
      codepointsAfter: [...out].length,
      combiningBefore,
      combiningAfter,
      removedTeamim,
      keptByCategory,
      removedByCategory
    }
  };
}

function formatMapTable(map) {
  const rows = sortedEntries(map);
  if (rows.length === 0) {
    return "- (none)";
  }
  return rows.map(([key, value]) => `- ${key}: ${value}`).join("\n");
}

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(opts.input);
  const outPath = path.resolve(opts.out);
  const shaOutPath = path.resolve(opts.shaOut);
  const reportPath = path.resolve(opts.reportOut);

  const raw = await fs.readFile(inputPath, "utf8");
  const source = JSON.parse(raw);

  const lines = [];
  const keptByCategory = new Map();
  const removedByCategory = new Map();

  let verses = 0;
  let codepointsBefore = 0;
  let codepointsAfter = 0;
  let combiningBefore = 0;
  let combiningAfter = 0;
  let removedTeamim = 0;
  let idempotenceFailures = 0;

  for (const book of source.books ?? []) {
    for (const chapter of book.chapters ?? []) {
      for (const verse of chapter.verses ?? []) {
        verses += 1;
        const text = verse.he ?? "";
        const { normalized, stats } = normalizeVerse(text, opts.keepTeamim);

        codepointsBefore += stats.codepointsBefore;
        codepointsAfter += stats.codepointsAfter;
        combiningBefore += stats.combiningBefore;
        combiningAfter += stats.combiningAfter;
        removedTeamim += stats.removedTeamim;

        for (const [key, value] of stats.keptByCategory.entries()) {
          increment(keptByCategory, key, value);
        }
        for (const [key, value] of stats.removedByCategory.entries()) {
          increment(removedByCategory, key, value);
        }

        const renormalized = normalizeVerse(normalized, opts.keepTeamim).normalized;
        if (renormalized !== normalized) {
          idempotenceFailures += 1;
        }

        const ref = `${book.name} ${chapter.n}:${verse.n}`;
        const lineValue = normalized.replace(/\n/g, "\\n");
        lines.push(`${ref}\t${lineValue}`);
      }
    }
  }

  const normalizedText = `${lines.join("\n")}\n`;
  const normalizedBuffer = Buffer.from(normalizedText, "utf8");
  const checksum = sha256Hex(normalizedBuffer);

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.mkdir(path.dirname(shaOutPath), { recursive: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  await fs.writeFile(outPath, normalizedBuffer);
  await fs.writeFile(shaOutPath, `${checksum}\n`, "utf8");

  const report = [
    "# Normalization Report",
    "",
    `- input: ${inputPath}`,
    `- output: ${outPath}`,
    `- checksum file: ${shaOutPath}`,
    `- normalization form: NFD`,
    `- te'amim policy: ${opts.keepTeamim ? "keep" : "strip"}`,
    `- te'amim ranges: U+0591-U+05AF`,
    `- verses processed: ${verses}`,
    `- idempotence failures: ${idempotenceFailures}`,
    "",
    "## Codepoint Counts",
    "",
    `- total codepoints before: ${codepointsBefore}`,
    `- total codepoints after: ${codepointsAfter}`,
    `- total combining marks before: ${combiningBefore}`,
    `- total combining marks after: ${combiningAfter}`,
    `- total te'amim removed: ${removedTeamim}`,
    "",
    "## Kept Mark Categories",
    "",
    formatMapTable(keptByCategory),
    "",
    "## Removed Mark Categories",
    "",
    formatMapTable(removedByCategory),
    "",
    "## Output SHA-256",
    "",
    `- ${checksum}`,
    ""
  ].join("\n");

  await fs.writeFile(reportPath, report, "utf8");

  console.log(
    [
      `done: verses=${verses}`,
      `teAmimPolicy=${opts.keepTeamim ? "keep" : "strip"}`,
      `idempotenceFailures=${idempotenceFailures}`,
      `out=${outPath}`,
      `shaOut=${shaOutPath}`,
      `report=${reportPath}`
    ].join(" ")
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
