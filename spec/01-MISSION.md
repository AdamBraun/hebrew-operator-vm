# Mission (non-normative)

Define the Hebrew alphabet (including space) as a deterministic operator calculus over an abstract state interface.

## Purpose and scope

- Provide a **deterministic**, **compositional** execution model for letter operators.
- Separate the **language spec** from any concrete world by requiring a minimal abstract state interface.
- Ensure a finite, explicit primitive basis for all letters and modifiers.
- Treat **space** as a runtime step and boundary operator.

## Invariants (must hold)

- **Determinism:** same input program + same initial state => same final state and event log.
- **Compositionality:** each token executes via `Select → Bound → Seal` with no hidden phases.
- **Finite primitives:** letters and modifiers must reduce to `{Y,V}` plus placement map `Δ`.
- **Space is a runtime step:** whitespace is semantic and produces a boundary operator.

## Non-goals

- No “meaning” or theology in the spec.
- No Hebrew linguistics or philology.
- No pedagogy or classroom metaphors.
- No profile-specific objects or concrete-world assumptions.
