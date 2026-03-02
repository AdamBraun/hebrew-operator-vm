# Ref Order Source Contract (Authoritative)

## Chosen Source

Metadata ref ordering uses **Option A**:

- source file: `data/torah.json`
- source section: `books[].chapters[].verses[]`

Normalization-layer outputs are not used as the primary ref-order source.

## Output

The extractor emits `RefKey[]` in canonical Torah order:

1. `Genesis`
2. `Exodus`
3. `Leviticus`
4. `Numbers`
5. `Deuteronomy`

Within each book:

- chapters are ordered by ascending chapter number,
- verses are ordered by ascending verse number.

## Inclusion/Exclusion Policy

- Only Torah books are included.
- Non-Torah books (if present in corpus payload) are ignored.
- Missing required Torah books are fatal.

## Stability Guarantees

- For identical `data/torah.json` content, output `RefKey[]` is byte-stable.
- Ordering does not depend on input array insertion order; ordering is canonicalized numerically.

## Current Corpus Checks

With current corpus (`data/torah.json`):

- first ref: `Genesis/1/1`
- last ref: `Deuteronomy/34/12`
- length equals the number of Torah verses present in the corpus payload.
