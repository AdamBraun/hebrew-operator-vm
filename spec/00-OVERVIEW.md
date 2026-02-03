# Overview

This directory defines the normative, domain-agnostic specification of the Hebrew operator calculus.

## Document map

- `01-MISSION.md`: purpose, scope boundaries, invariants, and non-goals.
- `10-LEXICAL.md`: alphabet, tokenization, attachments, and parsing rules.
- `20-STATE-INTERFACE.md`: abstract state interface required by any profile.
- `30-PHASES.md`: Select/Bound/Seal contracts and modifier tiers.
- `40-PRIMITIVES.md`: the only primitive subroutines (`Y`, `V`) and factorization rules.
- `50-MODIFIER-SYSTEM.md`: modifier typing, attachment tiers, and guarantees.
- `60-VM.md`: execution model, registers, stacks, space semantics, obligations.
- `70-DETERMINISM.md`: canonical ordering and replay guarantees.
- `80-CONFORMANCE.md`: compliance levels and required tests.

## Stability policy

- **Stable (normative):** everything under `/spec/` and the machine truth in `/registry/`.
- **Stable with explicit caveats:** `/letters/` and `/modifiers/` once declared in `/registry/`.
- **Experimental / non-normative:** `/theory/`, `/examples/`.
- **Optional, profile-specific:** `/profiles/*`.

Any implementation that claims conformance MUST implement `/spec/` and `/registry/` as written, and MUST declare the highest conformance level it satisfies (see `80-CONFORMANCE.md`).
