# Niqqud Layer Contract

## Layer Version

`NIQQUD_LAYER_VERSION = "1.0.0"`

This contract version governs Niqqud layer behavior and output semantics.

## Responsibilities

The Niqqud layer MUST:

- read `Spine.jsonl` and project only grapheme rows (`kind: "g"`) with `gid`, `ref_key`, `g_index`, and `marks_raw.niqqud`,
- transform raw niqqud marks into a modifier payload (`NiqqudIR`) keyed by `gid`,
- emit outputs that are independent of Letters, Cantillation, and Layout results.

The Niqqud layer MUST NOT read or join `LettersIR`, `CantillationIR`, or `LayoutIR`.

## Obligations (Must-Haves)

- Determinism: given identical `Spine` input and identical niqqud-layer config, output bytes MUST be identical.
- Stable anchoring: every emitted row MUST preserve source `gid` anchors; no rewriting, no reindexing.
- Isolation: no boundary creation, no `tau`, no workspace flush, and no semantic heap mutation.

## Invariants

1. Output rows are `gid`-scoped only and are emitted in canonical spine grapheme order.
2. For every emitted row, `(gid, ref_key, g_index)` MUST match the source spine grapheme anchor tuple.
3. The layer MUST ignore gap anchors entirely (`gapid` is out of scope for Niqqud).
4. `marks_raw.teamim` MUST NOT affect niqqud modifier computation.
5. Unknown or unsupported niqqud marks MUST be represented in `unhandled[]`; they MUST NOT be dropped silently.

## Non-Goals / Forbidden Behavior

The Niqqud layer MUST NOT:

- require base letter identity to compute modifiers,
- police validity of niqqud combinations (missing/extra marks are accepted and encoded),
- interpret cantillation marks or derive cantillation/boundary semantics,
- emit events keyed by `gapid`.

## Error Policy

- Unknown niqqud marks MUST NOT throw. They are recorded in `unhandled[]`.
- Missing or extra niqqud marks MUST NOT throw. They are encoded as-is (including empty payloads where applicable).
- Throw only on structural corruption, for example:
  - malformed spine records (invalid JSON/object shape),
  - missing required grapheme anchor fields (`gid`, `ref_key`, `g_index`),
  - invalid `marks_raw.niqqud` schema (non-array or non-string entries),
  - anchor tuple mismatches (e.g., `gid` inconsistent with `ref_key`/`g_index`).

## Versioning Rules

- `NIQQUD_LAYER_VERSION` MUST be bumped whenever behavior changes.
- A behavior change includes any change that can alter Niqqud layer outputs for the same spine+config inputs, including:
  - mark-to-modifier mapping changes,
  - `unhandled[]` classification/encoding changes,
  - output ordering or row-emission policy changes,
  - output schema field meaning changes.
- Pure refactors that preserve byte-identical output for identical inputs do not require a bump.
