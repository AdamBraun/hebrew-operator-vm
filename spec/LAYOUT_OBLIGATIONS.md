# Layout Obligations (Wrapper Reliance Contract)

This document defines what downstream wrapper/hygiene logic can rely on from `LayoutIR`.

## Scope

These obligations apply when `LayoutIR` is extracted from:

- canonical `Spine` gap stream, and
- a validated/resolved layout dataset.

## 1) Completeness

Layout guarantees event completeness:

1. Every Spine gap with `whitespace=true` produces exactly one `SPACE` LayoutIR record.
2. Every valid dataset event produces exactly one corresponding LayoutIR record.
3. If both whitespace and dataset signal occur on the same `gapid`, records are emitted separately (one per event type).

No additional inferred layout records are allowed.

## 2) Correct Anchoring

Layout guarantees anchor correctness:

1. Every emitted record is keyed by a valid `gapid` present in the Spine projection.
2. For each record, `gapid`, `ref_key`, and `gap_index` are mutually consistent.
3. Extraction MUST fail fast if a dataset event points to a missing or mismatched Spine gap.

## 3) Strength Monotonicity

`layout_event.strength` is a pure function of `layout_event.type`:

- `SPACE -> weak`
- `SETUMA -> mid`
- `PETUCHA -> strong`
- `BOOK_BREAK -> max`

No contextual or heuristic remapping is allowed in Layout extraction.

## 4) No Semantics

`LayoutIR` carries layout boundaries only and MUST NOT imply runtime semantics:

- no cut rank assignment,
- no `tau` transitions,
- no constituent closure,
- no VM heap/state mutation,
- no cantillation interpretation.

Semantic decisions remain wrapper/runtime responsibilities.

## 5) Determinism

Given identical Spine bytes and identical dataset bytes, Layout output bytes are identical.

Determinism requirements:

1. Stable traversal of Spine gap order.
2. Stable event ordering for same-gap multi-event cases.
3. Stable JSON serialization policy for each JSONL line.
4. Stable newline policy (`\n`-terminated JSONL lines).

Equivalent input must produce byte-identical `layout.ir.jsonl`.

## Wrapper Consumption Note

Wrapper hygiene/flush policies may consume `LayoutIR` strengths and event types, but must treat this contract as authoritative.
Any wrapper rule that depends on layout boundaries should be reviewed against this document.
