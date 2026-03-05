import { BOT_ID, createHandle } from "../state/handles";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { resolveSelectableFocus } from "../vm/select";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "א",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

function hasWordConstruct(state: State, focusAtEntry: string): boolean {
  return !(
    state.vm.K.length === 2 &&
    state.vm.K[0] === focusAtEntry &&
    state.vm.K[1] === BOT_ID &&
    state.vm.F === focusAtEntry &&
    state.vm.R === BOT_ID
  );
}

export const alephOp: LetterOp = {
  meta,
  select: (S: State) => ({
    S,
    ops: { args: [S.vm.wordEntryFocus ?? resolveSelectableFocus(S)], prefs: {} }
  }),
  bound: (S: State, ops) => {
    const focusAtEntry = ops.args[0] ?? resolveSelectableFocus(S);
    const constructId = hasWordConstruct(S, focusAtEntry) ? S.vm.F : nextId(S, "א");
    if (constructId !== S.vm.F) {
      S.handles.set(
        constructId,
        createHandle(constructId, "scope", {
          meta: { seededBy: "א", word_anchor: 1, focus: focusAtEntry }
        })
      );
    }
    const aliasId = nextId(S, "א");
    const cons: Construction = {
      base: constructId,
      envelope: defaultEnvelope(),
      meta: { focusAtEntry, constructId, aliasId }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { focusAtEntry, constructId, aliasId } = cons.meta as {
      focusAtEntry: string;
      constructId: string;
      aliasId: string;
    };
    S.handles.set(
      aliasId,
      createHandle(aliasId, "alias", {
        meta: { left: focusAtEntry, right: constructId, transport: true }
      })
    );
    S.links.push({ from: focusAtEntry, to: constructId, label: "transport" });
    S.links.push({ from: constructId, to: focusAtEntry, label: "transport" });
    S.vm.H.push({
      type: "alias",
      tau: S.vm.tau,
      data: { left: focusAtEntry, right: constructId, id: aliasId }
    });
    return { S, h: constructId, r: BOT_ID };
  }
};
