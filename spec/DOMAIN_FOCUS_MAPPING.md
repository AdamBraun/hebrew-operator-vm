# Domain/Focus Mapping

## Invariant

- `D` is the carry-domain register.
- `F` is the execution focus register.
- Letter/operator execution MUST NOT mutate `D`.
- `D` may be updated only by boundary/cantillation transition logic.

## Allowed Domain Writers

- Boundary transition handler for `□cut`, `□glue`, and `□glue_maqqef` (centralized in [`src/reference/vm/domainTransition.ts`](/Users/adambraun/projects/letters/src/reference/vm/domainTransition.ts)).
- Trope-aware boundary policy used by the same transition handler.

## Disallowed Domain Writers

- All letter/operator implementations (`Select`, `Bound`, `Seal` rails).
- Any operator helper invoked from letter execution paths.

## Runtime Enforcement

- In non-production builds, runtime captures `D` at operator entry and asserts it is unchanged at operator exit.
- Violations throw a `RuntimeError` with a domain-invariant message.

## Notes

- Operators may still read `D` as attachment context (for example endpoint/domain fallbacks).
- Operators continue to update `F` via normal Seal commit.
- Lifecycle repair (for example verse reset/GC safety) remains outside operator semantics.

## Regression Coverage

- [`tests/core/02_vm/vm.domain-focus-mapping.test.ts`](/Users/adambraun/projects/letters/tests/core/02_vm/vm.domain-focus-mapping.test.ts) verifies:
  - every registered operator preserves `D`,
  - only boundary transitions can account for `D` movement in traces,
  - runtime enforcement throws when an operator mutates `D`.
