# Normalization Report

- input: /Users/adambraun/projects/letters/data/torah.json
- output: /Users/adambraun/projects/letters/data/torah.normalized.teamim.txt
- checksum file: /Users/adambraun/projects/letters/data/torah.normalized.teamim.sha256
- normalization form: NFD
- te'amim policy: keep
- te'amim ranges: U+0591-U+05AF
- punctuation policy: retain
- maqaf policy (U+05BE): retain
- qamats-qatan policy (U+05C7): preserve (no rewrite)
- verses processed: 5846
- source idempotence failures: 0
- output idempotence failures: 0

## Codepoint Counts

- total codepoints before: 721428
- total codepoints after: 721428
- total combining marks before: 334675
- total combining marks after: 334675
- total te'amim removed: 0
- maqaf observed: 11474
- sof pasuq observed: 5853
- qamats-qatan observed: 1961
- qamats-qatan normalized to qamats: 0

## Category Totals

- kept:
  - niqqud: 201578
  - dots (dagesh/mappiq + shin/sin): 58153
  - te'amim: 64762
  - other combining marks: 10182
- removed:
  - niqqud: 0
  - dots (dagesh/mappiq + shin/sin): 0
  - te'amim: 0
  - other combining marks: 0

## Kept Mark Categories

- dagesh_or_mappiq: 42571
- niqqud: 201578
- other_hebrew_mark: 10168
- other_mark: 14
- shin_or_sin_dot: 15582
- teamim: 64762

## Removed Mark Categories

- (none)

## Teamim Codepoints Observed

- U+0591 (HEBREW ACCENT U+0591): 5494
- U+0592 (HEBREW ACCENT U+0592): 451
- U+0593 (HEBREW ACCENT U+0593): 4
- U+0594 (HEBREW ACCENT U+0594): 6998
- U+0595 (HEBREW ACCENT U+0595): 526
- U+0596 (HEBREW ACCENT U+0596): 11297
- U+0597 (HEBREW ACCENT U+0597): 2447
- U+0598 (HEBREW ACCENT U+0598): 59
- U+0599 (HEBREW ACCENT U+0599): 6378
- U+059A (HEBREW ACCENT U+059A): 357
- U+059B (HEBREW ACCENT U+059B): 2681
- U+059C (HEBREW ACCENT U+059C): 1120
- U+059E (HEBREW ACCENT U+059E): 513
- U+059F (HEBREW ACCENT U+059F): 1
- U+05A0 (HEBREW ACCENT U+05A0): 496
- U+05A1 (HEBREW ACCENT U+05A1): 159
- U+05A3 (HEBREW ACCENT U+05A3): 9465
- U+05A4 (HEBREW ACCENT U+05A4): 3049
- U+05A5 (HEBREW ACCENT U+05A5): 9141
- U+05A6 (HEBREW ACCENT U+05A6): 5
- U+05A7 (HEBREW ACCENT U+05A7): 1090
- U+05A8 (HEBREW ACCENT U+05A8): 2125
- U+05A9 (HEBREW ACCENT U+05A9): 530
- U+05AA (HEBREW ACCENT U+05AA): 1
- U+05AE (HEBREW ACCENT U+05AE): 375

## Policy Transformations Applied

- line_breaks_to_lf: 0
- markup_tags_removed: 2845
- html_entities_removed: 5065
- nbsp_to_space: 5065
- parasha_markers_removed: 670
- collapsed_horizontal_whitespace: 780
- trimmed_line_edges: 990
- qamats_qatan_to_qamats: 0

## Combining Mark Order Verification

- hebrew base letters checked: 305599
- base letters with combining marks checked: 225665
- out-of-order sequences detected: 0
- out-of-order samples: (none)

## Output Idempotence Samples

- (none)

## Output SHA-256

- 9e422280f2e06c0e655ba39b4457a917f09c4b372fdc5b8a50260c747c1ec11d
