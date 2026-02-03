# State Interface

This defines the **minimum abstract interface** a profile must implement. It is domain-agnostic and uses opaque handle IDs.

## Handle kinds (minimum set)

Profiles MUST provide these handle kinds (or exact equivalents):

- `ScopeHandle`: an addressable scope/region.
- `BoundaryHandle`: a separable inside/outside interface for scopes.
- `AliasHandle`: declares transport/identity or equivalence between handles.
- `RuleHandle`: persistent constraints or patches applied to scopes.
- `ArtifactHandle`: finalized, non-editable output objects.
- `EmptyHandle` (⊥): canonical empty/absent handle.

Profiles MAY define additional kinds, but letter signatures MUST declare which kinds they accept/produce.

## Required relations / traits

Implementations MUST support these abstract relations or traits, independent of any world semantics:

- **Scope relation:** a containment/association relation between handles and scopes.
- **Boundary relation:** a separation relation for inside/outside traversal.
- **Ports:** each boundary or interface handle exposes deterministic ports (`L`, `C`, `R` at minimum).
- **Policies:** edit policies `{soft, framed_lock, final}`.
- **Anchoring:** a boolean anchor bit `a ∈ {0,1}` (anchored vs unanchored).
- **Coupling / edit permissions:** traits that gate how patches flow (context flow, data flow, edit flow).
- **Link relation:** labeled directed links between handles.
- **Continuation relation (optional but recommended):** for ordered progression handles.
- **Edge modes:** metadata for behavior classes (e.g., `gated`, `stabilized`, `convergent`, `committed`, `bundled`, `collapsed`).
- **Head hints:** optional metadata that can bias selection without overriding anchoring.

## Required operations

Profiles MUST implement the following abstract operations with deterministic behavior:

- `allocate(kind, traits) -> handle_id`
- `link(src, dst, label, traits?) -> link_id`
- `seal(handle_id, traits?) -> handle_id` (commits a construction as addressable)
- `merge(h1, h2, mode) -> AliasHandle` (identity or transport)
- `project(handle_id, projection_spec) -> handle_id` (derive a view)
- `export(handle_id) -> ArtifactHandle` (finalized output)

## Permissions / mutations

- Only `Bound` may mutate envelope traits (policies, coupling, ports).
- Only `Seal` may allocate new handles or finalize artifacts.
- Modifiers MAY adjust traits within their tier’s allowed surface, but MUST NOT introduce new primitives.
