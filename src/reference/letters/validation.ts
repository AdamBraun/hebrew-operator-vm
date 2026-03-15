import { letterRegistry, type LetterRegistry } from "./registry";
import type { LetterOp } from "./types";
import { createInitialState } from "../state/state";

export type EdgeDelta = {
  cont: string[];
  carry: string[];
  supp: string[];
};

export type SelfSupportingPair = {
  source: string;
  target: string;
  cont: string;
  carry: string;
  supp: string;
  allowlistKey: string;
};

export type SelfSupportingLetterRecord = {
  letter: string;
  pairs: SelfSupportingPair[];
};

export function diffSet(after: Set<string>, before: Set<string>): string[] {
  return Array.from(after)
    .filter((edge) => !before.has(edge))
    .sort((left, right) => left.localeCompare(right));
}

export function parseEdge(edge: string): { source: string; target: string } {
  const pivot = edge.indexOf("->");
  if (pivot <= 0 || pivot + 2 >= edge.length) {
    throw new Error(`Malformed edge '${edge}'`);
  }
  return {
    source: edge.slice(0, pivot),
    target: edge.slice(pivot + 2)
  };
}

export function reverseEdge(edge: string): string {
  const { source, target } = parseEdge(edge);
  return `${target}->${source}`;
}

export function listUniqueLetterOps(
  registry: LetterRegistry = letterRegistry
): Array<[letter: string, op: LetterOp]> {
  const unique = new Map<string, LetterOp>();
  for (const op of Object.values(registry)) {
    if (!unique.has(op.meta.letter)) {
      unique.set(op.meta.letter, op);
    }
  }
  return Array.from(unique.entries()).sort(([left], [right]) => left.localeCompare(right));
}

export function executeLetterOnFreshState(op: LetterOp): EdgeDelta {
  const baseline = createInitialState();
  const state = createInitialState();
  const selected = op.select(state);
  const bound = op.bound(selected.S, selected.ops);
  op.seal(bound.S, bound.cons);

  return {
    cont: diffSet(state.cont, baseline.cont),
    carry: diffSet(state.carry, baseline.carry),
    supp: diffSet(state.supp, baseline.supp)
  };
}

export function collectLocalSelfSupportPairs(
  letter: string,
  edges: EdgeDelta
): SelfSupportingPair[] {
  const cont = new Set(edges.cont);
  const carry = new Set(edges.carry);

  return edges.supp
    .map((suppEdge) => {
      const carryEdge = reverseEdge(suppEdge);
      if (!carry.has(carryEdge) || !cont.has(carryEdge)) {
        return null;
      }
      const { source, target } = parseEdge(carryEdge);
      return {
        source,
        target,
        cont: carryEdge,
        carry: carryEdge,
        supp: suppEdge,
        allowlistKey: `${letter}:${carryEdge}`
      };
    })
    .filter((pair): pair is SelfSupportingPair => pair !== null)
    .sort((left, right) => {
      const carryOrder = left.carry.localeCompare(right.carry);
      if (carryOrder !== 0) {
        return carryOrder;
      }
      return left.supp.localeCompare(right.supp);
    });
}

export function collectLocalSelfSupportByLetter(
  registry: LetterRegistry = letterRegistry
): SelfSupportingLetterRecord[] {
  return listUniqueLetterOps(registry)
    .map(([letter, op]) => {
      try {
        return {
          letter,
          pairs: collectLocalSelfSupportPairs(letter, executeLetterOnFreshState(op))
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`self-support validation failed for '${letter}': ${message}`);
      }
    })
    .filter((record) => record.pairs.length > 0);
}

export function formatLocalSelfSupportViolations(violations: SelfSupportingLetterRecord[]): string {
  if (violations.length === 0) {
    return "No local self-support carry pairs found.";
  }

  const lines = ["Forbidden local self-support carry pairs detected:"];
  for (const violation of violations) {
    for (const pair of violation.pairs) {
      lines.push(
        `- ${violation.letter}: cont=${pair.cont} carry=${pair.carry} supp=${pair.supp} allowlist=${pair.allowlistKey}`
      );
    }
  }
  return lines.join("\n");
}
