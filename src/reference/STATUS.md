# Semantics notes (v0)

> Implementation status notes. Normative spec lives in `/spec/` and machine truth in `/registry/`.

## Implemented

- Deterministic IDs (`<letter>:<tau>:<counter>`) and event log.
- Space boundary (`□`) resolution for `MEM_ZONE` obligations and carry closure via `supp`.
- Letters with v0 semantics: א, ב, ג, ד, ה, ו, ז, ח, ט, י, כ, ך, ל, מ, ם, נ, ן, ס, ע, פ, ף, צ, ץ, ק, ר, ש, ת.
- Tokenizer with Hebrew letters, finals, whitespace→`□`, and basic niqqud mapping.
- Shin/sin dot disambiguation: `שׁ` and `שׂ` are emitted as explicit token letters.
- Shin/sin directional execution: `שׁ` is external tripod attachment; `שׂ` is internal triangle attachment with a closed loop.
- Whitespace is semantic: `"נ ס"` inserts `□`, and `glue` boundaries preserve unresolved carries.
- Same-word `"נס"` allows samekh to close an unresolved carry via `supp`.
- Runtime errors are thrown for illegal nesting (e.g., `ם` with non-`MEM_ZONE` on top, `ד` with non-`BOUNDARY` obligation).

## Stubbed / minimal

- All letters have minimal v0 semantics; several remain shallow approximations of the spec.
- Diacritic wrappers are parsed; `dagesh` hardens the envelope and `shuruk` activates carrier mode (no-op elsewhere).
- Selection policy uses deterministic sourcing with per-bucket distinctness; type checks are still minimal.
- `ב` creates an anchored boundary handle for “inside-of” and updates the ambient world.
- `ד` creates an anchored boundary handle for inside/outside (using `R` or the current boundary context).
- `ג` records a `bestow` link/event and creates a structured handle.
- `ה` seals a public rule handle and records a declaration event.
- `וּ` (shuruk) marks the sealed handle with `meta.carrier_mode = seeded` and `meta.rep_flag = 1`.
- `ו` creates a structured link handle labeled `vav`.
- `י` creates an `entity` handle seeded from focus.
- GC, rules, and extended classroom relations are placeholders.
