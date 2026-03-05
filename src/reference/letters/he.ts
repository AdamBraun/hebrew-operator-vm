import { BOT_ID, createHandle } from "../state/handles";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectCurrentFocus } from "../vm/select";
import { HehMode } from "../compile/types";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ה",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const heOp: LetterOp = {
  meta,
  select: (S: State) => selectCurrentFocus(S),
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
    const mode = (cons.meta.heh_mode as HehMode | undefined) ?? "public";

    const declarePublic = (): string => {
      const ruleId = nextId(S, "ה");
      S.handles.set(
        ruleId,
        createHandle(ruleId, "rule", {
          meta: { source: focus, public: 1, tau: S.vm.tau, he_mode: mode }
        })
      );
      S.rules.push({ id: ruleId, target: focus, patch: { public: true }, priority: 0 });
      S.vm.H.push({
        type: "declare",
        tau: S.vm.tau,
        data: { id: ruleId, target: focus, mode }
      });
      return ruleId;
    };

    if (mode === "breath") {
      const target = S.handles.get(focus);
      if (target) {
        target.meta = {
          ...target.meta,
          he_mode: "breath",
          final_tail: "breath",
          soft_public_shading: 1
        };
      }
      S.vm.H.push({
        type: "declare_breath",
        tau: S.vm.tau,
        data: { target: focus }
      });
      return { S, h: focus, r: BOT_ID };
    }

    const decl = declarePublic();

    if (mode === "pinned") {
      const pinId = nextId(S, "ה");
      S.handles.set(
        pinId,
        createHandle(pinId, "entity", {
          anchor: 1,
          meta: { seedOf: decl, source: focus, port: "interface", he_mode: "pinned" }
        })
      );
      S.vm.H.push({
        type: "declare_pin",
        tau: S.vm.tau,
        data: { declaration: decl, pin: pinId }
      });
      return { S, h: pinId, r: BOT_ID };
    }

    if (mode === "alias") {
      const aliasId = nextId(S, "ה");
      S.handles.set(
        aliasId,
        createHandle(aliasId, "alias", {
          meta: { left: decl, right: focus, transport: true, he_mode: "alias" }
        })
      );
      S.links.push({ from: decl, to: focus, label: "transport" });
      S.links.push({ from: focus, to: decl, label: "transport" });
      S.vm.H.push({
        type: "declare_alias",
        tau: S.vm.tau,
        data: { declaration: decl, referent: focus, alias: aliasId }
      });
      return { S, h: aliasId, r: BOT_ID };
    }

    return { S, h: decl, r: BOT_ID };
  }
};
