# Maintenance Closeout Audit + Debt Register

- generated_at_utc: 2026-02-12T22:00:00Z
- scope: Sprint 1-3 maintenance plan (`.codex/maintenance-plan.md`)

## P0 Closeout Summary

- `S1`: complete
  - TS policy published and linked in ADR/README/PR template.
  - guardrails and `.mjs` policy introduced.
  - schema adapter added for `semantic_version`/`semantics_version` read compatibility.
- `S2`: complete
  - `torah-corpus` modularized into TS runtime modules.
  - parity test suite for `execute`/`diff`/`regress` in place.
  - file-size guardrail baseline regenerated with no new violations.
- `S3`: complete for P0 scope
  - guardrails moved to fail mode for new/touched violations.
  - `.mjs` policy moved to fail mode with wrapper exception.
  - internal torah-corpus schema usage normalized to `semantics_version`/`semantics_versions`, while compatibility read path still accepts legacy `semantic_version`.

## Non-P0 Debt Register

| ID | Debt Item | Scope | Owner | Due Date | Tracking |
|---|---|---|---|---|---|
| D-001 | Migrate legacy `.mjs` business-logic scripts to TS modules + thin wrappers | `scripts/compile-token-operators.mjs`, `scripts/extract-token-registry.mjs`, `scripts/pattern-index.mjs`, `scripts/exemplar-library.mjs` | Owner C | 2026-04-24 | keep `config/mjs-policy-allowlist.json` shrinking each PR; `scripts/download-torah.mjs`, `scripts/iterate-torah.mjs`, and `scripts/normalize-torah.mjs` completed on 2026-02-12 |
| D-002 | Remove remaining max-bytes allowlist exceptions via modularization | `scripts/pattern-index.mjs`, `scripts/exemplar-library.mjs` | Owner B + Owner C | 2026-04-10 | monitor `reports/ci_guardrails_baseline.md` until allowlist empty |
| D-003 | Consolidate downstream artifact naming around `semantics_version` where contract-compatible | non-trace report/index/exemplar payload keys | Owner A + Owner C | 2026-05-08 | staged contract review + migration notes in ADR follow-up |
| D-004 | Remove `@ts-nocheck` from torah-corpus runtime modules after type hardening | `impl/reference/src/scripts/torahCorpus/runtime*.ts` | Owner D | 2026-05-22 | add strict type tests + incremental lint gates |
| D-005 | Add CI assertion that wrapper allowlist only contains true wrappers | `.mjs` policy workflow + allowlist hygiene | Owner B | 2026-03-27 | fail when wrapper allowlist entry exceeds wrapper heuristics |

## Exit Criteria For Debt Burn-Down

- `config/mjs-policy-allowlist.json` `legacy_business_logic` reduced to `0`.
- `config/guardrails-allowlist.json` reduced to `0` entries.
- no new internal usage of legacy `semantic_version` field naming outside compatibility readers.
- all debt items either closed or rebaselined with explicit owner/date updates.
