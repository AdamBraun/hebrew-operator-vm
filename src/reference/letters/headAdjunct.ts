import { createHandle } from "../state/handles";
import { addExportedAdjunct } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";

type HeadAdjunctSpec = {
  meta?: Record<string, any>;
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
