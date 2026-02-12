# ADR-0001: TypeScript Source of Truth; `.mjs` Wrappers Only

- Status: Accepted
- Date: 2026-02-12
- Owner: Owner A (Engineering Lead)

## Context

The repository currently mixes TypeScript (`impl/reference/src`) and large `.mjs`
script files in `scripts/`.

This creates avoidable risk:

- inconsistent type safety across core behaviors,
- harder static analysis and code review,
- unclear boundaries between stable domain logic and CLI entrypoint glue.

Sprint 1 requires a policy decision that unifies implementation direction while
keeping existing pipelines running.

## Decision

1. TypeScript is the only language for new or changed business/domain logic.
2. `.mjs` files are allowed only as thin entrypoint wrappers.
3. A valid wrapper may do only minimal orchestration:
   - parse and forward CLI args/options,
   - call a TS module entrypoint,
   - map result to process exit code/logging.
4. New `.mjs` business logic is disallowed.
5. Existing `.mjs` business logic is treated as legacy and migrated incrementally
   by sprint plan; touched files should reduce `.mjs` logic instead of adding it.

## Scope

This policy applies to:

- `scripts/` and other executable tooling entrypoints,
- pipeline logic that produces corpus/index/report/test artifacts,
- shared runtime modules consumed by CLI workflows.

## Enforcement Plan

- Sprint 1: document policy + add PR checklist + introduce CI/lint guardrails in
  warn mode.
- Sprint 3: move `.mjs` rule and related guardrails to fail mode for new/touched
  files.

## Exceptions

Short-term exceptions are allowed only when all are true:

- the change is a production-blocking fix,
- no safe TS module extraction can be completed in time,
- follow-up migration task is created in the same PR.

Exceptions require explicit Owner A approval in the PR description.

## Consequences

- Positive: clearer architecture, safer refactors, and stronger static checks.
- Transitional cost: legacy `.mjs` scripts need staged extraction into TS modules.
