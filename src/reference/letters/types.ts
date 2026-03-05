import { Envelope, defaultEnvelope } from "../state/policies";

export type LetterMeta = {
  letter: string;
  arity_req: number;
  arity_opt: number;
  distinct_required: boolean;
  distinct_optional: boolean;
  reflexive_ok: boolean;
};

export type SelectOperands = { args: string[]; prefs: Record<string, any> };

export { Envelope, defaultEnvelope };

export type Construction = {
  base: string;
  envelope: Envelope;
  meta: Record<string, any>;
};

export type SealResult = {
  S: import("../state/state").State;
  h: string;
  r: string;
  export_handle?: string;
  advance_focus?: boolean;
};

export type LetterOp = {
  meta: LetterMeta;
  select: (S: import("../state/state").State) => {
    S: import("../state/state").State;
    ops: SelectOperands;
  };
  bound: (
    S: import("../state/state").State,
    ops: SelectOperands
  ) => { S: import("../state/state").State; cons: Construction };
  seal: (S: import("../state/state").State, cons: Construction) => SealResult;
};
