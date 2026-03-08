# Hold Family Note: כ, ל, מ, ם

This note records the current working candidate for a unary hold-family in the Hebrew-operator VM. It assumes a current focus `F`, backward-visible context, and an open-enclosure stack for interiors that have been entered but not yet sealed.

## Proposed primitives

### כ — `hold`

Create a hold anchored at the current focus and make that hold the new focus. This is the unsplit base case: execution does not continue to an exterior or interior continuation site.

```text
H := Hold(F)
F := H
```

### ל — `hold_then_continue_outside`

Create the same hold, then move the thread to a continuation position outside the hold. The hold remains available in backward context, so the thread has moved beyond it rather than discarding it.

```text
H := Hold(F)
X := Outside(H)
BackwardContext(X) includes H
F := X
```

### מ — `hold_then_continue_inside_open`

Create the same hold, open an interior relative to that hold, and move the thread into that interior. The interior remains open until a later `ם` seals it.

```text
H := Hold(F)
I := Inside(H, open=1)
push OpenInterior(H, I)
F := I
```

### ם — `seal_interior`

Close the nearest still-open interior created by `מ`. The current best candidate is that the close yields a sealed enclosure handle and focus lands on that sealed result.

```text
(H, I) := pop nearest OpenInterior
S := SealInterior(H, I)
F := S
```

## Family relation

`כ` is the base operator of the family: it performs the hold without choosing a continuation direction. `ל` and `מ` reuse that same hold and differ only in where execution continues after the hold is formed. `ל` continues on the outside face of the hold, with the hold retained behind the thread as backward-visible context. `מ` continues on the inside face of an open enclosure relative to the hold, which introduces a pending close. `ם` is therefore not another variant of hold; it is the matching closure operator for the interior path opened by `מ`.

## Established / Approximate / Open

**Established**

- The family is unary and focus-relative.
- `כ` is the unsplit base hold.
- `ל` and `מ` are modifications of that same hold, not separate unrelated primitives.
- `ל` routes continuation outside the hold.
- `מ` routes continuation inside an open enclosure.
- `ם` closes the interior opened by `מ`.

**Approximate**

- `Hold`, `Outside`, `Inside`, and `SealInterior` are working VM primitives, not yet final runtime object shapes.
- The hold retained by `ל` is definitely backward-visible, but its exact representation is still provisional.
- The current best candidate for `ם` is to export a sealed enclosure handle and place focus on it.

**Open**

- The exact runtime shape of a hold: boundary handle, frame object, or another dedicated enclosure record.
- Whether `ל` needs an explicit outside node or only a focus relocation relative to the hold boundary.
- Whether `מ` should record only an open-enclosure obligation or also materialize a first-class interior cursor.
- The exact fallback behavior of `ם` when no matching open interior exists.

## What remains unresolved

- A canonical state representation for the hold itself.
- Deterministic nesting and stack discipline for repeated `מ ... ם` sequences.
- The final export and focus policy after `ם`.
- Trace-level event names and conformance tests once this family is promoted from working note to spec text.
