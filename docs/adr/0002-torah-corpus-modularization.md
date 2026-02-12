# ADR-0002: `torah-corpus` Modularization Contract (Sprint 2)

- Status: Accepted
- Date: 2026-02-12
- Owner: Owner A (Engineering Lead)

## Context

`scripts/torah-corpus.mjs` currently contains a large amount of mixed CLI and
domain logic in a single legacy file.

Sprint 2 requires migration toward the language policy in ADR-0001, with a
focus on reducing blast radius during changes and enabling parity testing.

## Decision

1. `torah-corpus` logic will be split into TypeScript modules with the
   following command-aligned boundaries:
   - `args`: parse/validate CLI flags and defaults.
   - `execute`: corpus execution pipeline and output emission.
   - `diff`: run comparison and diff-report generation.
   - `regress`: regression verdicting, golden loading/updating, and summaries.
   - `report`: shared deterministic report rendering helpers.
2. `scripts/torah-corpus.mjs` remains only as a thin Node entrypoint wrapper.
3. The wrapper may only:
   - accept argv and delegate to a TS entrypoint,
   - map returned status to exit code and top-level logging,
   - avoid domain/business rules.
4. Migration must preserve CLI behavior and artifact determinism for
   `execute`, `diff`, and `regress`.
5. Parity coverage is required before any legacy branch removal.

## Module Contract

- Domain types and reusable helpers belong in TS modules, not in the wrapper.
- Commands must expose explicit typed entrypoints to keep tests focused:
  - `runExecute(options)`
  - `runDiff(options)`
  - `runRegress(options)`
- Shared formatting and fingerprint/report helpers must not duplicate logic
  across command modules.

## Migration Rules

1. Extract by stable seams (args/report helpers first, command bodies next).
2. Keep output file names, summary text fields, and checksum behavior unchanged
   unless the change is explicitly approved and tested.
3. Add/extend pipeline tests to prove old vs new output parity for touched
   command paths.

## Non-Goals (Sprint 2)

- No semantic behavior change to operator execution.
- No schema naming migration beyond existing adapter compatibility.
- No fail-mode CI enforcement changes (scheduled for Sprint 3).

## Consequences

- Positive: clearer ownership boundaries, safer refactors, easier parity checks.
- Cost: temporary duplication during extraction and stricter review overhead
  while wrapper and TS modules coexist.
