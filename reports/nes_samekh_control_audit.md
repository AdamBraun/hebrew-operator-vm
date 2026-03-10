# Nes Samekh Control Audit

## Cursor Audit Scope

- dataset_status: `stable-only`
- stable allowlist: `ד ה ו ז ח י כ ל מ נ ס ע צ ק ר ש ך ם ן ץ`
- stale exclusions: families `א ב ג פ ת`; affected glyphs `א ב ג פ ף ת`
- graph-incomplete exclusions: families `ט`; affected glyphs `ט`

## Goal

Confirm that the known backward-anchor consumer behaves correctly, so any failure in other tests is not due to missing trace instrumentation.

Target word:

- `נֵס`

Preferred source verse:

- Numbers 21:8 — `עֲשֵׂה לְךָ שָׂרָף וְשִׂים אֹתוֹ עַל־נֵס`

## Hypothesis

The control passes if:

- `נ` creates forward continuation with a retained unresolved source
- `ס` explicitly resolves that retained source during its own step
- the resolution is not merely a word-end or boundary cleanup effect

If this control does not pass, anti-samekh conclusions should be treated as unreliable.

## Method

Runtime used:

- current rebuilt `dist/` from `src/reference`

Command:

```bash
npm run pasuk-trace -- --ref='Numbers/21/8' --lang=he --keep-teamim --no-show-post-reset --no-print-report --out-json=.tmp/axis/numbers-21-8.json --out-report=.tmp/axis/numbers-21-8.txt
```

Notes:

- the target is the final word in the verse trace: `נֵס`
- the operative token steps are `נ` at index `42` and `ס` at index `43`
- conclusions below refer to the in-word letter phases, not the trailing boundary reset

Raw artifacts:

- `.tmp/axis/numbers-21-8.json`
- `.tmp/axis/numbers-21-8.txt`

## Source Anchors

Implementation points that match the trace:

- `נ` spawns a carry-continuation node: `src/reference/letters/nun.ts`
- `ס` searches for the nearest unresolved carry source and adds `supp(focus, origin)`: `src/reference/letters/samekh.ts`

## Required Trace Fields

| Step | Current `F`                                                                   | Created `carry`                           | Backward search behavior                                           | Selected source for `ס`    | `supp(F, prior_anchor)` added |
| ---- | ----------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------ | -------------------------- | ----------------------------- |
| `נ`  | token-enter `ל:13:6`; operative source becomes `C:14:11`; token-exit `נ:14:1` | yes, `C:14:11->נ:14:1`                    | none                                                               | n/a                        | no                            |
| `ס`  | token-enter `נ:14:1`; token-exit `נ:14:1`                                     | no new carry; prior carry remains present | yes, outcome resolves nearest unresolved carry source to `C:14:11` | `select.args = ["נ:14:1"]` | yes, `נ:14:1->C:14:11`        |

## Step Analysis

### `נ`

Observed step:

- token index: `42`
- `F` before token: `ל:13:6`
- word-entry remaps active focus to word baseline `C:14:11`
- `select.args = ["C:14:11"]`
- bound base: `C:14:11`
- `F` after step: `נ:14:1`
- carry present after step:
  - `C:14:11->נ:14:1`
- support present after step:
  - none matching `נ:14:1->C:14:11`

Interpretation:

- `נ` creates a forward continuation node
- it retains the prior anchor by adding `carry(C:14:11, נ:14:1)`
- that carry is still unresolved after the `נ` step

### `ס`

Observed step:

- token index: `43`
- `F` before step: `נ:14:1`
- `select.args = ["נ:14:1"]`
- bound metadata:
  - `focus = "נ:14:1"`
  - `origin = "C:14:11"`
- `F` after step: `נ:14:1`
- carry still present after step:
  - `C:14:11->נ:14:1`
- support newly present after step:
  - `נ:14:1->C:14:11`

Interpretation:

- `ס` selects only the current focus at the surface level
- during its own bound phase it resolves the prior anchor as `origin = C:14:11`
- it then adds `supp(נ:14:1, C:14:11)` during the same step

## Backward Resolution Check

What the trace directly shows:

- before `ס`, the carried source from `נ` is still unresolved
- during the `ס` step, the bound construction records `origin = C:14:11`
- by `ס` token-exit, `supp(נ:14:1, C:14:11)` has been added

What is inferred from implementation:

- `ס` obtains that origin by walking backward through continuation predecessors and incoming carry edges
- the trace does not log each search hop separately
- the resolved origin in `bound.meta` matches the exact behavior defined in `findNearestUnresolvedCarrySource(...)`

## Boundary Independence

This is not boundary cleanup.

- after `נ`, the unresolved carry already exists
- during `ס`, the trace itself records the resolved `origin`
- by `ס` token-exit, the support edge has already been added
- only after that does the word boundary cut reset outgoing focus to `Ω`

So the control behavior happens inside the `ס` step, not as automatic word-end closure.

## Conclusion

The samekh control passes.

- `נ` creates the unresolved anchor with `carry(C:14:11, נ:14:1)`
- `ס` explicitly resolves that anchor to `C:14:11`
- `ס` adds `supp(נ:14:1, C:14:11)` during its own step
- this occurs before boundary reset

That validates the instrumentation. Any anti-samekh result should now be interpreted against a confirmed working control.
