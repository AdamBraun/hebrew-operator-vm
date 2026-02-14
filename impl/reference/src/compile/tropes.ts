import fs from "node:fs";
import path from "node:path";
import { Trope } from "./types";

type TropeRegistryEntry = {
  kind: "conj" | "disj";
  rank?: number;
  name?: string;
};

const TEAMIM_MIN = 0x0591;
const TEAMIM_MAX = 0x05af;
const REGISTRY_PATH = path.resolve(__dirname, "../../../../registry/tropes.json");

let registryCache: Record<string, TropeRegistryEntry> | null = null;

function loadRegistry(): Record<string, TropeRegistryEntry> {
  if (registryCache) {
    return registryCache;
  }
  const raw = fs.readFileSync(REGISTRY_PATH, "utf8");
  const parsed = JSON.parse(raw) as Record<string, TropeRegistryEntry>;
  registryCache = parsed;
  return parsed;
}

function toCodepointKey(mark: string): string | null {
  const codepoint = mark.codePointAt(0);
  if (codepoint === undefined) {
    return null;
  }
  return `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function isCantillationMark(mark: string): boolean {
  const codepoint = mark.codePointAt(0);
  if (codepoint === undefined) {
    return false;
  }
  return codepoint >= TEAMIM_MIN && codepoint <= TEAMIM_MAX;
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
  return {
    kind: entry.kind,
    name: entry.name,
    rank: entry.kind === "disj" ? Math.max(1, Number(entry.rank ?? 1)) : undefined
  };
}

export function resolveWordTrope(candidates: Trope[]): Trope {
  const disj = candidates.filter((candidate) => candidate.kind === "disj");
  if (disj.length > 0) {
    let best = disj[0];
    for (const candidate of disj) {
      const candidateRank = Number(candidate.rank ?? 1);
      const bestRank = Number(best.rank ?? 1);
      if (candidateRank > bestRank) {
        best = candidate;
      }
    }
    return {
      kind: "disj",
      name: best.name,
      rank: Number(best.rank ?? 1)
    };
  }

  const conj = candidates.find((candidate) => candidate.kind === "conj");
  if (conj) {
    return {
      kind: "conj",
      name: conj.name
    };
  }

  return { kind: "none" };
}
