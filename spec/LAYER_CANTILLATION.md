# Cantillation Layer Contract

## Purpose / Role

Cantillation is an **orthogonal analyzer** over Spine that extracts ta'amim and emits
cantillation boundary signal as IR.

It is a signal-selection layer only. It does not execute semantics, mutate runtime state,
or resolve layout segmentation.

## Inputs

Cantillation consumes exactly:

- `Spine.jsonl` from normalization.

Cantillation MUST read only Spine rows:

- grapheme rows (`kind: "g"`) for `marks_raw.teamim`,
- gap rows (`kind: "gap"`) for explicit punctuator evidence when present in encoding
  (for example maqaf / sof-pasuk markers, whether represented via `raw.chars` and/or
  explicit booleans in normalization output).

Cantillation MUST NOT consume or depend on:

- `LettersIR`
- `NiqqudIR`
- `LayoutIR`
- wrapper/VM state

## Outputs

Cantillation emits `CantillationIR` JSONL at:

- `outputs/cache/cantillation/<digest>/cantillation.ir.jsonl`

Canonical record type is `cant_event`, anchored by either:

- `anchor.kind: "gid"` (grapheme-attached event), or
- `anchor.kind: "gap"` (gap-attached event).

## Responsibilities

The cantillation layer MUST:

1. Read only Spine and extract ta'amim marks per grapheme from `marks_raw.teamim`.
2. Read explicit gap punctuator evidence from Spine when present (for example maqaf / sof-pasuk).
3. Emit `CantillationIR` events keyed by stable Spine anchors (`gid` and/or `gapid` via `anchor.id`).
4. Classify each relevant cantillation mark into:
   - `class: "CONJ" | "DISJ"`
   - `rank: integer` for `DISJ` marks where rank is applicable.
5. Emit explicit punctuation boundary operations from Spine gap evidence:
   - `MAQAF_GLUE` for maqaf joins when that evidence exists in Spine encoding.
   - `CUT(rank)` for explicit sof-pasuk policy when that evidence exists in Spine encoding.

## Anchoring Rules

Anchoring is deterministic and frozen by policy version.

Rule A (default):

- All ta'amim marks from `marks_raw.teamim` are anchored to the grapheme (`gid`) where they appear.
- The emitted event remains a mark event (`TROPE_MARK` for known mapping, `UNKNOWN_MARK` when surfaced).

Rule B (gap punctuation):

- Punctuation-derived events are anchored to `gapid`.
- `maqaf` evidence emits `MAQAF_GLUE` on `gapid`.
- `sof-pasuk` evidence emits `BOUNDARY CUT(rank=<policy>)` on `gapid`.

Derived boundary placement:

- The cantillation layer does not convert grapheme-attached disjunctive marks into concrete boundary placement.
- Disjunctive information is preserved as `TROPE_MARK(class="DISJ", rank?)` on `gid`.
- Wrapper-level stitching decides whether and where to place boundaries (for example, at following gaps) from those mark events.
- If concrete boundary emission from disjunctive marks is introduced in the future, it must use a deterministic placement policy based only on Spine and must be specified/tested as a versioned contract change.

## Non-Goals / Forbidden Behavior

Cantillation MUST NOT do any of the following:

- mutate `τ` (tau),
- update barriers,
- reify or mutate obligations,
- perform verse semantics beyond emitting explicit `SOF_PASUK` boundary events,
- perform layout segmentation (`SETUMA`, `PETUCHA`, `BOOK_BREAK`),
- depend on Letters or Niqqud outputs,
- police textual validity or correctness of cantillation usage,
- perform discourse-level inference.

## Engineering Obligations

Cantillation MUST satisfy all of the following:

1. Determinism and stable ordering.
2. Complete coverage reporting.
3. Strict anchor validation in strict mode.

### Determinism and Stable Ordering

Given identical Spine bytes, config, and code hash, emitted `cantillation.ir.jsonl` bytes MUST be identical.

Row ordering MUST be deterministic and canonical:

- `(ref_key, anchor.index, anchor.kind, event.sortKey)`

Where:

- `anchor.index` is parsed from `#g:<index>` or `#gap:<index>`.
- `event.sortKey` is a stable event key derived only from event payload fields.
- mark list normalization within a grapheme MUST be stable under irrelevant mark ordering.

### Complete Coverage Reporting

Cantillation build artifacts MUST report, at minimum, per-run counts for:

- `marks_seen`
- `marks_mapped`
- `marks_ignored`
- `boundary_events_emitted`

The layer MUST make unmapped/ignored marks observable (counters and/or warning artifacts).
Silent dropping is forbidden.

### Strict Anchor Validation

In strict mode, fail fast on any anchor inconsistency, including:

- malformed anchor ids,
- `anchor.id` not present in source Spine,
- mismatch between `anchor.id` ref/index and row `ref_key`,
- non-canonical output order.

## Composition Boundary

Cantillation output is compositional input to wrapper stitching.

The wrapper may consume gap-anchored boundary events, but semantics execution remains outside
this layer.
