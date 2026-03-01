# Normalization Layer Contract (Authoritative)

## Purpose

Normalization exists to **filter noise and canonicalize representation**.
It is explicitly **not** responsible for selecting or inferring signal.

Normalization MUST:

- normalize Unicode/text representation into a deterministic grapheme+gap stream,
- preserve raw observables needed by downstream analyzers,
- emit stable anchors (`gid`, `gapid`) used by all downstream layers.

Normalization MUST NOT pick layout/cantillation/niqqud semantics.

## Inputs and Output-Affecting CLI Options

Primary inputs:

- Source corpus with explicit `ref_key -> text` rows.
- Ref ordering source (index) used to emit deterministic cross-ref order.
- Normalization implementation version (`normalizerCodeDigest`).

Authoritative CLI entrypoint:

- `src/cli/build-spine.ts`

Output-affecting options (only these change `Spine.jsonl` content and `spineDigest`):

- canonical options object (`src/spine/options.ts`):
  - `unicodeForm: "NFC" | "NFKD" | "none"` (default `NFC`)
  - `normalizeFinals: boolean` (default `false`)
  - `stripControlChars: boolean` (default `true`)
  - `preservePunctuation: boolean` (default `true`)
  - `errorOnUnknownMark: boolean` (default `false`)

CLI contract (`src/cli/build-spine.ts`) MUST map to the same canonical options:

- `--unicode-form=NFC|NFKD|none`
- `--normalize-finals` / `--no-normalize-finals`
- `--strip-control-chars` / `--no-strip-control-chars`
- `--preserve-punctuation` / `--drop-punctuation`
- `--error-on-unknown-mark` / `--warn-on-unknown-mark`

Unknown options are fatal; silent ignore is forbidden.

Non-output-affecting options (must not change spine rows or `spineDigest`):

- output location flags (`--out-dir`, `--manifest-out`)
- logging/verbosity flags
- dry-run/inspection flags

## Output Artifacts

- `outputs/cache/spine/<spineDigest>/spine.jsonl`
- `outputs/cache/spine/<spineDigest>/manifest.json`
- `outputs/runs/latest/layers/spine` -> symlink/alias to the cached digest directory

### `Spine.jsonl` row schema (`oneOf`)

Each line is exactly one `g` or `gap` record.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "spec/schemas/spine-record.schema.json",
  "title": "SpineRecord",
  "type": "object",
  "oneOf": [
    {
      "title": "SpineGRecord",
      "type": "object",
      "additionalProperties": false,
      "required": ["kind", "gid", "ref_key", "g_index", "base_letter", "marks_raw"],
      "properties": {
        "kind": { "const": "g" },
        "gid": { "type": "string", "pattern": "^[^#]+#g:[0-9]+$" },
        "ref_key": { "type": "string", "minLength": 1 },
        "g_index": { "type": "integer", "minimum": 0 },
        "base_letter": {
          "type": ["string", "null"],
          "description": "Single grapheme base letter when Hebrew letter exists; null allowed for preserved non-letter grapheme."
        },
        "marks_raw": {
          "type": "object",
          "additionalProperties": false,
          "required": ["niqqud", "teamim"],
          "properties": {
            "niqqud": {
              "type": "array",
              "items": { "type": "string", "minLength": 1 },
              "default": []
            },
            "teamim": {
              "type": "array",
              "items": { "type": "string", "minLength": 1 },
              "default": []
            },
            "tagin": {
              "type": "array",
              "items": { "type": "string", "minLength": 1 }
            }
          }
        }
      }
    },
    {
      "title": "SpineGapRecord",
      "type": "object",
      "additionalProperties": false,
      "required": ["kind", "gapid", "ref_key", "gap_index", "raw"],
      "properties": {
        "kind": { "const": "gap" },
        "gapid": { "type": "string", "pattern": "^[^#]+#gap:[0-9]+$" },
        "ref_key": { "type": "string", "minLength": 1 },
        "gap_index": { "type": "integer", "minimum": 0 },
        "raw": {
          "type": "object",
          "additionalProperties": false,
          "required": ["whitespace"],
          "properties": {
            "whitespace": { "type": "boolean" },
            "maqaf_char": { "type": "boolean" },
            "sof_pasuk_char": { "type": "boolean" },
            "other": {
              "type": "array",
              "items": { "type": "string", "minLength": 1 }
            }
          }
        }
      }
    }
  ]
}
```

### `manifest.json` schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "spec/schemas/spine-manifest.schema.json",
  "title": "SpineManifest",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "layer",
    "spineDigest",
    "generated_at",
    "input",
    "options",
    "counts",
    "artifacts",
    "warnings"
  ],
  "properties": {
    "schema_version": { "const": 1 },
    "layer": { "const": "normalization" },
    "spineDigest": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "generated_at": { "type": "string", "format": "date-time" },
    "input": {
      "type": "object",
      "additionalProperties": false,
      "required": ["path", "sha256", "ref_order_sha256"],
      "properties": {
        "path": { "type": "string", "minLength": 1 },
        "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
        "ref_order_sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }
      }
    },
    "options": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "unicodeForm",
        "normalizeFinals",
        "stripControlChars",
        "preservePunctuation",
        "errorOnUnknownMark"
      ],
      "properties": {
        "unicodeForm": { "type": "string", "enum": ["NFC", "NFKD", "none"] },
        "normalizeFinals": { "type": "boolean" },
        "stripControlChars": { "type": "boolean" },
        "preservePunctuation": { "type": "boolean" },
        "errorOnUnknownMark": { "type": "boolean" }
      }
    },
    "counts": {
      "type": "object",
      "additionalProperties": false,
      "required": ["refs", "g_rows", "gap_rows", "total_rows"],
      "properties": {
        "refs": { "type": "integer", "minimum": 0 },
        "g_rows": { "type": "integer", "minimum": 0 },
        "gap_rows": { "type": "integer", "minimum": 0 },
        "total_rows": { "type": "integer", "minimum": 0 }
      }
    },
    "artifacts": {
      "type": "object",
      "additionalProperties": false,
      "required": ["spine_jsonl", "manifest_json"],
      "properties": {
        "spine_jsonl": {
          "type": "object",
          "additionalProperties": false,
          "required": ["path", "rows", "bytes", "sha256"],
          "properties": {
            "path": { "type": "string", "minLength": 1 },
            "rows": { "type": "integer", "minimum": 0 },
            "bytes": { "type": "integer", "minimum": 0 },
            "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }
          }
        },
        "manifest_json": {
          "type": "object",
          "additionalProperties": false,
          "required": ["path", "bytes", "sha256"],
          "properties": {
            "path": { "type": "string", "minLength": 1 },
            "bytes": { "type": "integer", "minimum": 0 },
            "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }
          }
        }
      }
    },
    "warnings": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

## Invariants (Normative)

1. Normalization output is deterministic: same input bytes + same options + same code digest => identical `spine.jsonl` bytes.
2. `gid` MUST equal `<ref_key>#g:<g_index>`.
3. `gapid` MUST equal `<ref_key>#gap:<gap_index>`.
4. Within each `ref_key`, `g_index` is contiguous `0..(G-1)`.
5. Within each `ref_key`, `gap_index` is contiguous `0..G` (leading + internal + terminal boundaries).
6. For each `ref_key`, total gap rows MUST equal grapheme rows + 1.
7. Per-ref row order in `spine.jsonl` is fixed as `gap(0), g(0), gap(1), g(1), ..., g(G-1), gap(G)`.
8. Global `spine.jsonl` ref order MUST follow canonical ref index order (numeric sort for chapter/verse segments).
9. `marks_raw.niqqud` and `marks_raw.teamim` MUST preserve post-normalization combining order; no semantic reordering allowed.
10. `raw.whitespace` reflects literal whitespace presence only; it must not encode layout class.
11. `raw.maqaf_char` and `raw.sof_pasuk_char` indicate literal character presence only; inference is forbidden.
12. Every emitted row MUST validate against the schema above; unknown fields are invalid.

## Non-Goals (Normative)

1. No layout semantics (`SETUMA`, `PETUCHA`, `BOOK_BREAK`) are selected here.
2. No cantillation semantics (`CUT`, `CONJ`, rank assignment) are selected here.
3. No niqqud semantic tiering/modifier meaning is computed here.
4. No letter operator selection (`letter_op`) is computed here.
5. No VM event generation or execution happens here.
6. No grammatical correctness policing ("valid Hebrew" enforcement) beyond structural validation.
7. No correction/inference of missing marks beyond explicit canonicalization rules.
8. No line/page geometry interpretation (columns, wrapped lines, scroll layout).
9. No package checkpoint planning (parasha/aliyah metadata).
10. No cross-layer joins (Normalization never reads Letters/Niqqud/Cantillation/Layout outputs).
11. No deduplication/aggregation semantics across refs.
12. No policy decisions about boundary strength (flush/compact/hard/soft) are made here.

## Error Handling and Validation

Fatal errors (build fails, no success manifest):

- Input cannot be parsed/read.
- Unknown CLI option or invalid option value.
- Unsupported `unicodeForm` value after option normalization.
- Unknown combining mark when `errorOnUnknownMark = true`.
- Non-deterministic anchor emission detected (duplicate `gid`/`gapid`, non-contiguous indexes, wrong row order).
- Schema validation failure for any row or manifest.
- Idempotence failure (`normalize(normalized_input) != normalized_input`).

Warnings (build succeeds; warnings recorded in manifest):

- Non-Hebrew graphemes preserved as `base_letter: null`.
- Gap has unusual punctuation captured in `raw.other`.
- Input contains deprecated/rare codepoints that were preserved (not dropped).
- Unknown combining mark when `errorOnUnknownMark = false` (recorded, not fatal).

Validation rules:

- Every row is validated against `SpineRecord` before write.
- Aggregate counts are validated at EOF:
  - `total_rows = g_rows + gap_rows`
  - per-ref `gap_rows = g_rows + 1`
- Manifest `artifacts.*.sha256` values are computed from final on-disk bytes.

## Hashing / Digest Rules (`spineDigest`)

`spineDigest` is defined as:

- `SHA-256(canonical_json(spine_digest_payload))`

Where `spine_digest_payload` includes exactly:

- `layer`: constant `"spine"`
- `schema_version`: `1`
- `normalizerCodeDigest`: SHA-256 of normalization-layer implementation snapshot
- `input.sha256`: source corpus bytes digest
- `input.ref_order_sha256`: canonical ref-order digest
- `options.unicodeForm`
- `options.normalizeFinals`
- `options.stripControlChars`
- `options.preservePunctuation`
- `options.errorOnUnknownMark`
- `artifacts.spine_jsonl.sha256`

`spineDigest` MUST NOT depend on:

- output file paths,
- wall-clock timestamps,
- logging verbosity,
- warning message text,
- machine-specific absolute paths.

Canonical JSON for digesting MUST sort object keys lexicographically and serialize UTF-8 bytes without extra whitespace.

## Example Records (Hebrew Snippet)

Snippet: `בָּרָא אֱלֹהִים׃` (`ref_key = "Genesis/1/1"`)

Example `g` and `gap` rows:

```json
{"kind":"g","gid":"Genesis/1/1#g:0","ref_key":"Genesis/1/1","g_index":0,"base_letter":"ב","marks_raw":{"niqqud":["ּ","ָ"],"teamim":[]}}
{"kind":"gap","gapid":"Genesis/1/1#gap:3","ref_key":"Genesis/1/1","gap_index":3,"raw":{"whitespace":true}}
{"kind":"g","gid":"Genesis/1/1#g:3","ref_key":"Genesis/1/1","g_index":3,"base_letter":"א","marks_raw":{"niqqud":["ֱ"],"teamim":[]}}
{"kind":"gap","gapid":"Genesis/1/1#gap:8","ref_key":"Genesis/1/1","gap_index":8,"raw":{"whitespace":false,"sof_pasuk_char":true}}
```

These examples are illustrative and must still satisfy the schema/invariant rules above.
