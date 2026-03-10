# Zeh Pointing Audit

## Cursor Audit Scope

- dataset_status: `stable-only`
- stable allowlist: `ד ה ו ז ח י כ ל מ נ ס ע צ ק ר ש ך ם ן ץ`
- stale exclusions: families `א ב ג פ ת`; affected glyphs `א ב ג פ ף ת`
- graph-incomplete exclusions: families `ט`; affected glyphs `ט`

## Goal

Test the intuition that `זה` should show explicit demonstrative pointing, not merely forward sequencing.

Target word:

- `זה`

Runs required:

- isolated `זה`
- verse-context `זֶה`

Verse context used:

- Exodus 15:2 — `זֶה אֵלִי וְאַנְוֵהוּ`

## Hypothesis

The pointing hypothesis is supported if:

- `ז` exports a resolved side-point
- `ה` subsequently frames or presents the same underlying source
- the resulting word contains an explicitly addressable presented object
- the word is not reducible to ordinary linear focus advance

The model is suspicious if:

- `זה` behaves like plain two-step continuation
- no pointer-like structure survives the word

## Method

Runtime used:

- current rebuilt `dist/` from `src/reference`

Commands:

```bash
npm run pasuk-trace -- --text='זה' --no-show-post-reset --no-print-report --out-json=.tmp/axis/zeh-isolated.json --out-report=.tmp/axis/zeh-isolated.txt
npm run pasuk-trace -- --ref='Exodus/15/2' --lang=he --keep-teamim --no-show-post-reset --no-print-report --out-json=.tmp/axis/exodus-15-2.json --out-report=.tmp/axis/exodus-15-2.txt
```

Notes:

- isolated input is wrapped as a single word with the usual boundary scaffolding
- the contextual run uses the first word `זֶה` in Exodus 15:2
- conclusions below refer to the in-word letter steps, not trailing boundary reset

Raw artifacts:

- `.tmp/axis/zeh-isolated.json`
- `.tmp/axis/zeh-isolated.txt`
- `.tmp/axis/exodus-15-2.json`
- `.tmp/axis/exodus-15-2.txt`

## Source Anchors

Implementation points that match the trace:

- `ז` spawns a resolved carry node, exports it to `K`, and keeps focus fixed: `src/reference/letters/zayin.ts`
- `ה` selects a source via `selectHeSource(...)` and exposes a backed head plus detached leg: `src/reference/letters/he.ts`
- current-focus selection ignores `K` exports unless a letter explicitly asks for them: `src/reference/vm/select.ts`

## Isolated `זה`

### After `ז`

Observed step:

- token index: `1`
- operative source: `C:1:1`
- `select.args = ["C:1:1"]`
- new exported handle:
  - `ז:1:1`
- `F` after step:
  - `C:1:1`
- `K` after step:
  - `["Ω", "⊥", "ז:1:1", "ז:1:1"]`

Observed graph after `ז`:

- `cont(C:1:1, ז:1:1)`
- `carry(C:1:1, ז:1:1)`
- `supp(ז:1:1, C:1:1)`

Observed handle metadata:

- `ז:1:1`
  - `meta.portOf = "C:1:1"`
  - `handle_label = "resolved_port"`
  - `x_flow = EXPLICIT_ONLY`
  - `data_flow = SNAPSHOT`

Interpretation:

- `ז` exports a resolved side-point
- focus does not advance to that point
- the port is independently preserved in `K`

### After `ה`

Observed step:

- token index: `2`
- `F` before step: `C:1:1`
- `select.args = ["C:1:1"]`
- `bound.source = "C:1:1"`
- new handles:
  - `ה:1:1` backed head
  - `ה:1:2` detached adjunct leg
- `F` after step:
  - `ה:1:1`
- `K` after step:
  - `["Ω", "⊥", "ז:1:1", "ז:1:1", "ה:1:1"]`

Observed graph after `ה`:

- prior `ז` graph remains
- new head graph:
  - `head_of(ה:1:1, C:1:1)`
  - `carry(C:1:1, ה:1:1)`
  - `supp(ה:1:1, C:1:1)`
  - `cont(ה:1:1, ה:1:2)`
  - `carry(ה:1:1, ה:1:2)`
  - `supp(ה:1:2, ה:1:1)`

Interpretation:

- `ה` does not select the exported `ז` port directly
- instead, it presents the same underlying source `C:1:1` as a backed head
- the `ז` port remains alive in `K` as a non-`F` access-point

## Contextual `זֶה` in Exodus 15:2

Target word:

- word index `7`
- surface form `זֶה`

### After `ז`

Observed step:

- token index: `29`
- operative source: `C:10:7`
- `select.args = ["C:10:7"]`
- new exported handle:
  - `ז:10:3`
- `F` after step:
  - `C:10:7`
- `K` after step:
  - `["Ω", "⊥", "ז:10:3", "ז:10:3"]`

Observed graph after `ז`:

- `cont(C:10:7, ז:10:3)`
- `carry(C:10:7, ז:10:3)`
- `supp(ז:10:3, C:10:7)`

Observed handle metadata:

- `ז:10:3`
  - `meta.portOf = "C:10:7"`
  - `handle_label = "resolved_port"`
  - `x_flow = EXPLICIT_ONLY`
  - `data_flow = SNAPSHOT`

Interpretation:

- the contextual run matches the isolated one at the `ז` step
- `ז` exports a resolved side-point and keeps focus fixed

### After `ה`

Observed step:

- token index: `30`
- `F` before step: `C:10:7`
- `select.args = ["C:10:7"]`
- `bound.source = "C:10:7"`
- new handles:
  - `ה:10:7` backed head
  - `ה:10:8` detached adjunct leg
- `F` after step:
  - `ה:10:7`
- `K` after step:
  - `["Ω", "⊥", "ז:10:3", "ז:10:3", "ה:10:7"]`

Observed graph after `ה`:

- prior `ז` graph remains
- new head graph:
  - `head_of(ה:10:7, C:10:7)`
  - `carry(C:10:7, ה:10:7)`
  - `supp(ה:10:7, C:10:7)`
  - `cont(ה:10:7, ה:10:8)`
  - `carry(ה:10:7, ה:10:8)`
  - `supp(ה:10:8, ה:10:7)`

Interpretation:

- as in isolation, `ה` does not consume the `ז` port directly
- it heads the same underlying source
- the `ז` port survives as a non-`F` access-point after the word

## Required Trace Field Summary

| Run              | `ז` exports resolved side-point | `ה` preserves / frames / exposes that point                      | Explicitly addressable presented object present | Non-`F` access-point survives the word |
| ---------------- | ------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| isolated `זה`    | yes, `ז:1:1`                    | yes, indirectly: `ה` heads `C:1:1` while `ז:1:1` remains alive   | yes                                             | yes                                    |
| contextual `זֶה` | yes, `ז:10:3`                   | yes, indirectly: `ה` heads `C:10:7` while `ז:10:3` remains alive | yes                                             | yes                                    |

## Comparison

Shared behavior:

- `ז` exports a resolved side-point
- `ז` does not advance focus
- `ה` creates a backed head over the same underlying source
- the exported `ז` point survives after `ה`

Important nuance:

- `ה` does not select the `ז` port from `K`
- it selects the current operative source directly
- so the demonstrative composite is not "port consumed by head"
- it is "port preserved alongside headed presentation of the same source"

That still counts as explicit pointing behavior because the word ends with:

- a surviving non-`F` presented point from `ז`
- a head-like presentation from `ה`

This is mechanically richer than plain linear continuation.

## Conclusion

The pointing hypothesis is supported.

- `זה` does not behave like ordinary two-step focus advance
- `ז` creates an explicit resolved port
- `ה` presents the same source as a backed head
- the `ז` port survives as an independently addressable non-`F` structure

So the composite result contains an addressable presented target, not merely a linear successor chain.
