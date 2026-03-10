# Cursor Register Decision Audit

## Cursor Audit Scope

- dataset_status: `stale-contaminated`
- stable allowlist: `ד ה ו ז ח י כ ל מ נ ס ע צ ק ר ש ך ם ן ץ`
- stale exclusions: families `א ב ג פ ת`; affected glyphs `א ב ג פ ף ת`
- graph-incomplete exclusions: families `ט`; affected glyphs `ט`
- contamination note: this decision review incorporates the short verse-set audit, so the aggregate decision input is not stable-only

## Goal

Decide whether distributed cursor material is sufficient, or whether the VM likely needs an explicit cursor register distinct from `F`.

Inputs reviewed:

- Test 6: `הָעֵץ`
- Test 7: `נֵס`
- Test 8: `זה`
- Test 9: short verse-set cursor-consumption audit
- Test 10: horizontal placement shape-law panel
- Test 11: focus-vs-cursor classification audit

## Decision Rule

A first-class cursor register is likely needed only if all three are true:

1. non-`F` anchors are frequently created
2. non-`F` anchors are rarely consumed except by `ס` or forced boundary closure
3. there exist words where semantic intuition strongly predicts pointing or presentation, but the trace remains pure `F`-tip following

If all three answers are yes:

- open a design task for explicit cursor register or generalized cursor-consumption policy

Otherwise:

- prefer refining existing selection-from-`K/W` rules before adding a new register

## Evidence Reviewed

### Test 6: `הָעֵץ`

Observed result:

- `ע` exports origin handle `ע:2:2`
- later `ץ` selects `["ע:2:2", "ה:2:1"]`
- current `F` at that moment is `ע:2:1`
- the non-`F` handle is consumed before boundary cleanup

Interpretation:

- this is direct in-word nonlocal consumption outside `ס`

### Test 7: `נֵס`

Observed result:

- `נ` creates unresolved `carry(C:14:11, נ:14:1)`
- `ס` resolves that prior anchor during its own step
- `supp(נ:14:1, C:14:11)` is added before boundary reset

Interpretation:

- samekh control is working
- the trace system can detect true nonlocal anchor consumption when it happens

### Test 8: `זה`

Observed result:

- `ז` exports a resolved non-`F` port
- `ה` does not consume that port
- `ה` presents the same underlying source as a backed head
- the demonstrative point and the headed presentation coexist

Interpretation:

- `זה` is not pure `F`-tip following
- pointer-like structure already exists without a first-class cursor register

### Test 9: aggregate counters

Observed totals:

- anchors created by `carry`: `147`
- handles exported by `ע`: `9`
- pins exported by `י`: `22`
- ports exported by `ז`: `3`
- non-`F` selections from `K`: `40`
- non-`F` selections from `W`: `0`
- backward-anchor consumptions by `ס`: `1`
- closures deferred to hard boundary or word-end: `29`

Derived metrics:

- `samekh_monopoly = 1 / 41 = 0.02439`
- `boundary_bailout = 29 / 50 = 0.58`
- `watch_deadness = 6 / 9 = 0.66667`

Threshold check:

- `samekh_monopoly > 0.85`: no
- `boundary_bailout > 0.75`: no
- `watch_deadness > 0.80`: no

Interpretation:

- non-`F` material is abundant
- but its use is not monopolized by `ס`
- and it is not mostly stranded until forced boundary cleanup

### Test 10: shape-law panel

Observed result:

- `6 / 7` letters fit the predicted correlation cleanly
- exported non-`F` access is already distributed across multiple operators

Interpretation:

- the current VM already contains multiple distinct kinds of non-`F` material
- the issue is not absence of cursor-like structure

### Test 11: focus-vs-cursor classification

Observed baseline:

- `ו` -> `focus_move_only`
- `נ` -> `focus_move_only`
- `ע` -> `focus_move_plus_cursor_create`
- `ז` -> `cursor_create_only`
- `ס` -> `cursor_consume_only`

Interpretation:

- ordinary `F := successor` is not being mislabeled as cursor movement
- explicit cursor creation and explicit cursor consumption are already distinguishable in trace

## Yes / No Questions

### 1. Are non-`F` anchors abundant?

Answer:

- yes

Reason:

- the verse audit shows high creation volume: `147` carry anchors, `9` exported `ע` handles, `22` `י` pins, and `3` `ז` ports

### 2. Are they under-consumed?

Answer:

- no

Reason:

- nonlocal consumption is not monopolized by `ס`
- `samekh_monopoly` is only `0.02439`
- `boundary_bailout` stays below the alert threshold at `0.58`
- `watch_deadness` is elevated but below the alert threshold at `0.66667`
- Test 6 also shows explicit non-`ס` in-word consumption in `הָעֵץ`

Conservative nuance:

- some exported handles do remain unused
- but the evidence does not support the stronger claim that distributed cursor material is broadly stranded

### 3. Do demonstrative or presentational words fail to show nonlocal access?

Answer:

- no

Reason:

- `זה` shows explicit demonstrative side-point plus headed presentation
- `הָעֵץ` shows later in-word non-`F` consumption
- `נֵס` confirms the control consumer works

So the traces do not remain pure `F`-tip following in the key semantic stress cases.

## Decision

Because the three-way rule requires all three answers to be yes, and only the first answer is yes, the decision is:

Distributed cursor material is sufficient; extend consumers.

## Design Preference

Preferred next move:

- refine existing selection-from-`K/W` rules and consumer behavior before adding a new register

Rationale:

- the VM already creates distinct non-`F` materials
- those materials are already consumed in at least some non-`ס` contexts
- demonstrative and presentational words already show nonlocal access structure

So the present evidence points to incomplete consumer coverage, not to missing representational machinery.

## Source Audits

- `reports/haetz_anti_samekh_cursor_audit.md`
- `reports/nes_samekh_control_audit.md`
- `reports/zeh_pointing_audit.md`
- `reports/cursor_consumption_short_verse_audit.md`
- `reports/horizontal_placement_shape_law_audit.md`
- `reports/focus_vs_cursor_movement_audit.md`
