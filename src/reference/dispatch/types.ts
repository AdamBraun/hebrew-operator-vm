import { DotKind, InsideDotKind, LetterMode } from "../compile/types";
import { State, VMEvent } from "../state/state";

export type CompiledModifierName =
  | "HOLAM"
  | "MAPIQ"
  | "SHURUK"
  | "DAGESH"
  | "SHIN_DOT_RIGHT"
  | "SHIN_DOT_LEFT"
  | "SHVA"
  | "HIRIQ"
  | "TSERE"
  | "SEGOL"
  | "PATACH"
  | "KAMATZ"
  | "KUBUTZ";

export type CompiledRuntimeSofKind =
  | "shva"
  | "hiriq"
  | "tzere"
  | "segol"
  | "patach"
  | "kamatz"
  | "kubutz";

export type CompileWarning = {
  code: string;
  message: string;
};

export type CompiledRuntimeSofModifier = {
  kind: CompiledRuntimeSofKind;
  mark: string;
  modifier: CompiledModifierName;
  hataf: boolean;
};

export type CompiledTokenRuntime = {
  token_letter: string;
  read_letter: string;
  shape_letter: string | null;
  shape_effect_scope: "routing" | null;
  rosh_branch: "left" | "right" | null;
  letter_mode_forced: LetterMode | null;
  has_shuruk: boolean;
  should_harden: boolean;
  sof_modifiers: CompiledRuntimeSofModifier[];
};

export type CompiledTokenBundle = {
  token_id: number;
  signature: string;
  base: string;
  count: number;
  op_family: string;
  modifiers: CompiledModifierName[];
  raw_marks: string[];
  derived: {
    rosh: CompiledModifierName[];
    toch: CompiledModifierName[];
    sof: CompiledModifierName[];
    dot_kind: DotKind;
    inside_dot_kind: InsideDotKind;
    modes: string[];
    ignored_marks: string[];
  };
  execution_plan: string[];
  event_contract: string[];
  warnings: CompileWarning[];
  runtime: CompiledTokenRuntime;
};

export type CompiledTokensFile = {
  schema_version: number;
  source: {
    registry_path: string;
    registry_sha256: string | null;
  };
  semantics: {
    definitions_path: string;
    schema_version: number | null;
    semver: string;
    definitions_sha256: string;
  };
  compile_policy: {
    illegal_combinations: string;
    unknown_marks: string;
    orthographic_noise: string;
  };
  stats: {
    tokens_total: number;
    warning_count: number;
    warning_by_code: Record<string, number>;
  };
  tokens: Record<string, CompiledTokenBundle>;
};

export type DispatchContext = {
  isWordFinal?: boolean;
};

export type TokenDispatchTable = Array<CompiledTokenBundle | undefined>;

export type DispatchApplyResult = [State, VMEvent[]];
