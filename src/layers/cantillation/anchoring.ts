import {
  resolveCantillationAnchor,
  type CantillationGapAnchor,
  type CantillationGidAnchor
} from "./schema";

export const CANTILLATION_ANCHORING_VERSION = 1;

export type CantillationAnchoringRules = {
  version: number;
  trope_mark_anchor: "gid";
  punctuation_boundary_anchor: "gap";
  derived_boundaries_from_trope_marks: "wrapper";
};

export const CANTILLATION_ANCHORING_RULES: Readonly<CantillationAnchoringRules> = Object.freeze({
  version: CANTILLATION_ANCHORING_VERSION,
  trope_mark_anchor: "gid",
  punctuation_boundary_anchor: "gap",
  derived_boundaries_from_trope_marks: "wrapper"
});

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`cantillation anchoring: ${label} must be non-empty string`);
  }
}

function assertAnchorRefKey(args: {
  anchor: CantillationGidAnchor | CantillationGapAnchor;
  ref_key: string;
}): void {
  const resolved = resolveCantillationAnchor(args.anchor);
  if (!resolved) {
    throw new Error(`cantillation anchoring: invalid anchor id '${args.anchor.id}'`);
  }
  if (resolved.ref_key !== args.ref_key) {
    throw new Error(
      `cantillation anchoring: anchor '${args.anchor.id}' must match ref_key='${args.ref_key}'`
    );
  }
}

export function anchorTropeMarkToGid(args: {
  gid: string;
  ref_key: string;
}): CantillationGidAnchor {
  assertNonEmptyString(args.gid, "gid");
  assertNonEmptyString(args.ref_key, "ref_key");
  const anchor: CantillationGidAnchor = {
    kind: CANTILLATION_ANCHORING_RULES.trope_mark_anchor,
    id: args.gid
  };
  assertAnchorRefKey({ anchor, ref_key: args.ref_key });
  return anchor;
}

export function anchorPunctuationBoundaryToGap(args: {
  gapid: string;
  ref_key: string;
}): CantillationGapAnchor {
  assertNonEmptyString(args.gapid, "gapid");
  assertNonEmptyString(args.ref_key, "ref_key");
  const anchor: CantillationGapAnchor = {
    kind: CANTILLATION_ANCHORING_RULES.punctuation_boundary_anchor,
    id: args.gapid
  };
  assertAnchorRefKey({ anchor, ref_key: args.ref_key });
  return anchor;
}

export function emitsDerivedBoundariesFromTropeMarks(): boolean {
  return CANTILLATION_ANCHORING_RULES.derived_boundaries_from_trope_marks !== "wrapper";
}
