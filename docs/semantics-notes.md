# Semantics notes (v0)

## Implemented

* Deterministic IDs (`<letter>:<tau>:<counter>`) and event log.
* Space boundary (`□`) resolution for `SUPPORT` and `MEM_ZONE` obligations.
* Letters with v0 semantics: נ, ן, ס, מ, ם, ב, ד, ג, ה.
* Tokenizer with Hebrew letters, finals, whitespace→`□`, and basic niqqud mapping.
* Whitespace is semantic: `"נ ס"` inserts `□` and discharges support before `ס`.
* Same-word `"נס"` allows samekh to discharge support before the boundary.

## Stubbed / minimal

* All other letters are no-ops (select + seal focus unchanged).
* Diacritic wrappers are parsed but only `dagesh/shuruk` harden policy (no-op elsewhere).
* Selection policy uses only basic deterministic sourcing; distinctness/type checks omitted.
* `ב` opens a `BOUNDARY` obligation; `ד` closes it into a boundary handle/record (or opens+closes immediately if none is pending).
* `ג` creates a link handle and records a `links` entry.
* `ה` seals a `final` artifact handle.
* `וּ` (shuruk) marks the current base handle with `meta.carrier_active = true` and hardens it.
* GC, rules, and extended classroom relations are placeholders.
