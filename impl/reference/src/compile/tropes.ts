import fs from "node:fs";
import path from "node:path";
import { Trope } from "./types";

type TeamimClass = "DISJUNCTIVE" | "CONJUNCTIVE" | "OTHER";

type TeamimClassificationEntry = {
  codepoint: string;
  unicode_name?: string;
  hebrew_name?: string;
  class: TeamimClass;
  precedence: number;
};

type TeamimClassificationFile = {
  entries: Record<string, TeamimClassificationEntry>;
};

const CODEPOINT_KEY_PATTERN = /^U\+([0-9A-F]{4,6})$/u;
const REGISTRY_PATH = path.resolve(__dirname, "../../../../registry/teamim.classification.json");

let registryCache: Record<string, TeamimClassificationEntry> | null = null;

function parseCodepointKey(codepointKey: string): number {
  const normalized = String(codepointKey ?? "").toUpperCase();
  const match = normalized.match(CODEPOINT_KEY_PATTERN);
  if (!match) {
    throw new Error(`Invalid teamim codepoint key '${codepointKey}'`);
  }
  return Number.parseInt(match[1] ?? "", 16);
}

function normalizeClassificationEntry(
  key: string,
  rawEntry: unknown
): TeamimClassificationEntry | null {
  if (!rawEntry || typeof rawEntry !== "object") {
    return null;
  }

  const entry = rawEntry as Partial<TeamimClassificationEntry>;
  if (entry.codepoint !== key) {
    return null;
  }
  if (entry.class !== "DISJUNCTIVE" && entry.class !== "CONJUNCTIVE" && entry.class !== "OTHER") {
    return null;
  }
  if (!Number.isInteger(entry.precedence)) {
    return null;
  }

  return {
    codepoint: entry.codepoint,
    unicode_name: entry.unicode_name,
    hebrew_name: entry.hebrew_name,
    class: entry.class,
    precedence: Number(entry.precedence)
  };
}

function loadRegistry(): Record<string, TeamimClassificationEntry> {
  if (registryCache) {
    return registryCache;
  }

  const raw = fs.readFileSync(REGISTRY_PATH, "utf8");
  const parsed = JSON.parse(raw) as TeamimClassificationFile;
  if (!parsed || typeof parsed !== "object" || !parsed.entries || typeof parsed.entries !== "object") {
    throw new Error(`Invalid teamim classification file at ${REGISTRY_PATH}`);
  }

  const normalized: Record<string, TeamimClassificationEntry> = {};
  for (const [rawKey, rawEntry] of Object.entries(parsed.entries)) {
    const key = String(rawKey).toUpperCase();
    parseCodepointKey(key);
    const entry = normalizeClassificationEntry(key, rawEntry);
    if (!entry) {
      throw new Error(`Invalid teamim classification entry ${rawKey} in ${REGISTRY_PATH}`);
    }
    normalized[key] = entry;
  }

  registryCache = normalized;
  return normalized;
}

function toCodepointKey(mark: string): string | null {
  const codepoint = mark.codePointAt(0);
  if (codepoint === undefined) {
    return null;
  }
  return `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

function resolveTropeName(entry: TeamimClassificationEntry): string {
  return entry.hebrew_name ?? entry.unicode_name ?? entry.codepoint;
}

function codepointOrder(candidate: Trope): number {
  if (!candidate.codepoint) {
    return Number.POSITIVE_INFINITY;
  }
  return parseCodepointKey(candidate.codepoint);
}

function chooseHighestPrecedence(candidates: Trope[]): Trope | null {
  if (candidates.length === 0) {
    return null;
  }

  let best = candidates[0];
  for (const candidate of candidates) {
    const candidateRank = Number(candidate.rank ?? 0);
    const bestRank = Number(best.rank ?? 0);
    if (candidateRank > bestRank) {
      best = candidate;
      continue;
    }
    if (candidateRank < bestRank) {
      continue;
    }
    if (codepointOrder(candidate) < codepointOrder(best)) {
      best = candidate;
    }
  }

  return best;
}

export function isCantillationMark(mark: string): boolean {
  const key = toCodepointKey(mark);
  if (!key) {
    return false;
  }
  return Boolean(loadRegistry()[key]);
}

export function lookupTrope(mark: string): Trope | null {
  const key = toCodepointKey(mark);
  if (!key) {
    return null;
  }

  const entry = loadRegistry()[key];
  if (!entry) {
    return null;
  }

  if (entry.class === "DISJUNCTIVE") {
    return {
      kind: "disj",
      name: resolveTropeName(entry),
      rank: Math.max(1, Number(entry.precedence)),
      codepoint: key
    };
  }

  if (entry.class === "CONJUNCTIVE") {
    return {
      kind: "conj",
      name: resolveTropeName(entry),
      rank: Math.max(1, Number(entry.precedence)),
      codepoint: key
    };
  }

  return null;
}

export function resolveWordTrope(candidates: Trope[]): Trope {
  const disj = candidates.filter((candidate) => candidate.kind === "disj");
  const bestDisj = chooseHighestPrecedence(disj);
  if (bestDisj) {
    return {
      kind: "disj",
      name: bestDisj.name,
      rank: Number(bestDisj.rank ?? 1),
      codepoint: bestDisj.codepoint
    };
  }

  const conj = candidates.filter((candidate) => candidate.kind === "conj");
  const bestConj = chooseHighestPrecedence(conj);
  if (bestConj) {
    return {
      kind: "conj",
      name: bestConj.name,
      rank: Number(bestConj.rank ?? 1),
      codepoint: bestConj.codepoint
    };
  }

  return { kind: "none" };
}
