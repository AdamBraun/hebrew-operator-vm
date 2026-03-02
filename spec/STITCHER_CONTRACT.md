# Stitcher Contract (Authoritative)

This document defines the authoritative stitching contract that composes orthogonal layer outputs into `ProgramIR`.

## Purpose

The stitcher is a deterministic join-and-validate layer. It combines anchor-compatible IR products without introducing VM semantics.

## Inputs

Required input artifacts:

1. `Spine.jsonl`
2. `LettersIR.jsonl`
3. `NiqqudIR.jsonl`
4. `CantillationIR.jsonl`
5. `LayoutIR.jsonl`
6. `MetadataPlan.json`

### Input Authority

- `Spine.jsonl` is the anchor authority (`gid`, `gapid`, canonical stream order).
- `LettersIR` is the authority for executable letter ops (`program_op` rows).
- `NiqqudIR`, `CantillationIR`, and `LayoutIR` are orthogonal attachments only.
- `MetadataPlan.json` is opaque metadata input for manifest digesting and traceability; stitcher does not reinterpret its semantics.

## Output

The stitcher emits:

1. `ProgramIR.jsonl` (or `ProgramIR.json`)
2. `program.manifest.json`
3. `program.meta.json` (cache/interface metadata for orchestration)

### ProgramIR Row Kinds

- `program_op` (anchored by `gid`):
  - sourced from `LettersIR`
  - optional `niqqud` attachment by `gid`
  - zero-or-more `cantillation_events` by `gid`

- `boundary_frame` (anchored by `gapid`):
  - emitted for each spine gap anchor
  - zero-or-more `layout_events` by `gapid`
  - zero-or-more `cantillation_events` by `gapid`

No other row kinds are allowed in the stitcher contract version `1.0.0`.

## Deterministic Ordering

`ProgramIR` ordering is canonical and stable:

1. `ref_key` (stable ref comparison)
2. anchor index (`gap_index` / `g_index`)
3. anchor kind (`boundary_frame` before `program_op` at equal index)
4. anchor id (`gapid` / `gid`) as lexical tie-break

Within joined arrays:

- `cantillation_events` are canonically ordered with cantillation event ordering.
- `layout_events` are canonically ordered by layout event type rank (`SPACE`, `SETUMA`, `PETUCHA`, `BOOK_BREAK`).

Given identical inputs, serialized `ProgramIR` bytes are identical.

## Required Invariants

1. Determinism:
   - same input artifacts produce byte-identical `ProgramIR` output.
2. No semantic inference:
   - stitcher performs joins + local structural/anchor validation only.
   - stitcher does not derive new semantic instructions, ranks, or VM meaning.
3. No VM execution:
   - stitcher does not execute VM programs and does not mutate heap/runtime state.
4. No runtime identities:
   - stitcher output must not depend on runtime-only IDs (for example handles allocated at execution time).
5. Anchor integrity:
   - every `gid` / `gapid` referenced by `LettersIR`, `NiqqudIR`, `CantillationIR`, or `LayoutIR` must exist in `Spine`.
   - violation is fatal with precise source-layer + row-index + anchor-id error.

## Validation Rules

Stitcher must reject inputs when any condition fails:

- malformed record shape in any input artifact,
- non-canonical deterministic order in any input stream,
- duplicate anchors where uniqueness is required by source schema,
- missing spine anchor for any referenced `gid`/`gapid`.

Rejections are fail-fast and must identify:

- source artifact (`LettersIR`, `NiqqudIR`, `CantillationIR`, `LayoutIR`),
- row index,
- offending anchor id.

## Manifest Contract

`program.manifest.json` must include:

- layer identity/version,
- stitcher contract version,
- created timestamp,
- output format (`jsonl` or `json`),
- input content digests for all six inputs,
- input row counts for all IR inputs,
- output row counts (`program_rows`, `op_rows`, `boundary_rows`),
- output `ProgramIR` digest.

Manifest content is canonicalized for deterministic serialization.

## Non-Goals

Stitcher does not:

- classify tropes, infer boundary policies, or decide VM `cut/glue` semantics,
- infer layout from whitespace when `LayoutIR` already carries layout signal,
- invent missing layer rows,
- mutate or execute runtime state.

## CLI Entrypoint

Primary stitch CLI:

`node src/cli/stitch-program.ts --spine <dir|file> --letters <dir|file> --niqqud <dir|file> --cant <dir|file> --layout <dir|file> --metadata <dir|file> --out <dir>`

The CLI:

- resolves input artifacts from file paths or layer directories,
- validates all inputs through stitch-time validation/contract checks,
- emits deterministic `ProgramIR.jsonl`,
- writes `program.manifest.json`,
- writes `program.meta.json` with cache digests/hooks.

### `program.meta.json` Minimum Fields

- `spineDigest`
- `lettersDigest`
- `niqqudDigest`
- `cantDigest`
- `layoutDigest`
- `metadataDigest`
- `stitcherVersion`
- `stitchConfig`
- `counts: { ops, boundaries, checkpoints }`
- optional `refStats`
