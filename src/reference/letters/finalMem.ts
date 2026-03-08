import { BOT_ID, createHandle } from "../state/handles";
import {
  addBoundary,
  addCarry,
  addCont,
  addSupp,
  closeBoundaryRecord,
  findNearestOpenBoundaryContaining
} from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectCurrentFocus } from "../vm/select";
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

    let boundary = findNearestOpenBoundaryContaining(S, focus, "mem_enclosure");
    let closeSource = focus;
    let mode: "existing" | "synthetic" = "existing";

    if (!boundary) {
      const holdId = nextId(S, "מ");
      const interiorId = nextId(S, "מ");
      const boundaryId = nextId(S, "מb");
      S.handles.set(holdId, createHandle(holdId, "scope", { meta: { heldFrom: focus } }));
      S.handles.set(
        interiorId,
        createHandle(interiorId, "scope", {
          meta: { interiorOf: holdId, boundaryId }
        })
      );
      addCont(S, focus, holdId);
      addCarry(S, focus, holdId);
      addSupp(S, holdId, focus);
      addCont(S, holdId, interiorId);
      boundary = addBoundary(S, boundaryId, interiorId, holdId, 1, {
        kind: "mem_enclosure",
        open: true,
        closed: false
      });
      closeSource = interiorId;
      mode = "synthetic";
      S.vm.H.push({
        type: "mem_open",
        tau: S.vm.tau,
        data: {
          id: boundaryId,
          source: focus,
          hold: holdId,
          inside: interiorId,
          outside: holdId,
          synthetic: true
        }
      });
    }

    const sealedId = nextId(S, "ם");
    S.handles.set(
      sealedId,
      createHandle(sealedId, "scope", {
        meta: { sealedFrom: closeSource, boundaryId: boundary.id, mode }
      })
    );
    addCont(S, closeSource, sealedId);
    addCarry(S, closeSource, sealedId);
    addSupp(S, sealedId, closeSource);
    closeBoundaryRecord(S, boundary.id, {
      close_mode: mode === "synthetic" ? "synthetic" : "explicit",
      closed_by: "ם"
    });
    S.vm.H.push({
      type: "mem_close",
      tau: S.vm.tau,
      data: {
        id: boundary.id,
        focus: closeSource,
        sealed: sealedId,
        inside: boundary.inside,
        outside: boundary.outside,
        mode
      }
    });
    return { S, h: sealedId, r: BOT_ID };
  }
};
