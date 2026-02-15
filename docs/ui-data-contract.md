# UI Data Contract

## Purpose
The UI consumes deterministic corpus artifacts and validates each record at runtime.
Any contract violation is treated as a load failure with an explicit error message.

Source of truth for runtime validators:

- `packages/ui/src/lib/contracts/wordTraces.ts`
- `packages/ui/src/lib/contracts/versePhraseTrees.ts`
- `packages/ui/src/lib/contracts/wordPhraseRoles.ts`
- `packages/ui/src/lib/contracts/renderOutputs.ts`
- `packages/ui/src/lib/contracts/manifest.ts`
- `packages/ui/src/lib/contracts/versioning.ts`

## Manifest (`manifest.json`)
Schema: `uiDataManifestSchema`.

Required top-level fields:

- `schema_version` (`1`)
- `corpus` (string)
- `artifact_set` (string)
- `generated_at` (UTC ISO timestamp)
- `version_contract`
  - `trace_version` (`1.x.y`)
  - `semantics_version` (`x.y.z`)
  - `render_version` (`x.y.z`)
- `artifacts` (array)

Each artifact entry requires:

- `kind` (`word_traces | verse_phrase_trees | word_phrase_roles | render_strict_paraphrase | render_poetic_paraphrase`)
- `path` (string)
- `format` (`jsonl`)
- `sha256` (lowercase hex, 64 chars)

Optional artifact fields:

- `rows` (int >= 0)
- `bytes` (int >= 0)

Manifest invariants:

- Required artifact kinds must exist: `word_traces`, `verse_phrase_trees`, `word_phrase_roles`.
- Artifact `kind` values must be unique.
- Artifact `path` values must be unique.

## `word_traces` Record Contract
Schema: `wordTraceRecordSchema`.

Required fields:

- `record_kind` = `WORD_TRACE`
- `trace_version`, `semantics_version`, `render_version`
- `ref` (`book`, `chapter`, `verse`, `token_index`)
- `ref_key` (`Book/Chapter/Verse/TokenIndex`)
- `surface`
- `token_ids`
- `events[]` with required event envelope fields:
  - `kind`
  - `index`
  - `tau`
  - `source`
  - `payload`

Allowed optional fields:

- `skeleton`
- `flow`
- `mode`
- `window_start` (only when `mode = WINDOW`)
- `canonical_hash`
- `extensions`

## `verse_phrase_trees` Record Contract
Schema: `versePhraseTreeRecordSchema`.

Required fields:

- `ref_key` (`Book/Chapter/Verse`)
- `ref` (`book`, `chapter`, `verse`)
- `words[]`
- `primary_accents[]`
- `tree` (recursive `LEAF | JOIN | SPLIT` node)
- `phrase_version`

Allowed optional fields:

- none (record is strict)

Additional constraint:

- `primary_accents.length` must match `words.length`.

## `word_phrase_roles` Record Contract
Schema: `wordPhraseRoleRecordSchema`.

Required fields:

- `ref_key` (`Book/Chapter/Verse`)
- `word_index`
- `surface`
- `primary_accent`
- `phrase_role` (`HEAD | TAIL | JOIN | SPLIT`)
- `phrase_path[]`
- `clause_id`
- `subclause_id`
- `phrase_version`

Allowed optional fields:

- none (record is strict)

## Optional Render Output Contract
Schema: `strictParaphraseRecordSchema` and `poeticParaphraseRecordSchema`.

Required fields:

- `ref_key` (`Book/Chapter/Verse[/TokenIndex]`)
- `style` (`strict` or `poetic`)
- `text`

Allowed optional fields:

- `metadata`

## Version Display Rules
Defined in `packages/ui/src/lib/contracts/versioning.ts`.

- Baseline contract is `1.1.0` for trace/semantics/render.
- Major version mismatch is blocking (`error`) and dataset load fails.
- Older/newer compatible versions (same major) are non-blocking (`warning`).
- Exact baseline match is `ok`.

## Runtime Validation Behavior
`readValidatedDataset()` in `packages/ui/src/lib/artifacts.ts` enforces:

- manifest schema validation
- version compatibility check
- JSONL record validation for each declared artifact
- optional `rows`/`bytes` manifest consistency check
- SHA-256 checksum verification (when Web Crypto is available)

Any violation throws a single explicit error with artifact path and line context.

## CI Coverage
The test suite validates:

- contract validators with valid/invalid fixtures
- sample bundle integrity and checksums under `packages/ui/public/data`

This runs through `npm test` in CI.
