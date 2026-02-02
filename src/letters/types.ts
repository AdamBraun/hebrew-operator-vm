import { HandlePolicy } from "../state/handles";

export type LetterMeta = {
  letter: string;
  arity_req: number;
  arity_opt: number;
  distinct_required: boolean;
  distinct_optional: boolean;
  reflexive_ok: boolean;
};

export type SelectOperands = { args: string[]; prefs: Record<string, any> };

export type Envelope = {
  ctx_flow: "HIGH" | "LOW";
  x_flow: "IMPLICIT_OK" | "EXPLICIT_ONLY";
  data_flow: "LIVE" | "SNAPSHOT";
  edit_flow: "OPEN" | "TIGHT";
  ports: Set<string>;
  coupling: "LINK" | "CopyNoBacklink";
  policy: HandlePolicy;
};

export type Construction = {
  base: string;
  envelope: Envelope;
  meta: Record<string, any>;
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
  seal: (
    S: import("../state/state").State,
    cons: Construction
  ) => { S: import("../state/state").State; h: string; r: string };
};

export function defaultEnvelope(policy: HandlePolicy = "soft"): Envelope {
  return {
    ctx_flow: "LOW",
    x_flow: "IMPLICIT_OK",
    data_flow: "LIVE",
    edit_flow: "OPEN",
    ports: new Set(),
    coupling: "LINK",
    policy
  };
}
