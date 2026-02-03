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

## Notes

This profile is intended for intuition and pedagogy. Any classroom-specific semantics for letters should be described here or in `/examples/`, not in `/spec/`.
