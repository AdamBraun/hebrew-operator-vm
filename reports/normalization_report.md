# Normalization Report

- input: /Users/adambraun/projects/letters/data/torah.json
- output: /Users/adambraun/projects/letters/data/torah.normalized.txt
- checksum file: /Users/adambraun/projects/letters/data/torah.normalized.sha256
- normalization form: NFD
- te'amim policy: strip
- te'amim ranges: U+0591-U+05AF
- verses processed: 5846
- source idempotence failures: 0
- output idempotence failures: 0

## Codepoint Counts

- total codepoints before: 724216
- total codepoints after: 659454
- total combining marks before: 334675
- total combining marks after: 269913
- total te'amim removed: 64762

## Category Totals

- kept:
  - niqqud: 201578
  - dots (dagesh/mappiq + shin/sin): 58153
  - te'amim: 0
  - other combining marks: 10182
- removed:
  - niqqud: 0
  - dots (dagesh/mappiq + shin/sin): 0
  - te'amim: 64762
  - other combining marks: 0

## Kept Mark Categories

- dagesh_or_mappiq: 42571
- niqqud: 201578
- other_hebrew_mark: 10168
- other_mark: 14
- shin_or_sin_dot: 15582

## Removed Mark Categories

- teamim: 64762

## Combining Mark Order Verification

- hebrew base letters checked: 306269
- base letters with combining marks checked: 215075
- out-of-order sequences detected: 0
- out-of-order samples: (none)

## Output Idempotence Samples

- (none)

## Output SHA-256

- c1b28315feb648ad6cd085cf3083724dbebc9e560dd2c87518776cadb5b238e8
