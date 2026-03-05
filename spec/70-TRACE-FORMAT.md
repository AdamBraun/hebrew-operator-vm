# Trace Format (Canonical Machine Truth)

## Status

Normative for trace artifacts emitted as:

- `corpus/word_traces.jsonl`
- `corpus/verse_traces.jsonl`

Canonical schema: `spec/70-TRACE-FORMAT.schema.json`.
Reference TS types: `src/reference/trace/types.ts`.

## Goals

- Provide an interpreter-independent trace contract for downstream tooling.
- Separate semantic machine truth from renderer-only text.
- Preserve deterministic hashing/diff behavior across re-runs for the same input + semantics.
- Support forward-compatible evolution without breaking old readers unexpectedly.

## Record Families

Two record families are valid:

- `WORD_TRACE` (`WordTraceRecord`): one record per surface word.
- `VERSE_TRACE` (`VerseTraceRecord`): one record per verse-level aggregation.

Each JSONL line MUST contain exactly one record object conforming to one of these families.

## Version Fields

Every record MUST include:

- `trace_version`: version of this trace data model (schema + semantics of fields).
- `semantics_version`: version of operator semantics used to produce events.
- `render_version`: version of human-rendering layer (`flow`, summaries, labels).

### Version semantics

- `trace_version`
  - MAJOR: breaking format/meaning changes (field rename/removal, event payload contract changes, ordering semantics changes).
  - MINOR: backward-compatible additions (new optional fields, new event kinds via extension lane).
  - PATCH: clarifications/fixes with no shape or semantic impact.
- `semantics_version`
  - Controlled by semantic operator definition changes.
  - Any event-kind behavior change MUST bump `semantics_version`.
- `render_version`
  - Changes only when renderer-facing strings/labels/formatting change.
  - MUST NOT be used as semantic equality basis.

## Canonical Trace Event Model

`TraceEvent` is a discriminated union keyed by `kind`.

Common required fields for all events:

- `kind`: canonical event family name (e.g. `TAV.FINALIZE`).
- `index`: 0-based order within the parent word trace event stream.
- `tau`: VM logical time at emission/derivation.
- `source`: one of:
  - `vm_event`
  - `derived_obligation`
  - `derived_boundary`
  - `error`
  - `extension`
- `payload`: kind-specific object.

### Canonical event kinds (v1)

VM-origin event kinds:

- `ALEPH.ALIAS`
- `GIMEL.BESTOW`
- `DALET.BOUNDARY_CLOSE`
- `RESH.BOUNDARY_CLOSE`
- `HE.DECLARE`
- `HE.DECLARE_BREATH`
- `HE.DECLARE_PIN`
- `HE.DECLARE_ALIAS`
- `ZAYIN.GATE`
- `HET.COMPARTMENT`
- `TET.COVERT`
- `LAMED.ENDPOINT`
- `SAMEKH.SUPPORT_DISCHARGE`
- `PE.UTTER`
- `FINAL_PE.UTTER_CLOSE`
- `TSADI.ALIGN`
- `FINAL_TSADI.ALIGN_FINAL`
- `QOF.APPROX`
- `SHIN.ATTACH_THREE`
- `TAV.FINALIZE`
- `SPACE.SUPPORT_DISCHARGE`
- `SPACE.BOUNDARY_AUTO_CLOSE`

Derived (obligation/boundary) kinds:

- `MEM.OPEN`
- `FINAL_MEM.CLOSE`
- `NUN.SUPPORT_DEBT`
- `FINAL_NUN.SUPPORT_DEBT`
- `FINAL_NUN.SUPPORT_DISCHARGE`
- `SPACE.MEM_AUTO_CLOSE`

Error kinds:

- `ERROR.RUNTIME`
- `ERROR.UNKNOWN_SIGNATURE`

### Extension lane

Forward-compatible event additions MUST use:

- `kind = "EXTENSION"`
- `source = "extension"`
- `payload.extension_kind` as namespaced identifier (e.g. `ACME.CUSTOM_EVENT`)
- `payload.data` as extension payload blob

This keeps v1 readers strict while allowing unknown future behavior to pass through explicitly.

## WordTraceRecord

Required fields:

- `record_kind = "WORD_TRACE"`
- `trace_version`
- `semantics_version`
- `render_version`
- `ref` with `{ book, chapter, verse, token_index }`
- `ref_key` (`Book/Chapter/Verse/TokenIndex`)
- `surface`
- `token_ids` (ordered grapheme token ids)
- `events` (`TraceEvent[]`)

Optional fields:

- `skeleton` (renderer convenience; usually `events[].kind`)
- `flow` (renderer string)
- `mode` (`WORD | VERSE | WINDOW`)
- `window_start`
- `canonical_hash` (hex sha256 over canonical semantic projection)
- `extensions` (vendor extension object)

## VerseTraceRecord

Required fields:

- `record_kind = "VERSE_TRACE"`
- `trace_version`
- `semantics_version`
- `render_version`
- `ref` with `{ book, chapter, verse }`
- `ref_key` (`Book/Chapter/Verse`)
- `mode`
- `words_total`
- `total_events`
- `boundary_events`
- `cross_word_events`
- `notable_motifs`

`boundary_events` includes:

- `total`
- `by_type`
- `verse_end`
- `phrase_breaks` (`PHRASE_BREAK` verse-level boundary events keyed to phrase tree split-node ids with word spans)
- `verse_boundary_operator`

Optional fields:

- `window_size`
- `safety_rail`
- `canonical_hash`
- `extensions`

`VerseTraceRecord` is an aggregation record; machine truth at semantic granularity remains the per-word `events` stream.

## Canonical Ordering Rules

These rules are required for stable hashing/diffs.

### JSONL record order

- Word traces: sort by `(ref.book, ref.chapter, ref.verse, ref.token_index)`.
- Verse traces: sort by `(ref.book, ref.chapter, ref.verse)`.
- Numeric segments MUST be compared numerically, not lexicographically.

### Event order

- `events` MUST be sorted by `index` ascending.
- `index` MUST be contiguous `0..N-1` with no duplicates.
- `tau` MUST be non-decreasing across `events`.

### Object key order

For canonical JSON hashing, object keys MUST be serialized in lexicographic order.

Recommended canonical key order for human-friendly emitters:

- Word: `record_kind`, `trace_version`, `semantics_version`, `render_version`, `ref`, `ref_key`, `surface`, `token_ids`, `events`, `skeleton`, `flow`, `mode`, `window_start`, `canonical_hash`, `extensions`.
- Verse: `record_kind`, `trace_version`, `semantics_version`, `render_version`, `ref`, `ref_key`, `mode`, `words_total`, `total_events`, `boundary_events`, `cross_word_events`, `notable_motifs`, `window_size`, `safety_rail`, `canonical_hash`, `extensions`.

### Semantic hash basis

For semantic equality/diffing, hash input SHOULD include:

- record envelope (`record_kind`, `trace_version`, `semantics_version`, `ref`, `ref_key`)
- semantic body (`token_ids`, `events` for words; verse aggregation fields for verse rows)

For semantic hashing, implementations SHOULD exclude renderer-only fields:

- `render_version`
- `flow`
- any renderer summaries in `extensions`

## Compatibility Policy

- Readers MUST reject records with unsupported `trace_version` MAJOR.
- Readers SHOULD accept higher MINOR/PATCH within same MAJOR, ignoring unknown optional fields.
- Writers MUST NOT remove or repurpose existing fields without MAJOR bump.
- New event semantics in existing event kind names require `semantics_version` bump.

## Validation

A conforming validator MUST validate each JSONL row against `spec/70-TRACE-FORMAT.schema.json`.

Conformance expectations:

- Required fields enforced.
- Type contracts and enum contracts enforced.
- Unknown top-level fields rejected except under explicit `extensions` lane.
- Event payloads validated by `kind` discriminator.
