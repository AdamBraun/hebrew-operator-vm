import type {
  MetadataPlanCheckpoint,
  MetadataPlanIR,
  MetadataPlanParashaSummary
} from "../../ir/metadata_ir";
import type { RefKey } from "../../ir/refkey";

export const WRAPPER_METADATA_MODE_ON = "on";
export const WRAPPER_METADATA_MODE_OFF = "off";

export type WrapperMetadataMode =
  | typeof WRAPPER_METADATA_MODE_ON
  | typeof WRAPPER_METADATA_MODE_OFF;

type DisabledMetadataPlan = {
  version: 1;
  notes: string;
  options: {
    metadata_mode: "off";
  };
  checkpoints: [];
};

type MetadataGroupingState = {
  byOrdinal: Map<number, MetadataPlanCheckpoint[]>;
  byRefEnd: Map<RefKey, MetadataPlanCheckpoint[]>;
};

const DISABLED_METADATA_PLAN: DisabledMetadataPlan = {
  version: 1,
  notes: "metadata disabled via --metadata off",
  options: {
    metadata_mode: "off"
  },
  checkpoints: []
};

export type WrapperMetadataConsumption = {
  mode: WrapperMetadataMode;
  snapshotOrdinals: number[];
  checkpointsByOrdinal: Map<number, MetadataPlanCheckpoint[]>;
  checkpointsByRefEnd: Map<RefKey, MetadataPlanCheckpoint[]>;
  parashaById: Map<string, MetadataPlanParashaSummary>;
};

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function checkpointKindRank(kind: MetadataPlanCheckpoint["kind"]): number {
  if (kind === "ALIYAH_END") {
    return 0;
  }
  return 1;
}

function compareCheckpointsStable(
  left: MetadataPlanCheckpoint,
  right: MetadataPlanCheckpoint
): number {
  if (left.ordinal !== right.ordinal) {
    return left.ordinal - right.ordinal;
  }

  const kindCmp = checkpointKindRank(left.kind) - checkpointKindRank(right.kind);
  if (kindCmp !== 0) {
    return kindCmp;
  }

  const parashaCmp = compareText(left.parasha_id, right.parasha_id);
  if (parashaCmp !== 0) {
    return parashaCmp;
  }

  const leftAliyah = left.aliyah_index ?? 0;
  const rightAliyah = right.aliyah_index ?? 0;
  if (leftAliyah !== rightAliyah) {
    return leftAliyah - rightAliyah;
  }

  const refCmp = compareText(left.ref_key_end, right.ref_key_end);
  if (refCmp !== 0) {
    return refCmp;
  }

  return compareText(left.checkpoint_id, right.checkpoint_id);
}

function assertStableCheckpointOrder(checkpoints: readonly MetadataPlanCheckpoint[]): void {
  for (let i = 1; i < checkpoints.length; i += 1) {
    const previous = checkpoints[i - 1]!;
    const current = checkpoints[i]!;
    if (compareCheckpointsStable(previous, current) > 0) {
      throw new Error(
        `wrapper metadata: checkpoints must be stable-sorted by ordinal; saw '${current.checkpoint_id}' after '${previous.checkpoint_id}'`
      );
    }
  }
}

function cloneCheckpoint(checkpoint: MetadataPlanCheckpoint): MetadataPlanCheckpoint {
  return {
    ...checkpoint
  };
}

function cloneParashaSummary(parasha: MetadataPlanParashaSummary): MetadataPlanParashaSummary {
  return {
    ...parasha,
    range: {
      ...parasha.range
    },
    ...(Array.isArray(parasha.aliyot)
      ? {
          aliyot: parasha.aliyot.map((aliyah) => ({
            ...aliyah,
            range: {
              ...aliyah.range
            }
          }))
        }
      : {})
  };
}

function groupCheckpoints(checkpoints: readonly MetadataPlanCheckpoint[]): MetadataGroupingState {
  const byOrdinal = new Map<number, MetadataPlanCheckpoint[]>();
  const byRefEnd = new Map<RefKey, MetadataPlanCheckpoint[]>();

  for (const checkpoint of checkpoints) {
    const checkpointCopy = cloneCheckpoint(checkpoint);

    const ordinalGroup = byOrdinal.get(checkpoint.ordinal) ?? [];
    ordinalGroup.push(checkpointCopy);
    byOrdinal.set(checkpoint.ordinal, ordinalGroup);

    const refGroup = byRefEnd.get(checkpoint.ref_key_end) ?? [];
    refGroup.push(checkpointCopy);
    byRefEnd.set(checkpoint.ref_key_end, refGroup);
  }

  return { byOrdinal, byRefEnd };
}

export function isMetadataDisabledArg(value: string): boolean {
  return value.trim().toLowerCase() === WRAPPER_METADATA_MODE_OFF;
}

export function createDisabledMetadataPlan(): DisabledMetadataPlan {
  return {
    version: DISABLED_METADATA_PLAN.version,
    notes: DISABLED_METADATA_PLAN.notes,
    options: {
      ...DISABLED_METADATA_PLAN.options
    },
    checkpoints: []
  };
}

export function formatDisabledMetadataPlanJson(): string {
  return `${JSON.stringify(createDisabledMetadataPlan(), null, 2)}\n`;
}

export function metadataCheckpointFolderSegments(checkpoint: MetadataPlanCheckpoint): string[] {
  if (checkpoint.kind === "ALIYAH_END") {
    return ["parashot", checkpoint.parasha_id, "aliyot", String(checkpoint.aliyah_index)];
  }
  return ["parashot", checkpoint.parasha_id];
}

export function buildWrapperMetadataConsumption(args: {
  mode?: WrapperMetadataMode;
  plan?: MetadataPlanIR | null;
}): WrapperMetadataConsumption {
  const mode = args.mode ?? WRAPPER_METADATA_MODE_ON;
  if (mode === WRAPPER_METADATA_MODE_OFF) {
    return {
      mode,
      snapshotOrdinals: [],
      checkpointsByOrdinal: new Map<number, MetadataPlanCheckpoint[]>(),
      checkpointsByRefEnd: new Map<RefKey, MetadataPlanCheckpoint[]>(),
      parashaById: new Map<string, MetadataPlanParashaSummary>()
    };
  }

  const plan = args.plan;
  if (!plan) {
    throw new Error("wrapper metadata: metadata mode is 'on' but no MetadataPlan was provided");
  }

  assertStableCheckpointOrder(plan.checkpoints);
  const grouped = groupCheckpoints(plan.checkpoints);
  const snapshotOrdinals = [...grouped.byOrdinal.keys()].sort((left, right) => left - right);
  const parashaById = new Map<string, MetadataPlanParashaSummary>();

  if (Array.isArray(plan.parashot)) {
    for (const parasha of plan.parashot) {
      parashaById.set(parasha.parasha_id, cloneParashaSummary(parasha));
    }
  }

  return {
    mode,
    snapshotOrdinals,
    checkpointsByOrdinal: grouped.byOrdinal,
    checkpointsByRefEnd: grouped.byRefEnd,
    parashaById
  };
}
