export type DiacriticTier = "rosh" | "toch" | "sof";

export type DiacriticKind =
  | "shva"
  | "hiriq"
  | "tzere"
  | "segol"
  | "patach"
  | "kamatz"
  | "holam"
  | "kubutz"
  | "dagesh"
  | "shin_dot_right"
  | "shin_dot_left";

export type Diacritic = {
  mark: string;
  kind: DiacriticKind;
  tier: DiacriticTier;
};

export type InsideDotKind =
  | "dagesh"
  | "shuruk"
  | "mappiq"
  | "shin_dot_right"
  | "shin_dot_left"
  | "none";

export type Token = {
  letter: string;
  diacritics: Diacritic[];
  inside_dot_kind: InsideDotKind;
  raw: string;
  meta?: Record<string, any>;
};

export class CompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompileError";
  }
}
