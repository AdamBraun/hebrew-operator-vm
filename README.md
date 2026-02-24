# Hebrew Operator VM (v0)

Implements a deterministic VM for the Hebrew operator calculus defined in the
normative spec under `spec/`.

Reference interpreter source: `impl/reference/src/`.

## Quickstart

```bash
npm install
npm run build
```

## Language Policy (ADR-0001)

Language policy for this repo is documented in
[`docs/adr/0001-typescript-source-of-truth.md`](docs/adr/0001-typescript-source-of-truth.md).

Sprint 2 modularization contract for `torah-corpus` is documented in
[`docs/adr/0002-torah-corpus-modularization.md`](docs/adr/0002-torah-corpus-modularization.md).

Rules:

- TypeScript is the source of truth for business and domain logic.
- `.mjs` files are allowed only as thin Node entrypoint wrappers.
- New business logic in `.mjs` is not allowed.
- When touching legacy `.mjs` files, move logic into TS modules and keep the
  wrapper minimal.

Guardrail commands (fail mode for new/touched violations):

```bash
npm run ci:guardrails
npm run ci:mjs-policy
```

Optional CI range override (used by GitHub Actions):

- `GUARDRAILS_BASE_SHA`
- `GUARDRAILS_HEAD_SHA`

Generated reports:

- `reports/ci_guardrails_baseline.md`
- `reports/mjs_policy_violations.md`

Policy allowlists:

- `config/guardrails-allowlist.json`
- `config/mjs-policy-allowlist.json`

## Torah Corpus (Optional)

The repo includes helper scripts to download the Torah and iterate it through the interpreter.

```bash
npm run download-torah -- --out data/torah.json --lang=he
npm run build
npm run iterate-torah -- --input data/torah.json --lang=he
```

Notes:

- The iterator sanitizes input to supported Hebrew letters + niqqud, strips cantillation/punctuation,
  and normalizes qamats‑qatan to kamatz.
- By default it does **not** normalize final letterforms and **fails fast** on RuntimeErrors.
  Use `--normalize-finals` or `--allow-runtime-errors` if you want a more permissive pass.

### Pasuk Trace Corpus (Per-Verse JSON + DOT)

Build a verse-by-verse archive with:

- `trace.json` from `pasuk-trace` semantics (deep trace, snapshots, final dump state, post-reset state)
- `trace.txt` human report
- `graph.dot` Graphviz DOT generated from each trace payload
- `refs/index.json` for UI traversal
- `manifest.json` run-level metadata and counts

Integrity model:

- `trace.json` is canonical.
- `trace.txt` and `graph.dot` are derived artifacts.
- Derived artifacts embed provenance headers that bind them to the exact `trace.json` bytes plus renderer/schema metadata.
- `graph.dot` provenance also binds to the exact graph option set hash.

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

Resume a previous run without regenerating existing verse artifacts:

```bash
npm run pasuk-trace-corpus -- \
  --input=data/torah.json \
  --out-dir=outputs/pasuk-trace-corpus/latest \
  --skip-existing
```

Validate existing resume artifacts against embedded provenance:

```bash
npm run pasuk-trace-corpus -- \
  --input=data/torah.json \
  --out-dir=outputs/pasuk-trace-corpus/latest \
  --skip-existing \
  --verify-existing
```

Repair stale derived artifacts (`trace.txt` / `graph.dot`) from stored `trace.json`:

```bash
npm run pasuk-trace-corpus -- \
  --input=data/torah.json \
  --out-dir=outputs/pasuk-trace-corpus/latest \
  --skip-existing \
  --repair-existing
```

Resume behavior with `--skip-existing`:

- Skip only when provenance validation passes.
- `--verify-existing` fails fast on any mismatch.
- `--repair-existing` rewrites stale `trace.txt`/`graph.dot` from stored `trace.json` without rerunning the interpreter.
- `--verify-existing` and `--repair-existing` are mutually exclusive.

Detailed output contract and UI integration notes:
[`docs/pasuk-trace-corpus.md`](docs/pasuk-trace-corpus.md)

Operational note: `--include-snapshots` can make per-verse JSON files very large; see
`docs/pasuk-trace-corpus.md` for measured sizing guidance and versioning recommendations.

### Torah Normalization Pipeline

For a deterministic canonical Unicode normalization stage (NFD) with explicit verse refs:

```bash
npm run normalize-torah
```

Verify normalized artifact integrity + checksum stability gate:

```bash
npm run normalize-torah:verify
```

Outputs:

- `data/torah.normalized.txt`
- `data/torah.normalized.sha256`
- `reports/normalization_report.md`
- `data/torah.normalized.teamim.txt` (when `--keep-teamim`)
- `data/torah.normalized.teamim.sha256` (when `--keep-teamim`)
- `reports/normalization_teamim_report.md` (when `--keep-teamim`)

Options:

- `--keep-teamim` to build the canonical teamim-preserving artifact set.
- `--strip-teamim` to build the canonical strip-teamim artifact set (default, U+0591-U+05AF).
- Unsupported combining marks fail fast with codepoint + context window.

### Grapheme Signature Token Registry (Observed-Only)

Extract all observed Hebrew grapheme signatures from normalized Torah text and assign stable TokenIDs:

```bash
npm run token-registry -- --input data/torah.normalized.txt
```

Verify deterministic outputs against the same input:

```bash
npm run token-registry:verify -- --input data/torah.normalized.txt
```

Outputs:

- `data/tokens.registry.json`
- `data/tokens.signatures.txt`
- `reports/token_registry_report.md`

Notes:

- Clusters are parsed as `base-letter + zero-or-more combining marks`.
- Supported combining marks are explicit; unsupported combining marks fail loudly with codepoint + context.
- TokenIDs are assigned deterministically by sorted signature order.

### Teamim Registry + Classification (Observed-Only)

Extract observed teamim codepoints from the teamim-preserving normalized corpus and validate coverage against the parser classification table:

```bash
npm run teamim-registry -- --input data/torah.normalized.teamim.txt
```

Verify deterministic outputs:

```bash
npm run teamim-registry:verify -- --input data/torah.normalized.teamim.txt
```

Outputs:

- `data/teamim.registry.json`
- `registry/teamim.classification.json` (normative parser table)
- `reports/teamim_registry_report.md`

Notes:

- Coverage gate fails if any observed teamim lacks classification metadata.
- Primary accent selection is deterministic: disjunctive-first, then conjunctive, with precedence + codepoint tie-break.

### Deterministic Phrase Trees (Per Verse)

Build deterministic binary phrase trees from the teamim-preserving normalized corpus and classification table:

```bash
npm run phrase-tree -- --input data/torah.normalized.teamim.txt --book=Genesis
```

Verify deterministic phrase-tree outputs:

```bash
npm run phrase-tree:verify -- --input data/torah.normalized.teamim.txt --book=Genesis
```

Outputs:

- `corpus/verse_phrase_trees.jsonl`
- `corpus/word_phrase_roles.jsonl`
- `reports/phrase_tree_report.md`

Notes:

- Split rule: strongest disjunctive in-span (precedence desc, codepoint asc, index asc), excluding terminal split positions.
- No-split spans use deterministic left-associative fold (`JOIN`, `fold=LEFT`).
- Every verse is validated for full leaf coverage (no overlap/gap) before write.

### Token Operator Compilation Cache

Compile each TokenID into a deterministic operator bundle with runtime-ready dispatch metadata:

```bash
npm run token-compile -- --registry data/tokens.registry.json
```

Verify deterministic compile artifacts:

```bash
npm run token-compile:verify -- --registry data/tokens.registry.json
```

Outputs:

- `data/tokens.compiled.json`
- `reports/compile_report.md`

Notes:

- Runtime dispatch uses the compiled runtime bundle (`apply(tokenId, state)`) and avoids Unicode mark parsing on the hot path.
- Semantic changes are centralized in `registry/token-semantics.json`; re-running compile regenerates bundles and report diffs.

### Torah Flow Corpus

For a full Torah-wide word corpus with stable grapheme TokenIDs and flow traces:

```bash
npm run build
npm run torah-corpus -- --input data/torah.json --out-dir outputs/torah-corpus/latest --lang=he
```

Artifacts:

- `token_registry.json`: stable `TokenID -> {base, rosh[], toch[], sof[], notes}`.
- `word_flows.skeleton.jsonl`: machine layer (`ref`, `surface`, `tokens`, `events`, `flow_skeleton`).
- `word_flows.one_liner.jsonl`: compiled human layer.
- `word_flows.full.jsonl`: merged row format for tooling.
- `word_phases.jsonl`: phrase-aware word-phase render rows (`Phrase role`, `Clause`, phrase path/IDs).
- `pattern_index.json`: explicit semantic patterns + frequent n-grams.
- `exemplar_library.json`: high-frequency skeleton exemplars.
- `summary.json`: deterministic stats + semantic fingerprints.
- `manifest.json`: deterministic checksums/bytes for review + integrity checks.
- `review_snapshot.json`: compact peer-review surface (top patterns + exemplar preview).

### Corpus Execution (Word Trace Skeletons + Flow Strings)

For the compact per-word execution artifacts (`jsonl` traces + human scan text):

```bash
npm run build
npm run torah-corpus:execute -- --input data/torah.json --lang=he
```

Outputs:

- `corpus/word_traces.jsonl`: one record per word (`ref`, `ref_key`, `surface`, `token_ids`, `skeleton`, `flow`, `semantic_version`).
- `corpus/word_flows.txt`: aligned one-line flow strings (`ref_key<TAB>surface<TAB>flow`).
- `reports/execution_report.md`: coverage, determinism checksum basis, error counts, top skeletons, performance.

### Atomic Event Rendering (Event -> Sentence)

Render canonical trace events into deterministic one-event-per-line atomic sentences:

```bash
npm run build
npm run render:atomic -- --trace corpus/word_traces.jsonl --out outputs/render/atomic
```

Outputs:

- `outputs/render/atomic/atomic_events.txt`: tab-separated anchored lines (`ref_key`, `word_index`, `event_index`, `event_text`).
- `outputs/render/atomic/atomic_events.jsonl`: JSONL rows with `event_text` plus anchors.

### Pattern Index + Query API

Build searchable skeleton/motif indexes from `corpus/word_traces.jsonl`:

```bash
npm run pattern-index -- --input corpus/word_traces.jsonl --index-dir index
```

Core artifacts:

- `index/skeleton_counts.json`: deterministic `skeleton_key -> count` map + checksum.
- `index/skeleton_to_occurrences.bin`: JSON-v1 `skeleton_key -> [occurrence...]` payload + k-gram postings.
- `index/motif_index.json`: motif match precompute by skeleton key.
- `reports/pattern_index_report.md`: top-100 skeletons, motif counts, and build summary.

Query examples:

```bash
npm run pattern-query -- skeleton "GIMEL.BESTOW|TAV.FINALIZE" --index-dir index
npm run pattern-query -- subsequence "GIMEL.BESTOW|TAV.FINALIZE" --index-dir index
npm run pattern-query -- suffix "*.FINALIZE" --index-dir index
npm run pattern-query -- contains "BESTOW" --then "SEAL" --index-dir index
npm run pattern-query -- motif ENDS_WITH_FINALIZE --index-dir index
```

### Exemplar Library (Canonical Examples)

Build a curated, deterministic exemplar set from the corpus trace (optionally informed by pattern index artifacts):

```bash
npm run exemplars -- --trace corpus/word_traces.jsonl --skeleton-counts index/skeleton_counts.json --motif-index index/motif_index.json
```

Verify that exemplar JSON, README rendering, and regression cases remain deterministic and consistent with the trace:

```bash
npm run exemplars:verify -- --trace corpus/word_traces.jsonl
```

Outputs:

- `exemplars/exemplars.json`: canonical structured exemplar records (`id`, `ref`, `surface`, `token_ids`, `skeleton`, `flow`, `semantic_version`, `explanation`, `tags`).
- `exemplars/README.md`: human-friendly grouped catalog by category/tag with flow and skeleton context.
- `tests/exemplar_regression.json`: promoted subset of exemplar goldens for strict skeleton regression checks.

Selection policy highlights:

- top skeleton counts seed high-frequency exemplars,
- motif index contributes motif representatives,
- special marks include mappiq / shin-dot / sin-dot / dagesh,
- boundary + final-form behaviors are explicitly represented,
- every observed operator event in `corpus/word_traces.jsonl` is covered by at least one exemplar.

Integrity check:

```bash
npm run torah-corpus:verify -- --dir outputs/torah-corpus/latest
```

Artifact freshness guard (interpreter + DOT renderer contract):

```bash
npm run artifacts:verify
npm run artifacts:verify:deep
npm run artifacts:repair -- --full
```

`artifacts:verify` compares required manifests against deterministic hashes for the two moving parts:

- `interpreter_inputs_hash`
- `dot_renderer_inputs_hash`

`artifacts:verify:deep` also runs:

- a read-only per-verse provenance scan of `outputs/pasuk-trace-corpus/latest/refs/**` (`trace.json` -> `trace.txt`/`graph.dot` binding, schema checks, canonical graph options hash check)
- a committed-state gate: push fails if engine/artifact paths have local uncommitted changes, so verification reflects exactly what will be pushed

`artifacts:repair -- --full` performs full regeneration and stamps each manifest with:

- `artifact_set_id`
- `interpreter_inputs_hash`
- `dot_renderer_inputs_hash` (for DOT-bearing corpora)
- `pasuk_corpus_args_sha256` (canonical pasuk trace corpus command args)
- `engine_git_sha` (when available)
- `artifact_generated_at`
- `artifact_tool_versions`

Hook/CI behavior:

- `.githooks/pre-commit` runs `artifacts:verify` only when staged paths touch configured engine inputs.
- `.githooks/pre-push` always runs `artifacts:verify:deep` and blocks push on any drift.
- CI always runs `npm run artifacts:verify:deep` on push/PR.

Run-to-run diff + regression (single command):

```bash
npm run torah-corpus:regress -- --run-a corpus/run-A/word_traces.jsonl --run-b corpus/run-B/word_traces.jsonl --update-goldens
```

Outputs:

- `diffs/runA_vs_runB.md`: readable run diff with breaking changes, top skeleton deltas, and semantic/warning context.
- `tests/goldens.json`: curated golden skeleton expectations (`ref`, `surface`, `expected_skeleton`, `notes`).
- `reports/regression_report.md`: exact-match regression results for all goldens (fails command on mismatch).

Notes:

- Omit `--update-goldens` during normal verification to fail loudly on unintended behavior changes.
- Pass `--compiled-a` / `--compiled-b` if each run used different compiled token bundles and you want precise warning deltas.

Legacy diff and regression promotion loop:

```bash
npm run torah-corpus:diff -- --prev outputs/torah-corpus/run-A --next outputs/torah-corpus/run-B --out outputs/torah-corpus/run-B/diff.from-run-A.json
npm run torah-corpus:promote -- --diff outputs/torah-corpus/run-B/diff.from-run-A.json --next outputs/torah-corpus/run-B --out tests/core/07_golden/torah_flow_promoted.json --limit=40
```

Recommended review artifacts to commit when semantics change:

- `outputs/torah-corpus/<run>/token_registry.json`
- `outputs/torah-corpus/<run>/summary.json`
- `outputs/torah-corpus/<run>/manifest.json`
- `outputs/torah-corpus/<run>/review_snapshot.json`
- `outputs/torah-corpus/<run>/diff.from-<prev>.json` (if comparing runs)
- `tests/core/07_golden/torah_flow_promoted.json` (selected regression deltas)

## Determinism & obligations

- **Determinism:** handle IDs are allocated as `<letter>:<tau>:<counter>`; the
  same input and initial state always yield identical IDs and event logs.
- **Obligations:** letters can push `SUPPORT` or `MEM_ZONE` obligations onto
  `OStack_word`, plus a `BOUNDARY` obligation from `ב` closed by `ד`.
  Discharging letters pop the top obligation.
- **Whitespace → `□`:** any whitespace in input is tokenized as `□`, so spaces
  are semantic word boundaries.
- **Shin/Sin disambiguation:** `שׁ` and `שׂ` tokenize distinctly; `שׂ` executes as
  composite `read=ס`, `shape=ש` (read-first, routing-only shape effect).
- **Mappiq vs final he:** `הּ` executes as a full heh declaration and exports a pinned handle.
  Final `...ה` without the dot uses breath/mater tail behavior and does not allocate a new declaration handle.
- **Space boundary (`□`):** on a space token (or end-of-input), `tau` increments
  and any remaining obligations are resolved: `SUPPORT` falls (logging a `fall`
  event and restoring focus), and `MEM_ZONE` closes silently.

## Spaces Are Operators

Whitespace is not just formatting: it compiles to the `□` operator. This means
space inserts a **boundary** that can discharge obligations before the next
letter runs.

Examples:

- `"נ ס"` inserts `□` between letters, so the `SUPPORT` from `נ` falls **before** `ס`.
- `"נס"` keeps them in the same word, so `ס` can discharge the support.

## Spec & registry

- Spec overview: `spec/00-OVERVIEW.md`
- Machine truth: `registry/`

## Notes

See `impl/reference/STATUS.md` for what is implemented versus stubbed.
