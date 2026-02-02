import { BOT_ID, createHandle } from "../state/handles";
import { addBoundary } from "../state/relations";
import { State } from "../state/state";
import { RuntimeError } from "../vm/errors";
import { nextId } from "../vm/ids";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ד",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const daletOp: LetterOp = {
  meta,
  select: (S: State) => ({ S, ops: { args: [S.vm.F], prefs: {} } }),
  bound: (S: State, ops) => {
    const cons: Construction = {
      base: ops.args[0],
      envelope: defaultEnvelope(),
      meta: { focus: ops.args[0] }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    void cons;
    const top = S.vm.OStack_word[S.vm.OStack_word.length - 1];
    if (!top || top.kind !== "BOUNDARY") {
      throw new RuntimeError("Dalet expected BOUNDARY obligation");
    }
    const obligation = S.vm.OStack_word.pop();
    if (!obligation) {
      throw new RuntimeError("Dalet boundary obligation missing");
    }
    const boundaryId = nextId(S, "ד");
    S.handles.set(
      boundaryId,
      createHandle(boundaryId, "boundary", {
        anchor: 1,
        meta: { inside: obligation.child, outside: obligation.parent, closedBy: "ד" }
      })
    );
    addBoundary(S, boundaryId, obligation.child, obligation.parent, 1);
    return { S, h: boundaryId, r: BOT_ID };
  }
};
