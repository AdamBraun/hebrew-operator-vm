# Cantillation Marks Mapping

This document defines the source-of-truth mapping from raw cantillation marks
(`marks_raw.teamim`) to cantillation layer semantics.

Authoritative implementation:

- `src/layers/cantillation/marks.ts`

## Scope

This mapping covers the **observed corpus set** currently used by the project
(derived from observed-only teamim policy).

Each known mark maps to:

- `name` (canonical internal name)
- `class` (`CONJ` or `DISJ`)
- `rank` (`integer | null`)
- `default_op` (`CUT` or `CONJ`)

## Rank Policy

Current policy is:

- `DISJ` marks carry an explicit rank (integer `>= 1`).
- `CONJ` marks carry `rank = null`.

Unknown marks must not receive guessed ranks.

## Known Teamim Mapping

| Mark | Codepoint | Name             | Class  | Rank | Default Op |
| ---- | --------- | ---------------- | ------ | ---: | ---------- |
| `֑`  | `U+0591`  | `ETNAHTA`        | `DISJ` |    2 | `CUT`      |
| `֒`  | `U+0592`  | `SEGOL`          | `DISJ` |    2 | `CUT`      |
| `֓`  | `U+0593`  | `SHALSHELET`     | `DISJ` |    2 | `CUT`      |
| `֔`  | `U+0594`  | `ZAQEF_QATAN`    | `DISJ` |    2 | `CUT`      |
| `֕`  | `U+0595`  | `ZAQEF_GADOL`    | `DISJ` |    2 | `CUT`      |
| `֖`  | `U+0596`  | `TIPCHA`         | `DISJ` |    1 | `CUT`      |
| `֗`  | `U+0597`  | `REVIA`          | `DISJ` |    2 | `CUT`      |
| `֘`  | `U+0598`  | `ZARQA`          | `DISJ` |    1 | `CUT`      |
| `֙`  | `U+0599`  | `PASHTA`         | `DISJ` |    2 | `CUT`      |
| `֚`  | `U+059A`  | `YETIV`          | `DISJ` |    1 | `CUT`      |
| `֛`  | `U+059B`  | `TEVIR`          | `DISJ` |    1 | `CUT`      |
| `֜`  | `U+059C`  | `GERESH`         | `DISJ` |    1 | `CUT`      |
| `֞`  | `U+059E`  | `GERSHAYIM`      | `DISJ` |    1 | `CUT`      |
| `֟`  | `U+059F`  | `QARNEY_PARA`    | `DISJ` |    2 | `CUT`      |
| `֠`  | `U+05A0`  | `TELISHA_GEDOLA` | `DISJ` |    1 | `CUT`      |
| `֡`  | `U+05A1`  | `PAZER`          | `DISJ` |    2 | `CUT`      |
| `֣`  | `U+05A3`  | `MUNACH`         | `CONJ` | null | `CONJ`     |
| `֤`  | `U+05A4`  | `MAHPAKH`        | `CONJ` | null | `CONJ`     |
| `֥`  | `U+05A5`  | `MERKHA`         | `CONJ` | null | `CONJ`     |
| `֦`  | `U+05A6`  | `MERKHA_KEFULA`  | `CONJ` | null | `CONJ`     |
| `֧`  | `U+05A7`  | `DARGA`          | `CONJ` | null | `CONJ`     |
| `֨`  | `U+05A8`  | `QADMA`          | `CONJ` | null | `CONJ`     |
| `֩`  | `U+05A9`  | `TELISHA_QETANA` | `DISJ` |    1 | `CUT`      |
| `֪`  | `U+05AA`  | `YERAH_BEN_YOMO` | `DISJ` |    1 | `CUT`      |
| `֮`  | `U+05AE`  | `ZINOR`          | `DISJ` |    3 | `CUT`      |

## Fallback Strategy

Unknown teamim marks MUST follow this policy:

1. Emit an unknown mark event (`event.type = "UNKNOWN_MARK"`) when extraction chooses to surface unknowns.
2. Count unknowns in coverage metrics (`marks_unknown`).
3. Do not guess `rank`.

Recommended counters in cantillation extraction/reporting:

- `marks_seen`
- `marks_mapped`
- `marks_unknown`

## Determinism Constraint

For identical input marks, mark resolution MUST be deterministic.

Known marks must always map to the same `(class, rank, default_op)` tuple.
Unknown marks must always map to `UNKNOWN_MARK` with no inferred rank.
