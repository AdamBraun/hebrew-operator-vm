# Conformance Levels

Implementations MUST declare the highest level they satisfy and MUST pass the corresponding tests under `/tests/`.

## L0 Core VM

- Tokenization and lexical rules
- VM execution model
- Determinism rules
- Space (`□`) semantics
- No requirement to implement full letter library

### Recommended boundary/carry tests

These are non-normative but useful as minimum sanity checks:

- **T1 — Unresolved nun is closed at boundary**: program `נ □` ⇒ the current chunk gains a boundary-time `supp` closure for the unresolved carry opened by `נ`.
- **T2 — Samekh resolves in-word carry**: program `נ ס □` ⇒ `ס` adds `supp(F, source)` against the nearest unresolved carry source before the boundary runs.
- **T3 — Final nun resolves at birth**: program `ן □` ⇒ the child created by `ן` already has `supp(child,parent)` before boundary handling.
- **T4 — Mem enclosure auto-closes at boundary**: program `מ □` ⇒ the open mem `BoundaryRecord` closes silently at the boundary, with no explicit final-mem seal node created by the boundary itself.
- **T5 — Final mem seals enclosure explicitly**: program `מ ם □` ⇒ a sealed mem node exists before boundary handling and the associated mem `BoundaryRecord` is closed.
- **T6 — WordStart bootstrap runs once per word**: for a 3-word input, `WORD_START` appears exactly 3 times (never on intra-word marks).
- **T7 — Glue preserves segment boundary state**: with carried segment state before `□glue`, next word starts with `segmentReset=false`.
- **T8 — Hard starts a new segment**: after `□hard`, next word starts with `segmentReset=true`, incremented segment id, and empty segment OStack.
- **T9 — Missing WordStart baseline fails early**: if letter execution occurs without `activeConstruct`, runtime throws a clear bootstrap error.

## L1 Modifier Engine

- Attachment typing and tiered modifier application
- Inside-dot disambiguation
- Modifier constraints from `spec/50-MODIFIER-SYSTEM.md`

## L2 Letter Library

- Full operator definitions from `/letters/`
- Registry consistency with `/registry/letters.yaml`
- All letter-level tests under `/tests/letters/`

## L3 Profile Runtime

- End-to-end tests for at least one profile under `/profiles/*`
- All required profile tests under `/tests/profiles/<profile>/`
