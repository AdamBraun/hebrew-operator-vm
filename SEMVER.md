# Versioning Contract

## Scope

This project uses three independent versions:

- `trace_version`: compatibility of the canonical trace schema and field semantics.
- `semantics_version`: operator semantics + compiled token bundle identity basis.
- `render_version`: human-language rendering rules (flow strings, labels, report wording, templates).

Source of truth: `/Users/adambraun/projects/letters/impl/reference/src/version.ts`.

## Contract

- `trace_version`
  - Bump `MAJOR` for breaking schema/meaning changes.
  - Bump `MINOR` for backward-compatible schema additions.
  - Bump `PATCH` for non-breaking corrections.
- `semantics_version`
  - Bump whenever operator behavior changes.
  - The value MUST match `registry/token-semantics.json` `semver`.
  - Compiled bundle identity is pinned by `definitions_sha256` in compiled artifacts.
- `render_version`
  - Bump when renderer-only behavior changes (templates/lexicon/report phrasing/layout).
  - Renderer changes MUST NOT be used as semantic equality basis.

## Artifact Requirements

Every artifact family must carry version metadata:

- Compiled bundles: `version_contract` + `semantics.definitions_sha256`.
- Trace records: `trace_version`, `semantics_version`, `render_version`.
- Render outputs: include trace/semantic/render versions in report/index metadata.
- Manifests: include `version_contract` and semantic identity fields.

## CI Enforcement

`npm run ci:version-contract` enforces required bumps by changed files:

- If `registry/token-semantics.json` changes, `semantics_version` must increase.
- If `registry/teamim.classification.json` changes, `semantics_version` must increase.
- If any `render/` file changes, `render_version` must increase.
- If `spec/70-TRACE-FORMAT.schema.json` changes, `trace_version` must increase.

Script path: `/Users/adambraun/projects/letters/scripts/check-version-contract.cjs`.
