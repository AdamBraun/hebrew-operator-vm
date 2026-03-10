# He Non-F Export Consumption Experiment

## Cursor Audit Scope

- dataset_status: `stable-only`
- stable allowlist: `ד ה ו ז ח י כ ל מ נ ס ע צ ק ר ש ך ם ן ץ`
- stale exclusions: families `א ב ג פ ת`; affected glyphs `א ב ג פ ף ת`
- graph-incomplete exclusions: families `ט`; affected glyphs `ט`
- scoped words: `זה`, `הזה`
- stale-contaminated words: none
- blocked-by-`ט` words: none

## Goal

Test whether `ה` becomes cleaner if it may head a live exported non-`F` point from the active export pool before defaulting to current focus.

Experimental branch:

- `codex/he-nonf-export-experiment`

Experimental switch:

- `HE_CONSUME_NON_F_EXPORTS=1`

## Stable Words Chosen

These are the stable-suite words where `ה` already appears after a live exported point:

- `זה`
- `הזה`

They are the only stable benchmark words in [stable_cursor_export_deadness_current.md](/Users/adambraun/projects/letters/reports/stable_cursor_export_deadness_current.md) where a later `ה` follows a live exported `ז` port.

## Trace Artifacts

Current:

- [zeh-he-current.json](/Users/adambraun/projects/letters/.tmp/axis/zeh-he-current.json)
- [hazeh-he-current.json](/Users/adambraun/projects/letters/.tmp/axis/hazeh-he-current.json)

Experimental:

- [zeh-he-experimental.json](/Users/adambraun/projects/letters/.tmp/axis/zeh-he-experimental.json)
- [hazeh-he-experimental.json](/Users/adambraun/projects/letters/.tmp/axis/hazeh-he-experimental.json)

Stable dead-export baselines:

- current: [stable_cursor_export_deadness_current.md](/Users/adambraun/projects/letters/reports/stable_cursor_export_deadness_current.md)
- experimental: [stable_cursor_export_deadness_experimental.md](/Users/adambraun/projects/letters/reports/stable_cursor_export_deadness_experimental.md)

## Comparison

| word  | mode         | `ה` selected source | resulting `head_of` target | earlier exported point status    |
| ----- | ------------ | ------------------- | -------------------------- | -------------------------------- |
| `זה`  | current      | `C:1:1`             | `ה:1:1->C:1:1`             | `ז:1:1` remains accompanied      |
| `זה`  | experimental | `ז:1:1`             | `ה:1:1->ז:1:1`             | `ז:1:1` is consumed by `ה`       |
| `הזה` | current      | `ה:1:1`             | `ה:1:3->ה:1:1`             | `ז:1:1` remains accompanied      |
| `הזה` | experimental | `ז:1:1`             | `ה:1:3->ז:1:1`             | `ז:1:1` is consumed by final `ה` |

Observed cursor tags on the final `ה` step:

- `זה`
  - current: `["cursor_accompany"]`
  - experimental: `["cursor_consume"]`
- `הזה`
  - current: `["cursor_accompany"]`
  - experimental: `["cursor_consume"]`

## Stable-Suite Dead Export Rates

Current stable suite:

- total exported non-`F` points: `9`
- `consumed_rate = 0.111` (`1/9`)
- `accompanied_rate = 0.667` (`6/9`)
- `dead_rate = 0.222` (`2/9`)

Experimental stable suite:

- total exported non-`F` points: `9`
- `consumed_rate = 0.333` (`3/9`)
- `accompanied_rate = 0.444` (`4/9`)
- `dead_rate = 0.222` (`2/9`)

Delta:

- consumption rises because `ה` now explicitly selects the prior `ז` port in `זה` and `הזה`
- accompaniment drops by the same amount
- dead exports do **not** decrease

## Interpretation

Graph simplicity does not improve.

- In the current model, `ז` and `ה` share the same underlying referent in `זה`: the port points to `C:1:1`, and `ה` heads `C:1:1`.
- In the experiment, `ה` no longer presents the referent directly; it heads the exported port handle itself.
- That adds indirection: `head_of(ה, ז-port)` instead of `head_of(ה, referent)`.

Family coherence gets worse on the strongest success case.

- Current `זה` is the clean pointer-plus-presentation case: live point plus headed presentation over the same source.
- Experimental `זה` stops being accompaniment and becomes pointer consumption.
- That weakens the earlier `זה` result rather than sharpening it.

Dead-export reduction is absent.

- The stable dead rate stays `0.222`.
- The same two dead `ה` adjunct exports remain dead:
  - `ה:1:2` in `זה`
  - `ה:1:4` in `הזה`

Unwanted regressions:

- `זה` loses the current coexistence law that made it mechanically strong.
- `הזה` stops re-presenting the already-headed source and instead points the final head at the intermediate `ז` port.
- The experiment changes the semantic reading from accompaniment to consumption without buying simpler graphs or fewer dead exports.

## Conclusion

The experimental `ה` is **not promising** under this rule.

- It increases non-`F` consumption counts.
- It does not reduce dead exports.
- It collapses the successful accompaniment behavior in `זה`.
- It makes the headed target less direct by pointing `head_of` at the exported handle instead of the underlying referent.

Preferred direction:

- keep default `ה` behavior unchanged
- if `ה` ever gains non-`F` access, it should likely dereference a prior export back to its referent rather than heading the export handle itself
