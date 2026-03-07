# State Interface

This defines the **minimum abstract interface** a profile must implement. It is domain-agnostic and uses opaque handle IDs.

## Handle kinds (minimum set)

Profiles MUST provide these handle kinds (or exact equivalents):

- `ScopeHandle`: an addressable scope/region.
- `AliasHandle`: declares transport/identity or equivalence between handles.
- `RuleHandle`: persistent constraints or patches applied to scopes.
- `ArtifactHandle`: finalized, non-editable output objects.
- `EmptyHandle` (⊥): canonical empty/absent handle.

Profiles MAY define additional kinds, but letter signatures MUST declare which kinds they accept/produce.

## Required relations / traits

Implementations MUST support these abstract relations or traits, independent of any world semantics:

- **Scope relation:** a containment/association relation between handles and scopes.
- **Boundary relation (optional but recommended):** a separation relation for inside/outside traversal when a profile models partitions or gates.
- **Ports (optional):** profiles MAY expose interface projections or attachment points, but no fixed tri-port schema is required.
- **Policies:** edit policies `{soft, framed_lock, final}`.
- Policy semantics (minimum): `framed_lock` blocks frame rewrites but allows interior edits; `final` blocks all mutation. Profiles MAY refine this but MUST preserve the ordering `soft → framed_lock → final`.
- **Coupling / edit permissions:** traits that gate how patches flow (context flow, data flow, edit flow).
- **Link relation:** labeled directed links between handles.
- **Continuation relation (optional but recommended):** for ordered progression handles.
- **Edge modes:** metadata for behavior classes (e.g., `gated`, `stabilized`, `convergent`, `committed`, `bundled`, `collapsed`).
- **Head hints:** optional metadata that can bias selection without overriding graph relations.
- **Cascade rules (optional but recommended):** a persistent rule set `Φ`, where each rule is `(target, bound, priority)`. Profiles may name this differently but must expose deterministic lookup/update if used by letter semantics.

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
