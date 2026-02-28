# Continual Mode Semantics

## Status

Normative for the implemented continual behavior in:

- `impl/reference/src/runtime/carryState.ts`
- `impl/reference/src/scripts/torahCorpus/runtimeCommands.ts`
- `impl/reference/src/scripts/runVerseRange/runtime.ts`

This document describes only behavior that exists in code/tests (tasks 1-10 scope).

## Carry State Contract

Carry is an explicit ID-only object:

```ts
type CarryState = {
  omegaHandleId?: string;
  focusHandleId?: string;
  domainHandleId?: string;
  pinnedHandleIds?: string[];
};
```

Rules:

- IDs are handle IDs, never object references.
- `extractCarryState(state, mode)` returns only mode-allowed fields.
- `applyCarryState(state, carry)` applies only provided fields.
- In `reset` mode, extracted carry is `{}`.

## Lifecycle Hooks and Ordering

For multi-verse execution, the loop order is:

1. `onVerseStart(ref, state, mode, carryState)`
2. execute verse
3. `onVerseEnd(ref, state, mode)` or `onVerseEndDetailed(...)`
4. assign returned `carryState` to next loop iteration

The carry object is loop-local (not global singleton state).

## Boundary Finalization (Ω handle)

`finalizeVerseScope(state, ref)` runs at verse end in all modes.

Behavior:

1. Create/reuse verse boundary handle ID `Ωv:<refSlug>` where `refSlug` is sanitized `Book/Chapter/Verse` (fallback `Ωv:tau:<tau>` if ref is empty).
2. Handle kind is `boundary` with metadata `verse_scope: 1` (and `ref` when available).
3. Link produced handles to boundary via `member_of` links.
   - Produced handles are handles created since `onVerseStart` mark.
   - Excludes `⊥`, root `Ω`, and the boundary handle itself.
4. Set `state.Omega` to boundary ID.
5. Set `state.vm.wordEntryFocus` to boundary ID.

Determinism note:

- For normal execution with explicit refs, boundary IDs are deterministic per ref.
- If an ID collision exists with a non-verse-scope handle, `:<n>` suffix is added.

## Cleanup Policy at Verse Boundary

Cleanup runs only when mode is not `reset`.

Roots:

- Always include `Ω` and `⊥`.
- Plus carry roots when present: `omegaHandleId`, `focusHandleId`, `domainHandleId`, `pinnedHandleIds`.

Reachability graph (undirected BFS) includes:

- `links` edges (current implementation treats all labels as semantic).
- `boundaries` (`id`, `inside`, `outside`).
- `cont` edges parsed from `from->to`.
- `vm.aliasEdges`.
- `rules` (`id` to `target`).

Drop policy:

- Drop all unreachable handles.
- Drop all `memZone` handles explicitly, even if reachable.
- Remove incident links/boundaries/rules/alias edges/`cont` edges referencing dropped handles.
- Repair VM references (fallback to roots/`Ω`/`⊥` as needed).

Return value:

- `{ keptCount, droppedCount }`.

## Modes and Exact Behavior

Supported modes:

- `reset` (default)
- `carry_omega`
- `carry_omega_focus`
- `carry_omega_focus_domain`

Per mode:

1. `reset`
   - Carry in/out: none (`{}`).
   - `onVerseStart`: no carry apply.
   - `onVerseEnd`: still finalizes verse scope in local verse state.
   - Cleanup: skipped.
   - Verse boundary carry trace block: omitted.

2. `carry_omega`
   - Carry out: `omegaHandleId` (+ `pinnedHandleIds` if any pinned exist).
   - Carry in: apply omega (+ pinned restoration).
   - Cleanup roots include omega/pinned (plus always `Ω`,`⊥`).

3. `carry_omega_focus`
   - `carry_omega` behavior plus `focusHandleId`.
   - `domainHandleId` is not carried.

4. `carry_omega_focus_domain`
   - `carry_omega_focus` behavior plus `domainHandleId`.

## Pinned Handles (Current Rule)

Pinned API:

- `pinHandle(id)`
- `isPinned(id)`
- `listPinned()`

Current promotion rule:

- `י` (`yodOp`) pins the produced seed handle during `seal`.

Carry behavior:

- In non-reset modes, extracted carry includes `pinnedHandleIds` when non-empty.
- `applyCarryState` re-pins incoming IDs.

## Missing Handle Fallback Policy

Current implementation uses safe fallback (not strict failure):

- If carried omega/focus/domain/pinned ID is absent in the target state, a placeholder handle is created.
- Placeholder metadata marks fallback origin (`carry_placeholder`, `carry_focus_fallback`, `carry_domain_fallback`).

## Verse Trace Boundary Instrumentation

In continual modes, each verse trace row may include optional `verseBoundary`:

```json
{
  "verseBoundary": {
    "mode": "carry_omega_focus",
    "end": {
      "omega": "Ωv:Genesis_1_1",
      "focus": "H77",
      "domain": "H5",
      "pinned": ["H12", "H13"],
      "pinnedCount": 2,
      "keptCount": 140,
      "droppedCount": 620
    },
    "startNext": {
      "omega": "Ωv:Genesis_1_1",
      "focus": "H77",
      "domain": null
    }
  }
}
```

Notes:

- `pinned` list is capped (currently first 12 IDs), `pinnedCount` is full count.
- IDs are validated against handle registry before emission.
- Canonicalization sorts `end.pinned` and normalizes missing node refs to `null`.
- In `reset` mode, `verseBoundary` is not emitted.

## Tiny End/Start Example

Given mode `carry_omega_focus`:

1. Verse `Genesis/1/1` end:
   - `end.omega = "Ωv:Genesis_1_1"`
   - `end.focus = "h:42"`
   - extracted carry: `{ omegaHandleId: "Ωv:Genesis_1_1", focusHandleId: "h:42" }`
2. Verse `Genesis/1/2` start:
   - `state.Omega` restored to `"Ωv:Genesis_1_1"`
   - `state.vm.F` restored to `"h:42"`
   - `state.vm.D` unchanged by carry in this mode

## Known Limitations

- Availability does not imply reference:
  carried IDs can be materialized as placeholders, so existence in the registry does not guarantee semantic linkage/history.
- Cleanup semantic edges are broad (`links` labels currently wildcarded), which may retain more than a narrower typed-edge policy.
- Pinned promotion is intentionally minimal (`י` output only); richer promotion/demotion logic is not implemented.
- `reset` still finalizes local verse Ω at end, but it is not propagated because carry/cleanup/trace are disabled in this mode.
