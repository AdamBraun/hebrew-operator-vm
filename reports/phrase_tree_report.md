# Phrase Tree Report

- input: /Users/adambraun/projects/letters/data/torah.normalized.teamim.txt
- classification: /Users/adambraun/projects/letters/registry/teamim.classification.json
- book filter: Genesis
- phrase_version: phrase_tree.v1
- tree checksum (sha256): c6053c869324b017c2ab9f408602497e49d5de0505804bd0acf16768017981a8
- word-role checksum (sha256): deb1f5f90643ecc984bff4f7f595b5ea74de801bded678d965dbaddcaa52aa2b

## Totals

- verses processed: 1533
- words processed: 20613
- split nodes: 9908
- verses without split nodes: 0
- single-word verses: 0
- words without primary accent: 4466
- healings applied: 114

## Healing Types

- PARASHA_MARKER_REMOVED: 91
- EDITORIAL_NOTE_REMOVED: 19
- SPLIT_FRAGMENT_JOINED: 4

## Depth Stats

- min depth: 3
- avg depth: 6.28
- median depth: 6
- p90 depth: 8
- max depth: 12

## Top Split Patterns

- U+0596 | tipcha | p1: 2969
- U+0594 | zaqef_qatan | p2: 1877
- U+0591 | etnahta | p2: 1467
- U+0599 | pashta | p2: 1428
- U+059B | tevir | p1: 623
- U+0597 | revia | p2: 611
- U+059C | geresh | p1: 244
- U+0595 | zaqef_gadol | p2: 176
- U+059E | gershayim | p1: 114
- U+05A9 | telisha_qetana | p1: 92
- U+059A | yetiv | p1: 79
- U+05AE | zinor | p3: 73
- U+0592 | segol | p2: 72
- U+05A0 | telisha_gedola | p1: 51
- U+05A1 | pazer | p2: 29
- U+0593 | shalshelet | p2: 3

## Deepest Verses

- Genesis/27/33: depth=12, words=22, split_nodes=10
- Genesis/7/23: depth=11, words=25, split_nodes=9
- Genesis/8/21: depth=11, words=32, split_nodes=13
- Genesis/22/2: depth=11, words=25, split_nodes=12
- Genesis/28/9: depth=11, words=17, split_nodes=6
- Genesis/47/15: depth=11, words=21, split_nodes=9
- Genesis/47/29: depth=11, words=27, split_nodes=11
- Genesis/1/29: depth=10, words=27, split_nodes=10
- Genesis/21/17: depth=10, words=28, split_nodes=10
- Genesis/30/40: depth=10, words=21, split_nodes=9
- Genesis/34/25: depth=10, words=22, split_nodes=10
- Genesis/36/6: depth=10, words=30, split_nodes=11

## Determinism Rules

- split selection: strongest DISJUNCTIVE in span by precedence desc, codepoint asc, word index asc.
- split position rule: terminal word in a span is not eligible as a split position.
- no-split rule: left-associative sequential fold (`JOIN`, `fold=LEFT`).
- node ids: leaf `w_{word_index}`, internal `n_{start}_{end}_{type}`.
