import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_INPUT = path.resolve(process.cwd(), "data", "torah.json");
export const DEFAULT_OUT = path.resolve(process.cwd(), "data", "torah.normalized.txt");
export const DEFAULT_SHA = path.resolve(process.cwd(), "data", "torah.normalized.sha256");
export const DEFAULT_REPORT = path.resolve(process.cwd(), "reports", "normalization_report.md");
export const DEFAULT_TEAMIM_OUT = path.resolve(
  process.cwd(),
  "data",
  "torah.normalized.teamim.txt"
);
export const DEFAULT_TEAMIM_SHA = path.resolve(
  process.cwd(),
  "data",
  "torah.normalized.teamim.sha256"
);
export const DEFAULT_TEAMIM_REPORT = path.resolve(
  process.cwd(),
  "reports",
  "normalization_teamim_report.md"
);

const TEAMIM_RANGES = [{ start: 0x0591, end: 0x05af }];
const COMBINING_MARK = /\p{M}/u;
const HEBREW_BASE_LETTER = /[\u05D0-\u05EA]/u;
const COMBINING_GRAPHEME_JOINER = 0x034f;
const HEBREW_QAMATS_QATAN = 0x05c7;
const MAQAF = "\u05BE";
const SOF_PASUQ = "\u05C3";
const CONTEXT_SPAN = 12;
const ORDER_SAMPLE_LIMIT = 10;
const IDEMPOTENCE_SAMPLE_LIMIT = 10;
const PARASHA_MARKER = /\{\s*[פס]\s*\}/gu;
const SPACE_ENTITIES = new Set(["&nbsp;", "&thinsp;"]);
const STRUCTURAL_TAGS = new Set(["br", "p", "div", "li", "tr", "td", "th", "hr"]);

const SUPPORTED_COMBINING_MARKS = buildSupportedCombiningMarks();
const MARK_NAME_BY_CODEPOINT = new Map<number, string>([
  [0x034f, "COMBINING GRAPHEME JOINER"],
  [0x05b0, "HEBREW POINT SHEVA"],
  [0x05b1, "HEBREW POINT HATAF SEGOL"],
  [0x05b2, "HEBREW POINT HATAF PATAH"],
  [0x05b3, "HEBREW POINT HATAF QAMATS"],
  [0x05b4, "HEBREW POINT HIRIQ"],
  [0x05b5, "HEBREW POINT TSERE"],
  [0x05b6, "HEBREW POINT SEGOL"],
  [0x05b7, "HEBREW POINT PATAH"],
  [0x05b8, "HEBREW POINT QAMATS"],
  [0x05b9, "HEBREW POINT HOLAM"],
  [0x05ba, "HEBREW POINT HOLAM HASER FOR VAV"],
  [0x05bb, "HEBREW POINT QUBUTS"],
  [0x05bc, "HEBREW POINT DAGESH OR MAPIQ"],
  [0x05bd, "HEBREW POINT METEG"],
  [0x05bf, "HEBREW POINT RAFE"],
  [0x05c1, "HEBREW POINT SHIN DOT"],
  [0x05c2, "HEBREW POINT SIN DOT"],
  [0x05c4, "HEBREW MARK UPPER DOT"],
  [0x05c5, "HEBREW MARK LOWER DOT"],
  [0x05c7, "HEBREW POINT QAMATS QATAN"]
]);

const POLICY_TRANSFORMATION_KEYS = [
  "line_breaks_to_lf",
  "markup_tags_removed",
  "html_entities_removed",
  "nbsp_to_space",
  "parasha_markers_removed",
  "collapsed_horizontal_whitespace",
  "trimmed_line_edges",
  "qamats_qatan_to_qamats"
] as const;

type PolicyTransformationKey = (typeof POLICY_TRANSFORMATION_KEYS)[number];

type Command = "run" | "verify";

type NormalizeOptions = {
  input: string;
  out: string;
  shaOut: string;
  reportOut: string;
  keepTeamim: boolean;
};

type ParseResult = {
  command: Command;
  opts: NormalizeOptions;
};

type VersePayload = {
  n: number;
  he?: string;
};

type ChapterPayload = {
  n: number;
  verses?: VersePayload[];
};

type BookPayload = {
  name: string;
  chapters?: ChapterPayload[];
};

type SourcePayload = {
  books?: BookPayload[];
};

type OrderSample = {
  ref: string;
  base: string;
  original: string;
  reordered: string;
  originalCodepoints: string;
  reorderedCodepoints: string;
};

type OutputIdempotenceSample = {
  ref: string;
  original: string;
  renormalized: string;
};

type NormalizeStats = {
  verses: number;
  codepointsBefore: number;
  codepointsAfter: number;
  combiningBefore: number;
  combiningAfter: number;
  removedTeamim: number;
  keptByCategory: Map<string, number>;
  removedByCategory: Map<string, number>;
  teamimObservedByCodepoint: Map<number, number>;
  policyTransformations: Map<PolicyTransformationKey, number>;
  maqafObserved: number;
  sofPasuqObserved: number;
  qamatsQatanObserved: number;
  qamatsQatanNormalized: number;
  sourceIdempotenceFailures: number;
  outputIdempotenceFailures: number;
  outputIdempotenceSamples: OutputIdempotenceSample[];
  hebrewBasesChecked: number;
  markSequencesChecked: number;
  outOfOrderMarkSequences: number;
  outOfOrderSamples: OrderSample[];
};

type NormalizeResult = {
  normalizedText: string;
  normalizedBuffer: Buffer;
  checksum: string;
  stats: NormalizeStats;
};

export function printHelp(): void {
  console.log("Usage:");
  console.log(
    "  node scripts/normalize-torah.mjs [run] [--input=path] [--out=path] [--sha-out=path] [--report-out=path]"
  );
  console.log(
    "  node scripts/normalize-torah.mjs verify [--input=path] [--out=path] [--sha-out=path] [--keep-teamim|--strip-teamim]"
  );
  console.log("");
  console.log("Defaults:");
  console.log(`  --input=${DEFAULT_INPUT}`);
  console.log("  strip profile (default):");
  console.log(`    --out=${DEFAULT_OUT}`);
  console.log(`    --sha-out=${DEFAULT_SHA}`);
  console.log(`    --report-out=${DEFAULT_REPORT}`);
  console.log("  keep-teamim profile:");
  console.log(`    --out=${DEFAULT_TEAMIM_OUT}`);
  console.log(`    --sha-out=${DEFAULT_TEAMIM_SHA}`);
  console.log(`    --report-out=${DEFAULT_TEAMIM_REPORT}`);
  console.log("  keep-teamim=false (strip U+0591-U+05AF)");
  console.log("  punctuation policy=retain (including maqaf U+05BE, sof pasuq U+05C3)");
  console.log("  qamats-qatan policy=preserve U+05C7");
}

export function parseArgs(argv: string[]): ParseResult {
  const args = [...argv];
  let command: Command = "run";
  if (args.length > 0 && !args[0]?.startsWith("-")) {
    const maybeCommand = args.shift();
    if (maybeCommand === "run" || maybeCommand === "verify") {
      command = maybeCommand;
    } else {
      throw new Error(`Unknown command '${maybeCommand}'`);
    }
  }

  let outExplicit = false;
  let shaOutExplicit = false;
  let reportOutExplicit = false;
  let keepTeamim = false;

  const opts: NormalizeOptions = {
    input: DEFAULT_INPUT,
    out: "",
    shaOut: "",
    reportOut: "",
    keepTeamim: false
  };

  for (const arg of args) {
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
      outExplicit = true;
      continue;
    }
    if (arg.startsWith("--sha-out=")) {
      opts.shaOut = arg.slice("--sha-out=".length);
      shaOutExplicit = true;
      continue;
    }
    if (arg.startsWith("--report-out=")) {
      opts.reportOut = arg.slice("--report-out=".length);
      reportOutExplicit = true;
      continue;
    }
    if (arg === "--keep-teamim") {
      keepTeamim = true;
      continue;
    }
    if (arg === "--strip-teamim") {
      keepTeamim = false;
      continue;
    }
    throw new Error(`Unknown argument '${arg}'`);
  }

  opts.keepTeamim = keepTeamim;
  const defaults = defaultArtifactPaths(keepTeamim);
  if (!outExplicit) {
    opts.out = defaults.out;
  }
  if (!shaOutExplicit) {
    opts.shaOut = defaults.shaOut;
  }
  if (!reportOutExplicit) {
    opts.reportOut = defaults.reportOut;
  }

  return { command, opts };
}

function isInRanges(codePoint: number, ranges: Array<{ start: number; end: number }>): boolean {
  for (const range of ranges) {
    if (codePoint >= range.start && codePoint <= range.end) {
      return true;
    }
  }
  return false;
}

function isTeamim(mark: string): boolean {
  const codePoint = mark.codePointAt(0);
  return codePoint !== undefined && isInRanges(codePoint, TEAMIM_RANGES);
}

function categoryForMark(mark: string): string {
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

function addRange(target: Set<number>, start: number, end: number): void {
  for (let codepoint = start; codepoint <= end; codepoint += 1) {
    target.add(codepoint);
  }
}

function buildSupportedCombiningMarks(): Set<number> {
  const supported = new Set<number>([COMBINING_GRAPHEME_JOINER]);
  addRange(supported, 0x0591, 0x05af);
  addRange(supported, 0x05b0, 0x05bc);
  supported.add(0x05bd);
  supported.add(0x05bf);
  supported.add(0x05c1);
  supported.add(0x05c2);
  supported.add(0x05c4);
  supported.add(0x05c5);
  supported.add(HEBREW_QAMATS_QATAN);
  return supported;
}

function defaultArtifactPaths(keepTeamim: boolean): {
  out: string;
  shaOut: string;
  reportOut: string;
} {
  if (keepTeamim) {
    return {
      out: DEFAULT_TEAMIM_OUT,
      shaOut: DEFAULT_TEAMIM_SHA,
      reportOut: DEFAULT_TEAMIM_REPORT
    };
  }
  return {
    out: DEFAULT_OUT,
    shaOut: DEFAULT_SHA,
    reportOut: DEFAULT_REPORT
  };
}

function toCodepoint(codepoint: number): string {
  return `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

function markNameForCodepoint(codepoint: number): string {
  const known = MARK_NAME_BY_CODEPOINT.get(codepoint);
  if (known) {
    return known;
  }
  if (codepoint >= 0x0591 && codepoint <= 0x05af) {
    return `HEBREW ACCENT ${toCodepoint(codepoint)}`;
  }
  return `UNKNOWN MARK ${toCodepoint(codepoint)}`;
}

function increment<K>(map: Map<K, number>, key: K, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

function sortedEntries(map: Map<string, number>): Array<[string, number]> {
  return [...map.entries()].sort((left, right) => left[0].localeCompare(right[0], "en"));
}

function sortedCodepointEntries(map: Map<number, number>): Array<[number, number]> {
  return [...map.entries()].sort((left, right) => left[0] - right[0]);
}

function contextSnippet(chars: string[], index: number): string {
  const start = Math.max(0, index - CONTEXT_SPAN);
  const end = Math.min(chars.length, index + CONTEXT_SPAN + 1);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < chars.length ? "…" : "";
  return `${prefix}${chars.slice(start, end).join("")}${suffix}`.replace(/\s+/g, " ");
}

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length;
}

function normalizeLineBreaks(text: string): {
  normalized: string;
  replacements: number;
} {
  const source = String(text ?? "");
  const replacements = countMatches(source, /\r\n?/g);
  return {
    normalized: source.replace(/\r\n?/g, "\n"),
    replacements
  };
}

function extractTagName(markupTag: string): string | null {
  const match = String(markupTag ?? "").match(/^<\s*\/?\s*([A-Za-z0-9:-]+)/u);
  return match?.[1]?.toLowerCase() ?? null;
}

function stripMarkupAndEntities(text: string): {
  normalized: string;
  transformations: Map<PolicyTransformationKey, number>;
} {
  const transformations = new Map<PolicyTransformationKey, number>();

  let markupTagsRemoved = 0;
  let htmlEntitiesRemoved = 0;
  let nbspToSpace = 0;

  let out = text.replace(/<[^>]*>/g, (match) => {
    markupTagsRemoved += 1;
    const tagName = extractTagName(match);
    if (tagName && STRUCTURAL_TAGS.has(tagName)) {
      return "\n";
    }
    return "";
  });
  out = out.replace(/&[^;\s]+;/g, (match) => {
    htmlEntitiesRemoved += 1;
    if (SPACE_ENTITIES.has(match.toLowerCase())) {
      nbspToSpace += 1;
      return " ";
    }
    return "";
  });
  const literalSpaceEntities = countMatches(out, /[\u00A0\u2009]/g);
  if (literalSpaceEntities > 0) {
    nbspToSpace += literalSpaceEntities;
    out = out.replace(/[\u00A0\u2009]/g, " ");
  }
  const parashaMarkersRemoved = countMatches(out, PARASHA_MARKER);
  out = out.replace(PARASHA_MARKER, " ");

  const collapsedHorizontalWhitespace = countMatches(out, /[ \t\f\v]{2,}/g);
  const trimmedLineEdges = countMatches(out, / *\n */g);

  out = out.replace(/[ \t\f\v]+/g, " ");
  out = out.replace(/ *\n */g, "\n");
  const trimmed = out.trim();

  if (markupTagsRemoved > 0) {
    transformations.set("markup_tags_removed", markupTagsRemoved);
  }
  if (htmlEntitiesRemoved > 0) {
    transformations.set("html_entities_removed", htmlEntitiesRemoved);
  }
  if (nbspToSpace > 0) {
    transformations.set("nbsp_to_space", nbspToSpace);
  }
  if (parashaMarkersRemoved > 0) {
    transformations.set("parasha_markers_removed", parashaMarkersRemoved);
  }
  if (collapsedHorizontalWhitespace > 0) {
    transformations.set("collapsed_horizontal_whitespace", collapsedHorizontalWhitespace);
  }
  if (trimmedLineEdges > 0 || trimmed.length !== out.length) {
    transformations.set(
      "trimmed_line_edges",
      trimmedLineEdges + (trimmed.length !== out.length ? 1 : 0)
    );
  }

  return {
    normalized: trimmed,
    transformations
  };
}

function throwUnsupportedCombiningMark(
  ref: string,
  chars: string[],
  index: number,
  codepoint: number
): never {
  throw new Error(
    `Unsupported combining mark ${toCodepoint(codepoint)} (${markNameForCodepoint(
      codepoint
    )}) at ${ref} (char ${index + 1}). Context: "${contextSnippet(chars, index)}"`
  );
}

function toCodepoints(text: string): string {
  return [...text]
    .map((ch) => `U+${String(ch.codePointAt(0)?.toString(16)).toUpperCase().padStart(4, "0")}`)
    .join(" ");
}

function verifyCombiningOrder(text: string): {
  hebrewBasesChecked: number;
  markSequencesChecked: number;
  outOfOrderCount: number;
  samples: Array<{
    base: string;
    original: string;
    reordered: string;
    originalCodepoints: string;
    reorderedCodepoints: string;
  }>;
} {
  const chars = [...text];
  let hebrewBasesChecked = 0;
  let markSequencesChecked = 0;
  let outOfOrderCount = 0;
  const samples: Array<{
    base: string;
    original: string;
    reordered: string;
    originalCodepoints: string;
    reorderedCodepoints: string;
  }> = [];

  for (let index = 0; index < chars.length; index += 1) {
    const base = chars[index];
    if (!base || !HEBREW_BASE_LETTER.test(base)) {
      continue;
    }
    hebrewBasesChecked += 1;

    const marks: string[] = [];
    let lookahead = index + 1;
    while (lookahead < chars.length && COMBINING_MARK.test(chars[lookahead] ?? "")) {
      const next = chars[lookahead];
      if (next) {
        marks.push(next);
      }
      lookahead += 1;
    }

    if (marks.length === 0) {
      continue;
    }
    markSequencesChecked += 1;

    const original = marks.join("");
    const reordered = [...`א${original}`.normalize("NFD")].slice(1).join("");
    if (original !== reordered) {
      outOfOrderCount += 1;
      if (samples.length < ORDER_SAMPLE_LIMIT) {
        samples.push({
          base,
          original,
          reordered,
          originalCodepoints: toCodepoints(original),
          reorderedCodepoints: toCodepoints(reordered)
        });
      }
    }
  }

  return {
    hebrewBasesChecked,
    markSequencesChecked,
    outOfOrderCount,
    samples
  };
}

export function normalizeVerse(
  text: string,
  keepTeamim: boolean,
  ref = "(unknown)"
): {
  normalized: string;
  stats: {
    codepointsBefore: number;
    codepointsAfter: number;
    combiningBefore: number;
    combiningAfter: number;
    removedTeamim: number;
    keptByCategory: Map<string, number>;
    removedByCategory: Map<string, number>;
    teamimObservedByCodepoint: Map<number, number>;
    policyTransformations: Map<PolicyTransformationKey, number>;
    maqafObserved: number;
    sofPasuqObserved: number;
    qamatsQatanObserved: number;
    qamatsQatanNormalized: number;
  };
} {
  const lineStable = normalizeLineBreaks(text);
  const stripped = stripMarkupAndEntities(lineStable.normalized);
  const nfd = stripped.normalized.normalize("NFD");

  let out = "";
  let removedTeamim = 0;
  const keptByCategory = new Map<string, number>();
  const removedByCategory = new Map<string, number>();
  const teamimObservedByCodepoint = new Map<number, number>();
  const policyTransformations = new Map<PolicyTransformationKey, number>();
  let combiningBefore = 0;
  let combiningAfter = 0;
  let maqafObserved = 0;
  let sofPasuqObserved = 0;
  let qamatsQatanObserved = 0;
  const qamatsQatanNormalized = 0;

  if (lineStable.replacements > 0) {
    policyTransformations.set("line_breaks_to_lf", lineStable.replacements);
  }
  for (const [key, value] of stripped.transformations.entries()) {
    increment(policyTransformations, key, value);
  }

  const chars = [...nfd];
  for (let index = 0; index < chars.length; index += 1) {
    const ch = chars[index] ?? "";

    if (!COMBINING_MARK.test(ch)) {
      out += ch;
      if (ch === MAQAF) {
        maqafObserved += 1;
      } else if (ch === SOF_PASUQ) {
        sofPasuqObserved += 1;
      }
      continue;
    }

    const codepoint = ch.codePointAt(0);
    if (codepoint === undefined) {
      continue;
    }
    if (!SUPPORTED_COMBINING_MARKS.has(codepoint)) {
      throwUnsupportedCombiningMark(ref, chars, index, codepoint);
    }

    combiningBefore += 1;
    if (codepoint === HEBREW_QAMATS_QATAN) {
      qamatsQatanObserved += 1;
    }

    const category = categoryForMark(ch);
    if (isTeamim(ch)) {
      increment(teamimObservedByCodepoint, codepoint);
    }
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
      removedByCategory,
      teamimObservedByCodepoint,
      policyTransformations,
      maqafObserved,
      sofPasuqObserved,
      qamatsQatanObserved,
      qamatsQatanNormalized
    }
  };
}

function formatMapTable(map: Map<string, number>): string {
  const rows = sortedEntries(map);
  if (rows.length === 0) {
    return "- (none)";
  }
  return rows.map(([key, value]) => `- ${key}: ${value}`).join("\n");
}

function formatPolicyTransformationTable(map: Map<PolicyTransformationKey, number>): string {
  return POLICY_TRANSFORMATION_KEYS.map((key) => `- ${key}: ${map.get(key) ?? 0}`).join("\n");
}

function formatCodepointCountTable(map: Map<number, number>): string {
  const rows = sortedCodepointEntries(map);
  if (rows.length === 0) {
    return "- (none)";
  }
  return rows
    .map(
      ([codepoint, value]) =>
        `- ${toCodepoint(codepoint)} (${markNameForCodepoint(codepoint)}): ${value}`
    )
    .join("\n");
}

function sha256Hex(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function parseNormalizedLine(line: string): { ref: string; text: string } {
  const tabIndex = line.indexOf("\t");
  if (tabIndex < 0) {
    return { ref: "", text: line };
  }
  return {
    ref: line.slice(0, tabIndex),
    text: line.slice(tabIndex + 1)
  };
}

function verifyNormalizedOutputIdempotence(
  normalizedText: string,
  keepTeamim: boolean
): {
  failures: number;
  samples: OutputIdempotenceSample[];
} {
  const lines = normalizedText
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);

  let failures = 0;
  const samples: OutputIdempotenceSample[] = [];
  for (const line of lines) {
    const { ref, text } = parseNormalizedLine(line);
    const renormalized = normalizeVerse(text, keepTeamim, ref || "(unknown)").normalized;
    if (renormalized !== text) {
      failures += 1;
      if (samples.length < IDEMPOTENCE_SAMPLE_LIMIT) {
        samples.push({ ref, original: text, renormalized });
      }
    }
  }

  return { failures, samples };
}

export function buildNormalizationResult(
  source: SourcePayload,
  keepTeamim: boolean
): NormalizeResult {
  const lines: string[] = [];
  const keptByCategory = new Map<string, number>();
  const removedByCategory = new Map<string, number>();
  const teamimObservedByCodepoint = new Map<number, number>();
  const policyTransformations = new Map<PolicyTransformationKey, number>();

  let verses = 0;
  let codepointsBefore = 0;
  let codepointsAfter = 0;
  let combiningBefore = 0;
  let combiningAfter = 0;
  let removedTeamim = 0;
  let maqafObserved = 0;
  let sofPasuqObserved = 0;
  let qamatsQatanObserved = 0;
  let qamatsQatanNormalized = 0;
  let sourceIdempotenceFailures = 0;
  let hebrewBasesChecked = 0;
  let markSequencesChecked = 0;
  let outOfOrderMarkSequences = 0;
  const outOfOrderSamples: OrderSample[] = [];

  for (const book of source.books ?? []) {
    for (const chapter of book.chapters ?? []) {
      for (const verse of chapter.verses ?? []) {
        verses += 1;
        const ref = `${book.name} ${chapter.n}:${verse.n}`;
        const text = verse.he ?? "";
        const { normalized, stats } = normalizeVerse(text, keepTeamim, ref);
        const orderCheck = verifyCombiningOrder(normalized);

        codepointsBefore += stats.codepointsBefore;
        codepointsAfter += stats.codepointsAfter;
        combiningBefore += stats.combiningBefore;
        combiningAfter += stats.combiningAfter;
        removedTeamim += stats.removedTeamim;
        maqafObserved += stats.maqafObserved;
        sofPasuqObserved += stats.sofPasuqObserved;
        qamatsQatanObserved += stats.qamatsQatanObserved;
        qamatsQatanNormalized += stats.qamatsQatanNormalized;
        hebrewBasesChecked += orderCheck.hebrewBasesChecked;
        markSequencesChecked += orderCheck.markSequencesChecked;
        outOfOrderMarkSequences += orderCheck.outOfOrderCount;

        for (const [key, value] of stats.keptByCategory.entries()) {
          increment(keptByCategory, key, value);
        }
        for (const [key, value] of stats.removedByCategory.entries()) {
          increment(removedByCategory, key, value);
        }
        for (const [codepoint, value] of stats.teamimObservedByCodepoint.entries()) {
          increment(teamimObservedByCodepoint, codepoint, value);
        }
        for (const [key, value] of stats.policyTransformations.entries()) {
          increment(policyTransformations, key, value);
        }
        for (const sample of orderCheck.samples) {
          if (outOfOrderSamples.length >= ORDER_SAMPLE_LIMIT) {
            break;
          }
          outOfOrderSamples.push({
            ref,
            ...sample
          });
        }

        const renormalized = normalizeVerse(normalized, keepTeamim, ref).normalized;
        if (renormalized !== normalized) {
          sourceIdempotenceFailures += 1;
        }

        const lineValue = normalized.replace(/\n/g, "\\n");
        lines.push(`${ref}\t${lineValue}`);
      }
    }
  }

  const normalizedText = `${lines.join("\n")}\n`;
  const normalizedBuffer = Buffer.from(normalizedText, "utf8");
  const checksum = sha256Hex(normalizedBuffer);
  const outputIdempotence = verifyNormalizedOutputIdempotence(normalizedText, keepTeamim);

  return {
    normalizedText,
    normalizedBuffer,
    checksum,
    stats: {
      verses,
      codepointsBefore,
      codepointsAfter,
      combiningBefore,
      combiningAfter,
      removedTeamim,
      keptByCategory,
      removedByCategory,
      teamimObservedByCodepoint,
      policyTransformations,
      maqafObserved,
      sofPasuqObserved,
      qamatsQatanObserved,
      qamatsQatanNormalized,
      sourceIdempotenceFailures,
      outputIdempotenceFailures: outputIdempotence.failures,
      outputIdempotenceSamples: outputIdempotence.samples,
      hebrewBasesChecked,
      markSequencesChecked,
      outOfOrderMarkSequences,
      outOfOrderSamples
    }
  };
}

function buildReport(
  result: NormalizeResult,
  opts: NormalizeOptions,
  inputPath: string,
  outPath: string,
  shaOutPath: string
): string {
  const {
    verses,
    codepointsBefore,
    codepointsAfter,
    combiningBefore,
    combiningAfter,
    removedTeamim,
    keptByCategory,
    removedByCategory,
    teamimObservedByCodepoint,
    policyTransformations,
    maqafObserved,
    sofPasuqObserved,
    qamatsQatanObserved,
    qamatsQatanNormalized,
    sourceIdempotenceFailures,
    outputIdempotenceFailures,
    outputIdempotenceSamples,
    hebrewBasesChecked,
    markSequencesChecked,
    outOfOrderMarkSequences,
    outOfOrderSamples
  } = result.stats;

  const keptNiqqud = keptByCategory.get("niqqud") ?? 0;
  const keptDots =
    (keptByCategory.get("dagesh_or_mappiq") ?? 0) + (keptByCategory.get("shin_or_sin_dot") ?? 0);
  const keptTeamim = keptByCategory.get("teamim") ?? 0;
  const keptOther = sortedEntries(keptByCategory)
    .filter(([key]) => !["niqqud", "dagesh_or_mappiq", "shin_or_sin_dot", "teamim"].includes(key))
    .reduce((acc, [, value]) => acc + value, 0);

  const removedNiqqud = removedByCategory.get("niqqud") ?? 0;
  const removedDots =
    (removedByCategory.get("dagesh_or_mappiq") ?? 0) +
    (removedByCategory.get("shin_or_sin_dot") ?? 0);
  const removedTeamimByCategory = removedByCategory.get("teamim") ?? 0;
  const removedOther = sortedEntries(removedByCategory)
    .filter(([key]) => !["niqqud", "dagesh_or_mappiq", "shin_or_sin_dot", "teamim"].includes(key))
    .reduce((acc, [, value]) => acc + value, 0);

  return [
    "# Normalization Report",
    "",
    `- input: ${inputPath}`,
    `- output: ${outPath}`,
    `- checksum file: ${shaOutPath}`,
    `- normalization form: NFD`,
    `- te'amim policy: ${opts.keepTeamim ? "keep" : "strip"}`,
    `- te'amim ranges: U+0591-U+05AF`,
    `- punctuation policy: retain`,
    `- maqaf policy (U+05BE): retain`,
    `- qamats-qatan policy (U+05C7): preserve (no rewrite)`,
    `- verses processed: ${verses}`,
    `- source idempotence failures: ${sourceIdempotenceFailures}`,
    `- output idempotence failures: ${outputIdempotenceFailures}`,
    "",
    "## Codepoint Counts",
    "",
    `- total codepoints before: ${codepointsBefore}`,
    `- total codepoints after: ${codepointsAfter}`,
    `- total combining marks before: ${combiningBefore}`,
    `- total combining marks after: ${combiningAfter}`,
    `- total te'amim removed: ${removedTeamim}`,
    `- maqaf observed: ${maqafObserved}`,
    `- sof pasuq observed: ${sofPasuqObserved}`,
    `- qamats-qatan observed: ${qamatsQatanObserved}`,
    `- qamats-qatan normalized to qamats: ${qamatsQatanNormalized}`,
    "",
    "## Category Totals",
    "",
    "- kept:",
    `  - niqqud: ${keptNiqqud}`,
    `  - dots (dagesh/mappiq + shin/sin): ${keptDots}`,
    `  - te'amim: ${keptTeamim}`,
    `  - other combining marks: ${keptOther}`,
    "- removed:",
    `  - niqqud: ${removedNiqqud}`,
    `  - dots (dagesh/mappiq + shin/sin): ${removedDots}`,
    `  - te'amim: ${removedTeamimByCategory}`,
    `  - other combining marks: ${removedOther}`,
    "",
    "## Kept Mark Categories",
    "",
    formatMapTable(keptByCategory),
    "",
    "## Removed Mark Categories",
    "",
    formatMapTable(removedByCategory),
    "",
    "## Teamim Codepoints Observed",
    "",
    formatCodepointCountTable(teamimObservedByCodepoint),
    "",
    "## Policy Transformations Applied",
    "",
    formatPolicyTransformationTable(policyTransformations),
    "",
    "## Combining Mark Order Verification",
    "",
    `- hebrew base letters checked: ${hebrewBasesChecked}`,
    `- base letters with combining marks checked: ${markSequencesChecked}`,
    `- out-of-order sequences detected: ${outOfOrderMarkSequences}`,
    outOfOrderSamples.length === 0 ? "- out-of-order samples: (none)" : "- out-of-order samples:",
    ...outOfOrderSamples.map(
      (sample) =>
        `  - ${sample.ref} base='${sample.base}' original='${sample.originalCodepoints}' reordered='${sample.reorderedCodepoints}'`
    ),
    "",
    "## Output Idempotence Samples",
    "",
    outputIdempotenceSamples.length === 0
      ? "- (none)"
      : "- lines that changed after re-normalization:",
    ...outputIdempotenceSamples.map(
      (sample) =>
        `  - ${sample.ref || "(unknown)"} original='${sample.original}' renormalized='${sample.renormalized}'`
    ),
    "",
    "## Output SHA-256",
    "",
    `- ${result.checksum}`,
    ""
  ].join("\n");
}

async function runCommand(opts: NormalizeOptions): Promise<void> {
  const inputPath = path.resolve(opts.input);
  const outPath = path.resolve(opts.out);
  const shaOutPath = path.resolve(opts.shaOut);
  const reportPath = path.resolve(opts.reportOut);

  const raw = await fs.readFile(inputPath, "utf8");
  const source = JSON.parse(raw) as SourcePayload;
  const result = buildNormalizationResult(source, opts.keepTeamim);

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.mkdir(path.dirname(shaOutPath), { recursive: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  await fs.writeFile(outPath, result.normalizedBuffer);
  await fs.writeFile(shaOutPath, `${result.checksum}\n`, "utf8");

  const report = buildReport(result, opts, inputPath, outPath, shaOutPath);
  await fs.writeFile(reportPath, report, "utf8");

  if (
    result.stats.sourceIdempotenceFailures > 0 ||
    result.stats.outputIdempotenceFailures > 0 ||
    result.stats.outOfOrderMarkSequences > 0
  ) {
    throw new Error(
      `normalization quality gate failed: sourceIdempotenceFailures=${result.stats.sourceIdempotenceFailures} outputIdempotenceFailures=${result.stats.outputIdempotenceFailures} outOfOrderMarkSequences=${result.stats.outOfOrderMarkSequences}`
    );
  }

  console.log(
    [
      `done: verses=${result.stats.verses}`,
      `teAmimPolicy=${opts.keepTeamim ? "keep" : "strip"}`,
      `sourceIdempotenceFailures=${result.stats.sourceIdempotenceFailures}`,
      `outputIdempotenceFailures=${result.stats.outputIdempotenceFailures}`,
      `out=${outPath}`,
      `shaOut=${shaOutPath}`,
      `report=${reportPath}`
    ].join(" ")
  );
}

async function verifyCommand(opts: NormalizeOptions): Promise<void> {
  const inputPath = path.resolve(opts.input);
  const outPath = path.resolve(opts.out);
  const shaOutPath = path.resolve(opts.shaOut);

  const [rawInput, existingOutputBuffer, existingShaRaw] = await Promise.all([
    fs.readFile(inputPath, "utf8"),
    fs.readFile(outPath),
    fs.readFile(shaOutPath, "utf8")
  ]);

  const source = JSON.parse(rawInput) as SourcePayload;
  const expected = buildNormalizationResult(source, opts.keepTeamim);

  const existingOutput = existingOutputBuffer.toString("utf8");
  const existingOutputSha = sha256Hex(existingOutputBuffer);
  const recordedSha = existingShaRaw.trim();

  const failures: string[] = [];
  if (expected.normalizedText !== existingOutput) {
    failures.push("normalized output file does not match deterministic normalization of input");
  }
  if (recordedSha !== existingOutputSha) {
    failures.push("recorded sha256 does not match actual output bytes");
  }
  if (recordedSha !== expected.checksum) {
    failures.push("recorded sha256 does not match deterministic checksum from current input");
  }
  if (expected.stats.sourceIdempotenceFailures > 0) {
    failures.push(`source idempotence failures: ${expected.stats.sourceIdempotenceFailures}`);
  }
  if (expected.stats.outputIdempotenceFailures > 0) {
    failures.push(`output idempotence failures: ${expected.stats.outputIdempotenceFailures}`);
  }
  if (expected.stats.outOfOrderMarkSequences > 0) {
    failures.push(`out-of-order mark sequences: ${expected.stats.outOfOrderMarkSequences}`);
  }

  if (failures.length > 0) {
    throw new Error(`verify failed: ${failures.join("; ")}`);
  }

  console.log(
    [
      "verify: ok",
      `teAmimPolicy=${opts.keepTeamim ? "keep" : "strip"}`,
      `verses=${expected.stats.verses}`,
      `sha256=${recordedSha}`,
      `out=${outPath}`
    ].join(" ")
  );
}

export async function main(rawArgv: string[] = process.argv.slice(2)): Promise<void> {
  const { command, opts } = parseArgs(rawArgv);
  if (command === "verify") {
    await verifyCommand(opts);
    return;
  }
  await runCommand(opts);
}
