# Demonstrative Family Audit

## Goal

Stress-test the refined `זה` result across nearby forms:

- `זו`
- `זאת`
- `אלה`
- `הזה`

The question is whether the VM shows a controlled family of demonstrative and presentation patterns, rather than a single crude law or random variation.

## Refined Family Hypothesis

Test 8 established a stronger law for `זה` than the original pass condition:

- `ז` creates a demonstrative non-`F` point
- `ה` does not need to consume that point
- `ה` can instead present the same referent as a backed head
- the point and the presentation can coexist

This audit checks whether nearby forms preserve that pointer/presentation split under controlled variation.

Expected family behavior:

- `זו` should look like point plus onward flow
- `זאת` should look like point plus presented or transported referent plus sealing
- `אלה` should show some stable demonstrative presentation pattern, even if not by `ז`-pointing
- `הזה` should show the effect of prefixed `ה` on the demonstrative relation

The family is suspicious if all four forms collapse to the same linear focus-advance pattern.

## Method

Runtime used:

- current rebuilt `dist/` from `src/reference`

Commands:

```bash
npm run pasuk-trace -- --text='זו' --no-show-post-reset --no-print-report --out-json=.tmp/axis/zu-isolated.json --out-report=.tmp/axis/zu-isolated.txt
npm run pasuk-trace -- --text='זאת' --no-show-post-reset --no-print-report --out-json=.tmp/axis/zot-isolated.json --out-report=.tmp/axis/zot-isolated.txt
npm run pasuk-trace -- --text='אלה' --no-show-post-reset --no-print-report --out-json=.tmp/axis/eleh-isolated.json --out-report=.tmp/axis/eleh-isolated.txt
npm run pasuk-trace -- --text='הזה' --no-show-post-reset --no-print-report --out-json=.tmp/axis/hazeh-isolated.json --out-report=.tmp/axis/hazeh-isolated.txt

npm run pasuk-trace -- --ref='Exodus/15/13' --lang=he --keep-teamim --no-show-post-reset --no-print-report --out-json=.tmp/axis/exodus-15-13.json --out-report=.tmp/axis/exodus-15-13.txt
npm run pasuk-trace -- --ref='Deuteronomy/14/4' --lang=he --keep-teamim --no-show-post-reset --no-print-report --out-json=.tmp/axis/deut-14-4.json --out-report=.tmp/axis/deut-14-4.txt
npm run pasuk-trace -- --ref='Deuteronomy/1/1' --lang=he --keep-teamim --no-show-post-reset --no-print-report --out-json=.tmp/axis/deut-1-1.json --out-report=.tmp/axis/deut-1-1.txt
npm run pasuk-trace -- --ref='Deuteronomy/1/6' --lang=he --keep-teamim --no-show-post-reset --no-print-report --out-json=.tmp/axis/deut-1-6.json --out-report=.tmp/axis/deut-1-6.txt
```

Context words used:

- Exodus 15:13 — `זוּ`
- Deuteronomy 14:4 — `זֹאת`
- Deuteronomy 1:1 — `אֵלֶּה`
- Deuteronomy 1:6 — `הַזֶּה`

Notes:

- isolated inputs are wrapped as single words with normal boundary scaffolding
- conclusions below describe the in-word mechanics, not trailing boundary reset
- contextual runs were checked against the isolated runs for pattern stability

Raw artifacts:

- `.tmp/axis/zu-isolated.json`
- `.tmp/axis/zot-isolated.json`
- `.tmp/axis/eleh-isolated.json`
- `.tmp/axis/hazeh-isolated.json`
- `.tmp/axis/exodus-15-13.json`
- `.tmp/axis/deut-14-4.json`
- `.tmp/axis/deut-1-1.json`
- `.tmp/axis/deut-1-6.json`

## Source Anchors

Implementation points that match the trace:

- `ז` exports a resolved port and keeps focus fixed: `src/reference/letters/zayin.ts`
- `ה` presents a backed head with detached leg: `src/reference/letters/he.ts`
- `ו` spawns continuation and moves focus to the new child: `src/reference/letters/vav.ts`
- `א` creates a transport alias between entry focus and construct: `src/reference/letters/aleph.ts`
- `ל` creates a held source plus exterior endpoint: `src/reference/letters/lamed.ts`
- `ת` finalizes by adding a boundary, artifact, and residue: `src/reference/letters/tav.ts`

## Family Summary

| Word  | Isolated core pattern                                                      | Contextual match | Surviving non-`F` access at word end                | Provisional reading                                      |
| ----- | -------------------------------------------------------------------------- | ---------------- | --------------------------------------------------- | -------------------------------------------------------- |
| `זו`  | `ז` exports point; `ו` flows onward from same source without consuming it  | yes              | yes, the `ז` port survives the word                 | point plus onward flow                                   |
| `זאת` | `ז` exports point; `א` aliases same referent; `ת` seals it                 | yes              | yes, the `ז` port survives through sealing          | pointed, transported, delimited presentation             |
| `אלה` | no `ז` point; `א` aliases, `ל` exteriorizes, `ה` presents exterior as head | yes              | yes, but not as a `ז` port                          | exterior or field presentation                           |
| `הזה` | first `ה` heads source; `ז` points to that head; second `ה` re-presents it | yes              | yes, the `ז` port survives alongside the later head | pre-headed referent with subordinate demonstrative point |

## `זו`

### Isolated

Observed steps:

- `ז`
  - `select.args = ["C:1:1"]`
  - exports resolved port `ז:1:1`
  - adds `cont(C:1:1, ז:1:1)`, `carry(C:1:1, ז:1:1)`, `supp(ז:1:1, C:1:1)`
  - `F` stays `C:1:1`
- `ו`
  - `select.args = ["C:1:1"]`
  - creates continuation child `ו:1:1`
  - `F` becomes `ו:1:1`
  - the `ז` port remains in `K`

Interpretation:

- `ו` does not consume the demonstrative point
- it continues forward from the same source while the point remains live
- this is point plus flow, not point collapsed into presentation

### Context: Exodus 15:13

Contextual word:

- word index `4`
- surface form `זוּ`

Observed word-internal behavior matches isolation:

- `ז` exports `ז:4:5` and keeps `F = C:4:4`
- `ו` advances to `ו:4:1` from the same source
- `ז:4:5` remains exported after the word

Important contextual nuance:

- in the following glued word `גָּאָלְתָּ`, the first step selects `["ו:4:1", "ז:4:5", "ז:4:5"]`
- so the preserved demonstrative point is not merely inert; it can be picked up later across word glue

## `זאת`

### Isolated

Observed steps:

- `ז`
  - `select.args = ["C:1:1"]`
  - exports resolved port `ז:1:1`
  - `F` stays `C:1:1`
- `א`
  - `select.args = ["Ω"]`
  - creates alias `א:1:1`
  - links entry focus `Ω` to construct `C:1:1`
  - `F` remains `C:1:1`
- `ת`
  - `select.args = ["C:1:1"]`
  - creates boundary `ת:1:1`, artifact `ת:1:2`, residue `ת:1:3`
  - `F` becomes residue `ת:1:3`

Interpretation:

- `ז` supplies a demonstrative point
- `א` transports or aliases the same referent rather than consuming the point
- `ת` then seals that referent
- this is not simple forward continuation; it is pointed plus transported plus delimited

### Context: Deuteronomy 14:4

Contextual word:

- word index `1`
- surface form `זֹאת`

Observed behavior matches isolation:

- `ז` exports `ז:1:1` and keeps focus fixed
- `א` aliases `Ω` to `C:1:1`
- `ת` finalizes `C:1:1` into boundary plus artifact plus residue

Interpretation:

- the contextual form preserves the same law as the isolated run
- the demonstrative point survives through the sealing sequence instead of being consumed by it

## `אלה`

### Isolated

Observed steps:

- `א`
  - `select.args = ["Ω"]`
  - creates alias `א:1:1`
  - establishes construct `C:1:1`
- `ל`
  - `select.args = ["C:1:1"]`
  - creates hold `ל:1:1` and exterior endpoint `ל:1:2`
  - adds `carry(C:1:1, ל:1:1)`, `supp(ל:1:1, C:1:1)`, `cont(ל:1:1, ל:1:2)`
  - `F` becomes `ל:1:2`
- `ה`
  - `select.args = ["ל:1:2"]`
  - creates backed head `ה:1:1` and leg `ה:1:2`
  - `F` becomes `ה:1:1`

Interpretation:

- `אלה` is not a `ז`-pointer form
- its demonstrative behavior is built differently:
  - alias the referent
  - step past it into an exterior endpoint
  - present that exterior endpoint as a head
- this looks more like field or exterior presentation than single-point indication

### Context: Deuteronomy 1:1

Contextual word:

- word index `1`
- surface form `אֵלֶּה`

Observed behavior matches isolation:

- `א` aliases `Ω` to `C:1:1`
- `ל` creates `holdId = ל:1:1` and `exteriorId = ל:1:2`
- `ה` presents `ל:1:2` as headed form `ה:1:1`

Interpretation:

- the contextual run confirms that `אלה` is not random drift away from `זה`
- it is a stable alternate demonstrative architecture with no need for a `ז` port

## `הזה`

### Isolated

Observed steps:

- first `ה`
  - `select.args = ["Ω"]`
  - creates backed head `ה:1:1` and leg `ה:1:2`
  - `F` becomes `ה:1:1`
- `ז`
  - `select.args = ["ה:1:1"]`
  - `select.prefs.exported_adjuncts = ["ה:1:2"]`
  - exports resolved port `ז:1:1` with `meta.portOf = "ה:1:1"`
  - `F` stays `ה:1:1`
- second `ה`
  - `select.args = ["ה:1:1"]`
  - creates a new backed head `ה:1:3` and leg `ה:1:4`
  - `F` becomes `ה:1:3`

Interpretation:

- prefixed `ה` first establishes a presented head
- `ז` then points to that already-presented referent
- the final `ה` presents it again
- the demonstrative point is therefore subordinate to an already-headed referent, not primary

### Context: Deuteronomy 1:6

Contextual word:

- word index `11`
- surface form `הַזֶּה`

Observed behavior matches isolation:

- first `ה`
  - `select.args = ["C:12:11"]`
  - creates head `ה:12:9` and leg `ה:12:10`
  - `F = ה:12:9`
- `ז`
  - `select.args = ["ה:12:9"]`
  - `select.prefs.exported_adjuncts = ["ה:12:10"]`
  - exports port `ז:12:3`
  - `F` stays `ה:12:9`
- second `ה`
  - `select.args = ["ה:12:9"]`
  - creates head `ה:12:11` and leg `ה:12:12`
  - `F = ה:12:11`

Interpretation:

- the contextual run confirms the prefixed-head pattern exactly
- `הזה` is not just `זה` with an extra ornamental article
- it reorganizes the internal hierarchy so that presentation precedes pointing

## Comparative Reading

The family does not collapse to one law. It shows controlled variation:

- `זה`
  - lateral demonstrative point plus vertical presentation of the same source
- `זו`
  - lateral demonstrative point plus onward continuation from the same source
- `זאת`
  - lateral demonstrative point plus transported referent plus sealing
- `אלה`
  - no `ז` point; instead alias plus exteriorization plus headed presentation
- `הזה`
  - headed referent first, then lateral point, then re-presentation

That gives at least five distinct mechanical relations:

- cursor accompaniment
- onward flow
- sealing or delimitation
- exteriorization or field presentation
- pre-headed subordination

## Conclusion

The demonstrative family is not random, and it does not reduce to plain focus advance.

The strongest generalization supported by these traces is:

- `ז` is a lateral demonstrative operator that creates a live non-`F` access-point
- `ה` is a vertical or headwise presentation operator
- nearby letters then vary how the pointed or presented referent is treated:
  - `ו` carries it forward
  - `א` aliases or transports it
  - `ת` seals it
  - `ל` exteriorizes it
  - prefixed `ה` can make the presented head primary before `ז` points

So the VM already appears to contain a real pointer/presentation split without needing a first-class cursor register. The family evidence strengthens the refined reading from Test 8:

- non-`F` structure can be consumed later
- or remain live as accompaniment
- or survive alongside sealing
- or become subordinate to an already-headed presentation
