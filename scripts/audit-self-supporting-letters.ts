import { letterRegistry } from "../src/reference/letters/registry";
import type { LetterOp } from "../src/reference/letters/types";
import { createInitialState } from "../src/reference/state/state";

export type SelfSupportingPair = {
  source: string;
  target: string;
  cont: string;
  carry: string;
  supp: string;
};

export type SelfSupportingLetterRecord = {
  letter: string;
  pairs: SelfSupportingPair[];
};

export type SelfSupportingLetterAudit = {
  scenario: "fresh_state";
  letters: SelfSupportingLetterRecord[];
};

type EdgeDelta = {
  cont: string[];
  carry: string[];
  supp: string[];
};

function diffSet(after: Set<string>, before: Set<string>): string[] {
  return Array.from(after)
    .filter((edge) => !before.has(edge))
    .sort((left, right) => left.localeCompare(right));
}

function parseEdge(edge: string): { source: string; target: string } {
  const pivot = edge.indexOf("->");
  if (pivot <= 0 || pivot + 2 >= edge.length) {
    throw new Error(`Malformed edge '${edge}'`);
  }
  return {
    source: edge.slice(0, pivot),
    target: edge.slice(pivot + 2)
  };
}

function reverseEdge(edge: string): string {
  const { source, target } = parseEdge(edge);
  return `${target}->${source}`;
}

function listUniqueLetterOps(): Array<[letter: string, op: LetterOp]> {
  const unique = new Map<string, LetterOp>();
  for (const op of Object.values(letterRegistry)) {
    if (!unique.has(op.meta.letter)) {
      unique.set(op.meta.letter, op);
    }
  }
  return Array.from(unique.entries()).sort(([left], [right]) => left.localeCompare(right));
}

function executeLetter(op: LetterOp): EdgeDelta {
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

function collectPairs(edges: EdgeDelta): SelfSupportingPair[] {
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
        supp: suppEdge
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

export function collectSelfSupportingLetterAudit(): SelfSupportingLetterAudit {
  const letters = listUniqueLetterOps()
    .map(([letter, op]) => {
      try {
        return {
          letter,
          pairs: collectPairs(executeLetter(op))
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`self-support audit failed for '${letter}': ${message}`);
      }
    })
    .filter((record) => record.pairs.length > 0);

  return {
    scenario: "fresh_state",
    letters
  };
}

export function renderSelfSupportingLetterAudit(): string {
  return `${JSON.stringify(collectSelfSupportingLetterAudit(), null, 2)}\n`;
}

if (require.main === module) {
  process.stdout.write(renderSelfSupportingLetterAudit());
}
