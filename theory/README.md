# theory/README.md

## Purpose

This directory contains metatheory for the calculus: formal semantics, equivalence notions, and proof work that explains what the system _is_ beyond an operational interpreter.

Everything here is **non-normative** unless explicitly promoted into `/spec/` with corresponding conformance tests.

## Scope boundaries

Included:

- Denotational / axiomatic semantics candidates for the language defined in `/spec/`.
- Equivalence relations (observational equivalence, bisimulation, contextual equivalence).
- Confluence / Church–Rosser results or explicit non-confluence analyses (critical pairs).
- Normal-form theorems for the `{Y,V}` primitive basis (factorization correctness, uniqueness conditions).
- Determinism theorems tied to `/spec/70-DETERMINISM.md`.
- Type-soundness style properties if a static layer exists (progress/preservation analogs).
- Complexity bounds (cost models for VM steps, modifier application, merges).

Excluded:

- World-specific reasoning about `/profiles/*` unless the result is stated abstractly and parameterized over the state interface.
- Any new runtime behavior not already defined in `/spec/`.
- Pedagogical explanations (belongs in `/examples/`).

## Dependency rule

All statements must be phrased against:

- `/spec/*` (language + VM + determinism contracts)
- `/spec/20-STATE-INTERFACE.md` (abstract world interface)

A proof may assume a _profile_ only as an example or counterexample, but the theorem statement must remain interface-parameterized unless explicitly labeled “Profile-only”.

## Directory map

- `README.md` — this file.
- `semantics/` — denotational and axiomatic semantics candidates.
- `equivalence/` — definitions and lemmas for “same meaning”.
- `rewriting/` — confluence, critical pairs, normalization, canonicalization.
- `properties/` — determinism, invariants, soundness-like results.
- `cost/` — step-count models, asymptotic bounds, resource analysis.
- `notes/` — scratch work and abandoned directions (clearly marked).

## Promotion process (non-normative → normative)

A result may be promoted into `/spec/` only if all are true:

1. The statement is expressed purely in terms of `/spec/*` and the abstract state interface.
2. The proof assumptions are explicit and checkable.
3. A corresponding conformance test exists in `/tests/core/` (or a static checker rule exists in `/impl/tools/`).
4. Promotion does not introduce profile-dependent semantics.

## Current research agenda

### A. Semantics

Goal: define a semantics that composes cleanly with `Select/Bound/Seal` and with token modifiers.

Targets:

- A denotational semantics `⟦w⟧ : 𝕊 → 𝕊` consistent with the VM trace semantics.
- A notion of “effect” that isolates where nondeterminism could enter and rules it out by construction.

Deliverables:

- `semantics/trace.md`: operational trace semantics extracted from `/spec/60-VM.md`.
- `semantics/denotational.md`: a candidate denotation and a simulation theorem (VM refines denotation).

### B. Determinism

Goal: prove determinism given the canonicalization rules in `/spec/70-DETERMINISM.md`.

Deliverables:

- `properties/determinism.md`: theorem + proof sketch + list of required canonical tie-breakers.
- `properties/id-stability.md`: handle/ID allocation invariants.

### C. Rewriting / confluence

Goal: either prove confluence (or Church–Rosser modulo defined equivalences) or explicitly classify the non-confluent critical pairs.

Deliverables:

- `rewriting/critical-pairs.md`: enumeration, minimal counterexamples, and whether they are ruled out by spec constraints.
- `rewriting/church-rosser-modulo.md`: if applicable, define the “modulo” relation (e.g., GC equivalence).

### D. Primitive basis theorems

Goal: formalize when “letters are programs over `{Y,V}`” is merely a compilation target vs a semantic normal form.

Deliverables:

- `rewriting/yv-factorization.md`: compilation correctness; optional uniqueness conditions under constraints on `Δ`.

### E. Cost model

Goal: make performance claims meaningful and comparable across profiles.

Deliverables:

- `cost/step-model.md`: define the unit-cost model (VM steps, merge cost, modifier dispatch).
- `cost/bounds.md`: derive bounds for typical word shapes and letter classes.

## Conventions

- Every document must begin with:
  - Status: `draft | stable | abandoned`
  - Assumptions
  - Theorem statements (if any)
  - Proof sketch or full proof

- All symbols should match `/spec/` notation (do not invent parallel notation).
- Counterexamples must include a minimal program and the exact trace or state delta.

## How to use this directory

- If implementing: ignore this directory unless a theorem has been promoted into `/spec/` and `/tests/` references it.
- If extending the language: update `/spec/` first, then revisit proofs that mention the changed modules.
- If proving: start from the trace semantics and determinism contract; do not reason from examples.

## Status

The repository treats `/theory/` as a laboratory: high value, high churn, no effect on conformance until promotion.
