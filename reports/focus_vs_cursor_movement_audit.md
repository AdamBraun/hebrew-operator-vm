# Focus vs Cursor Movement Audit

## Cursor Audit Scope

- dataset_status: `stable-only`
- stable allowlist: `ד ה ו ז ח י כ ל מ נ ס ע צ ק ר ש ך ם ן ץ`
- stale exclusions: families `א ב ג פ ת`; affected glyphs `א ב ג פ ף ת`
- graph-incomplete exclusions: families `ט`; affected glyphs `ט`

## Goal

Prevent false positives where ordinary `F := successor` is mislabeled as cursor behavior.

Target letters:

- `ו`
- `נ`
- `ע`
- `ז`
- `ס`

## Classification Rule

Each operative letter step must be assigned exactly one category:

- `focus_move_only`
- `cursor_create_only`
- `focus_move_plus_cursor_create`
- `cursor_consume_only`
- `neither`

Strict normalization used in this audit:

- `focus move` means the operative post-step `F` differs from the pre-step `F`
- `cursor create` means a new independently addressable non-`F` point is created
- `cursor consume` means an already-existing non-`F` point or nonlocal anchor is materially resolved or selected

Important exclusion:

- latent `carry` by itself does not count as cursor creation
- it counts only as retained substrate unless it becomes independently addressable as non-`F`

This exclusion is the core anti-false-positive guard in the audit.

## Method

Trace basis:

- isolated one-letter traces for `ו`, `נ`, `ע`, `ז`
- the in-word `נֵס` control trace for `ס`

Artifacts used:

- `.tmp/axis/vav.snap.json`
- `.tmp/axis/nun.snap.json`
- `.tmp/axis/ayin.snap.json`
- `.tmp/axis/zayin.snap.json`
- `.tmp/axis/numbers-21-8.json`

Prior audits used as source summaries:

- `reports/vav_yod_axis_hypothesis.md`
- `reports/nun_ayin_anchor_cursor_audit.md`
- `reports/final_nun_zayin_resolved_continuation_audit.md`
- `reports/nes_samekh_control_audit.md`

Notes:

- conclusions below refer to the operative in-word letter step, not boundary reset
- for `ס`, the relevant evidence is the bound-phase recovery of `origin` and the addition of `supp(focus, origin)` during the same step

## Step Classification

| trace        | step | `F` changes? | new independent non-`F` point created? | existing non-`F` point consumed?           | category                        |
| ------------ | ---- | ------------ | -------------------------------------- | ------------------------------------------ | ------------------------------- |
| isolated `ו` | `ו`  | yes          | no                                     | no                                         | `focus_move_only`               |
| isolated `נ` | `נ`  | yes          | no                                     | no                                         | `focus_move_only`               |
| isolated `ע` | `ע`  | yes          | yes, exported origin alias             | no                                         | `focus_move_plus_cursor_create` |
| isolated `ז` | `ז`  | no           | yes, exported resolved port            | no                                         | `cursor_create_only`            |
| `נֵס`        | `נ`  | yes          | no                                     | no                                         | `focus_move_only`               |
| `נֵס`        | `ס`  | no           | no                                     | yes, unresolved carried origin is resolved | `cursor_consume_only`           |

## Step Evidence

### `ו`

Observed trace:

- pre-step operative `F = C:1:1`
- post-step operative `F = ו:1:1`
- no exported non-`F` handle
- no consumption of prior non-`F` material

Classification:

- `focus_move_only`

Reason:

- this is ordinary successor advance with no independent off-focus access point

### `נ`

Observed trace:

- pre-step operative `F = C:1:1`
- post-step operative `F = נ:1:1`
- `carry(C:1:1, נ:1:1)` is created
- no exported origin handle appears

Classification:

- `focus_move_only`

Reason:

- the step retains source via `carry`, but that retained substrate is not independently addressable
- under the strict rule, latent `carry` alone is not cursor creation

### `ע`

Observed trace:

- pre-step operative `F = C:1:1`
- post-step operative `F = ע:1:1`
- `carry(C:1:1, ע:1:1)` is created
- exported origin alias `ע:1:2` is created
- the exported alias is distinct from current `F`

Classification:

- `focus_move_plus_cursor_create`

Reason:

- the step both advances focus and creates a new independently addressable non-`F` access point

### `ז`

Observed trace:

- pre-step operative `F = C:1:1`
- post-step operative `F = C:1:1`
- `carry(C:1:1, ז:1:1)` and `supp(ז:1:1, C:1:1)` are created
- exported resolved port `ז:1:1` is created

Classification:

- `cursor_create_only`

Reason:

- the step creates a new off-focus access point but does not move focus

### `ס` in `נֵס`

Observed trace:

- pre-step operative `F = נ:14:1`
- post-step operative `F = נ:14:1`
- no new exported non-`F` point is created
- bound metadata records `origin = C:14:11`
- by token exit, `supp(נ:14:1, C:14:11)` has been added

Classification:

- `cursor_consume_only`

Reason:

- the step resolves a previously retained nonlocal anchor during its own operation
- it does not advance focus and does not create a new off-focus access point

## Expected Baseline Check

Expected baseline:

- `ו` -> `focus_move_only`
- `נ` -> `focus_move_only`, unless latent `carry` is explicitly counted as cursor material
- `ע` -> `focus_move_plus_cursor_create`
- `ז` -> `cursor_create_only`
- `ס` -> `cursor_consume_only`

Observed result:

- all five baseline expectations are met under the strict rule

## False-Positive Check

Potential failure mode:

- ordinary continuation steps get mislabeled as cursor movement because they retain source via `carry`

What the stricter rule fixes:

- `נ` no longer counts as cursor creation
- only letters that create an independently addressable non-`F` point count as `cursor_create`
- only letters that materially resolve or select an existing non-`F` point count as `cursor_consume`

This prevents the analysis from collapsing:

- focus movement
- latent retention
- explicit cursor creation
- cursor consumption

into one loose bucket.

## Conclusion

Test 11 passes.

The classification stays tight enough to distinguish:

- ordinary focus advance: `ו`, `נ`
- focus advance plus explicit cursor creation: `ע`
- pure cursor creation without focus movement: `ז`
- pure cursor consumption without focus movement: `ס`

So ordinary `F := successor` is not being mislabeled as cursor movement under the stricter trace rule.

## Source Anchors

Implementation points that match the traces:

- `ו`: `src/reference/letters/vav.ts`
- `נ`: `src/reference/letters/nun.ts`
- `ע`: `src/reference/letters/ayin.ts`
- `ז`: `src/reference/letters/zayin.ts`
- `ס`: `src/reference/letters/samekh.ts`
