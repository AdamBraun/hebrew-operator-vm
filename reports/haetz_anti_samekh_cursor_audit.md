# Haetz Anti-Samekh Cursor Audit

## Cursor Audit Scope

- dataset_status: `stable-only`
- stable allowlist: `ד ה ו ז ח י כ ל מ נ ס ע צ ק ר ש ך ם ן ץ`
- stale exclusions: families `א ב ג פ ת`; affected glyphs `א ב ג פ ף ת`
- graph-incomplete exclusions: families `ט`; affected glyphs `ט`

## Goal

Test whether the existing mechanics allow non-`ס` cursor-like access in a real word where `ע` should preserve an earlier point of access.

Target word:

- `הָעֵץ`

Preferred source verse:

- Genesis 3:3 — `וּמִפְּרִי הָעֵץ אֲשֶׁר בְּתוֹךְ־הַגָּן`

## Exact Success Criterion

Test 6 succeeds iff all of these hold:

1. `ע` creates an independently addressable origin handle and exports it to `K`.
2. At least one later letter in the same word performs a selection that includes that exported handle, or another non-`F` handle derived from it.
3. At the moment of that later selection, the consumed handle is not identical to current `F`.
4. The later letter's behavior is not reducible to boundary cleanup or automatic word-end closure.

Minimal pass:

- a later letter consumes a handle exported earlier by `ע`
- that consumed handle is non-`F`

Strong pass:

- the later letter materially uses that non-`F` operand in its own operation
- the operand is not just an inert extra argument in the trace

Failure condition:

- `ע` exports a handle, but no later letter in the word ever selects it
- a later letter selects only `F`
- the handle survives until word-end and is only neutralized by boundary reset or closure
- the supposed non-`F` item is only an alias for current `F`, not a distinct access point

## Method

Runtime used:

- current rebuilt `dist/` from `src/reference`

Command:

```bash
npm run pasuk-trace -- --ref='Genesis/3/3' --lang=he --keep-teamim --no-show-post-reset --no-print-report --out-json=.tmp/axis/genesis-3-3.json --out-report=.tmp/axis/genesis-3-3.txt
```

Notes:

- the target is the second word in the verse trace: `הָעֵץ`
- the operative token steps for this word are `ה`, `ע`, `ץ`
- conclusions below refer to the in-word letter phases, not the trailing boundary reset

Raw artifacts:

- `.tmp/axis/genesis-3-3.json`
- `.tmp/axis/genesis-3-3.txt`

## Relevant Trace Sequence

### `ה`

Observed step:

- token index: `7`
- `F` before token: `ר:1:1`
- word-entry remaps active focus to word baseline `C:2:2`
- `select.args = ["C:2:2"]`
- new handles:
  - `ה:2:1` head
  - `ה:2:2` detached adjunct leg
- exported access:
  - adjunct export `ה:2:2`
- `F` after step: `ה:2:1`

This step establishes the local headed structure that the later letters operate over.

### `ע`

Observed step:

- token index: `8`
- `F` before step: `ה:2:1`
- `select.args = ["ה:2:1"]`
- `select.prefs.selection_targets = ["ה:2:2"]`
- `select.prefs.exported_adjuncts = ["ה:2:2"]`
- new handles:
  - `ע:2:1` child
  - `ע:2:2` origin alias handle
- exported access:
  - `ע:2:2` with `meta.target = "ה:2:1"` and `export_origin = true`
- `F` after step: `ע:2:1`
- `K` after step:
  - `["Ω", "פ:1:1", "ר:1:1", "י:1:1", "ה:2:1", "ע:2:2"]`

This is the required export step: `ע` snapshots the earlier origin, advances focus to `ע:2:1`, and leaves the origin handle independently addressable in `K`.

### `ץ`

Observed step:

- token index: `9`
- `F` before step: `ע:2:1`
- `K` at token entry:
  - `["Ω", "פ:1:1", "ר:1:1", "י:1:1", "ה:2:1", "ע:2:2"]`
- `select.args = ["ע:2:2", "ה:2:1"]`
- new handle:
  - `ץ:2:1` final aligned artifact
- bound construction:
  - `base = "ע:2:2"`
  - `focus = "ע:2:2"`
  - `exemplar = "ה:2:1"`
- event:
  - `align_final(id = "ץ:2:1", focus = "ע:2:2", exemplar = "ה:2:1")`
- `F` after step: `ץ:2:1`
- `K` after step:
  - `["Ω", "פ:1:1", "ר:1:1", "י:1:1", "ץ:2:1"]`

This is the decisive later-letter use:

- `ץ` consumes `ע:2:2`
- `ע:2:2` is not current `F`
- the consumption occurs during the in-word `select` and `bound` phases, before boundary cleanup

## Step Table

| Letter | `F` before                                             | `select.args`        | Newly created handles / exports        | Any non-`F` operand consumed?     | `F` after |
| ------ | ------------------------------------------------------ | -------------------- | -------------------------------------- | --------------------------------- | --------- |
| `ה`    | `ר:1:1` before token, operative source becomes `C:2:2` | `["C:2:2"]`          | `ה:2:1`, `ה:2:2` exported adjunct      | no                                | `ה:2:1`   |
| `ע`    | `ה:2:1`                                                | `["ה:2:1"]`          | `ע:2:1`, `ע:2:2` exported origin alias | no                                | `ע:2:1`   |
| `ץ`    | `ע:2:1`                                                | `["ע:2:2", "ה:2:1"]` | `ץ:2:1`                                | yes, `ע:2:2` and `ה:2:1` from `K` | `ץ:2:1`   |

## Criterion Check

1. `ע` creates and exports an independently addressable origin handle:
   yes, `ע:2:2`

2. A later letter in the same word selects that exported handle:
   yes, `ץ` selects `ע:2:2`

3. The consumed handle is not current `F` at the time of later selection:
   yes, during `ץ` selection current `F = "ע:2:1"` and consumed handle `ע:2:2`

4. The use is not reducible to boundary cleanup or word-end closure:
   yes, the consumption happens in `ץ`'s active `select` and `bound` phases before the word boundary

## Minimal Pass vs Strong Pass

Minimal pass:

- satisfied
- a later letter, `ץ`, consumes the handle exported earlier by `ע`
- the consumed handle is non-`F`

Strong pass:

- plausible and likely satisfied
- `ץ` does not merely list `ע:2:2` as an inert trace artifact
- its construction uses `base = focus = "ע:2:2"` and records that use in `align_final`

Conservative reading:

- the trace guarantees a minimal pass
- it is also strong evidence for a strong pass candidate because the non-`F` operand is materially threaded into `ץ`'s operation

## Boundary Check

The later non-`F` use is in-word, not post hoc cleanup.

- `ע:2:2` is present in `K` after `ע`
- `ץ` consumes it before word end
- after `ץ`, `K` no longer contains `ע:2:2`
- only after that does the word boundary cut reset outgoing focus to `Ω`

So the exported handle does not survive unused to word-end closure.

## Conclusion

`העץ` passes Test 6.

- `ע` exports an independently addressable origin handle
- a later letter in the same word, `ץ`, explicitly consumes that handle
- the consumed handle is distinct from current `F`
- the use occurs before boundary cleanup

This word is therefore positive evidence that the current mechanics already allow non-`ס` cursor-like access and later intra-word non-`F` anchor consumption.

## Source Anchors

Implementation points that match the trace:

- `ע` exports an origin alias handle: `src/reference/letters/ayin.ts`
- `ץ` selects two operands and uses them as `focus` and `exemplar` in final alignment: `src/reference/letters/finalTsadi.ts`
