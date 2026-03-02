# Metadata Layer Contract (Authoritative)

## Purpose / Role

Metadata is a packaging/checkpoint/navigation layer only.

Metadata MUST:

- emit deterministic package metadata (for example checkpoint plans and labels),
- support navigation/indexing across a fixed corpus order,
- remain declarative and non-executable.

Metadata MUST NOT carry or infer semantics.

## Inputs

Metadata consumes only:

- canonical Torah ref ordering for the supported corpus,
- metadata-layer config/options (including cycle policy),
- optional human-authored metadata annotations (for example labels/notes) that do not encode semantics.

Metadata MUST NOT consume or depend on:

- VM/runtime state (heap, handles, stacks, `tau`, barriers, obligations, or any execution-time register),
- outputs from other layers (`LettersIR`, `NiqqudIR`, `CantillationIR`, `LayoutIR`, or stitched `ProgramIR`),
- side effects from previous runs.

## Outputs

Metadata emits a deterministic `MetadataPlan` artifact (JSON object) used only for packaging/checkpoints/navigation.

Minimum supported shape:

- `version: integer >= 1`
- optional metadata fields (for example `notes`, `labels`, `options`)
- optional `checkpoints[]` entries keyed by `ref_end`

Output records are descriptive only. They are not VM instructions and do not encode semantic boundaries.

## Non-Goals (Normative)

Metadata MUST NOT do any of the following:

1. assign or infer semantics,
2. emit or classify boundaries,
3. read, write, or derive `tau`,
4. emit or imply `cut`/`glue` behavior,
5. trigger or specify flush/compaction semantics,
6. mutate VM/runtime state,
7. execute program logic.

Explicit acceptance guardrails:

- Metadata outputs must not depend on VM state or other layers' outputs.
- Metadata never mutates VM state.

## Determinism and Versioning

Metadata output MUST be deterministic:

- same corpus refs + same metadata config + same metadata code version => byte-identical `MetadataPlan` output.

Determinism requirements:

- canonical ordering of checkpoints by canonical ref order,
- canonical JSON serialization for digesting/signing,
- no wall-clock, randomness, locale, or calendar-year dependence.

Versioning requirements:

- `MetadataPlan.version` is required and integer `>= 1`,
- contract-breaking schema/meaning changes MUST bump version,
- metadata digesting MUST include content + version + metadata code/policy version so drift invalidates cache.

## Supported Corpus Scope

The metadata layer scope is the Five Books of Moses only (Torah):

- Genesis
- Exodus
- Leviticus
- Numbers
- Deuteronomy

Refs outside Torah are out of contract and MUST be rejected or excluded by policy.

## Cycle Scope

Cycle policy is fixed to a one-year plan.

Calendar-based combined parashot are explicitly out of scope:

- metadata planning ignores year-type/calendar-driven joins,
- output must remain stable and not vary by locale/year calendar combinations.
