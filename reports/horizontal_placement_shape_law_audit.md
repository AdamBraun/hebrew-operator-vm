# Horizontal Placement Shape Law Audit

## Cursor Audit Scope

- dataset_status: `stable-only`
- stable allowlist: `ד ה ו ז ח י כ ל מ נ ס ע צ ק ר ש ך ם ן ץ`
- stale exclusions: families `א ב ג פ ת`; affected glyphs `א ב ג פ ף ת`
- graph-incomplete exclusions: families `ט`; affected glyphs `ט`

## Goal

Test whether the position of a lateral addition predicts the type of non-spine behavior:

- top-right
- bottom-left
- side-middle
- no lateral addition

Minimal comparison panel:

- `ו`
- `י`
- `ז`
- `נ`
- `ר`
- `ד`
- `ע`

## Hypothesis

The synthetic shape law is promising if the trace panel shows a stable correlation between visible lateral placement and access behavior:

- no lateral addition -> no side access
- top-right addition -> exposed or backed upper access
- lower-left addition -> retained source or base anchor
- explicit side addition plus no focus advance -> exported cursor-like access

The shape law is weakened if the rows show no stable correlation between stroke placement and access behavior.

## Method

Trace basis:

- previously collected isolated one-letter traces
- each letter was traced as a one-letter input wrapped by normal boundary scaffolding
- conclusions below refer to the operative in-word letter step, not the trailing boundary reset

Artifacts used:

- `.tmp/axis/vav.snap.json`
- `.tmp/axis/yod.snap.json`
- `.tmp/axis/zayin.snap.json`
- `.tmp/axis/nun.snap.json`
- `.tmp/axis/resh.snap.json`
- `.tmp/axis/dalet.snap.json`
- `.tmp/axis/ayin.snap.json`

Prior audits used as source summaries:

- `reports/vav_yod_axis_hypothesis.md`
- `reports/nun_ayin_anchor_cursor_audit.md`
- `reports/final_nun_zayin_resolved_continuation_audit.md`
- `reports/resh_dalet_backed_head_audit.md`

Important normalization:

- `vertical focus move` is used narrowly here
- it means successor-style spine advance, where focus moves onto a newly continued child
- it does not include bare or backed head exposure, even though those also change `F`

This normalization keeps the table from conflating:

- continuation-like advance
- head reassignment

## Required Table

| letter | vertical focus move? | lateral export? | latent retained anchor? | backed head? | focus changes? |
| ------ | -------------------- | --------------- | ----------------------- | ------------ | -------------- |
| ו      | yes                  | no              | no                      | no           | yes            |
| י      | no                   | yes             | no                      | no           | no             |
| ז      | no                   | yes             | yes                     | no           | no             |
| נ      | yes                  | no              | yes                     | no           | yes            |
| ר      | no                   | no              | no                      | no           | yes            |
| ד      | no                   | no              | no                      | yes          | yes            |
| ע      | yes                  | yes             | yes                     | no           | yes            |

## Row Justification

### `ו`

Observed trace:

- `select.args = ["C:1:1"]`
- `cont(C:1:1, ו:1:1)`
- no `carry`
- no exported side handle
- `F: C:1:1 -> ו:1:1`

Classification:

- vertical focus move: yes
- lateral export: no
- latent retained anchor: no
- backed head: no
- focus changes: yes

### `י`

Observed trace:

- `select.args = ["C:1:1"]`
- `cont(C:1:1, י:1:1)`
- exported pin `י:1:1`
- no `carry`
- `F` remains `C:1:1`

Classification:

- vertical focus move: no
- lateral export: yes
- latent retained anchor: no
- backed head: no
- focus changes: no

### `ז`

Observed trace:

- `select.args = ["C:1:1"]`
- `cont(C:1:1, ז:1:1)`
- `carry(C:1:1, ז:1:1)`
- `supp(ז:1:1, C:1:1)`
- exported resolved port `ז:1:1`
- `F` remains `C:1:1`

Classification:

- vertical focus move: no
- lateral export: yes
- latent retained anchor: yes
- backed head: no
- focus changes: no

### `נ`

Observed trace:

- `select.args = ["C:1:1"]`
- `cont(C:1:1, נ:1:1)`
- `carry(C:1:1, נ:1:1)`
- no exported origin handle
- `F: C:1:1 -> נ:1:1`

Classification:

- vertical focus move: yes
- lateral export: no
- latent retained anchor: yes
- backed head: no
- focus changes: yes

### `ר`

Observed trace:

- source selected as `Ω` in the isolated baseline case
- `head_of(ר:1:1, Ω)`
- `carry(Ω, ר:1:1)`
- no `supp`
- no side export
- `F = ר:1:1`

Classification:

- vertical focus move: no
- lateral export: no
- latent retained anchor: no
- backed head: no
- focus changes: yes

Note:

- `ר` does create `carry`, but in this audit that does not count as a latent retained anchor
- the anchor column is reserved for the continuation-family retained-source behavior isolated in the `נ / ע / ז` panel
- `ר` is treated instead as bare head exposure

### `ד`

Observed trace:

- source selected as `Ω` in the isolated baseline case
- `head_of(ד:1:1, Ω)`
- `carry(Ω, ד:1:1)`
- `supp(ד:1:1, Ω)`
- no side export
- `F = ד:1:1`

Classification:

- vertical focus move: no
- lateral export: no
- latent retained anchor: no
- backed head: yes
- focus changes: yes

### `ע`

Observed trace:

- `select.args = ["C:1:1"]`
- `cont(C:1:1, ע:1:1)`
- `carry(C:1:1, ע:1:1)`
- exported origin alias `ע:1:2`
- `F: C:1:1 -> ע:1:1`

Classification:

- vertical focus move: yes
- lateral export: yes
- latent retained anchor: yes
- backed head: no
- focus changes: yes

## Visual Family Comparison

### `ו` vs `י`

Observed split:

- `ו` is pure focus-moving continuation
- `י` is pure exported side access without focus movement

This is the cleanest no-lateral versus top-right mini-pair in the panel.

### `נ` vs `ז` vs `ע`

Observed split:

- `נ` retains source latently and advances focus
- `ז` retains source, exports access, and keeps focus fixed
- `ע` retains source, exports access, and still advances focus

This shows a structured retained-anchor family rather than one undifferentiated class.

### `ר` vs `ד`

Observed split:

- both allocate heads and move `F` onto the head
- only `ד` adds `supp(head, source)`

So the top-right augmentation in this pair tracks backed head rather than ordinary continuation.

## Prediction Check

### No lateral addition -> no side access

Supported by:

- `ו`

Qualified by:

- `ר` and `ד` also have no side export, but they are head forms rather than continuation forms

### Top-right addition -> exposed or backed upper access

Supported by:

- `י` as exposed off-focus pin
- `ד` as backed head

This prediction is promising, though it splits into two realizations:

- export without focus advance
- backing of a head already made focal

### Lower-left addition -> retained source or base anchor

Supported by:

- `נ`
- `ע`

Both show retained-source behavior through `carry`; `ע` additionally exports the retained origin.

### Explicit side addition plus no focus advance -> exported cursor-like access

Supported by:

- `י`
- `ז`

This is one of the cleanest correlations in the panel.

## Pass Evaluation

Pass criterion:

- the shape law is promising if at least 5 of the 7 letters fit the predicted row cleanly

Assessment:

- `ו`: fits cleanly
- `י`: fits cleanly
- `ז`: fits cleanly
- `נ`: fits cleanly
- `ד`: fits cleanly
- `ע`: fits cleanly
- `ר`: useful baseline, but not strongly predicted by the shape law as stated

Result:

- at least `6 / 7` letters fit the predicted rows cleanly

## Conclusion

The shape law is promising on this panel.

Strongest correlations:

- no side addition plus plain stroke: no side export and ordinary focus advance in `ו`
- side addition plus no focus advance: exported cursor-like access in `י` and `ז`
- lower-left family: retained-source anchoring in `נ` and `ע`
- top-right head augmentation: backing in `ד` relative to bare `ר`

Main limitation:

- `ר` shows that the panel still needs a baseline category for bare head exposure
- so the current shape law looks informative but not complete

Best conservative reading:

- the trace evidence shows a real correlation between stroke placement and access behavior
- but the law should be treated as a promising organizing heuristic, not yet a finished full grammar

## Source Anchors

Implementation points that match the traces:

- `ו`: `src/reference/letters/vav.ts`
- `י`: `src/reference/letters/yod.ts`
- `ז`: `src/reference/letters/zayin.ts`
- `נ`: `src/reference/letters/nun.ts`
- `ר`: `src/reference/letters/resh.ts`
- `ד`: `src/reference/letters/dalet.ts`
- `ע`: `src/reference/letters/ayin.ts`
