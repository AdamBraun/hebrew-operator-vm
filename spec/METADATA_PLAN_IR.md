# Metadata Plan IR Contract (Authoritative)

## Purpose

`MetadataPlan.json` is the metadata-layer output IR.

It is packaging/navigation/checkpoint data only and is independent of VM execution.

## Output Artifact

Path contract (logical):

- `MetadataPlan.json`

Top-level required fields:

- `ir_version`: `"metadata_plan_ir.v1"`
- `dataset_id`: string
- `scope`: `"torah"`
- `cycle`: `"one_year"`
- `ref_order_source`: `"corpus_index"`
- `generated_at`: ISO-8601 datetime string
- `plan_digest`: lowercase SHA-256 hex over normalized dataset + ref ordering
- `checkpoints`: authoritative ordered checkpoint list

Top-level optional helper fields:

- `parashot`: UI summary blocks
- `ranges`: consolidated segment ranges for fast lookup
- `ref_to_segment_index`: lookup map keyed by `RefKey`

## Checkpoints (Authoritative)

Checkpoint record fields:

- `checkpoint_id`: deterministic stable ID
- `kind`: `"ALIYAH_END" | "PARASHA_END"`
- `parasha_id`: normalized slug
- `aliyah_index`: `1..7` for `ALIYAH_END`, `null` for `PARASHA_END`
- `ref_key_end`: canonical `RefKey`
- `ordinal`: zero-based corpus index (`ref_order[ordinal] == ref_key_end`)

Deterministic ID rule:

- `checkpoint_id = "${kind}:${parasha_id}:${aliyah_index ?? 0}:${ref_key_end}"`

## Determinism and Regeneration

Given identical:

- normalized input dataset,
- canonical corpus ref ordering source (`corpus_index`),
- metadata IR version + implementation version,

the emitted IR must be byte-identical except for `generated_at` when wall-clock mode is used.

For strict reproducibility mode, `generated_at` must be supplied deterministically (or fixed), yielding fully byte-identical outputs.

`plan_digest` must not include `generated_at`.

## Ordering Rules

- `checkpoints` are sorted by corpus order (`ordinal` ascending).
- Primary tie-break (same `ordinal`): `ALIYAH_END` before `PARASHA_END`.
- Duplicate ordinal is allowed only for end-of-parasha coincidence:
  - `ALIYAH_END` with `aliyah_index = 7`
  - immediately followed by matching `PARASHA_END`
  - same `parasha_id` and same `ref_key_end`
- Any other duplicate-ordinal pattern is a contract violation.
- Any ordering instability is a contract violation.

## Coverage/Partition Guarantees

- Every checkpoint `ref_key_end` must exist in the corpus ref order source.
- Parasha ranges must cover the full corpus ref order with no overlaps and no gaps.
- Within each parasha, aliyah ranges must form a full non-overlapping partition of the parasha range.

## Dependencies and Non-Goals

Metadata Plan IR generation may depend only on:

- metadata input dataset,
- corpus index/ref ordering,
- metadata-layer deterministic transforms.

Metadata Plan IR generation must not depend on:

- VM runtime state,
- `LettersIR`, `NiqqudIR`, `CantillationIR`, `LayoutIR`, or stitched `ProgramIR`.

Metadata Plan IR must not encode VM instructions or semantic execution state.
