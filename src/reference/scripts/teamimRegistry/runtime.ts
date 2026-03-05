import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_INPUT = path.resolve(process.cwd(), "data", "torah.normalized.teamim.txt");
export const DEFAULT_CLASSIFICATION = path.resolve(
  process.cwd(),
  "registry",
  "teamim.classification.json"
);
export const DEFAULT_REGISTRY_OUT = path.resolve(process.cwd(), "data", "teamim.registry.json");
export const DEFAULT_REPORT_OUT = path.resolve(
  process.cwd(),
  "reports",
  "teamim_registry_report.md"
);

const TEAMIM_MIN = 0x0591;
const TEAMIM_MAX = 0x05af;
const CODEPOINT_KEY_PATTERN = /^U\+([0-9A-F]{4,6})$/u;

type Command = "run" | "verify";

type TeamimClass = "DISJUNCTIVE" | "CONJUNCTIVE" | "OTHER";

type TeamimClassificationEntry = {
  codepoint: string;
  unicode_name?: string;
  hebrew_name?: string;
  class: TeamimClass;
  precedence: number;
};

type TeamimClassification = {
  schema_version: number;
  source?: Record<string, unknown>;
  selection_policy?: Record<string, unknown>;
  other_policy?: string;
  entries: Record<string, TeamimClassificationEntry>;
};

export type TeamimRegistryOptions = {
  input: string;
  classification: string;
  registryOut: string;
  reportOut: string;
};

type ParseResult = {
  command: Command;
  opts: TeamimRegistryOptions;
};

type InputRecord = {
  ref: string;
  lineNumber: number;
  text: string;
};

type TeamimRegistryEntry = {
  codepoint: string;
  unicode_name: string;
  hebrew_name: string | null;
  class: TeamimClass;
  precedence: number;
  count: number;
};

type BuildStats = {
  records: number;
  marks: number;
  observedCodepoints: number;
};

export type BuildArtifactsResult = {
  registryJson: string;
  reportText: string;
  stats: BuildStats;
};

function sha256Hex(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function compareCodepointKey(left: string, right: string): number {
  return parseCodepointKey(left) - parseCodepointKey(right);
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

function toCodepoint(codepoint: number): string {
  return `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

function parseCodepointKey(key: string): number {
  const normalizedKey = String(key ?? "").toUpperCase();
  const match = normalizedKey.match(CODEPOINT_KEY_PATTERN);
  if (!match) {
    throw new Error(`Invalid codepoint key '${key}'`);
  }
  return Number.parseInt(match[1] ?? "", 16);
}

function assertTeamimRange(codepoint: number, source: string): void {
  if (codepoint < TEAMIM_MIN || codepoint > TEAMIM_MAX) {
    throw new Error(`Codepoint ${toCodepoint(codepoint)} in ${source} is outside U+0591-U+05AF`);
  }
}

function isTeamimCodepoint(codepoint: number): boolean {
  return codepoint >= TEAMIM_MIN && codepoint <= TEAMIM_MAX;
}

function parseClassificationSource(sourceText: string): TeamimClassification {
  let parsed: unknown;
  try {
    parsed = JSON.parse(sourceText);
  } catch (error) {
    throw new Error(
      `Invalid JSON in teamim classification: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Teamim classification must be a JSON object");
  }

  const classification = parsed as Partial<TeamimClassification>;
  if (!Number.isInteger(classification.schema_version)) {
    throw new Error("Teamim classification requires integer schema_version");
  }

  if (!classification.entries || typeof classification.entries !== "object") {
    throw new Error("Teamim classification requires entries object");
  }

  const validatedEntries: Record<string, TeamimClassificationEntry> = {};
  const classValues = new Set<TeamimClass>(["DISJUNCTIVE", "CONJUNCTIVE", "OTHER"]);

  for (const [key, rawEntry] of Object.entries(classification.entries)) {
    if (!rawEntry || typeof rawEntry !== "object") {
      throw new Error(`Classification entry ${key} must be an object`);
    }

    const entry = rawEntry as Partial<TeamimClassificationEntry>;
    const keyCodepoint = parseCodepointKey(key);
    assertTeamimRange(keyCodepoint, `classification key ${key}`);

    if (entry.codepoint !== key) {
      throw new Error(`Classification entry ${key} must include matching codepoint field`);
    }

    if (!entry.class || !classValues.has(entry.class)) {
      throw new Error(`Classification entry ${key} has invalid class '${String(entry.class)}'`);
    }

    if (!Number.isInteger(entry.precedence)) {
      throw new Error(`Classification entry ${key} requires integer precedence`);
    }

    const precedence = Number(entry.precedence);
    if (entry.class === "OTHER") {
      if (precedence !== 0) {
        throw new Error(`Classification entry ${key} class OTHER must use precedence=0`);
      }
    } else if (precedence <= 0) {
      throw new Error(`Classification entry ${key} must use precedence > 0`);
    }

    validatedEntries[key] = {
      codepoint: entry.codepoint,
      unicode_name: entry.unicode_name,
      hebrew_name: entry.hebrew_name,
      class: entry.class,
      precedence
    };
  }

  return {
    schema_version: Number(classification.schema_version),
    source:
      classification.source && typeof classification.source === "object"
        ? { ...classification.source }
        : undefined,
    selection_policy:
      classification.selection_policy && typeof classification.selection_policy === "object"
        ? { ...classification.selection_policy }
        : undefined,
    other_policy:
      typeof classification.other_policy === "string" ? classification.other_policy : undefined,
    entries: validatedEntries
  };
}

function increment<K>(map: Map<K, number>, key: K, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

export function printHelp(): void {
  console.log("Usage:");
  console.log(
    "  node scripts/teamim-registry.mjs [run] [--input=path] [--classification=path] [--registry-out=path] [--report-out=path]"
  );
  console.log(
    "  node scripts/teamim-registry.mjs verify [--input=path] [--classification=path] [--registry-out=path] [--report-out=path]"
  );
  console.log("");
  console.log("Defaults:");
  console.log(`  --input=${DEFAULT_INPUT}`);
  console.log(`  --classification=${DEFAULT_CLASSIFICATION}`);
  console.log(`  --registry-out=${DEFAULT_REGISTRY_OUT}`);
  console.log(`  --report-out=${DEFAULT_REPORT_OUT}`);
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

  const opts: TeamimRegistryOptions = {
    input: DEFAULT_INPUT,
    classification: DEFAULT_CLASSIFICATION,
    registryOut: DEFAULT_REGISTRY_OUT,
    reportOut: DEFAULT_REPORT_OUT
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
    if (arg.startsWith("--classification=")) {
      opts.classification = arg.slice("--classification=".length);
      continue;
    }
    if (arg.startsWith("--registry-out=")) {
      opts.registryOut = arg.slice("--registry-out=".length);
      continue;
    }
    if (arg.startsWith("--report-out=")) {
      opts.reportOut = arg.slice("--report-out=".length);
      continue;
    }
    throw new Error(`Unknown argument '${arg}'`);
  }

  return { command, opts };
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

export function buildArtifacts(
  sourceText: string,
  classificationSourceText: string,
  inputPath: string,
  classificationPath: string
): BuildArtifactsResult {
  const records = parseInputRecords(sourceText);
  const classification = parseClassificationSource(classificationSourceText);

  const observedByCodepoint = new Map<number, number>();
  let marks = 0;

  for (const record of records) {
    const chars = Array.from(record.text.normalize("NFD"));
    for (const ch of chars) {
      const codepoint = ch.codePointAt(0);
      if (codepoint === undefined || !isTeamimCodepoint(codepoint)) {
        continue;
      }
      increment(observedByCodepoint, codepoint);
      marks += 1;
    }
  }

  const observedCodepoints = Array.from(observedByCodepoint.keys()).sort(
    (left, right) => left - right
  );
  const observedKeys = observedCodepoints.map((codepoint) => toCodepoint(codepoint));
  const classificationKeys = Object.keys(classification.entries).sort(compareCodepointKey);

  const missingFromClassification = observedKeys.filter((key) => !classification.entries[key]);
  if (missingFromClassification.length > 0) {
    throw new Error(
      `Coverage check failed: observed teamim missing classification entries: ${missingFromClassification.join(", ")}`
    );
  }

  const observedTeamim: Record<string, TeamimRegistryEntry> = {};
  const codepointsByClass = new Map<TeamimClass, number>();
  const marksByClass = new Map<TeamimClass, number>();

  for (const codepoint of observedCodepoints) {
    const key = toCodepoint(codepoint);
    const entry = classification.entries[key];
    if (!entry) {
      continue;
    }

    const count = observedByCodepoint.get(codepoint) ?? 0;
    increment(codepointsByClass, entry.class);
    increment(marksByClass, entry.class, count);

    observedTeamim[key] = {
      codepoint: key,
      unicode_name: entry.unicode_name ?? `HEBREW ACCENT ${key}`,
      hebrew_name: entry.hebrew_name ?? null,
      class: entry.class,
      precedence: entry.precedence,
      count
    };
  }

  const unobservedClassification = classificationKeys.filter((key) => !observedKeys.includes(key));

  const registryPayload = {
    schema_version: 1,
    input: {
      path: path.resolve(inputPath),
      sha256: sha256Hex(sourceText)
    },
    classification: {
      path: path.resolve(classificationPath),
      sha256: sha256Hex(classificationSourceText),
      schema_version: classification.schema_version
    },
    scan: {
      normalization: "NFD",
      teamim_range: `${toCodepoint(TEAMIM_MIN)}-${toCodepoint(TEAMIM_MAX)}`
    },
    selection_policy: classification.selection_policy ?? {
      primary_accent: {
        class_priority: ["DISJUNCTIVE", "CONJUNCTIVE"],
        precedence: "higher_integer_wins",
        tie_break: "lower_codepoint_wins"
      }
    },
    stats: {
      records_scanned: records.length,
      teamim_marks_scanned: marks,
      observed_codepoints: observedCodepoints.length,
      classified_observed_codepoints: observedCodepoints.length,
      classification_entries_total: classificationKeys.length,
      classification_entries_unobserved: unobservedClassification.length,
      observed_classes: {
        DISJUNCTIVE: codepointsByClass.get("DISJUNCTIVE") ?? 0,
        CONJUNCTIVE: codepointsByClass.get("CONJUNCTIVE") ?? 0,
        OTHER: codepointsByClass.get("OTHER") ?? 0
      },
      observed_marks_by_class: {
        DISJUNCTIVE: marksByClass.get("DISJUNCTIVE") ?? 0,
        CONJUNCTIVE: marksByClass.get("CONJUNCTIVE") ?? 0,
        OTHER: marksByClass.get("OTHER") ?? 0
      }
    },
    observed_teamim: observedTeamim
  };

  const registryJson = `${JSON.stringify(sortObjectKeysDeep(registryPayload), null, 2)}\n`;

  const rowsByFrequency = observedCodepoints
    .map((codepoint) => {
      const key = toCodepoint(codepoint);
      const entry = observedTeamim[key];
      return {
        codepoint,
        key,
        entry
      };
    })
    .sort((left, right) => {
      const leftCount = left.entry?.count ?? 0;
      const rightCount = right.entry?.count ?? 0;
      if (leftCount !== rightCount) {
        return rightCount - leftCount;
      }
      return left.codepoint - right.codepoint;
    });

  const reportLines = [
    "# Teamim Registry Report",
    "",
    `- input: ${path.resolve(inputPath)}`,
    `- classification: ${path.resolve(classificationPath)}`,
    `- records scanned: ${records.length}`,
    `- teamim marks scanned: ${marks}`,
    `- observed teamim codepoints: ${observedCodepoints.length}`,
    `- classification entries: ${classificationKeys.length}`,
    `- unobserved classification entries: ${unobservedClassification.length}`,
    `- registry checksum (sha256): ${sha256Hex(registryJson)}`,
    "",
    "## Validation",
    "",
    `- coverage: ${missingFromClassification.length === 0 ? "pass" : "fail"}`,
    "- primary accent selection: if DISJUNCTIVE marks exist, choose highest precedence DISJUNCTIVE; otherwise choose highest precedence CONJUNCTIVE.",
    "- tie-break rule: lower codepoint wins when precedence ties.",
    "- parser rule source: registry/teamim.classification.json only.",
    classification.other_policy ? `- other policy: ${classification.other_policy}` : "",
    "",
    "## Observed Counts By Class",
    "",
    `- DISJUNCTIVE: codepoints=${codepointsByClass.get("DISJUNCTIVE") ?? 0}, marks=${marksByClass.get("DISJUNCTIVE") ?? 0}`,
    `- CONJUNCTIVE: codepoints=${codepointsByClass.get("CONJUNCTIVE") ?? 0}, marks=${marksByClass.get("CONJUNCTIVE") ?? 0}`,
    `- OTHER: codepoints=${codepointsByClass.get("OTHER") ?? 0}, marks=${marksByClass.get("OTHER") ?? 0}`,
    "",
    "## Observed Teamim (count desc)",
    "",
    ...rowsByFrequency.map((row) => {
      const entry = row.entry;
      if (!entry) {
        return `- ${row.key}: missing metadata`;
      }
      return `- ${row.key} ${entry.unicode_name} | class=${entry.class} precedence=${entry.precedence} count=${entry.count}`;
    }),
    ""
  ].filter((line) => line.length > 0 || line === "");

  const reportText = reportLines.join("\n");

  return {
    registryJson,
    reportText,
    stats: {
      records: records.length,
      marks,
      observedCodepoints: observedCodepoints.length
    }
  };
}

export function assertDeterminism(first: BuildArtifactsResult, second: BuildArtifactsResult): void {
  if (first.registryJson !== second.registryJson) {
    throw new Error(
      "Determinism check failed: teamim registry JSON differs across repeated extraction"
    );
  }
  if (first.reportText !== second.reportText) {
    throw new Error(
      "Determinism check failed: teamim registry report differs across repeated extraction"
    );
  }
}

export async function runCommand(opts: TeamimRegistryOptions): Promise<void> {
  const inputPath = path.resolve(opts.input);
  const classificationPath = path.resolve(opts.classification);
  const registryOutPath = path.resolve(opts.registryOut);
  const reportOutPath = path.resolve(opts.reportOut);

  const [sourceText, classificationText] = await Promise.all([
    fs.readFile(inputPath, "utf8"),
    fs.readFile(classificationPath, "utf8")
  ]);

  const generated = buildArtifacts(sourceText, classificationText, inputPath, classificationPath);
  const generatedAgain = buildArtifacts(
    sourceText,
    classificationText,
    inputPath,
    classificationPath
  );
  assertDeterminism(generated, generatedAgain);

  await Promise.all([
    fs.mkdir(path.dirname(registryOutPath), { recursive: true }),
    fs.mkdir(path.dirname(reportOutPath), { recursive: true })
  ]);

  await Promise.all([
    fs.writeFile(registryOutPath, generated.registryJson, "utf8"),
    fs.writeFile(reportOutPath, generated.reportText, "utf8")
  ]);

  console.log(
    [
      `done: records=${generated.stats.records}`,
      `marks=${generated.stats.marks}`,
      `observedCodepoints=${generated.stats.observedCodepoints}`,
      `registryOut=${registryOutPath}`,
      `reportOut=${reportOutPath}`
    ].join(" ")
  );
}

export async function verifyCommand(opts: TeamimRegistryOptions): Promise<void> {
  const inputPath = path.resolve(opts.input);
  const classificationPath = path.resolve(opts.classification);
  const registryOutPath = path.resolve(opts.registryOut);
  const reportOutPath = path.resolve(opts.reportOut);

  const [sourceText, classificationText, existingRegistry, existingReport] = await Promise.all([
    fs.readFile(inputPath, "utf8"),
    fs.readFile(classificationPath, "utf8"),
    fs.readFile(registryOutPath, "utf8"),
    fs.readFile(reportOutPath, "utf8")
  ]);

  const expected = buildArtifacts(sourceText, classificationText, inputPath, classificationPath);
  const expectedAgain = buildArtifacts(
    sourceText,
    classificationText,
    inputPath,
    classificationPath
  );
  assertDeterminism(expected, expectedAgain);

  const failures: string[] = [];
  if (existingRegistry !== expected.registryJson) {
    failures.push("registry json differs from deterministic extraction");
  }
  if (existingReport !== expected.reportText) {
    failures.push("report differs from deterministic extraction");
  }

  if (failures.length > 0) {
    throw new Error(`verify failed: ${failures.join("; ")}`);
  }

  console.log(
    [
      "verify: ok",
      `records=${expected.stats.records}`,
      `marks=${expected.stats.marks}`,
      `observedCodepoints=${expected.stats.observedCodepoints}`,
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
