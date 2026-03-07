import { HandleKind, createHandle } from "../state/handles";
import { addCarry, addCont, addExportedAdjunct, addHeadOf, addSupp } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";

type HeadAdjunctSpec = {
  meta?: Record<string, any>;
};

export type ExposeHeadWithLegArgs = {
  source: string;
  resolved: boolean;
  headIdPrefix?: string;
  legIdPrefix?: string;
  headKind?: HandleKind;
  legKind?: HandleKind;
  headMeta?: Record<string, any>;
  legMeta?: Record<string, any>;
};

export type ExposeHeadWithLegResult = {
  head: string;
  leg: string;
};

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeHeadAdjunctSpecs(value: unknown): HeadAdjunctSpec[] {
  if (value === null || value === undefined || value === false) {
    return [];
  }
  if (value === true) {
    return [{}];
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Array.from({ length: Math.max(0, Math.trunc(value)) }, () => ({}));
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeHeadAdjunctSpecs(entry));
  }
  if (!isRecord(value)) {
    return [];
  }
  if (isRecord(value.meta)) {
    return [{ meta: { ...value.meta } }];
  }
  return [{ meta: { ...value } }];
}

export function exportHeadAdjuncts(
  state: State,
  args: {
    headId: string;
    sourceLetter: "ד" | "ר";
    specs: unknown;
  }
): string[] {
  const specs = normalizeHeadAdjunctSpecs(args.specs);
  const adjunctIds: string[] = [];

  for (const spec of specs) {
    const adjunctId = nextId(state, "adj");
    state.handles.set(
      adjunctId,
      createHandle(adjunctId, "scope", {
        meta: {
          ...(spec.meta ?? {}),
          adjunct_of: args.headId,
          exported_by: args.sourceLetter,
          detached_adjunct: 1
        }
      })
    );
    addExportedAdjunct(state, args.headId, adjunctId);
    adjunctIds.push(adjunctId);
  }

  return adjunctIds;
}

export function exposeHeadWithLeg(
  state: State,
  args: ExposeHeadWithLegArgs
): ExposeHeadWithLegResult {
  const headId = nextId(state, args.headIdPrefix ?? "head");
  state.handles.set(
    headId,
    createHandle(headId, args.headKind ?? "scope", {
      meta: { ...(args.headMeta ?? {}) }
    })
  );
  addHeadOf(state, headId, args.source);
  addCarry(state, args.source, headId);
  if (args.resolved) {
    addSupp(state, headId, args.source);
  }

  const legId = nextId(state, args.legIdPrefix ?? "leg");
  state.handles.set(
    legId,
    createHandle(legId, args.legKind ?? "scope", {
      meta: { ...(args.legMeta ?? {}) }
    })
  );
  addCont(state, headId, legId);
  addCarry(state, headId, legId);
  if (args.resolved) {
    addSupp(state, legId, headId);
  }
  addExportedAdjunct(state, headId, legId);

  return { head: headId, leg: legId };
}
