import { BOT_ID, createHandle } from "../state/handles";
import { closeMemZoneSilently } from "../state/relations";
import { State } from "../state/state";
import { RuntimeError } from "../vm/errors";
import { nextId } from "../vm/ids";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ם",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const finalMemOp: LetterOp = {
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
    const focus = cons.meta.focus as string;
    if (S.vm.OStack_word.length > 0) {
      const top = S.vm.OStack_word[S.vm.OStack_word.length - 1];
      if (top.kind !== "MEM_ZONE") {
        throw new RuntimeError("Final mem encountered non-mem obligation");
      }
      const obligation = S.vm.OStack_word.pop();
      if (!obligation) {
        throw new RuntimeError("Final mem obligation missing");
      }
      closeMemZoneSilently(S, obligation.child);
      const memHandle = nextId(S, "ם");
      S.handles.set(
        memHandle,
        createHandle(memHandle, "memHandle", { meta: { zone: obligation.child } })
      );
      return { S, h: memHandle, r: BOT_ID };
    }

    const zone = nextId(S, "מ");
    S.handles.set(zone, createHandle(zone, "memZone", { meta: { anchor: focus, closed: 1 } }));
    const memHandle = nextId(S, "ם");
    S.handles.set(memHandle, createHandle(memHandle, "memHandle", { meta: { zone } }));
    return { S, h: memHandle, r: BOT_ID };
  }
};
