# Teamim Registry Report

- input: /Users/adambraun/projects/letters/data/torah.normalized.teamim.txt
- classification: /Users/adambraun/projects/letters/registry/teamim.classification.json
- records scanned: 5846
- teamim marks scanned: 64762
- observed teamim codepoints: 25
- classification entries: 25
- unobserved classification entries: 0
- registry checksum (sha256): ee94c621e4b64164fa4126a6469731e7b9816b9017fc64a0f4eba155d599fcda

## Validation

- coverage: pass
- primary accent selection: if DISJUNCTIVE marks exist, choose highest precedence DISJUNCTIVE; otherwise choose highest precedence CONJUNCTIVE.
- tie-break rule: lower codepoint wins when precedence ties.
- parser rule source: registry/teamim.classification.json only.
- other policy: No observed teamim are currently classified as OTHER. Add explicit entries as needed when policy expands.

## Observed Counts By Class

- DISJUNCTIVE: codepoints=19, marks=39887
- CONJUNCTIVE: codepoints=6, marks=24875
- OTHER: codepoints=0, marks=0

## Observed Teamim (count desc)

- U+0596 HEBREW ACCENT TIPEHA | class=DISJUNCTIVE precedence=1 count=11297
- U+05A3 HEBREW ACCENT MUNAH | class=CONJUNCTIVE precedence=1 count=9465
- U+05A5 HEBREW ACCENT MERKHA | class=CONJUNCTIVE precedence=1 count=9141
- U+0594 HEBREW ACCENT ZAQEF QATAN | class=DISJUNCTIVE precedence=2 count=6998
- U+0599 HEBREW ACCENT PASHTA | class=DISJUNCTIVE precedence=2 count=6378
- U+0591 HEBREW ACCENT ETNAHTA | class=DISJUNCTIVE precedence=2 count=5494
- U+05A4 HEBREW ACCENT MAHAPAKH | class=CONJUNCTIVE precedence=1 count=3049
- U+059B HEBREW ACCENT TEVIR | class=DISJUNCTIVE precedence=1 count=2681
- U+0597 HEBREW ACCENT REVIA | class=DISJUNCTIVE precedence=2 count=2447
- U+05A8 HEBREW ACCENT QADMA | class=CONJUNCTIVE precedence=1 count=2125
- U+059C HEBREW ACCENT GERESH | class=DISJUNCTIVE precedence=1 count=1120
- U+05A7 HEBREW ACCENT DARGA | class=CONJUNCTIVE precedence=1 count=1090
- U+05A9 HEBREW ACCENT TELISHA QETANA | class=DISJUNCTIVE precedence=1 count=530
- U+0595 HEBREW ACCENT ZAQEF GADOL | class=DISJUNCTIVE precedence=2 count=526
- U+059E HEBREW ACCENT GERSHAYIM | class=DISJUNCTIVE precedence=1 count=513
- U+05A0 HEBREW ACCENT TELISHA GEDOLA | class=DISJUNCTIVE precedence=1 count=496
- U+0592 HEBREW ACCENT SEGOL | class=DISJUNCTIVE precedence=2 count=451
- U+05AE HEBREW ACCENT ZINOR | class=DISJUNCTIVE precedence=3 count=375
- U+059A HEBREW ACCENT YETIV | class=DISJUNCTIVE precedence=1 count=357
- U+05A1 HEBREW ACCENT PAZER | class=DISJUNCTIVE precedence=2 count=159
- U+0598 HEBREW ACCENT ZARQA | class=DISJUNCTIVE precedence=1 count=59
- U+05A6 HEBREW ACCENT MERKHA KEFULA | class=CONJUNCTIVE precedence=1 count=5
- U+0593 HEBREW ACCENT SHALSHELET | class=DISJUNCTIVE precedence=2 count=4
- U+059F HEBREW ACCENT QARNEY PARA | class=DISJUNCTIVE precedence=2 count=1
- U+05AA HEBREW ACCENT YERAH BEN YOMO | class=DISJUNCTIVE precedence=1 count=1
