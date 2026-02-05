import { BOT_ID, createHandle } from "../state/handles";
import { addBoundary } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ת",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const tavOp: LetterOp = {
  meta,
  select: (S: State) => ({ S, ops: { args: [S.vm.F], prefs: {} } }),
  bound: (S: State, ops) => {
    const target = ops.args[0];
    const frame = S.vm.E[S.vm.E.length - 1];
    const outside =
      S.vm.R !== BOT_ID ? S.vm.R : frame?.Omega_frame ? frame.Omega_frame : S.vm.Omega;
    const boundaryId = nextId(S, "ת");
    S.handles.set(
      boundaryId,
      createHandle(boundaryId, "boundary", {
        anchor: 1,
        meta: { inside: target, outside, closedBy: "ת" }
      })
    );
    addBoundary(S, boundaryId, target, outside, 1);
    const artifactId = nextId(S, "ת");
    S.handles.set(
      artifactId,
      createHandle(artifactId, "artifact", {
        policy: "final",
        meta: { base: target, boundaryId, mark: 1 }
      })
    );
    const residueId = nextId(S, "ת");
    S.handles.set(
      residueId,
      createHandle(residueId, "scope", {
        meta: { residueOf: target, outside, artifact: artifactId, mark: 1 }
      })
    );
    const cons: Construction = {
      base: target,
      envelope: defaultEnvelope("final"),
      meta: { target, outside, boundaryId, artifactId, residueId }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { target, outside, boundaryId, artifactId, residueId } = cons.meta as {
      target: string;
      outside: string;
      boundaryId: string;
      artifactId: string;
      residueId: string;
    };
    S.vm.wordLastSealedArtifact = artifactId;
    S.vm.H.push({
      type: "finalize",
      tau: S.vm.tau,
      data: { id: artifactId, target, outside, boundaryId, residueId }
    });
    return { S, h: residueId, r: artifactId };
  }
};
