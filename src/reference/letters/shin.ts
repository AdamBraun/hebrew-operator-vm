import { BOT_ID } from "../state/handles";
import { State } from "../state/state";
import { fork, ForkDirection, ForkHandle } from "../vm/constructs/fork";
import { selectCurrentFocus } from "../vm/select";
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
  select: (S: State) => selectCurrentFocus(S),
  bound: (S: State, ops) => {
    const focus = ops.args[0];
    const requested = ops.prefs?.shin_branch;
    const active = requested === "left" || requested === "right" ? requested : "right";
    const direction: ForkDirection =
      ops.prefs?.shin_direction === "internal" ? "internal" : "external";
    const forkHandle = fork(S, focus, direction, active);
    const cons: Construction = {
      base: focus,
      envelope: defaultEnvelope(),
      meta: forkHandle
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { parentId, focusId, spineId, leftId, rightId, activeId, direction } =
      cons.meta as ForkHandle;
    if (direction === "external") {
      S.links.push({ from: parentId, to: spineId, label: "branch" });
      S.links.push({ from: parentId, to: leftId, label: "branch" });
      S.links.push({ from: parentId, to: rightId, label: "branch" });
    }
    S.vm.H.push({
      type: "shin",
      tau: S.vm.tau,
      data: {
        id: parentId,
        focus: focusId,
        spine: spineId,
        left: leftId,
        right: rightId,
        active: activeId,
        direction
      }
    });
    if (direction === "external") {
      return { S, h: parentId, r: BOT_ID, export_handle: activeId };
    }
    return { S, h: parentId, r: BOT_ID };
  }
};
