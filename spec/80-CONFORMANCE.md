# Conformance Levels

Implementations MUST declare the highest level they satisfy and MUST pass the corresponding tests under `/tests/`.

## L0 Core VM

- Tokenization and lexical rules
- VM execution model
- Determinism rules
- Space (`□`) semantics
- No requirement to implement full letter library

### Recommended obligation tests (legacy)

These are non-normative but useful as minimum sanity checks:

- **T1 — Unresolved nun falls at boundary**: program `נ □` ⇒ event log contains `fall(child,parent,τ)`, `F` equals the pre-נ focus, and `R` equals the child created by נ.
- **T2 — Nun stabilized by samekh does not fall**: program `נ ס □` ⇒ no `fall` event for that nun, `policy(F)` is `framed_lock` after ס, and `F` remains in the supported continuation at boundary.
- **T3 — Final nun does not leave pending support**: program `ן □` ⇒ no `fall` event and `policy(F)` is `framed_lock`.
- **T4 — Mem pending closes silently at boundary (no export)**: program `מ □` ⇒ no exported mem handle pushed to `K` by boundary; the internal mem zone is closed via `CloseMemZoneSilently`.
- **T5 — Final mem exports handle**: program `מ ם □` ⇒ a stable mem handle is exported and becomes `F` before boundary; no pending `MEM_ZONE` remains at boundary.

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
