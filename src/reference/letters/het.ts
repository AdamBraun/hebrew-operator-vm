import { BOT_ID, createHandle } from "../state/handles";
import { addLink } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectCurrentFocus } from "../vm/select";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";
import { spawnResolvedPort } from "./ports";

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
  select: (S: State) => selectCurrentFocus(S),
  bound: (S: State, ops) => {
    const inside = ops.args[0];
    const frame = S.vm.E[S.vm.E.length - 1];
    const outside = S.vm.R !== BOT_ID ? S.vm.R : frame?.D_frame ? frame.D_frame : S.vm.D;
    const { portId: p_in } = spawnResolvedPort(S, {
      portOf: inside,
      prefix: "ז",
      exportToK: false
    });
    const { portId: p_out } = spawnResolvedPort(S, {
      portOf: outside,
      prefix: "ז",
      exportToK: false
    });
    const interfaceId = nextId(S, "ח");
    S.handles.set(
      interfaceId,
      createHandle(interfaceId, "gate", {
        meta: { inside, outside, p_in, p_out, formedBy: "ז+ז" }
      })
    );
    addLink(S, p_in, interfaceId, "bridge");
    addLink(S, p_out, interfaceId, "bridge");
    const cons: Construction = {
      base: inside,
      envelope: defaultEnvelope(),
      meta: { inside, outside, interfaceId, p_in, p_out }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { inside, outside, interfaceId, p_in, p_out } = cons.meta as {
      inside: string;
      outside: string;
      interfaceId: string;
      p_in: string;
      p_out: string;
    };
    S.vm.H.push({
      type: "interface",
      tau: S.vm.tau,
      data: { id: interfaceId, inside, outside, p_in, p_out }
    });
    return { S, h: interfaceId, r: BOT_ID };
  }
};
