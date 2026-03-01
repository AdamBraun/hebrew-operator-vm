# Wrapper Stitching Contract

This document defines how wrapper stitching composes orthogonal layer outputs into boundary frames.

## Inputs

Wrapper stitching consumes:

- Spine gap stream (`gapid`, `ref_key`, `gap_index` order authority)
- LayoutIR stream (authoritative layout signal product)
- Cantillation gap-event stream (optional, orthogonal boundary signal)

Layout production details are out of scope for wrapper stitching.

## Gap Join Rules

Join key is `gapid` only.

For each spine gap in canonical order, wrapper emits one boundary frame containing:

- `zero or more` layout events (`LayoutIR` rows for the same `gapid`)
- `zero or more` cantillation events (cantillation rows for the same `gapid`)

Wrapper must not mutate or reinterpret layout event strength/type while stitching.

## Layout Authority Rule

When LayoutIR is provided, wrapper MUST treat it as authoritative layout signal.
Wrapper MUST NOT infer layout events from spine whitespace or other raw gap signals in that mode.

## Missing LayoutIR Policy

Default mode is strict:

- missing LayoutIR input is an error.

Explicit debug mode may allow missing LayoutIR:

- only when configured (`allowMissingLayoutIR=true` or equivalent),
- frames are emitted with empty `layout_events`.

No implicit fallback is allowed.

## Optional Layout Hygiene Placeholder

Wrapper may optionally attach a non-semantic hygiene plan derived from `layout_event.strength`
for downstream policy wiring.

- This is disabled by default.
- Enabling it must not mutate semantic state by itself.
- It remains separate from cut ranks, `tau`, and verse logic.

## Validation / Safety

Wrapper stitching MUST fail fast when:

1. layout/cantillation records reference a `gapid` not present in spine gap stream,
2. input streams are not in canonical deterministic order,
3. record anchor tuple (`gapid`, `ref_key`, `gap_index`) is inconsistent.

These failures prevent silent cross-layer drift.
