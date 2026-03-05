# Niqqud Class Vocabulary

Authoritative mapping source:

- class enum/order: `src/layers/niqqud/classes.ts`
- raw mark map: `src/layers/niqqud/map.ts`

## Class Set

- `SHVA`
- `HATAF_SEGOL`
- `HATAF_PATAH`
- `HATAF_QAMATS`
- `HIRIQ` (chirik)
- `TSERE`
- `SEGOL`
- `PATAH`
- `QAMATS`
- `HOLAM` (cholam)
- `QUBUTS` (kubutz)
- `DAGESH_SHURUK_DOT`
- `RAFE`
- `SHIN_DOT_RIGHT`
- `SHIN_DOT_LEFT`

## Raw Unicode Mark Mapping

- `U+05B0 HEBREW POINT SHEVA` -> `SHVA`
- `U+05B1 HEBREW POINT HATAF SEGOL` -> `HATAF_SEGOL`
- `U+05B2 HEBREW POINT HATAF PATAH` -> `HATAF_PATAH`
- `U+05B3 HEBREW POINT HATAF QAMATS` -> `HATAF_QAMATS`
- `U+05B4 HEBREW POINT HIRIQ` -> `HIRIQ`
- `U+05B5 HEBREW POINT TSERE` -> `TSERE`
- `U+05B6 HEBREW POINT SEGOL` -> `SEGOL`
- `U+05B7 HEBREW POINT PATAH` -> `PATAH`
- `U+05B8 HEBREW POINT QAMATS` -> `QAMATS`
- `U+05B9 HEBREW POINT HOLAM` -> `HOLAM`
- `U+05BA HEBREW POINT HOLAM HASER FOR VAV` -> `HOLAM`
- `U+05BB HEBREW POINT QUBUTS` -> `QUBUTS`
- `U+05BC HEBREW POINT DAGESH OR MAPIQ` -> `DAGESH_SHURUK_DOT`
- `U+05BF HEBREW POINT RAFE` -> `RAFE`
- `U+05C1 HEBREW POINT SHIN DOT` -> `SHIN_DOT_RIGHT`
- `U+05C2 HEBREW POINT SIN DOT` -> `SHIN_DOT_LEFT`
- `U+05C7 HEBREW POINT QAMATS QATAN` -> `QAMATS`

## Explicit Exclusions

- `U+05BD HEBREW POINT METEG` is currently excluded from class mapping and is emitted in `unhandled[]`.
- Teamim/cantillation marks are not part of this niqqud class map.

## Ambiguity Policy

- Ambiguous raw marks map to one neutral class token instead of letter-specific interpretation.
- Example: `U+05BC` always maps to `DAGESH_SHURUK_DOT` (no attempt to resolve dagesh vs mapiq vs shuruk here).
- `flags.ambiguous=true` is reserved for conflicting class co-occurrence, not for single-mark ambiguity.
- Recommended conflict sets:
  - Vowel nucleus conflict: if more than one of
    `SHVA`, `HATAF_SEGOL`, `HATAF_PATAH`, `HATAF_QAMATS`, `HIRIQ`, `TSERE`, `SEGOL`, `PATAH`, `QAMATS`, `HOLAM`, `QUBUTS`
    is present.
  - Dot conflict: `SHIN_DOT_RIGHT` and `SHIN_DOT_LEFT` both present.
