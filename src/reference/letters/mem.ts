import { BOT_ID, createHandle } from "../state/handles";
import { addBoundary, addCont, addSupp } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectCurrentFocus } from "../vm/select";
import { Construction, LetterMeta, LetterOp, SelectOperands, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "מ",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const memOp: LetterOp = {
  meta,
  select: (S: State) => selectCurrentFocus(S),
  bound: (S: State, ops: SelectOperands) => {
    const source = ops.args[0];
    const holdId = nextId(S, "מ");
    const interiorId = nextId(S, "מ");
    const boundaryId = nextId(S, "מb");
    S.handles.set(holdId, createHandle(holdId, "scope", { meta: { heldFrom: source } }));
    S.handles.set(
      interiorId,
      createHandle(interiorId, "scope", {
        meta: { interiorOf: holdId, boundaryId }
      })
    );
    addCont(S, source, holdId);
    addSupp(S, holdId, source);
    addCont(S, holdId, interiorId);
    addBoundary(S, boundaryId, interiorId, holdId, 1, {
      kind: "mem_enclosure",
      open: true,
      closed: false
    });
    const cons: Construction = {
      base: source,
      envelope: defaultEnvelope(),
      meta: { source, holdId, interiorId, boundaryId }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { source, holdId, interiorId, boundaryId } = cons.meta as {
      source: string;
      holdId: string;
      interiorId: string;
      boundaryId: string;
    };
    S.vm.H.push({
      type: "mem_open",
      tau: S.vm.tau,
      data: {
        id: boundaryId,
        source,
        hold: holdId,
        inside: interiorId,
        outside: holdId
      }
    });
    return { S, h: interiorId, r: BOT_ID };
  }
};
