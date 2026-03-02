import {
  readNiqqudIRJsonl,
  type NiqqudFlags,
  type NiqqudIRRow,
  type NiqqudMods
} from "../layers/niqqud/schema";
import {
  assertLayoutIRRecord,
  compareLayoutIRRecords,
  compareRefKeysStable,
  type LayoutEvent,
  type LayoutIRRecord
} from "../layers/layout/schema";
import { type GapDescriptor } from "../layers/layout/spine_adapter";
import { deriveLayoutHygienePlan, type LayoutHygienePlan } from "./layout_hygiene_policy";

export type CantillationGapEvent = {
  gapid: string;
  ref_key: string;
  gap_index: number;
  event: Record<string, unknown>;
};

export type BoundaryFrame = {
  gapid: string;
  ref_key: string;
  gap_index: number;
  layout_events: LayoutEvent[];
  cantillation_events: CantillationGapEvent[];
  layout_hygiene_policy?: LayoutHygienePlan;
};

export type StitchBoundaryFramesArgs = {
  gaps: AsyncIterable<GapDescriptor> | Iterable<GapDescriptor>;
  layoutRecords?: AsyncIterable<LayoutIRRecord> | Iterable<LayoutIRRecord> | null;
  cantillationGapEvents?:
    | AsyncIterable<CantillationGapEvent>
    | Iterable<CantillationGapEvent>
    | null;
  allowMissingLayoutIR?: boolean;
  enableLayoutHygienePolicy?: boolean;
};

export type ExecutableOp = {
  gid: string;
  modifiers?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AttachedNiqqudPayload = {
  mods: NiqqudMods;
  unhandled: string[];
  flags: Pick<NiqqudFlags, "empty" | "ambiguous">;
};

type GapTuple = {
  gapid: string;
  ref_key: string;
  gap_index: number;
};

const GAPID_PATTERN = /^([^#]+)#gap:([0-9]+)$/;

const EMPTY_NIQQUD_MODS: NiqqudMods = {
  classes: [],
  features: {
    hasDagesh: false,
    hasShva: false,
    vowelCount: 0
  }
};

const EMPTY_NIQQUD_FLAGS: Pick<NiqqudFlags, "empty" | "ambiguous"> = {
  empty: true,
  ambiguous: false
};

function toAsyncIterator<T>(
  source: AsyncIterable<T> | Iterable<T>
): AsyncIterator<T, unknown, undefined> {
  const asyncIterable = source as AsyncIterable<T>;
  if (typeof asyncIterable[Symbol.asyncIterator] === "function") {
    return asyncIterable[Symbol.asyncIterator]();
  }

  const syncIterator = (source as Iterable<T>)[Symbol.iterator]();
  return {
    next: async () => syncIterator.next() as IteratorResult<T>
  };
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function compareGapTuple(left: GapTuple, right: GapTuple): number {
  const refCmp = compareRefKeysStable(left.ref_key, right.ref_key);
  if (refCmp !== 0) {
    return refCmp;
  }
  if (left.gap_index !== right.gap_index) {
    return left.gap_index - right.gap_index;
  }
  return compareText(left.gapid, right.gapid);
}

function cloneNiqqudMods(mods: NiqqudMods): NiqqudMods {
  return {
    classes: [...mods.classes],
    features: { ...mods.features },
    ...(mods.tierHints
      ? {
          tierHints: { ...mods.tierHints }
        }
      : {})
  };
}

function pickNiqqudFlags(flags: NiqqudFlags | undefined): Pick<NiqqudFlags, "empty" | "ambiguous"> {
  if (!flags) {
    return { ...EMPTY_NIQQUD_FLAGS };
  }
  return {
    empty: flags.empty,
    ambiguous: flags.ambiguous
  };
}

function cloneAttachedNiqqudFromRow(row: NiqqudIRRow): AttachedNiqqudPayload {
  return {
    mods: cloneNiqqudMods(row.mods),
    unhandled: [...row.unhandled],
    flags: pickNiqqudFlags(row.flags)
  };
}

function emptyAttachedNiqqud(): AttachedNiqqudPayload {
  return {
    mods: cloneNiqqudMods(EMPTY_NIQQUD_MODS),
    unhandled: [],
    flags: { ...EMPTY_NIQQUD_FLAGS }
  };
}

export async function loadNiqqudIndex(filePath: string): Promise<Map<string, NiqqudIRRow>> {
  const rows = await readNiqqudIRJsonl(filePath);
  const byGid = new Map<string, NiqqudIRRow>();
  for (const row of rows) {
    if (byGid.has(row.gid)) {
      throw new Error(`wrapper stitch: duplicate NiqqudIR gid '${row.gid}'`);
    }
    byGid.set(row.gid, row);
  }
  return byGid;
}

export function attachNiqqud(op: ExecutableOp, niqqudRow?: NiqqudIRRow): ExecutableOp {
  if (niqqudRow && niqqudRow.gid !== op.gid) {
    throw new Error(
      `wrapper stitch: niqqud row gid '${niqqudRow.gid}' does not match op gid '${op.gid}'`
    );
  }

  const existingModifiers =
    op.modifiers && typeof op.modifiers === "object" && !Array.isArray(op.modifiers)
      ? op.modifiers
      : {};

  const payload = niqqudRow ? cloneAttachedNiqqudFromRow(niqqudRow) : emptyAttachedNiqqud();

  return {
    ...op,
    modifiers: {
      ...existingModifiers,
      niqqud: payload
    }
  };
}

function parseGapId(gapid: string): { ref_key: string; gap_index: number } | null {
  const match = gapid.match(GAPID_PATTERN);
  if (!match) {
    return null;
  }
  const ref_key = match[1] ?? "";
  const gap_index = Number(match[2]);
  if (!Number.isInteger(gap_index) || gap_index < 0) {
    return null;
  }
  return { ref_key, gap_index };
}

function assertCanonicalGapOrder(previous: GapDescriptor | null, current: GapDescriptor): void {
  if (!previous) {
    return;
  }
  if (compareGapTuple(previous, current) < 0) {
    return;
  }
  throw new Error(
    `wrapper stitch: gap stream must be in canonical ascending order; saw ${current.gapid} after ${previous.gapid}`
  );
}

function assertCantillationGapEvent(value: unknown): asserts value is CantillationGapEvent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("wrapper stitch: cantillation gap event must be an object");
  }
  const row = value as Record<string, unknown>;
  if (typeof row.gapid !== "string" || row.gapid.length === 0) {
    throw new Error("wrapper stitch: cantillation gap event requires non-empty gapid");
  }
  if (typeof row.ref_key !== "string" || row.ref_key.length === 0) {
    throw new Error("wrapper stitch: cantillation gap event requires non-empty ref_key");
  }
  if (typeof row.gap_index !== "number" || !Number.isInteger(row.gap_index) || row.gap_index < 0) {
    throw new Error(
      "wrapper stitch: cantillation gap event requires non-negative integer gap_index"
    );
  }
  if (typeof row.event !== "object" || row.event === null || Array.isArray(row.event)) {
    throw new Error("wrapper stitch: cantillation gap event requires event object");
  }

  const parsed = parseGapId(row.gapid);
  if (!parsed || parsed.ref_key !== row.ref_key || parsed.gap_index !== row.gap_index) {
    throw new Error(
      `wrapper stitch: cantillation gap event gapid '${row.gapid}' must match ref_key='${row.ref_key}' and gap_index=${String(row.gap_index)}`
    );
  }
}

function assertCantillationOrder(
  previous: CantillationGapEvent | null,
  current: CantillationGapEvent
): void {
  if (!previous) {
    return;
  }
  if (compareGapTuple(previous, current) < 0) {
    return;
  }
  throw new Error(
    `wrapper stitch: cantillation gap stream must be in canonical ascending order; saw ${current.gapid} after ${previous.gapid}`
  );
}

export async function* stitchBoundaryFrames(
  args: StitchBoundaryFramesArgs
): AsyncGenerator<BoundaryFrame> {
  const hasLayoutInput = args.layoutRecords !== null && args.layoutRecords !== undefined;
  if (!hasLayoutInput && args.allowMissingLayoutIR !== true) {
    throw new Error(
      "wrapper stitch: LayoutIR input is required; set allowMissingLayoutIR=true only for explicit debug mode"
    );
  }

  const layoutIterator = hasLayoutInput
    ? toAsyncIterator(
        args.layoutRecords as AsyncIterable<LayoutIRRecord> | Iterable<LayoutIRRecord>
      )
    : null;
  const cantillationIterator = args.cantillationGapEvents
    ? toAsyncIterator(
        args.cantillationGapEvents as
          | AsyncIterable<CantillationGapEvent>
          | Iterable<CantillationGapEvent>
      )
    : null;

  let layoutCursor = layoutIterator ? await layoutIterator.next() : null;
  let cantillationCursor = cantillationIterator ? await cantillationIterator.next() : null;
  let previousGap: GapDescriptor | null = null;
  let previousLayout: LayoutIRRecord | null = null;
  let previousCantillation: CantillationGapEvent | null = null;
  const enableLayoutHygienePolicy = args.enableLayoutHygienePolicy === true;

  for await (const gap of args.gaps) {
    assertCanonicalGapOrder(previousGap, gap);
    previousGap = gap;

    const layoutEvents: LayoutEvent[] = [];
    while (layoutCursor && !layoutCursor.done) {
      const row = layoutCursor.value;
      assertLayoutIRRecord(row);
      if (previousLayout && compareLayoutIRRecords(previousLayout, row) > 0) {
        throw new Error(
          `wrapper stitch: LayoutIR stream must be canonical and deterministic; saw ${row.gapid} out of order`
        );
      }

      const cmp = compareGapTuple(row, gap);
      if (cmp < 0) {
        throw new Error(
          `wrapper stitch: LayoutIR references gap '${row.gapid}' not present in spine gap stream`
        );
      }
      if (cmp > 0) {
        break;
      }

      layoutEvents.push(row.layout_event);
      previousLayout = row;
      layoutCursor = await layoutIterator!.next();
    }

    const cantillationEvents: CantillationGapEvent[] = [];
    while (cantillationCursor && !cantillationCursor.done) {
      const row = cantillationCursor.value;
      assertCantillationGapEvent(row);
      assertCantillationOrder(previousCantillation, row);

      const cmp = compareGapTuple(row, gap);
      if (cmp < 0) {
        throw new Error(
          `wrapper stitch: cantillation stream references gap '${row.gapid}' not present in spine gap stream`
        );
      }
      if (cmp > 0) {
        break;
      }

      cantillationEvents.push(row);
      previousCantillation = row;
      cantillationCursor = await cantillationIterator!.next();
    }

    const frame: BoundaryFrame = {
      gapid: gap.gapid,
      ref_key: gap.ref_key,
      gap_index: gap.gap_index,
      layout_events: layoutEvents,
      cantillation_events: cantillationEvents
    };

    if (enableLayoutHygienePolicy) {
      frame.layout_hygiene_policy = deriveLayoutHygienePlan(layoutEvents);
    }

    yield frame;
  }

  if (layoutCursor && !layoutCursor.done) {
    throw new Error(
      `wrapper stitch: LayoutIR references gap '${layoutCursor.value.gapid}' not present in spine gap stream`
    );
  }
  if (cantillationCursor && !cantillationCursor.done) {
    throw new Error(
      `wrapper stitch: cantillation stream references gap '${cantillationCursor.value.gapid}' not present in spine gap stream`
    );
  }
}

export async function collectBoundaryFrames(
  args: StitchBoundaryFramesArgs
): Promise<BoundaryFrame[]> {
  const out: BoundaryFrame[] = [];
  for await (const frame of stitchBoundaryFrames(args)) {
    out.push(frame);
  }
  return out;
}
