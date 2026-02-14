import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { tokenizeWords } from "../../compile/tokenizer";

export const DEFAULT_INPUT = path.resolve(process.cwd(), "data", "torah.normalized.teamim.txt");
export const DEFAULT_CLASSIFICATION = path.resolve(
  process.cwd(),
  "registry",
  "teamim.classification.json"
);
export const DEFAULT_TREE_OUT = path.resolve(process.cwd(), "corpus", "verse_phrase_trees.jsonl");
export const DEFAULT_WORD_OUT = path.resolve(process.cwd(), "corpus", "word_phrase_roles.jsonl");
export const DEFAULT_REPORT_OUT = path.resolve(process.cwd(), "reports", "phrase_tree_report.md");
export const PHRASE_VERSION = "phrase_tree.v1";

const TEAMIM_MIN = 0x0591;
const TEAMIM_MAX = 0x05af;
const CODEPOINT_KEY_PATTERN = /^U\+([0-9A-F]{4,6})$/u;

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

const MAQQEF = "\u05BE";
const SOF_PASUQ = "\u05C3";

type Command = "run" | "verify";
type TeamimClass = "DISJUNCTIVE" | "CONJUNCTIVE" | "OTHER";
type PhraseRole = "HEAD" | "TAIL" | "JOIN" | "SPLIT";

type TeamimClassificationEntry = {
  codepoint: string;
  unicode_name?: string;
  hebrew_name?: string;
  class: TeamimClass;
  precedence: number;
};

type TeamimClassification = {
  schema_version: number;
  entries: Record<string, TeamimClassificationEntry>;
};

type ParseResult = {
  command: Command;
  opts: PhraseTreeOptions;
};

export type PhraseTreeOptions = {
  input: string;
  classification: string;
  treeOut: string;
  wordOut: string;
  reportOut: string;
  bookFilter: string;
};

export type InputRecord = {
  ref: string;
  lineNumber: number;
  text: string;
};

type VerseRef = {
  book: string;
  chapter: number;
  verse: number;
  ref_key: string;
};

type VerseRecord = InputRecord &
  VerseRef & {
    normalized_text: string;
    words: string[];
  };

export type PrimaryAccent = {
  word_index: number;
  class: "DISJUNCTIVE" | "CONJUNCTIVE" | "NONE";
  codepoint: string | null;
  name: string | null;
  precedence: number;
  observed_teamim: string[];
};

type NodeSpan = {
  start: number;
  end: number;
};

export type PhraseLeafNode = {
  id: string;
  node_type: "LEAF";
  span: NodeSpan;
  word_index: number;
  surface: string;
  accent: PrimaryAccent;
};

export type PhraseJoinNode = {
  id: string;
  node_type: "JOIN";
  span: NodeSpan;
  fold: "LEFT";
  left: PhraseNode;
  right: PhraseNode;
};

export type PhraseSplitNode = {
  id: string;
  node_type: "SPLIT";
  span: NodeSpan;
  split_word_index: number;
  split_accent: {
    codepoint: string;
    name: string | null;
    precedence: number;
  };
  left: PhraseNode;
  right: PhraseNode;
};

export type PhraseNode = PhraseLeafNode | PhraseJoinNode | PhraseSplitNode;

type VersePhraseTreeRow = {
  ref_key: string;
  ref: {
    book: string;
    chapter: number;
    verse: number;
  };
  words: string[];
  primary_accents: PrimaryAccent[];
  tree: PhraseNode;
  phrase_version: string;
};

type WordPhraseRoleRow = {
  ref_key: string;
  word_index: number;
  surface: string;
  primary_accent: PrimaryAccent;
  phrase_role: PhraseRole;
  phrase_path: string[];
  clause_id: string;
  subclause_id: string;
  phrase_version: string;
};

type HealingKind = "PARASHA_MARKER_REMOVED" | "EDITORIAL_NOTE_REMOVED" | "SPLIT_FRAGMENT_JOINED";

export type HealingEvent = {
  ref_key: string;
  kind: HealingKind;
  detail: string;
};

type BuildStats = {
  verses: number;
  words: number;
  splitNodes: number;
  noSplitVerses: number;
  singleWordVerses: number;
  wordsWithoutAccent: number;
  maxDepth: number;
  healingCount: number;
  healingByKind: Record<HealingKind, number>;
  bookFilter: string[];
};

export type BuildArtifactsResult = {
  treeJsonl: string;
  wordJsonl: string;
  reportText: string;
  stats: BuildStats;
  healings: HealingEvent[];
};

export type TreeValidationResult = {
  ok: boolean;
  errors: string[];
};

function sha256Hex(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function toCodepoint(codepoint: number): string {
  return `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

function parseCodepointKey(key: string): number {
  const normalized = String(key ?? "").toUpperCase();
  const match = normalized.match(CODEPOINT_KEY_PATTERN);
  if (!match) {
    throw new Error(`Invalid teamim codepoint key '${key}'`);
  }
  return Number.parseInt(match[1] ?? "", 16);
}

function isTeamim(ch: string): boolean {
  const codepoint = ch.codePointAt(0);
  if (codepoint === undefined) {
    return false;
  }
  return codepoint >= TEAMIM_MIN && codepoint <= TEAMIM_MAX;
}

function startsWithHebrewLetter(value: string): boolean {
  const chars = Array.from(String(value ?? ""));
  for (const ch of chars) {
    if (HEBREW_LETTERS.has(ch)) {
      return true;
    }
    if (/\p{M}/u.test(ch)) {
      continue;
    }
    return false;
  }
  return false;
}

function endsWithCombiningMark(value: string): boolean {
  const chars = Array.from(String(value ?? ""));
  if (chars.length === 0) {
    return false;
  }
  const last = chars[chars.length - 1] ?? "";
  return /\p{M}/u.test(last);
}

function countHebrewBaseLetters(value: string): number {
  let count = 0;
  for (const ch of Array.from(String(value ?? ""))) {
    if (HEBREW_LETTERS.has(ch)) {
      count += 1;
    }
  }
  return count;
}

function hasTeamimMark(value: string): boolean {
  return Array.from(String(value ?? "")).some((ch) => isTeamim(ch));
}

function firstHebrewLetter(value: string): string {
  for (const ch of Array.from(String(value ?? ""))) {
    if (HEBREW_LETTERS.has(ch)) {
      return ch;
    }
  }
  return "";
}

function isSplitMetadataFragment(value: string): boolean {
  const text = String(value ?? "").trim();
  if (!text || text.includes(MAQQEF) || text.includes(SOF_PASUQ)) {
    return false;
  }
  if (countHebrewBaseLetters(text) !== 1) {
    return false;
  }
  return firstHebrewLetter(text).length > 0;
}

type FragmentJoin = {
  parts: string[];
  merged: string;
};

type CollapseFragmentsResult = {
  text: string;
  joins: FragmentJoin[];
};

function collapseSplitWordFragments(text: string): CollapseFragmentsResult {
  const parts = String(text ?? "")
    .split(/\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    return {
      text: parts.join(" "),
      joins: []
    };
  }

  const joins: FragmentJoin[] = [];
  const out: string[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const current = parts[index] ?? "";
    const nextPart = parts[index + 1] ?? "";
    const currentIsFragment = isSplitMetadataFragment(current);
    const canStartFromFragment =
      currentIsFragment &&
      startsWithHebrewLetter(nextPart) &&
      !(hasTeamimMark(current) && countHebrewBaseLetters(nextPart) === 1);
    const canStartFromTailFragment =
      !currentIsFragment &&
      startsWithHebrewLetter(current) &&
      endsWithCombiningMark(current) &&
      !hasTeamimMark(current) &&
      !current.includes(MAQQEF) &&
      !current.includes(SOF_PASUQ) &&
      isSplitMetadataFragment(nextPart) &&
      startsWithHebrewLetter(parts[index + 2] ?? "");

    if (!canStartFromFragment && !canStartFromTailFragment) {
      out.push(current);
      continue;
    }

    let merged = current;
    const consumed = [merged];
    let joined = false;
    let cursor = index + 1;
    while (cursor < parts.length) {
      const next = parts[cursor] ?? "";
      if (!startsWithHebrewLetter(next)) {
        break;
      }
      merged += next;
      consumed.push(next);
      joined = true;
      cursor += 1;
      if (!isSplitMetadataFragment(next)) {
        break;
      }
    }
    if (joined && consumed.length >= 2) {
      joins.push({
        parts: consumed,
        merged
      });
      out.push(merged);
      index = cursor - 1;
      continue;
    }
    out.push(current);
  }
  return {
    text: out.join(" "),
    joins
  };
}

function compactDetail(text: string, maxLength = 120): string {
  const compact = String(text ?? "")
    .replace(/\s+/gu, " ")
    .trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1))}…`;
}

function sanitizeVerseText(
  text: string,
  refKey: string
): { normalized: string; healings: HealingEvent[] } {
  const healings: HealingEvent[] = [];
  let cleaned = String(text ?? "");
  cleaned = cleaned.replace(/\{\s*[פס]\s*\}/gu, (match) => {
    healings.push({
      ref_key: refKey,
      kind: "PARASHA_MARKER_REMOVED",
      detail: `removed '${compactDetail(match, 20)}'`
    });
    return " ";
  });
  cleaned = cleaned.replace(/\*\s*\([^)]*\)/gu, (match) => {
    healings.push({
      ref_key: refKey,
      kind: "EDITORIAL_NOTE_REMOVED",
      detail: `removed '${compactDetail(match)}'`
    });
    return " ";
  });
  cleaned = cleaned.replace(/\([^)]*\)/gu, (match) => {
    healings.push({
      ref_key: refKey,
      kind: "EDITORIAL_NOTE_REMOVED",
      detail: `removed '${compactDetail(match)}'`
    });
    return " ";
  });
  cleaned = cleaned.replace(/<[^>]*>/gu, " ");
  cleaned = cleaned.replace(/&[^;]+;/gu, " ");
  cleaned = cleaned.normalize("NFD");

  cleaned = cleaned.replace(/\u05C7/gu, "\u05B8");
  cleaned = cleaned.replace(/\u05C0/gu, " ");
  cleaned = cleaned.replace(/\u05F3|\u05F4/gu, "");

  let out = "";
  let lastWasLetter = false;
  for (const ch of cleaned) {
    if (HEBREW_LETTERS.has(ch) || FINAL_MAP[ch]) {
      const normalized = ch;
      if (!HEBREW_LETTERS.has(normalized)) {
        continue;
      }
      out += normalized;
      lastWasLetter = true;
      continue;
    }
    if (ALLOWED_MARKS.has(ch) || isTeamim(ch)) {
      if (lastWasLetter) {
        out += ch;
      }
      continue;
    }
    if (ch === MAQQEF || ch === SOF_PASUQ) {
      out += ch;
      lastWasLetter = false;
      continue;
    }
    if (/\s/u.test(ch)) {
      out += " ";
      lastWasLetter = false;
    }
  }

  let normalized = out;
  normalized = normalized.replace(/\s*־\s*/gu, "־");
  normalized = normalized.replace(/\s*׃\s*/gu, "׃ ");
  normalized = normalized.replace(/\s+/gu, " ").trim();
  const collapsed = collapseSplitWordFragments(normalized);
  for (const join of collapsed.joins) {
    healings.push({
      ref_key: refKey,
      kind: "SPLIT_FRAGMENT_JOINED",
      detail: `joined '${join.parts.join(" + ")}' -> '${join.merged}'`
    });
  }
  return {
    normalized: collapsed.text,
    healings
  };
}

function compareRefLike(left: string, right: string): number {
  return left.localeCompare(right, "en", { numeric: true });
}

function compareCodepointKeyAscending(left: string, right: string): number {
  return parseCodepointKey(left) - parseCodepointKey(right);
}

function parseClassification(sourceText: string): TeamimClassification {
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

  const value = parsed as Partial<TeamimClassification>;
  if (!Number.isInteger(value.schema_version)) {
    throw new Error("Teamim classification requires integer schema_version");
  }
  if (!value.entries || typeof value.entries !== "object") {
    throw new Error("Teamim classification requires entries object");
  }

  const entries: Record<string, TeamimClassificationEntry> = {};
  for (const [rawKey, rawEntry] of Object.entries(value.entries)) {
    if (!rawEntry || typeof rawEntry !== "object") {
      throw new Error(`Classification entry ${rawKey} must be an object`);
    }
    const key = String(rawKey).toUpperCase();
    const codepoint = parseCodepointKey(key);
    if (codepoint < TEAMIM_MIN || codepoint > TEAMIM_MAX) {
      throw new Error(`Classification key ${key} is outside U+0591-U+05AF`);
    }

    const entry = rawEntry as Partial<TeamimClassificationEntry>;
    if (entry.codepoint !== key) {
      throw new Error(`Classification entry ${key} must include matching codepoint field`);
    }
    if (entry.class !== "DISJUNCTIVE" && entry.class !== "CONJUNCTIVE" && entry.class !== "OTHER") {
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

    entries[key] = {
      codepoint: key,
      unicode_name: entry.unicode_name,
      hebrew_name: entry.hebrew_name,
      class: entry.class,
      precedence
    };
  }

  return {
    schema_version: Number(value.schema_version),
    entries
  };
}

export function parseInputRecords(inputText: string): InputRecord[] {
  const normalizedLineEndings = String(inputText ?? "").replace(/\r\n?/gu, "\n");
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
    const verseText = (hasRefPrefix ? rawLine.slice(tabIndex + 1) : rawLine).replace(/\\n/gu, " ");

    records.push({
      ref,
      lineNumber: lineNumber + 1,
      text: verseText
    });
  }

  return records;
}

function parseVerseRef(ref: string): VerseRef {
  const normalized = String(ref ?? "").trim();
  const match = normalized.match(/^(.*\S)\s+(\d+):(\d+)$/u);
  if (!match) {
    throw new Error(`Invalid verse reference '${ref}'`);
  }
  const book = String(match[1]).trim();
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  if (!book || !Number.isInteger(chapter) || !Number.isInteger(verse)) {
    throw new Error(`Invalid verse reference '${ref}'`);
  }
  return {
    book,
    chapter,
    verse,
    ref_key: `${book}/${chapter}/${verse}`
  };
}

function normalizeRecords(
  records: InputRecord[],
  bookFilter: string[]
): { verses: VerseRecord[]; healings: HealingEvent[] } {
  const filtered = records
    .map((record) => ({
      record,
      ref: parseVerseRef(record.ref)
    }))
    .filter((item) => {
      if (bookFilter.length === 0) {
        return true;
      }
      return bookFilter.includes(item.ref.book);
    });

  const seen = new Set<string>();
  const verses: VerseRecord[] = [];
  const healings: HealingEvent[] = [];
  for (const item of filtered) {
    if (seen.has(item.ref.ref_key)) {
      throw new Error(`Duplicate verse reference '${item.ref.ref_key}'`);
    }
    seen.add(item.ref.ref_key);

    const sanitized = sanitizeVerseText(item.record.text, item.ref.ref_key);
    const normalizedText = sanitized.normalized;
    healings.push(...sanitized.healings);
    if (!normalizedText) {
      throw new Error(`Verse ${item.ref.ref_key} normalized to empty text`);
    }

    const tokenized = tokenizeWords(normalizedText);
    const words = tokenized.map((word) => word.text_raw);
    if (words.length === 0) {
      throw new Error(`Verse ${item.ref.ref_key} produced zero words after tokenization`);
    }

    verses.push({
      ...item.record,
      ...item.ref,
      normalized_text: normalizedText,
      words
    });
  }

  if (verses.length === 0) {
    const detail = bookFilter.length > 0 ? ` for books [${bookFilter.join(", ")}]` : "";
    throw new Error(`No verse records were found${detail}`);
  }

  return { verses, healings };
}

function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}

function selectPrimaryAccent(
  wordIndex: number,
  wordSurface: string,
  classification: TeamimClassification
): PrimaryAccent {
  const marks = dedupePreserveOrder(
    Array.from(wordSurface.normalize("NFD"))
      .map((ch) => ch.codePointAt(0))
      .filter((codepoint): codepoint is number => codepoint !== undefined)
      .filter((codepoint) => codepoint >= TEAMIM_MIN && codepoint <= TEAMIM_MAX)
      .map((codepoint) => toCodepoint(codepoint))
  );

  const observedEntries = marks.map((codepoint) => {
    const entry = classification.entries[codepoint];
    if (!entry) {
      throw new Error(
        `Observed teamim ${codepoint} missing from classification on word ${wordIndex} (${wordSurface})`
      );
    }
    return entry;
  });

  const disj = observedEntries.filter((entry) => entry.class === "DISJUNCTIVE");
  const conj = observedEntries.filter((entry) => entry.class === "CONJUNCTIVE");
  const candidates = disj.length > 0 ? disj : conj;
  if (candidates.length === 0) {
    return {
      word_index: wordIndex,
      class: "NONE",
      codepoint: null,
      name: null,
      precedence: 0,
      observed_teamim: marks
    };
  }

  const chosen = [...candidates].sort((left, right) => {
    if (left.precedence !== right.precedence) {
      return right.precedence - left.precedence;
    }
    return compareCodepointKeyAscending(left.codepoint, right.codepoint);
  })[0];

  return {
    word_index: wordIndex,
    class: chosen.class as "DISJUNCTIVE" | "CONJUNCTIVE",
    codepoint: chosen.codepoint,
    name: chosen.hebrew_name ?? chosen.unicode_name ?? chosen.codepoint,
    precedence: chosen.precedence,
    observed_teamim: marks
  };
}

function leafId(wordIndex: number): string {
  return `w_${wordIndex}`;
}

function nodeId(nodeType: "JOIN" | "SPLIT", start: number, end: number): string {
  return `n_${start}_${end}_${nodeType.toLowerCase()}`;
}

function buildLeaf(
  wordIndex: number,
  words: string[],
  primaryAccents: PrimaryAccent[]
): PhraseLeafNode {
  return {
    id: leafId(wordIndex),
    node_type: "LEAF",
    span: { start: wordIndex, end: wordIndex },
    word_index: wordIndex,
    surface: words[wordIndex - 1] ?? "",
    accent: primaryAccents[wordIndex - 1]
  };
}

type SplitCandidate = {
  wordIndex: number;
  codepoint: string;
  precedence: number;
  name: string | null;
};

function chooseStrongestSplit(
  start: number,
  end: number,
  primaryAccents: PrimaryAccent[]
): SplitCandidate | null {
  let best: SplitCandidate | null = null;
  for (let wordIndex = start; wordIndex < end; wordIndex += 1) {
    const accent = primaryAccents[wordIndex - 1];
    if (accent.class !== "DISJUNCTIVE" || !accent.codepoint) {
      continue;
    }
    const candidate: SplitCandidate = {
      wordIndex,
      codepoint: accent.codepoint,
      precedence: accent.precedence,
      name: accent.name
    };
    if (!best) {
      best = candidate;
      continue;
    }
    if (candidate.precedence > best.precedence) {
      best = candidate;
      continue;
    }
    if (candidate.precedence < best.precedence) {
      continue;
    }
    const candidateCodepoint = parseCodepointKey(candidate.codepoint);
    const bestCodepoint = parseCodepointKey(best.codepoint);
    if (candidateCodepoint < bestCodepoint) {
      best = candidate;
      continue;
    }
    if (candidateCodepoint > bestCodepoint) {
      continue;
    }
    if (candidate.wordIndex < best.wordIndex) {
      best = candidate;
    }
  }
  return best;
}

function buildJoinSpan(
  start: number,
  end: number,
  words: string[],
  primaryAccents: PrimaryAccent[]
): PhraseNode {
  let current: PhraseNode = buildLeaf(start, words, primaryAccents);
  for (let wordIndex = start + 1; wordIndex <= end; wordIndex += 1) {
    const right = buildLeaf(wordIndex, words, primaryAccents);
    current = {
      id: nodeId("JOIN", start, wordIndex),
      node_type: "JOIN",
      span: { start, end: wordIndex },
      fold: "LEFT",
      left: current,
      right
    };
  }
  return current;
}

function buildSpan(
  start: number,
  end: number,
  words: string[],
  primaryAccents: PrimaryAccent[]
): PhraseNode {
  if (start === end) {
    return buildLeaf(start, words, primaryAccents);
  }
  const split = chooseStrongestSplit(start, end, primaryAccents);
  if (!split) {
    return buildJoinSpan(start, end, words, primaryAccents);
  }
  const left = buildSpan(start, split.wordIndex, words, primaryAccents);
  const right = buildSpan(split.wordIndex + 1, end, words, primaryAccents);
  return {
    id: nodeId("SPLIT", start, end),
    node_type: "SPLIT",
    span: { start, end },
    split_word_index: split.wordIndex,
    split_accent: {
      codepoint: split.codepoint,
      name: split.name,
      precedence: split.precedence
    },
    left,
    right
  };
}

export function buildPhraseTree(words: string[], primaryAccents: PrimaryAccent[]): PhraseNode {
  if (words.length === 0) {
    throw new Error("Cannot build phrase tree for empty word list");
  }
  if (words.length !== primaryAccents.length) {
    throw new Error(
      `Primary accent length mismatch: words=${words.length} accents=${primaryAccents.length}`
    );
  }
  return buildSpan(1, words.length, words, primaryAccents);
}

export function validateTree(tree: PhraseNode, wordCount: number): TreeValidationResult {
  const errors: string[] = [];
  const seenNodeIds = new Set<string>();
  const seenLeaves = new Set<number>();

  const visit = (node: PhraseNode): NodeSpan => {
    if (seenNodeIds.has(node.id)) {
      errors.push(`Duplicate node id '${node.id}'`);
    }
    seenNodeIds.add(node.id);

    const span = node.span;
    if (!Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start > span.end) {
      errors.push(`Invalid span on node '${node.id}'`);
    }

    if (node.node_type === "LEAF") {
      if (node.word_index !== span.start || node.word_index !== span.end) {
        errors.push(`Leaf span mismatch on node '${node.id}'`);
      }
      if (node.word_index < 1 || node.word_index > wordCount) {
        errors.push(`Leaf word index out of range on node '${node.id}'`);
      }
      if (seenLeaves.has(node.word_index)) {
        errors.push(`Duplicate leaf word index ${node.word_index}`);
      }
      seenLeaves.add(node.word_index);
      return span;
    }

    const leftSpan = visit(node.left);
    const rightSpan = visit(node.right);
    if (leftSpan.end + 1 !== rightSpan.start) {
      errors.push(`Gap/overlap detected at node '${node.id}'`);
    }
    if (span.start !== leftSpan.start || span.end !== rightSpan.end) {
      errors.push(`Parent span mismatch on node '${node.id}'`);
    }

    if (node.node_type === "SPLIT") {
      if (
        node.split_word_index < leftSpan.start ||
        node.split_word_index > leftSpan.end ||
        node.split_word_index >= rightSpan.start
      ) {
        errors.push(`Invalid split_word_index on node '${node.id}'`);
      }
    }
    return span;
  };

  visit(tree);
  for (let wordIndex = 1; wordIndex <= wordCount; wordIndex += 1) {
    if (!seenLeaves.has(wordIndex)) {
      errors.push(`Missing leaf for word index ${wordIndex}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function computeTreeDepth(node: PhraseNode): number {
  if (node.node_type === "LEAF") {
    return 1;
  }
  return 1 + Math.max(computeTreeDepth(node.left), computeTreeDepth(node.right));
}

function collectSplitNodes(node: PhraseNode, out: PhraseSplitNode[]): void {
  if (node.node_type === "SPLIT") {
    out.push(node);
    collectSplitNodes(node.left, out);
    collectSplitNodes(node.right, out);
    return;
  }
  if (node.node_type === "JOIN") {
    collectSplitNodes(node.left, out);
    collectSplitNodes(node.right, out);
  }
}

function annotateWords(
  refKey: string,
  words: string[],
  primaryAccents: PrimaryAccent[],
  tree: PhraseNode
): WordPhraseRoleRow[] {
  const parentByNodeId = new Map<string, string | null>();
  const leafByWordIndex = new Map<number, PhraseLeafNode>();
  const splitWords = new Set<number>();
  const splitPathByWordIndex = new Map<number, number[]>();

  const walk = (node: PhraseNode, parentId: string | null, splitPath: number[]): void => {
    parentByNodeId.set(node.id, parentId);
    if (node.node_type === "LEAF") {
      leafByWordIndex.set(node.word_index, node);
      splitPathByWordIndex.set(node.word_index, [...splitPath]);
      return;
    }

    if (node.node_type === "SPLIT") {
      splitWords.add(node.split_word_index);
      walk(node.left, node.id, [...splitPath, 1]);
      walk(node.right, node.id, [...splitPath, 2]);
      return;
    }

    walk(node.left, node.id, splitPath);
    walk(node.right, node.id, splitPath);
  };
  walk(tree, null, []);

  const out: WordPhraseRoleRow[] = [];
  for (let wordIndex = 1; wordIndex <= words.length; wordIndex += 1) {
    const leaf = leafByWordIndex.get(wordIndex);
    if (!leaf) {
      throw new Error(`Missing leaf annotation for ${refKey} word ${wordIndex}`);
    }
    const phrasePath: string[] = [];
    let currentId: string | null = leaf.id;
    while (currentId) {
      phrasePath.push(currentId);
      currentId = parentByNodeId.get(currentId) ?? null;
    }

    const splitPath = splitPathByWordIndex.get(wordIndex) ?? [];
    const phraseRole: PhraseRole = splitWords.has(wordIndex)
      ? "SPLIT"
      : wordIndex === 1
        ? "HEAD"
        : wordIndex === words.length
          ? "TAIL"
          : "JOIN";
    const clauseNumber = splitPath[0] ?? 1;
    const subclausePath = splitPath.length > 0 ? splitPath.join(".") : "1";

    out.push({
      ref_key: refKey,
      word_index: wordIndex,
      surface: words[wordIndex - 1] ?? "",
      primary_accent: primaryAccents[wordIndex - 1],
      phrase_role: phraseRole,
      phrase_path: phrasePath,
      clause_id: `C${clauseNumber}`,
      subclause_id: `C${subclausePath}`,
      phrase_version: PHRASE_VERSION
    });
  }

  return out;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const clamped = Math.min(1, Math.max(0, p));
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * clamped) - 1));
  return sorted[index] ?? 0;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarizeFilter(filter: string[]): string {
  if (filter.length === 0) {
    return "all";
  }
  return filter.join(", ");
}

function parseBookFilter(filter: string): string[] {
  return Array.from(
    new Set(
      String(filter ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function buildReport(
  inputPath: string,
  classificationPath: string,
  bookFilter: string[],
  treeJsonl: string,
  wordJsonl: string,
  stats: BuildStats,
  depthRows: Array<{ ref_key: string; depth: number; words: number; split_nodes: number }>,
  splitPatternCounts: Map<string, number>
): string {
  const depths = depthRows.map((row) => row.depth);
  const sortedDepthRows = [...depthRows]
    .sort((left, right) => right.depth - left.depth || compareRefLike(left.ref_key, right.ref_key))
    .slice(0, 12);

  const topSplitPatterns = Array.from(splitPatternCounts.entries())
    .sort((left, right) => right[1] - left[1] || compareRefLike(left[0], right[0]))
    .slice(0, 20);

  const lines = [
    "# Phrase Tree Report",
    "",
    `- input: ${path.resolve(inputPath)}`,
    `- classification: ${path.resolve(classificationPath)}`,
    `- book filter: ${summarizeFilter(bookFilter)}`,
    `- phrase_version: ${PHRASE_VERSION}`,
    `- tree checksum (sha256): ${sha256Hex(treeJsonl)}`,
    `- word-role checksum (sha256): ${sha256Hex(wordJsonl)}`,
    "",
    "## Totals",
    "",
    `- verses processed: ${stats.verses}`,
    `- words processed: ${stats.words}`,
    `- split nodes: ${stats.splitNodes}`,
    `- verses without split nodes: ${stats.noSplitVerses}`,
    `- single-word verses: ${stats.singleWordVerses}`,
    `- words without primary accent: ${stats.wordsWithoutAccent}`,
    `- healings applied: ${stats.healingCount}`,
    "",
    "## Healing Types",
    "",
    `- PARASHA_MARKER_REMOVED: ${stats.healingByKind.PARASHA_MARKER_REMOVED}`,
    `- EDITORIAL_NOTE_REMOVED: ${stats.healingByKind.EDITORIAL_NOTE_REMOVED}`,
    `- SPLIT_FRAGMENT_JOINED: ${stats.healingByKind.SPLIT_FRAGMENT_JOINED}`,
    "",
    "## Depth Stats",
    "",
    `- min depth: ${depths.length > 0 ? Math.min(...depths) : 0}`,
    `- avg depth: ${average(depths).toFixed(2)}`,
    `- median depth: ${percentile(depths, 0.5)}`,
    `- p90 depth: ${percentile(depths, 0.9)}`,
    `- max depth: ${stats.maxDepth}`,
    "",
    "## Top Split Patterns",
    "",
    ...(topSplitPatterns.length === 0
      ? ["- (none)"]
      : topSplitPatterns.map(([pattern, count]) => `- ${pattern}: ${count}`)),
    "",
    "## Deepest Verses",
    "",
    ...(sortedDepthRows.length === 0
      ? ["- (none)"]
      : sortedDepthRows.map(
          (row) =>
            `- ${row.ref_key}: depth=${row.depth}, words=${row.words}, split_nodes=${row.split_nodes}`
        )),
    "",
    "## Determinism Rules",
    "",
    "- split selection: strongest DISJUNCTIVE in span by precedence desc, codepoint asc, word index asc.",
    "- split position rule: terminal word in a span is not eligible as a split position.",
    "- no-split rule: left-associative sequential fold (`JOIN`, `fold=LEFT`).",
    "- node ids: leaf `w_{word_index}`, internal `n_{start}_{end}_{type}`.",
    ""
  ];

  return lines.join("\n");
}

export function buildArtifacts(
  sourceText: string,
  classificationText: string,
  inputPath: string,
  classificationPath: string,
  bookFilterValue = ""
): BuildArtifactsResult {
  const records = parseInputRecords(sourceText);
  const classification = parseClassification(classificationText);
  const bookFilter = parseBookFilter(bookFilterValue);
  const { verses, healings } = normalizeRecords(records, bookFilter);

  const verseRows: VersePhraseTreeRow[] = [];
  const wordRows: WordPhraseRoleRow[] = [];
  const depthRows: Array<{ ref_key: string; depth: number; words: number; split_nodes: number }> =
    [];
  const splitPatternCounts = new Map<string, number>();

  let splitNodes = 0;
  let noSplitVerses = 0;
  let singleWordVerses = 0;
  let wordsWithoutAccent = 0;
  let maxDepth = 0;
  let words = 0;

  for (const verse of verses) {
    words += verse.words.length;
    if (verse.words.length === 1) {
      singleWordVerses += 1;
    }

    const primaryAccents = verse.words.map((word, index) =>
      selectPrimaryAccent(index + 1, word, classification)
    );
    wordsWithoutAccent += primaryAccents.filter((accent) => accent.class === "NONE").length;

    const tree = buildPhraseTree(verse.words, primaryAccents);
    const validation = validateTree(tree, verse.words.length);
    if (!validation.ok) {
      throw new Error(
        `Tree validation failed for ${verse.ref_key}: ${validation.errors.slice(0, 5).join("; ")}`
      );
    }

    const splitNodesForVerse: PhraseSplitNode[] = [];
    collectSplitNodes(tree, splitNodesForVerse);
    if (splitNodesForVerse.length === 0) {
      noSplitVerses += 1;
    }
    splitNodes += splitNodesForVerse.length;
    for (const splitNode of splitNodesForVerse) {
      const splitKey = [
        splitNode.split_accent.codepoint,
        splitNode.split_accent.name ?? "unknown",
        `p${splitNode.split_accent.precedence}`
      ].join(" | ");
      splitPatternCounts.set(splitKey, (splitPatternCounts.get(splitKey) ?? 0) + 1);
    }

    const depth = computeTreeDepth(tree);
    maxDepth = Math.max(maxDepth, depth);
    depthRows.push({
      ref_key: verse.ref_key,
      depth,
      words: verse.words.length,
      split_nodes: splitNodesForVerse.length
    });

    verseRows.push({
      ref_key: verse.ref_key,
      ref: {
        book: verse.book,
        chapter: verse.chapter,
        verse: verse.verse
      },
      words: verse.words,
      primary_accents: primaryAccents,
      tree,
      phrase_version: PHRASE_VERSION
    });

    wordRows.push(...annotateWords(verse.ref_key, verse.words, primaryAccents, tree));
  }

  const treeJsonl = `${verseRows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const wordJsonl = `${wordRows.map((row) => JSON.stringify(row)).join("\n")}\n`;

  const stats: BuildStats = {
    verses: verseRows.length,
    words,
    splitNodes,
    noSplitVerses,
    singleWordVerses,
    wordsWithoutAccent,
    maxDepth,
    healingCount: healings.length,
    healingByKind: {
      PARASHA_MARKER_REMOVED: healings.filter(
        (healing) => healing.kind === "PARASHA_MARKER_REMOVED"
      ).length,
      EDITORIAL_NOTE_REMOVED: healings.filter(
        (healing) => healing.kind === "EDITORIAL_NOTE_REMOVED"
      ).length,
      SPLIT_FRAGMENT_JOINED: healings.filter((healing) => healing.kind === "SPLIT_FRAGMENT_JOINED")
        .length
    },
    bookFilter
  };

  const reportText = buildReport(
    inputPath,
    classificationPath,
    bookFilter,
    treeJsonl,
    wordJsonl,
    stats,
    depthRows,
    splitPatternCounts
  );

  return {
    treeJsonl,
    wordJsonl,
    reportText,
    stats,
    healings
  };
}

export function assertDeterminism(first: BuildArtifactsResult, second: BuildArtifactsResult): void {
  if (first.treeJsonl !== second.treeJsonl) {
    throw new Error(
      "Determinism check failed: verse phrase tree JSONL differs across repeated runs"
    );
  }
  if (first.wordJsonl !== second.wordJsonl) {
    throw new Error(
      "Determinism check failed: word phrase roles JSONL differs across repeated runs"
    );
  }
  if (first.reportText !== second.reportText) {
    throw new Error("Determinism check failed: phrase tree report differs across repeated runs");
  }
  const firstHealings = JSON.stringify(first.healings);
  const secondHealings = JSON.stringify(second.healings);
  if (firstHealings !== secondHealings) {
    throw new Error("Determinism check failed: healing stream differs across repeated runs");
  }
}

export function printHelp(): void {
  console.log("Usage:");
  console.log(
    "  node scripts/phrase-tree.mjs [run] [--input=path] [--classification=path] [--tree-out=path] [--word-out=path] [--report-out=path] [--book=Book]"
  );
  console.log(
    "  node scripts/phrase-tree.mjs verify [--input=path] [--classification=path] [--tree-out=path] [--word-out=path] [--report-out=path] [--book=Book]"
  );
  console.log("");
  console.log("Defaults:");
  console.log(`  --input=${DEFAULT_INPUT}`);
  console.log(`  --classification=${DEFAULT_CLASSIFICATION}`);
  console.log(`  --tree-out=${DEFAULT_TREE_OUT}`);
  console.log(`  --word-out=${DEFAULT_WORD_OUT}`);
  console.log(`  --report-out=${DEFAULT_REPORT_OUT}`);
  console.log("  --book=(all books)");
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

  const opts: PhraseTreeOptions = {
    input: DEFAULT_INPUT,
    classification: DEFAULT_CLASSIFICATION,
    treeOut: DEFAULT_TREE_OUT,
    wordOut: DEFAULT_WORD_OUT,
    reportOut: DEFAULT_REPORT_OUT,
    bookFilter: ""
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
    if (arg.startsWith("--tree-out=")) {
      opts.treeOut = arg.slice("--tree-out=".length);
      continue;
    }
    if (arg.startsWith("--word-out=")) {
      opts.wordOut = arg.slice("--word-out=".length);
      continue;
    }
    if (arg.startsWith("--report-out=")) {
      opts.reportOut = arg.slice("--report-out=".length);
      continue;
    }
    if (arg.startsWith("--book=")) {
      opts.bookFilter = arg.slice("--book=".length);
      continue;
    }
    throw new Error(`Unknown argument '${arg}'`);
  }

  return { command, opts };
}

function printHealingEvents(healings: HealingEvent[]): void {
  if (healings.length === 0) {
    console.log("healing: none");
    return;
  }
  for (const healing of healings) {
    console.log(
      `healing: ref=${healing.ref_key} kind=${healing.kind} detail=${compactDetail(healing.detail, 200)}`
    );
  }
}

export async function runCommand(opts: PhraseTreeOptions): Promise<void> {
  const inputPath = path.resolve(opts.input);
  const classificationPath = path.resolve(opts.classification);
  const treeOutPath = path.resolve(opts.treeOut);
  const wordOutPath = path.resolve(opts.wordOut);
  const reportOutPath = path.resolve(opts.reportOut);

  const [sourceText, classificationText] = await Promise.all([
    fs.readFile(inputPath, "utf8"),
    fs.readFile(classificationPath, "utf8")
  ]);

  const generated = buildArtifacts(
    sourceText,
    classificationText,
    inputPath,
    classificationPath,
    opts.bookFilter
  );
  const generatedAgain = buildArtifacts(
    sourceText,
    classificationText,
    inputPath,
    classificationPath,
    opts.bookFilter
  );
  assertDeterminism(generated, generatedAgain);

  await Promise.all([
    fs.mkdir(path.dirname(treeOutPath), { recursive: true }),
    fs.mkdir(path.dirname(wordOutPath), { recursive: true }),
    fs.mkdir(path.dirname(reportOutPath), { recursive: true })
  ]);

  await Promise.all([
    fs.writeFile(treeOutPath, generated.treeJsonl, "utf8"),
    fs.writeFile(wordOutPath, generated.wordJsonl, "utf8"),
    fs.writeFile(reportOutPath, generated.reportText, "utf8")
  ]);
  printHealingEvents(generated.healings);

  console.log(
    [
      `done: verses=${generated.stats.verses}`,
      `words=${generated.stats.words}`,
      `splitNodes=${generated.stats.splitNodes}`,
      `maxDepth=${generated.stats.maxDepth}`,
      `healings=${generated.stats.healingCount}`,
      `treeOut=${treeOutPath}`,
      `wordOut=${wordOutPath}`,
      `reportOut=${reportOutPath}`
    ].join(" ")
  );
}

export async function verifyCommand(opts: PhraseTreeOptions): Promise<void> {
  const inputPath = path.resolve(opts.input);
  const classificationPath = path.resolve(opts.classification);
  const treeOutPath = path.resolve(opts.treeOut);
  const wordOutPath = path.resolve(opts.wordOut);
  const reportOutPath = path.resolve(opts.reportOut);

  const [sourceText, classificationText, existingTree, existingWord, existingReport] =
    await Promise.all([
      fs.readFile(inputPath, "utf8"),
      fs.readFile(classificationPath, "utf8"),
      fs.readFile(treeOutPath, "utf8"),
      fs.readFile(wordOutPath, "utf8"),
      fs.readFile(reportOutPath, "utf8")
    ]);

  const expected = buildArtifacts(
    sourceText,
    classificationText,
    inputPath,
    classificationPath,
    opts.bookFilter
  );
  const expectedAgain = buildArtifacts(
    sourceText,
    classificationText,
    inputPath,
    classificationPath,
    opts.bookFilter
  );
  assertDeterminism(expected, expectedAgain);

  const failures: string[] = [];
  if (existingTree !== expected.treeJsonl) {
    failures.push("verse phrase trees differ from deterministic generation");
  }
  if (existingWord !== expected.wordJsonl) {
    failures.push("word phrase roles differ from deterministic generation");
  }
  if (existingReport !== expected.reportText) {
    failures.push("phrase tree report differs from deterministic generation");
  }
  if (failures.length > 0) {
    throw new Error(`verify failed: ${failures.join("; ")}`);
  }
  printHealingEvents(expected.healings);

  console.log(
    [
      "verify: ok",
      `verses=${expected.stats.verses}`,
      `words=${expected.stats.words}`,
      `splitNodes=${expected.stats.splitNodes}`,
      `healings=${expected.stats.healingCount}`,
      `treeSha256=${sha256Hex(expected.treeJsonl)}`
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
