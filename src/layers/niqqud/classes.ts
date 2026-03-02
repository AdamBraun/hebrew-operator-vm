export type NiqqudClass =
  | "SHVA"
  | "HATAF_SEGOL"
  | "HATAF_PATAH"
  | "HATAF_QAMATS"
  | "HIRIQ"
  | "TSERE"
  | "SEGOL"
  | "PATAH"
  | "QAMATS"
  | "HOLAM"
  | "QUBUTS"
  | "DAGESH_SHURUK_DOT"
  | "RAFE"
  | "SHIN_DOT_RIGHT"
  | "SHIN_DOT_LEFT";

export const NIQQUD_CLASS_ORDER: readonly NiqqudClass[] = [
  "SHVA",
  "HATAF_SEGOL",
  "HATAF_PATAH",
  "HATAF_QAMATS",
  "HIRIQ",
  "TSERE",
  "SEGOL",
  "PATAH",
  "QAMATS",
  "HOLAM",
  "QUBUTS",
  "DAGESH_SHURUK_DOT",
  "RAFE",
  "SHIN_DOT_RIGHT",
  "SHIN_DOT_LEFT"
] as const;
