import { BOT_ID, createHandle } from "../state/handles";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ש",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const shinOp: LetterOp = {
  meta,
  select: (S: State) => ({ S, ops: { args: [S.vm.F], prefs: {} } }),
  bound: (S: State, ops) => {
    const focus = ops.args[0];
    const requested = ops.prefs?.shin_branch;
    const active = requested === "left" || requested === "right" ? requested : "right";
    const spineId = nextId(S, "ש");
    const leftId = nextId(S, "ש");
    const rightId = nextId(S, "ש");
    const parentId = nextId(S, "ש");
    S.handles.set(
      spineId,
      createHandle(spineId, "structured", { meta: { role: "spine", parent: parentId } })
    );
    S.handles.set(
      leftId,
      createHandle(leftId, "structured", { meta: { role: "left", parent: parentId } })
    );
    S.handles.set(
      rightId,
      createHandle(rightId, "structured", { meta: { role: "right", parent: parentId } })
    );
    S.handles.set(
      parentId,
      createHandle(parentId, "structured", {
        meta: { base: focus, spine: spineId, left: leftId, right: rightId, active }
      })
    );
    const cons: Construction = {
      base: focus,
      envelope: defaultEnvelope(),
      meta: { parentId, focus, spineId, leftId, rightId, active }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { parentId, focus, spineId, leftId, rightId, active } = cons.meta as {
      parentId: string;
      focus: string;
      spineId: string;
      leftId: string;
      rightId: string;
      active: "left" | "right";
    };
    S.links.push({ from: parentId, to: spineId, label: "branch" });
    S.links.push({ from: parentId, to: leftId, label: "branch" });
    S.links.push({ from: parentId, to: rightId, label: "branch" });
    S.vm.H.push({
      type: "shin",
      tau: S.vm.tau,
      data: { id: parentId, focus, spine: spineId, left: leftId, right: rightId, active }
    });
    return { S, h: parentId, r: BOT_ID };
  }
};
