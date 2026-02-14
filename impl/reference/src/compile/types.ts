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

export type DotKind = "dagesh" | "mappiq" | "shuruk" | "none";

export type InsideDotKind =
  | "dagesh"
  | "shuruk"
  | "mappiq"
  | "shin_dot_right"
  | "shin_dot_left"
  | "none";

export type HehMode = "public" | "breath" | "pinned" | "alias";
export type VavMode = "plain" | "seeded" | "transport";
export type LetterMode = HehMode | VavMode;

export type TropeKind = "none" | "conj" | "disj";

export type Trope = {
  kind: TropeKind;
  name?: string;
  rank?: number;
  codepoint?: string;
};

export type SpaceBoundaryMode = "hard" | "glue" | "glue_maqqef" | "cut";

export type SpaceBoundarySource =
  | "whitespace"
  | "maqqef"
  | "punctuation"
  | "implicit_leading"
  | "implicit_trailing";

export type SpaceBoundary = {
  mode: SpaceBoundaryMode;
  rank?: number;
  source: SpaceBoundarySource;
  left_trope?: Trope;
};

export type WordToken = {
  text_raw: string;
  letters: Token[];
  trope: Trope;
  has_maqqef: boolean;
};

export type Token = {
  letter: string;
  diacritics: Diacritic[];
  dot_kind: DotKind;
  inside_dot_kind: InsideDotKind;
  letter_mode?: LetterMode;
  is_final: boolean;
  raw: string;
  meta?: Record<string, any>;
  trope?: Trope;
  boundary?: SpaceBoundary;
  word_index?: number;
};

export class CompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompileError";
  }
}
