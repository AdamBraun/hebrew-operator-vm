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

Guardrail commands (warn mode):

```bash
npm run ci:guardrails
npm run ci:mjs-policy
```

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

Options:

- `--keep-teamim` to keep cantillation marks.
- `--strip-teamim` to explicitly strip cantillation marks (default, U+0591-U+05AF).

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
