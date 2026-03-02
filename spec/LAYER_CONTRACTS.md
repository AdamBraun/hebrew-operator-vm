# Layer Contracts

Authoritative layer contract docs:

- [Normalization Layer Contract](./NORMALIZATION_LAYER.md)
- [Layout Layer Contract](./LAYOUT_LAYER.md)
- [Letters Layer Contract](./LAYERS/LETTERS.md)
- [Niqqud Layer Contract](./LAYERS/NIQQUD_LAYER.md)
- [Cantillation Layer Contract](./LAYER_CANTILLATION.md)
- [Layout Obligations](./LAYOUT_OBLIGATIONS.md)

## Normalization vs Layout (Guardrail)

Normalization and Layout are separate layers with separate authority.

Normalization MUST:

- emit only canonical grapheme (`g`) and gap (`gap`) records,
- preserve raw marks on graphemes (`marks_raw.niqqud`, `marks_raw.teamim`),
- preserve raw boundary observations in gaps (`raw.whitespace`, `raw.chars`).

Normalization MUST NOT:

- emit `SETUMA`, `PETUCHA`, or `BOOK_BREAK`,
- emit any layout-strength or layout-classification field,
- infer layout semantics from whitespace or punctuation.

Layout layer is the only layer allowed to emit layout events such as:

- `SETUMA`
- `PETUCHA`
- `BOOK_BREAK`

Any introduction of layout signal into Normalization is a contract violation and MUST fail tests.

## Cantillation Orthogonality Guarantee

Cantillation extraction is an orthogonal Spine-only layer.

Cantillation extractor code MUST depend only on:

- Spine schema/reader surface (`Spine.jsonl` rows and related spine parsing helpers),
- cantillation-local modules (mapping table, schema, anchoring/placement policy, stats, manifest/hash helpers, validators),
- generic runtime/platform utilities (for example `node:*` and local utility code that is layer-agnostic).

Cantillation extractor code MUST NOT import:

- VM runtime or execution semantics modules,
- letter operator definitions or Letters layer extraction/state,
- niqqud modifier logic or Niqqud layer extraction/state,
- layout datasets, layout segmentation logic, or Layout layer extraction/state.

Concrete boundary rule:

- Any import from `src/layers/letters/**`, `src/layers/niqqud/**`, `src/layers/layout/**`, `src/wrapper/**`, or VM/core execution modules is a contract violation for the cantillation extractor.

Composition boundary:

- Wrapper is the only composition point that may combine CantillationIR with LettersIR/NiqqudIR/LayoutIR.
- Cantillation layer must emit its own IR only; it does not stitch cross-layer semantics.
