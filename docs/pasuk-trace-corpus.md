# Pasuk Trace Corpus

## Goal

Create a versioned hard-copy corpus of per-verse interpreter outputs across the full Torah:

- full `pasuk-trace` JSON payloads (including snapshots and final state),
- human-readable trace reports,
- Graphviz DOT graphs derived from each verse trace.

This corpus is designed for:

- commit-based historical diffs of interpreter behavior,
- deterministic artifact inspection outside the runtime,
- direct UI consumption for verse traversal.

## Dataset Scope

For `data/torah.json` currently in this repo:

- books: `5`
- chapters: `187`
- verses: `5846`

## Command

```bash
npm run build
npm run pasuk-trace-corpus -- \
  --input=data/torah.json \
  --lang=he \
  --keep-teamim \
  --include-snapshots \
  --concurrency=50 \
  --layout=boot \
  --pretty-ids \
  --boundary=cluster \
  --out-dir=outputs/pasuk-trace-corpus/latest
```

Defaults are already aligned with the command above for:

- `--lang=he`
- `--keep-teamim`
- `--include-snapshots`
- `--concurrency=50`
- `--layout=boot`
- `--pretty-ids`
- `--boundary=cluster`

## Storage Planning Note

`--include-snapshots` is high-volume because each verse can contain large state snapshots.

Measured on this repo (Genesis 1:1):

- with snapshots: `trace.json` = `17,607,674` bytes
- without snapshots: `trace.json` = `435,044` bytes

If you plan to commit this corpus in Git, strongly consider either:

- running without snapshots (`--no-snapshots`) for baseline versioning, and/or
- storing full-snapshot runs outside Git or in LFS/object storage.

## Resume / Partial Runs

Resume without regenerating completed verses:

```bash
npm run pasuk-trace-corpus -- \
  --input=data/torah.json \
  --out-dir=outputs/pasuk-trace-corpus/latest \
  --skip-existing
```

Strict provenance verification on resume:

```bash
npm run pasuk-trace-corpus -- \
  --input=data/torah.json \
  --out-dir=outputs/pasuk-trace-corpus/latest \
  --skip-existing \
  --verify-existing
```

Auto-repair stale derived artifacts on resume (no interpreter rerun):

```bash
npm run pasuk-trace-corpus -- \
  --input=data/torah.json \
  --out-dir=outputs/pasuk-trace-corpus/latest \
  --skip-existing \
  --repair-existing
```

Run a subset:

```bash
npm run pasuk-trace-corpus -- \
  --input=data/torah.json \
  --out-dir=outputs/pasuk-trace-corpus/genesis-window \
  --book=Genesis \
  --from-ref=Genesis/1/1 \
  --to-ref=Genesis/2/5
```

Limit for smoke tests:

```bash
npm run pasuk-trace-corpus -- --input=data/torah.json --limit=20
```

## Output Layout

```text
outputs/pasuk-trace-corpus/latest/
  manifest.json
  refs/
    index.json
    genesis/
      001/
        001/
          trace.json
          trace.txt
          graph.dot
```

Path convention:

- `refs/<book-slug>/<chapter-3d>/<verse-3d>/`
- chapter/verse are zero-padded (`001`, `002`, ...)
- `book-slug` is lowercase hyphenated (for current Torah input: `genesis`, `exodus`, `leviticus`, `numbers`, `deuteronomy`)

## `trace.json` Contract

Each `trace.json` is equivalent to `pasuk-trace` output payload shape:

- `schema_version`
- `generated_at`
- `ref_key`
- `options` (input path + run options)
- `source_text`
- `cleaned_text`
- `prepared_tokens`
- `deep_trace`
- `verse_snapshots`
- `final_dump_state`
- `post_reset_state`
- `word_sections`
- `final_state` (same as `final_dump_state`)

`trace.json` is canonical. `trace.txt` and `graph.dot` are treated as derived artifacts.

## Derived Provenance Contract

Each `graph.dot` starts with provenance comments:

```text
// trace_file_sha256: <hex>
// graph_opts_sha256: <hex>
// graph_renderer_id: <string>
// dot_schema: <int>
// trace_semantic_sha256: <hex>   # optional
```

Each `trace.txt` starts with provenance comments:

```text
# trace_file_sha256: <hex>
# report_renderer_id: <string>
# report_schema: <int>
# trace_semantic_sha256: <hex>    # optional
```

Semantics:

- `trace_file_sha256` binds derived files to the exact `trace.json` bytes on disk.
- `graph_opts_sha256` binds DOT output to the exact active graph option set.
- renderer IDs + schema versions protect against renderer/output format drift.
- `trace_semantic_sha256` is computed from a canonicalized trace payload (volatile fields removed).

Resume behavior with `--skip-existing`:

- verse is skippable only when required artifacts exist and provenance validates.
- if provenance fails and `--verify-existing` is set: run fails.
- if provenance fails and `--repair-existing` is set: derived artifacts are regenerated from stored `trace.json` (no interpreter rerun).
- otherwise: verse is treated as non-skippable and regenerated normally.

## `refs/index.json` Contract

`refs/index.json` is a UI traversal index (array). Row shape:

```json
{
  "ref_key": "Genesis/1/1",
  "book": "Genesis",
  "book_slug": "genesis",
  "chapter": 1,
  "verse": 1,
  "output": {
    "trace_json": "refs/genesis/001/001/trace.json",
    "trace_report": "refs/genesis/001/001/trace.txt",
    "graph_dot": "refs/genesis/001/001/graph.dot"
  },
  "stats": {
    "words": 7,
    "trace_entries": 38,
    "snapshots": 1
  },
  "sha256": {
    "trace_json": "<hex>",
    "trace_report": "<hex>",
    "graph_dot": "<hex>"
  }
}
```

## Tiered Navigation Indexes

For clients that avoid loading the full `refs/index.json` at startup, run:

```bash
node scripts/split-index.mjs
```

This reads `outputs/pasuk-trace-corpus/latest/refs/index.json` and writes:

- `outputs/pasuk-trace-corpus/latest/refs/books.json`
- `outputs/pasuk-trace-corpus/latest/refs/{book}/chapters.json`
- `outputs/pasuk-trace-corpus/latest/refs/{book}/{chapter}/verses.json`

All arrays are sorted ascending and encoded as pretty JSON (`2` spaces + trailing newline).

## `manifest.json` Contract

Run-level metadata and accounting:

- `schema_version`
- `corpus` (`torah`)
- `artifact_set` (`pasuk-trace-corpus`)
- `generated_at`
- `input.path`
- `options.*` (trace + graph + filter options)
- `totals.discovered_refs`
- `totals.processed`
- `totals.skipped_existing`
- `totals.errors`
- `totals.duration_ms`
- `index.path`
- `index.rows`
- `errors[]` with `{ ref_key, message }`

## Graph Configuration

Supported passthrough graph flags:

- `--theme=light|dark|kabbalah`
- `--mode=full|compact|summary`
- `--boundary=auto|cluster|node|both`
- `--prune=orphans|none`
- `--prune-keep-kinds=kind1,kind2`
- `--prune-keep-ids=id1,id2`
- `--layout=plain|boot`
- `--pretty-ids` / `--no-pretty-ids`
- `--legend` / `--no-legend`
- `--words=off|cluster|label`
- `--no-dot` to skip DOT emission entirely

## Error Strategy

Default is fail-fast:

- first verse failure aborts the run,
- partial outputs written before the failure remain on disk.

Optional continue mode:

```bash
npm run pasuk-trace-corpus -- --input=data/torah.json --continue-on-error
```

In continue mode, failures are recorded in `manifest.json -> errors[]`.

## UI Integration Pattern

Recommended client flow:

1. Load `manifest.json` to validate run metadata and show coverage.
2. Build navigation using either:
   - tiered files (`refs/books.json` -> `refs/{book}/chapters.json` -> `refs/{book}/{chapter}/verses.json`), or
   - `refs/index.json` when full row metadata is required up front.
3. For selected verse:
   - fetch `trace_json` for raw interpreter state and final snapshot,
   - fetch `trace_report` for human-readable debug view,
   - fetch `graph_dot` for Graphviz rendering.

Because index paths are relative to the run directory, the same UI code works
for any versioned run folder.
