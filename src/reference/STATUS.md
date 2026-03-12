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
- Runtime errors are thrown for illegal boundary misuse and unknown obligation kinds during space resolution.

## Stubbed / minimal

- All letters have minimal v0 semantics; several remain shallow approximations of the spec.
- Diacritic wrappers are parsed; `dagesh` hardens the envelope and `shuruk` remains lexical-only.
- Selection policy uses deterministic sourcing with per-bucket distinctness; type checks are still minimal.
- `ב` creates an anchored boundary handle for “inside-of” and updates the ambient world.
- `ד` exposes a supported head via `head_of`, `cont`, and `supp` (without `carry`).
- `ג` emits a shoulder continuation: `cont(F, M)`, `carry(F, M)`, `cont(M, F⁺)`.
- `ה` seals a resolved head and exports a detached adjunct leg via `sub` while keeping focus on the head.
- `ז` creates an exported supported projection via `cont`/`supp` and keeps focus in place.
- `ט` rewrites the target envelope around a single sanctioned port and adds no graph edges.
- `וּ` (shuruk) does not alter `ו` semantics beyond lexical host detection.
- `ו` no longer performs grouping; it only advances the spine via `cont`.
- `כ`, `ל`, and `מ` implement the resolved-hold family: hold, step-past, and open enclosure.
- `נ`, `ס`, and `ע` implement unresolved continuation, nearest carry closure, and origin-exported continuation.
- `י` creates an `entity` handle seeded from focus.
- `ק`, `ר`, and `ש` implement bare head-with-leg, bare head, and three-point attachment.
- GC, rules, and extended classroom relations are placeholders.
