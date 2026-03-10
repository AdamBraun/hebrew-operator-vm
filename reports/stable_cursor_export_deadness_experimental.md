# Stable Cursor Export Deadness Audit

## Cursor Audit Scope

- dataset_status: `stable-only`
- stable allowlist: `ד ה ו ז ח י כ ל מ נ ס ע צ ק ר ש ך ם ן ץ`
- stale exclusions: families `א ב ג פ ת`; affected glyphs `א ב ג פ ף ת`
- graph-incomplete exclusions: families `ט`; affected glyphs `ט`
- scoped words: `זה`, `זו`, `הזה`, `נס`, `העץ`, `לך`, `הן`
- stale-contaminated words: none
- blocked-by-`ט` words: none

## Goal

Measure how often the stable benchmark creates independently addressable non-`F` points that are later consumed, accompanied, or left live but unused at boundary.

## Mode

- benchmark mode: `isolated_stable`
- rationale: isolated-token execution preserves the stable-only allowlist and avoids verse-context contamination from stale letters outside the benchmark token
- note: the current stable suite contains no dedicated `י` case, so `י` export counts are `0` in this baseline

## Totals

- stable cases: `7`
- total exported non-`F` points: `9`
- consumed later: `3` (`0.333`)
- accompanied later: `4` (`0.444`)
- live but unused at boundary: `2` (`0.222`)
- by letter: `י=0` `ז=3` `ע=1` `ה=5`

## Cases

### `זה` — `zeh_genesis_31_38`

- ref: `Genesis/31/38` word `1`
  | handle | carrier | kind | outcome | later step | live at boundary |
  | --- | --- | --- | --- | --- | --- |
  | `ז:1:1` | `ז` | `port_export` | `consumed_later` | consumed by `ה` @ 2 | `true` |
  | `ה:1:2` | `ה` | `adjunct_export` | `live_unused_at_boundary` | - | `true` |

### `זו` — `zu_exodus_15_13`

- ref: `Exodus/15/13` word `4`
  | handle | carrier | kind | outcome | later step | live at boundary |
  | --- | --- | --- | --- | --- | --- |
  | `ז:1:1` | `ז` | `port_export` | `accompanied_later` | accompanied by `ו` @ 2 | `true` |

### `הזה` — `hazeh_exodus_12_2`

- ref: `Exodus/12/2` word `2`
  | handle | carrier | kind | outcome | later step | live at boundary |
  | --- | --- | --- | --- | --- | --- |
  | `ה:1:2` | `ה` | `adjunct_export` | `accompanied_later` | accompanied by `ז` @ 2 | `true` |
  | `ז:1:1` | `ז` | `port_export` | `consumed_later` | consumed by `ה` @ 3 | `true` |
  | `ה:1:4` | `ה` | `adjunct_export` | `live_unused_at_boundary` | - | `true` |

### `נס` — `nes_numbers_21_8`

- ref: `Numbers/21/8` word `11`
- exported points: none

### `העץ` — `haetz_genesis_3_3`

- ref: `Genesis/3/3` word `2`
  | handle | carrier | kind | outcome | later step | live at boundary |
  | --- | --- | --- | --- | --- | --- |
  | `ה:1:2` | `ה` | `adjunct_export` | `accompanied_later` | accompanied by `ע` @ 2 | `true` |
  | `ע:1:2` | `ע` | `origin_export` | `consumed_later` | consumed by `ץ` @ 3 | `false` |

### `לך` — `lekh_exodus_3_16`

- ref: `Exodus/3/16` word `1`
- exported points: none

### `הן` — `hen_deuteronomy_10_14`

- ref: `Deuteronomy/10/14` word `1`
  | handle | carrier | kind | outcome | later step | live at boundary |
  | --- | --- | --- | --- | --- | --- |
  | `ה:1:2` | `ה` | `adjunct_export` | `accompanied_later` | accompanied by `ן` @ 2 | `true` |
