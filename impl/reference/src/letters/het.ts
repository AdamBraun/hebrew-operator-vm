import { BOT_ID, createHandle } from "../state/handles";
import { addBoundary } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ח",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const hetOp: LetterOp = {
  meta,
  select: (S: State) => ({ S, ops: { args: [S.vm.F], prefs: {} } }),
  bound: (S: State, ops) => {
    const inside = ops.args[0];
    const frame = S.vm.E[S.vm.E.length - 1];
    const outside =
      S.vm.R !== BOT_ID ? S.vm.R : frame?.Omega_frame ? frame.Omega_frame : S.vm.Omega;
    const boundaryId = nextId(S, "ח");
    S.handles.set(
      boundaryId,
      createHandle(boundaryId, "boundary", {
        anchor: 1,
        meta: { inside, outside, closedBy: "ח" }
      })
    );
    addBoundary(S, boundaryId, inside, outside, 1);
    const compartmentId = nextId(S, "ח");
    S.handles.set(
      compartmentId,
      createHandle(compartmentId, "compartment", {
        meta: { inside, outside, boundaryId }
      })
    );
    const cons: Construction = {
      base: inside,
      envelope: defaultEnvelope(),
      meta: { inside, outside, boundaryId, compartmentId }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { inside, outside, boundaryId, compartmentId } = cons.meta as {
      inside: string;
      outside: string;
      boundaryId: string;
      compartmentId: string;
    };
    S.links.push({ from: inside, to: compartmentId, label: "compartment" });
    S.vm.H.push({
      type: "compartment",
      tau: S.vm.tau,
      data: { id: compartmentId, inside, outside, boundaryId }
    });
    return { S, h: compartmentId, r: BOT_ID };
  }
};
