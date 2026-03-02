# RefKey Contract (Authoritative)

## Purpose

`RefKey` is the canonical reference identity for verse-level addressing in the Torah corpus.

It is used for stable planning/navigation keys (including metadata checkpoints) and is independent of tokenization, grapheme segmentation, or runtime anchors.

## Format

Canonical string shape:

`<Book>/<Chapter>/<Verse>`

Example:

`Genesis/1/1`

Allowed `Book` values are frozen to:

- `Genesis`
- `Exodus`
- `Leviticus`
- `Numbers`
- `Deuteronomy`

`Chapter` and `Verse` are positive base-10 integers (`>= 1`) with no sign and no semantic suffixes.

## Parsing and Formatting Guarantees

- Parsing MUST be strict and reject non-canonical strings.
- Formatting MUST always emit canonical `Book/Chapter/Verse`.
- Parse(format(x)) and format(parse(k)) MUST be stable for valid inputs.

## Stability Guarantees

- `RefKey` identity is stable across runs.
- `RefKey` does not depend on tokenization (`gid`, `gapid`, word index) or VM/runtime state.
- Changing grapheme segmentation or anchor indexes must not change `RefKey`.

## Metadata Boundary Rule

Metadata plan boundaries MUST be keyed by `RefKey` (`checkpoints[].ref_end`).

Metadata boundaries MUST NOT use grapheme/gap anchors:

- no `gid`
- no `gapid`
