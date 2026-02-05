# Classroom Profile (optional)

This profile provides a pedagogical, concrete instantiation of the abstract state interface. It is **not** required by the core spec and MUST NOT be referenced by `/spec/` or `/letters/`.

## World objects

- **Students** (`U`)
- **Groups** (`G`, each `g ⊂ U`)
- **Class** (`C = U`)
- **Tokens/labels** (`L`): properties like “leader”, “quiet”, etc.

## Handle mapping

- `ScopeHandle(scope_id, ...)` → class, group, or student scopes
- `BoundaryHandle(boundary_id, inside, outside, a, ...)` → classroom partitions
- `AliasHandle(alias_id, h1, h2, transports, ...)` → identity/transport across views
- `RuleHandle(rule_id, target_scope, patch, priority, ...)` → classroom rules/constraints
- `ArtifactHandle(artifact_id, payload, policy=final, ...)` → finalized outputs
- `EmptyHandle(⊥)` → canonical empty scope

## Relations / facts

- Equality (`=`) on entities
- Indistinguishability (`≈`) on entities
- Membership (`∈`) between students and groups
- Labeled links (`E`) between entities
- Continuation links (`E_cont`) with reachability `≤cont*`
- Boundaries (`B`) with anchor bit `a ∈ {0,1}`
- Policies (`soft`, `framed_lock`, `final`)
- Edge modes (`free`, `gated`, `stabilized`, `convergent`, `committed`, `bundled`, `collapsed`)
- Head hints (`anchored`, `unanchored`, `none`)

## Typing constraints (profile view)

- Membership (`∈`) only applies between `EntityHandle` and `ScopeHandle`.
- Head constructors consume `ScopeHandle` and produce `BoundaryHandle`.
- Letters declare input/output handle kinds and must respect them.
- Each letter declares `(in_types_req, in_types_opt, out_type)` and a finite list of allowed coercions; if no coercion exists, mismatched kinds are a compile error.

## Cascade layer (Φ)

- A set of rules `Φ`, each rule is `(target, bound, priority)`.
- These rules are part of the classroom profile’s persistent constraints and are consulted by letter semantics that reference cascade behavior.

## Execution context (profile additions)

This profile uses the core VM registers defined in `spec/60-VM.md` and adds:

- `λ ∈ {student, group, class}`: the current level of focus.
- `H`: event log (used for sealing and boundary events).

Derived predicates (no new handle metadata):

- `is_bent(h) := exists o in OStack_word with o.kind=SUPPORT and o.child <=cont* h`
- `is_open_mem(z) := exists o in OStack_word with o.kind=MEM_ZONE and o.child == z`

Initial state can be “infinite possibilities” by taking `Φ = ⊤` (no bounds), `F = C`, and leaving entities unnamed until instantiated/refined.

## Notes

This profile is intended for intuition and pedagogy. Any classroom-specific semantics for letters should be described here or in `/examples/`, not in `/spec/`.
