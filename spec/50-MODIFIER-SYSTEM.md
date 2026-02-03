# Modifier System

Modifiers are phase-typed attachments to base letters. They are **not** standalone letters and do **not** introduce new primitives.

## Attachment typing

Each modifier belongs to exactly one tier:

- `δ_rosh` (rosh/above): transforms selection outputs.
- `δ_toch` (toch/inside): transforms bound constructions.
- `δ_sof` (sof/below): transforms sealed handles.

## Inside-dot disambiguation

Inside-dot features (e.g., `dagesh`, `shuruk`, `shin_dot_right/left`) are **token features**, not standalone modifiers. They dispatch to specific tiered behaviors as defined in `/modifiers/` and `/registry/modifiers.yaml`.

## Guarantees and constraints

- Modifiers do **not** introduce new primitives.
- `δ_rosh` may only alter selection preferences or ordering.
- `δ_toch` may only alter envelope traits or construction metadata.
- `δ_sof` may allocate a new handle **only** if its output type is declared in the modifier’s registry entry; otherwise it must preserve the input handle kind.

## Inventory

The complete modifier inventory, micro-graphs, and behavior classes live in `/modifiers/` and are indexed in `/registry/modifiers.yaml`.
