import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_INPUT = path.resolve(process.cwd(), "data", "torah.normalized.txt");
export const DEFAULT_REGISTRY_OUT = path.resolve(process.cwd(), "data", "tokens.registry.json");
export const DEFAULT_SIGNATURES_OUT = path.resolve(process.cwd(), "data", "tokens.signatures.txt");
export const DEFAULT_REPORT_OUT = path.resolve(
  process.cwd(),
  "reports",
  "token_registry_report.md"
);
export const DEFAULT_TOP_SIGNATURES = 100;

const HEBREW_BASE_START = 0x05d0;
const HEBREW_BASE_END = 0x05ea;
const CONTEXT_SPAN = 12;

const COMBINING_MARK = /\p{M}/u;

const SUPPORTED_MARK_CODEPOINTS = buildSupportedMarkCodepoints();

const VOWEL_LABEL_BY_CODEPOINT = new Map<number, string>([
  [0x05b0, "shva"],
  [0x05b1, "hataf_segol"],
  [0x05b2, "hataf_patah"],
  [0x05b3, "hataf_qamats"],
  [0x05b4, "hiriq"],
  [0x05b5, "tsere"],
  [0x05b6, "segol"],
  [0x05b7, "patah"],
  [0x05b8, "qamats"],
  [0x05b9, "holam"],
  [0x05ba, "holam_haser_for_vav"],
  [0x05bb, "qubuts"],
  [0x05c7, "qamats_qatan"]
]);

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

type Command = "run" | "verify";

export type ExtractTokenRegistryOptions = {
  input: string;
  registryOut: string;
  signaturesOut: string;
  reportOut: string;
  top: number;
};

type ParseResult = {
  command: Command;
  opts: ExtractTokenRegistryOptions;
};

type InputRecord = {
  ref: string;
  lineNumber: number;
  text: string;
};

type SignatureDescriptor = {
  signature: string;
  base: string;
  markCodepoints: number[];
  mark_names: string[];
};

type ExtractSignaturesResult = {
  totalClusters: number;
  signatureByKey: Map<string, SignatureDescriptor>;
  signatureCounts: Map<string, number>;
  baseFrequencies: Map<string, number>;
  markFrequencies: Map<number, number>;
};

type BuildStats = {
  records: number;
  clusters: number;
  distinctSignatures: number;
};

export type BuildArtifactsResult = {
  registryJson: string;
  signaturesText: string;
  reportText: string;
  stats: BuildStats;
};

type BuildFeaturesResult = {
  has_dagesh: boolean;
  vowel: string | null;
  has_shin_dot: "shin" | "sin" | null;
};

type TokenRegistryEntry = {
  token_id: number;
  signature: string;
  base: string;
  marks: string[];
  mark_names: string[];
  count: number;
  features: BuildFeaturesResult;
  notes: string;
};

export function printHelp(): void {
  console.log("Usage:");
  console.log(
    "  node scripts/extract-token-registry.mjs [run] [--input=path] [--registry-out=path] [--signatures-out=path] [--report-out=path] [--top=N]"
  );
  console.log(
    "  node scripts/extract-token-registry.mjs verify [--input=path] [--registry-out=path] [--signatures-out=path] [--report-out=path] [--top=N]"
  );
  console.log("");
  console.log("Defaults:");
  console.log(`  --input=${DEFAULT_INPUT}`);
  console.log(`  --registry-out=${DEFAULT_REGISTRY_OUT}`);
  console.log(`  --signatures-out=${DEFAULT_SIGNATURES_OUT}`);
  console.log(`  --report-out=${DEFAULT_REPORT_OUT}`);
  console.log(`  --top=${DEFAULT_TOP_SIGNATURES}`);
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

  const opts: ExtractTokenRegistryOptions = {
    input: DEFAULT_INPUT,
    registryOut: DEFAULT_REGISTRY_OUT,
    signaturesOut: DEFAULT_SIGNATURES_OUT,
    reportOut: DEFAULT_REPORT_OUT,
    top: DEFAULT_TOP_SIGNATURES
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
    if (arg.startsWith("--registry-out=")) {
      opts.registryOut = arg.slice("--registry-out=".length);
      continue;
    }
    if (arg.startsWith("--signatures-out=")) {
      opts.signaturesOut = arg.slice("--signatures-out=".length);
      continue;
    }
    if (arg.startsWith("--report-out=")) {
      opts.reportOut = arg.slice("--report-out=".length);
      continue;
    }
    if (arg.startsWith("--top=")) {
      const parsed = Number(arg.slice("--top=".length));
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Invalid --top value '${arg.slice("--top=".length)}'`);
      }
      opts.top = parsed;
      continue;
    }
    throw new Error(`Unknown argument '${arg}'`);
  }

  return { command, opts };
}

function buildSupportedMarkCodepoints(): Set<number> {
  const supported = new Set<number>([0x034f]);
  addRange(supported, 0x0591, 0x05af);
  addRange(supported, 0x05b0, 0x05bc);
  supported.add(0x05bd);
  supported.add(0x05bf);
  supported.add(0x05c1);
  supported.add(0x05c2);
  supported.add(0x05c4);
  supported.add(0x05c5);
  supported.add(0x05c7);
  return supported;
}

function addRange(target: Set<number>, start: number, end: number): void {
  for (let codepoint = start; codepoint <= end; codepoint += 1) {
    target.add(codepoint);
  }
}

function isHebrewBaseLetter(codepoint: number): boolean {
  return codepoint >= HEBREW_BASE_START && codepoint <= HEBREW_BASE_END;
}

function isCombiningMark(ch: string): boolean {
  return COMBINING_MARK.test(ch);
}

function toCodepoint(codepoint: number): string {
  return `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

function markNameForCodepoint(codepoint: number): string {
  const knownName = MARK_NAME_BY_CODEPOINT.get(codepoint);
  if (knownName) {
    return knownName;
  }
  if (codepoint >= 0x0591 && codepoint <= 0x05af) {
    return `HEBREW ACCENT ${toCodepoint(codepoint)}`;
  }
  return `UNKNOWN MARK ${toCodepoint(codepoint)}`;
}

function sha256Hex(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function compareKeys(left: string, right: string): number {
  const integerPattern = /^\d+$/;
  const leftIsInteger = integerPattern.test(left);
  const rightIsInteger = integerPattern.test(right);
  if (leftIsInteger && rightIsInteger) {
    return Number(left) - Number(right);
  }
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function sortObjectKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortObjectKeysDeep(item));
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const ordered: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort(compareKeys)) {
      ordered[key] = sortObjectKeysDeep(source[key]);
    }
    return ordered;
  }
  return value;
}

function increment<K>(map: Map<K, number>, key: K, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

export function parseInputRecords(inputText: string): InputRecord[] {
  const normalizedLineEndings = String(inputText ?? "").replace(/\r\n?/g, "\n");
  const rows = normalizedLineEndings.split("\n");
  const records: InputRecord[] = [];

  for (let lineNumber = 0; lineNumber < rows.length; lineNumber += 1) {
    const rawLine = rows[lineNumber] ?? "";
    if (!rawLine || rawLine.trim().length === 0) {
      continue;
    }

    const tabIndex = rawLine.indexOf("\t");
    const hasRefPrefix = tabIndex >= 0;
    const fallbackRef = `line:${lineNumber + 1}`;
    const ref = hasRefPrefix ? rawLine.slice(0, tabIndex).trim() || fallbackRef : fallbackRef;
    const verseText = (hasRefPrefix ? rawLine.slice(tabIndex + 1) : rawLine).replace(/\\n/g, " ");

    records.push({
      ref,
      lineNumber: lineNumber + 1,
      text: verseText
    });
  }

  return records;
}

function contextSnippet(chars: string[], index: number): string {
  const start = Math.max(0, index - CONTEXT_SPAN);
  const end = Math.min(chars.length, index + CONTEXT_SPAN + 1);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < chars.length ? "…" : "";
  const snippet = chars.slice(start, end).join("");
  return `${prefix}${snippet}${suffix}`.replace(/\s+/g, " ");
}

function throwUnsupportedCombiningMark(
  record: InputRecord,
  chars: string[],
  index: number,
  codepoint: number
): never {
  throw new Error(
    `Unsupported combining mark ${toCodepoint(codepoint)} at ${record.ref} (line ${record.lineNumber}, char ${
      index + 1
    }). Context: "${contextSnippet(chars, index)}"`
  );
}

function throwStrayCombiningMark(
  record: InputRecord,
  chars: string[],
  index: number,
  codepoint: number
): never {
  throw new Error(
    `Combining mark ${toCodepoint(codepoint)} without preceding Hebrew base letter at ${record.ref} (line ${
      record.lineNumber
    }, char ${index + 1}). Context: "${contextSnippet(chars, index)}"`
  );
}

function compareSignatureDescriptors(
  left: SignatureDescriptor,
  right: SignatureDescriptor
): number {
  const leftBase = left.base.codePointAt(0) ?? 0;
  const rightBase = right.base.codePointAt(0) ?? 0;
  if (leftBase !== rightBase) {
    return leftBase - rightBase;
  }

  const maxLength = Math.max(left.markCodepoints.length, right.markCodepoints.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftCodepoint = left.markCodepoints[index];
    const rightCodepoint = right.markCodepoints[index];
    if (leftCodepoint === undefined) {
      return -1;
    }
    if (rightCodepoint === undefined) {
      return 1;
    }
    if (leftCodepoint !== rightCodepoint) {
      return leftCodepoint - rightCodepoint;
    }
  }

  if (left.signature === right.signature) {
    return 0;
  }
  return left.signature < right.signature ? -1 : 1;
}

function encodeSignature(base: string, markCodepoints: number[]): string {
  const marksValue =
    markCodepoints.length === 0
      ? "NONE"
      : markCodepoints.map((codepoint) => toCodepoint(codepoint)).join(",");
  return `BASE=${base}|MARKS=${marksValue}`;
}

function buildFeatures(markCodepoints: number[]): BuildFeaturesResult {
  const uniqueMarks = new Set(markCodepoints);
  const vowels = markCodepoints
    .filter((codepoint) => VOWEL_LABEL_BY_CODEPOINT.has(codepoint))
    .map((codepoint) => VOWEL_LABEL_BY_CODEPOINT.get(codepoint))
    .filter((label): label is string => Boolean(label));
  const vowel =
    vowels.length === 0
      ? null
      : vowels.length === 1
        ? vowels[0]
        : `multiple:${Array.from(new Set(vowels)).join("+")}`;

  let shinDot: "shin" | "sin" | null = null;
  if (uniqueMarks.has(0x05c1)) {
    shinDot = "shin";
  } else if (uniqueMarks.has(0x05c2)) {
    shinDot = "sin";
  }

  return {
    has_dagesh: uniqueMarks.has(0x05bc),
    vowel,
    has_shin_dot: shinDot
  };
}

function extractSignatures(records: InputRecord[]): ExtractSignaturesResult {
  const signatureByKey = new Map<string, SignatureDescriptor>();
  const signatureCounts = new Map<string, number>();
  const baseFrequencies = new Map<string, number>();
  const markFrequencies = new Map<number, number>();

  let totalClusters = 0;

  for (const record of records) {
    const chars = [...record.text.normalize("NFD")];
    let activeCluster: { base: string; marks: string[] } | null = null;

    const finalizeCluster = (): void => {
      if (!activeCluster) {
        return;
      }
      const markCodepoints = [...activeCluster.marks]
        .map((mark) => mark.codePointAt(0))
        .filter((codepoint): codepoint is number => codepoint !== undefined)
        .sort((left, right) => left - right);
      const signature = encodeSignature(activeCluster.base, markCodepoints);

      if (!signatureByKey.has(signature)) {
        signatureByKey.set(signature, {
          signature,
          base: activeCluster.base,
          markCodepoints,
          mark_names: markCodepoints.map((codepoint) => markNameForCodepoint(codepoint))
        });
      }

      increment(signatureCounts, signature);
      increment(baseFrequencies, activeCluster.base);
      for (const markCodepoint of markCodepoints) {
        increment(markFrequencies, markCodepoint);
      }
      totalClusters += 1;
      activeCluster = null;
    };

    for (let index = 0; index < chars.length; index += 1) {
      const ch = chars[index] ?? "";
      const codepoint = ch.codePointAt(0);
      if (codepoint === undefined) {
        continue;
      }

      if (isHebrewBaseLetter(codepoint)) {
        finalizeCluster();
        activeCluster = {
          base: ch,
          marks: []
        };
        continue;
      }

      if (isCombiningMark(ch)) {
        if (!SUPPORTED_MARK_CODEPOINTS.has(codepoint)) {
          throwUnsupportedCombiningMark(record, chars, index, codepoint);
        }
        if (!activeCluster) {
          throwStrayCombiningMark(record, chars, index, codepoint);
        }
        activeCluster.marks.push(ch);
        continue;
      }

      finalizeCluster();
    }

    finalizeCluster();
  }

  return {
    totalClusters,
    signatureByKey,
    signatureCounts,
    baseFrequencies,
    markFrequencies
  };
}

export function buildArtifacts(
  sourceText: string,
  opts: Pick<ExtractTokenRegistryOptions, "top">,
  inputPath: string
): BuildArtifactsResult {
  const records = parseInputRecords(sourceText);
  const extracted = extractSignatures(records);

  const sortedSignatures = Array.from(extracted.signatureByKey.values()).sort(
    compareSignatureDescriptors
  );
  const tokenIdBySignature = new Map<string, number>();
  const tokens: Record<string, TokenRegistryEntry> = {};

  for (let index = 0; index < sortedSignatures.length; index += 1) {
    const signatureDescriptor = sortedSignatures[index];
    if (!signatureDescriptor) {
      continue;
    }
    const tokenId = index + 1;
    const signatureCount = extracted.signatureCounts.get(signatureDescriptor.signature) ?? 0;
    tokenIdBySignature.set(signatureDescriptor.signature, tokenId);

    tokens[String(tokenId)] = {
      token_id: tokenId,
      signature: signatureDescriptor.signature,
      base: signatureDescriptor.base,
      marks: signatureDescriptor.markCodepoints.map((codepoint) => toCodepoint(codepoint)),
      mark_names: signatureDescriptor.mark_names,
      count: signatureCount,
      features: buildFeatures(signatureDescriptor.markCodepoints),
      notes: ""
    };
  }

  const mappedClusters = Object.values(tokens).reduce((sum, token) => sum + token.count, 0);
  if (mappedClusters !== extracted.totalClusters) {
    throw new Error(
      `Completeness check failed: scanned=${extracted.totalClusters}, mapped=${mappedClusters}`
    );
  }

  const supportedMarks = Array.from(SUPPORTED_MARK_CODEPOINTS)
    .sort((left, right) => left - right)
    .map((codepoint) => toCodepoint(codepoint));

  const registryPayload = {
    schema_version: 1,
    input: {
      path: path.resolve(inputPath),
      sha256: sha256Hex(sourceText)
    },
    parsing: {
      base_letters: `${toCodepoint(HEBREW_BASE_START)}-${toCodepoint(HEBREW_BASE_END)}`,
      supported_combining_marks: supportedMarks,
      mark_sort_order: "codepoint"
    },
    stats: {
      records_scanned: records.length,
      clusters_scanned: extracted.totalClusters,
      clusters_mapped: mappedClusters,
      distinct_signatures: sortedSignatures.length
    },
    tokens
  };

  const registryJson = `${JSON.stringify(sortObjectKeysDeep(registryPayload), null, 2)}\n`;
  const signaturesText = `${sortedSignatures.map((signature) => signature.signature).join("\n")}\n`;

  const baseFrequencyRows = Array.from(extracted.baseFrequencies.entries()).sort((left, right) => {
    const leftCodepoint = left[0].codePointAt(0) ?? 0;
    const rightCodepoint = right[0].codePointAt(0) ?? 0;
    return leftCodepoint - rightCodepoint;
  });

  const markFrequencyRows = Array.from(extracted.markFrequencies.entries()).sort((left, right) => {
    if (left[1] !== right[1]) {
      return right[1] - left[1];
    }
    return left[0] - right[0];
  });

  const topSignatureRows = sortedSignatures
    .map((signature) => ({
      token_id: tokenIdBySignature.get(signature.signature) ?? 0,
      signature: signature.signature,
      count: extracted.signatureCounts.get(signature.signature) ?? 0
    }))
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }
      return left.token_id - right.token_id;
    })
    .slice(0, opts.top);

  const reportLines = [
    "# Token Registry Report",
    "",
    `- input: ${path.resolve(inputPath)}`,
    `- records scanned: ${records.length}`,
    `- grapheme clusters scanned: ${extracted.totalClusters}`,
    `- grapheme clusters mapped: ${mappedClusters}`,
    `- distinct signatures: ${sortedSignatures.length}`,
    `- token registry checksum (sha256): ${sha256Hex(registryJson)}`,
    `- signatures list checksum (sha256): ${sha256Hex(signaturesText)}`,
    "",
    "## Validation",
    "",
    `- completeness: ${mappedClusters === extracted.totalClusters ? "pass" : "fail"}`,
    "- unknown-mark policy: unsupported combining marks fail loudly",
    "- token assignment policy: sorted by base letter then sorted mark sequence",
    "",
    "## Base Letter Counts",
    "",
    ...baseFrequencyRows.map(([base, count]) => `- ${base}: ${count}`),
    "",
    "## Combining Mark Frequencies",
    "",
    ...markFrequencyRows.map(
      ([codepoint, count]) =>
        `- ${toCodepoint(codepoint)} (${markNameForCodepoint(codepoint)}): ${count}`
    ),
    "",
    `## Top ${opts.top} Signatures`,
    "",
    ...topSignatureRows.map(
      (row) => `- TokenID ${row.token_id}: ${row.signature} (count=${row.count})`
    ),
    ""
  ];

  const reportText = reportLines.join("\n");

  return {
    registryJson,
    signaturesText,
    reportText,
    stats: {
      records: records.length,
      clusters: extracted.totalClusters,
      distinctSignatures: sortedSignatures.length
    }
  };
}

export function assertDeterminism(first: BuildArtifactsResult, second: BuildArtifactsResult): void {
  if (first.registryJson !== second.registryJson) {
    throw new Error("Determinism check failed: registry JSON differs across repeated extraction");
  }
  if (first.signaturesText !== second.signaturesText) {
    throw new Error("Determinism check failed: signatures text differs across repeated extraction");
  }
  if (first.reportText !== second.reportText) {
    throw new Error("Determinism check failed: report text differs across repeated extraction");
  }
}

export async function runCommand(opts: ExtractTokenRegistryOptions): Promise<void> {
  const inputPath = path.resolve(opts.input);
  const registryOutPath = path.resolve(opts.registryOut);
  const signaturesOutPath = path.resolve(opts.signaturesOut);
  const reportOutPath = path.resolve(opts.reportOut);

  const sourceText = await fs.readFile(inputPath, "utf8");
  const generated = buildArtifacts(sourceText, opts, inputPath);
  const generatedAgain = buildArtifacts(sourceText, opts, inputPath);
  assertDeterminism(generated, generatedAgain);

  await Promise.all([
    fs.mkdir(path.dirname(registryOutPath), { recursive: true }),
    fs.mkdir(path.dirname(signaturesOutPath), { recursive: true }),
    fs.mkdir(path.dirname(reportOutPath), { recursive: true })
  ]);

  await Promise.all([
    fs.writeFile(registryOutPath, generated.registryJson, "utf8"),
    fs.writeFile(signaturesOutPath, generated.signaturesText, "utf8"),
    fs.writeFile(reportOutPath, generated.reportText, "utf8")
  ]);

  console.log(
    [
      `done: records=${generated.stats.records}`,
      `clusters=${generated.stats.clusters}`,
      `signatures=${generated.stats.distinctSignatures}`,
      `registryOut=${registryOutPath}`,
      `signaturesOut=${signaturesOutPath}`,
      `reportOut=${reportOutPath}`
    ].join(" ")
  );
}

export async function verifyCommand(opts: ExtractTokenRegistryOptions): Promise<void> {
  const inputPath = path.resolve(opts.input);
  const registryOutPath = path.resolve(opts.registryOut);
  const signaturesOutPath = path.resolve(opts.signaturesOut);
  const reportOutPath = path.resolve(opts.reportOut);

  const [sourceText, existingRegistryJson, existingSignaturesText, existingReportText] =
    await Promise.all([
      fs.readFile(inputPath, "utf8"),
      fs.readFile(registryOutPath, "utf8"),
      fs.readFile(signaturesOutPath, "utf8"),
      fs.readFile(reportOutPath, "utf8")
    ]);

  const expected = buildArtifacts(sourceText, opts, inputPath);
  const expectedAgain = buildArtifacts(sourceText, opts, inputPath);
  assertDeterminism(expected, expectedAgain);

  const failures: string[] = [];
  if (existingRegistryJson !== expected.registryJson) {
    failures.push("registry json differs from deterministic extraction");
  }
  if (existingSignaturesText !== expected.signaturesText) {
    failures.push("signatures text differs from deterministic extraction");
  }
  if (existingReportText !== expected.reportText) {
    failures.push("report text differs from deterministic extraction");
  }

  if (failures.length > 0) {
    throw new Error(`verify failed: ${failures.join("; ")}`);
  }

  console.log(
    [
      "verify: ok",
      `records=${expected.stats.records}`,
      `clusters=${expected.stats.clusters}`,
      `signatures=${expected.stats.distinctSignatures}`,
      `registrySha256=${sha256Hex(expected.registryJson)}`
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
