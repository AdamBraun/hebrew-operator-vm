# Semantics notes (v0)

> Implementation status notes. Normative spec lives in `/spec/` and machine truth in `/registry/`.
> Post-change review scope for unary `ו` lives in `/spec/VAV_POST_CHANGE_REVIEW.md`.

## Implemented

- Deterministic IDs (`<letter>:<tau>:<counter>`) and event log.
- Space boundary (`□`) resolution for open mem enclosures and carry closure via `supp`.
- Letters with v0 semantics: א, ב, ג, ד, ה, ו, ז, ח, ט, י, כ, ך, ל, מ, ם, נ, ן, ס, ע, פ, ף, צ, ץ, ק, ר, ש, ת.
- Tokenizer with Hebrew letters, finals, whitespace→`□`, and basic niqqud mapping.
- Shin/sin dot disambiguation: `שׁ` and `שׂ` are emitted as explicit token letters.
- Shin/sin directional execution: `שׁ` is external tripod attachment; `שׂ` is internal triangle attachment with a closed loop.
- Whitespace is semantic: `"נ ס"` inserts `□`, and `glue` boundaries preserve unresolved carries.
- Same-word `"נס"` allows samekh to close an unresolved carry via `supp`.
- Runtime errors are thrown for illegal boundary misuse (e.g., `ד` with non-`BOUNDARY` obligation).

## Stubbed / minimal

- All letters have minimal v0 semantics; several remain shallow approximations of the spec.
- Diacritic wrappers are parsed; `dagesh` hardens the envelope and `shuruk` remains lexical-only.
- Selection policy uses deterministic sourcing with per-bucket distinctness; type checks are still minimal.
- `ב` creates an anchored boundary handle for “inside-of” and updates the ambient world.
- `ד` creates an anchored boundary handle for inside/outside (using `R` or the current boundary context).
- `ג` records a `bestow` link/event and creates a structured handle.
- `ה` seals a resolved head and exports a detached adjunct leg while keeping focus on the head.
- `וּ` (shuruk) does not alter `ו` semantics beyond lexical host detection.
- `ו` no longer performs grouping; it only advances the spine via `cont`.
- `י` creates an `entity` handle seeded from focus.
- GC, rules, and extended classroom relations are placeholders.
