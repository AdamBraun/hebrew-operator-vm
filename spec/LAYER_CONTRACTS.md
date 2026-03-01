# Layer Contracts

## Normalization vs Layout (Guardrail)

Normalization and Layout are separate layers with separate authority.

Normalization MUST:

- emit only canonical grapheme (`g`) and gap (`gap`) records,
- preserve raw marks on graphemes (`marks_raw.niqqud`, `marks_raw.teamim`),
- preserve raw boundary observations in gaps (`raw.whitespace`, `raw.chars`).

Normalization MUST NOT:

- emit `SETUMA`, `PETUCHA`, or `BOOK_BREAK`,
- emit any layout-strength or layout-classification field,
- infer layout semantics from whitespace or punctuation.

Layout layer is the only layer allowed to emit layout events such as:

- `SETUMA`
- `PETUCHA`
- `BOOK_BREAK`

Any introduction of layout signal into Normalization is a contract violation and MUST fail tests.
