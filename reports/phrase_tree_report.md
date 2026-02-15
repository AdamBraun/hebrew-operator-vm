# Phrase Tree Report

- input: /Users/adambraun/projects/letters/data/torah.normalized.teamim.txt
- classification: /Users/adambraun/projects/letters/registry/teamim.classification.json
- book filter: all
- phrase_version: phrase_tree.v1
- tree checksum (sha256): 651b730b288cfbbd481c0b7d0f7e0a34cdd9e0cd9193d659497bca9ce991dcf5
- word-role checksum (sha256): 69ac79f689bec6a767b167976975a93587d5bffc8e282a85171f9efe6d00d245

## Totals

- verses processed: 5846
- words processed: 79979
- split nodes: 38435
- verses without split nodes: 0
- single-word verses: 0
- words without primary accent: 17208
- healings applied: 65

## Healing Types

- PARASHA_MARKER_REMOVED: 0
- EDITORIAL_NOTE_REMOVED: 64
- SPLIT_FRAGMENT_JOINED: 1

## Depth Stats

- min depth: 3
- avg depth: 6.32
- median depth: 6
- p90 depth: 8
- max depth: 13

## Top Split Patterns

- U+0596 | tipcha | p1: 11282
- U+0594 | zaqef_qatan | p2: 6987
- U+0591 | etnahta | p2: 5488
- U+0599 | pashta | p2: 5437
- U+059B | tevir | p1: 2678
- U+0597 | revia | p2: 2435
- U+059C | geresh | p1: 1110
- U+0595 | zaqef_gadol | p2: 526
- U+059E | gershayim | p1: 511
- U+05A9 | telisha_qetana | p1: 454
- U+05AE | zinor | p3: 375
- U+0592 | segol | p2: 368
- U+059A | yetiv | p1: 357
- U+05A0 | telisha_gedola | p1: 266
- U+05A1 | pazer | p2: 155
- U+0593 | shalshelet | p2: 4
- U+05AA | yerah_ben_yomo | p1: 1
- U+059F | qarney_para | p2: 1

## Deepest Verses

- Numbers/32/29: depth=13, words=26, split_nodes=10
- Genesis/27/33: depth=12, words=22, split_nodes=10
- Deuteronomy/1/19: depth=11, words=23, split_nodes=12
- Deuteronomy/2/24: depth=11, words=21, split_nodes=8
- Deuteronomy/5/14: depth=11, words=26, split_nodes=13
- Deuteronomy/13/17: depth=11, words=23, split_nodes=11
- Deuteronomy/24/4: depth=11, words=29, split_nodes=12
- Exodus/7/19: depth=11, words=33, split_nodes=12
- Exodus/22/8: depth=11, words=31, split_nodes=14
- Exodus/29/20: depth=11, words=29, split_nodes=13
- Genesis/7/23: depth=11, words=25, split_nodes=9
- Genesis/8/21: depth=11, words=32, split_nodes=13

## Determinism Rules

- split selection: strongest DISJUNCTIVE in span by precedence desc, codepoint asc, word index asc.
- split position rule: terminal word in a span is not eligible as a split position.
- no-split rule: left-associative sequential fold (`JOIN`, `fold=LEFT`).
- node ids: leaf `w_{word_index}`, internal `n_{start}_{end}_{type}`.
