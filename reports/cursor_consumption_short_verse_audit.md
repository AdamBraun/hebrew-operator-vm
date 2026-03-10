# Cursor Consumption Short-Verse Audit

## Cursor Audit Scope

- dataset_status: `stale-contaminated`
- stable allowlist: `ד ה ו ז ח י כ ל מ נ ס ע צ ק ר ש ך ם ן ץ`
- stale exclusions: families `א ב ג פ ת`; affected glyphs `א ב ג פ ף ת`
- graph-incomplete exclusions: families `ט`; affected glyphs `ט`
- contamination note: the five-verse set includes words containing excluded stale letters, so this report is not a stable-only inference base

## Goal

Measure whether cursor-bearing structures are created much more often than they are consumed.

## Verse Set

Exact set traced:

- Genesis 3:3
- Numbers 21:8
- Exodus 15:2
- Genesis 1:2
- Exodus 34:17

Role coverage:

- Genesis 3:3 includes `העץ`
- Numbers 21:8 includes `נס`
- Exodus 15:2 contains demonstrative `זה`
- Genesis 1:2 contains `ע` but no `ס`
- Exodus 34:17 contains both `ע` and `ס`

Artifacts:

- `.tmp/axis/genesis-3-3.json`
- `.tmp/axis/genesis-3-3.txt`
- `.tmp/axis/numbers-21-8.json`
- `.tmp/axis/numbers-21-8.txt`
- `.tmp/axis/exodus-15-2.json`
- `.tmp/axis/exodus-15-2.txt`
- `.tmp/axis/genesis-1-2.json`
- `.tmp/axis/genesis-1-2.txt`
- `.tmp/axis/exodus-34-17.json`
- `.tmp/axis/exodus-34-17.txt`

## Required Counters

Totals across the full set:

| Counter                                        | Value |
| ---------------------------------------------- | ----- |
| anchors created by `carry`                     | `147` |
| handles exported by `ע`                        | `9`   |
| pins exported by `י`                           | `22`  |
| ports exported by `ז`                          | `3`   |
| non-`F` selections from `K`                    | `40`  |
| non-`F` selections from `W`                    | `0`   |
| backward-anchor consumptions by `ס`            | `1`   |
| closures deferred to hard boundary or word-end | `29`  |

Supporting totals used by the derived metrics:

| Supporting total               | Value |
| ------------------------------ | ----- |
| all nonlocal consumptions      | `41`  |
| all closures                   | `50`  |
| all exported origin handles    | `9`   |
| unused exported origin handles | `6`   |

## Derived Metrics

Definitions used:

- `samekh_monopoly = samekh_nonlocal_consumptions / all_nonlocal_consumptions`
- `boundary_bailout = forced_boundary_closures / all_closures`
- `watch_deadness = unused_exported_origin_handles / all_exported_origin_handles`

Computed values:

| Metric             | Formula   | Value     |
| ------------------ | --------- | --------- |
| `samekh_monopoly`  | `1 / 41`  | `0.02439` |
| `boundary_bailout` | `29 / 50` | `0.58`    |
| `watch_deadness`   | `6 / 9`   | `0.66667` |

## Threshold Check

Alert thresholds:

- raise flag if `samekh_monopoly > 0.85`
- raise flag if `boundary_bailout > 0.75`
- raise flag if `watch_deadness > 0.80`

Observed result:

- `samekh_monopoly > 0.85`: no
- `boundary_bailout > 0.75`: no
- `watch_deadness > 0.80`: no

No threshold is exceeded on this verse set.

## Per-Verse Breakdown

| Verse          | `carry` created | `ע` exports | `י` pins | `ז` ports | non-`F` from `K` | non-`F` from `W` | `ס` backward consumptions |
| -------------- | --------------- | ----------- | -------- | --------- | ---------------- | ---------------- | ------------------------- |
| `Genesis/3/3`  | `28`            | `2`         | `2`      | `0`       | `16`             | `0`              | `0`                       |
| `Numbers/21/8` | `36`            | `2`         | `5`      | `0`       | `5`              | `0`              | `1`                       |
| `Exodus/15/2`  | `30`            | `2`         | `9`      | `3`       | `5`              | `0`              | `0`                       |
| `Genesis/1/2`  | `40`            | `2`         | `5`      | `0`       | `12`             | `0`              | `0`                       |
| `Exodus/34/17` | `13`            | `1`         | `1`      | `0`       | `2`              | `0`              | `0`                       |

## Exported-`ע` Handle Use

Used later in the same verse set:

- `Genesis/3/3`: `ע:2:2` consumed by `ץ`
- `Genesis/1/2`: `ע:9:2` consumed by `פ`
- `Genesis/1/2`: `ע:17:4` consumed by `פ`

Exported but unused later:

- `Genesis/3/3`: `ע:13:2`
- `Numbers/21/8`: `ע:6:2`
- `Numbers/21/8`: `ע:13:4`
- `Exodus/15/2`: `ע:1:2`
- `Exodus/15/2`: `ע:8:4`
- `Exodus/34/17`: `ע:4:2`

This yields:

- used exported origin handles: `3`
- unused exported origin handles: `6`
- `watch_deadness = 6 / 9`

## Interpretation

The audit does not raise the underpowered-consumption flag on this sample.

What the sample shows:

- nonlocal consumption is present and is not monopolized by `ס`
- most nonlocal use here occurs through non-`F` selection from `K`
- `W` is entirely unused in this set
- `ע` exports are still under-consumed in a softer sense, but not past the alert threshold

High-signal examples inside the set:

- `Genesis/3/3`: `ץ` consumes the `ע`-exported origin in `העץ`
- `Genesis/1/2`: later `פ` consumes `ע`-exported origin handles twice
- `Numbers/21/8`: `ס` resolves the retained `נ` anchor in `נס`

## Method Note

Creation and nonlocal-consumption counts were taken from the deep trace JSONs for the five selected verses.

For `boundary_bailout`, the closure denominator used closure-labeled corpus events over the same refs:

- boundary-forced closures counted as:
  - `RESH.BOUNDARY_CLOSE`
  - `DALET.BOUNDARY_CLOSE`
  - `SPACE.MEM_AUTO_CLOSE`
  - `SPACE.SUPPORT_DISCHARGE`
- all closures counted as the above plus:
  - `TAV.FINALIZE`
  - `FINAL_MEM.CLOSE`
  - `MEM.CLOSE`
  - `FINAL_NUN.SUPPORT_DISCHARGE`

Under that taxonomy, boundary closure is substantial but not dominant.

## Conclusion

On this short verse set, the system does show cursor-bearing material that is actually consumed.

- `samekh_monopoly` is low
- `boundary_bailout` is below the alert threshold
- `watch_deadness` is elevated but not extreme

So this sample does not support the claim that cursor material exists but is broadly stranded due to underpowered consumption.
