# Graphworld Profile (recommended canonical)

A minimal, cold instantiation for determinism and proofs. State is a typed graph with explicit scopes, boundaries, and policies.

## State model

- Nodes: handles (typed)
- Edges: labeled relations (links, containment, continuation)
- Traits: policies, anchoring, ports, coupling, edit permissions

## Mapping from abstract interface

- `allocate(kind, traits)` → create typed node with traits
- `link(src, dst, label, traits)` → create labeled edge
- `seal(handle, traits)` → mark node as committed (immutable traits may be enforced)
- `merge(h1, h2, mode)` → create `AliasHandle` node + transport edges
- `project(handle, spec)` → create derived view node with deterministic projection edges
- `export(handle)` → create `ArtifactHandle` node and mark `policy=final`

## Determinism

All traversals and serializations use canonical ordering (sorted node IDs, sorted edge labels, stable tie-breaks). This profile is the canonical target for reference interpreter tests.
