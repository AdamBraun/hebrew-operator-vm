import type { RefKey } from "./refkey";

export const METADATA_PLAN_IR_VERSION = "metadata_plan_ir.v1";
export const METADATA_PLAN_SCOPE = "torah";
export const METADATA_PLAN_CYCLE = "one_year";
export const METADATA_PLAN_REF_ORDER_SOURCE = "corpus_index";

export type MetadataPlanIrVersion = typeof METADATA_PLAN_IR_VERSION;
export type MetadataPlanScope = typeof METADATA_PLAN_SCOPE;
export type MetadataPlanCycle = typeof METADATA_PLAN_CYCLE;
export type MetadataPlanRefOrderSource = typeof METADATA_PLAN_REF_ORDER_SOURCE;

export type MetadataPlanRange = {
  start: RefKey;
  end: RefKey;
};

export type MetadataPlanAliyahIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type MetadataPlanParashaAliyah = {
  aliyah_index: MetadataPlanAliyahIndex;
  range: MetadataPlanRange;
};

export type MetadataPlanParashaSummary = {
  parasha_id: string;
  parasha_name_he?: string;
  parasha_name_en?: string;
  range: MetadataPlanRange;
  aliyot?: MetadataPlanParashaAliyah[];
};

export type MetadataCheckpointKind = "ALIYAH_END" | "PARASHA_END";

export type MetadataPlanAliyahEndCheckpoint = {
  checkpoint_id: string;
  kind: "ALIYAH_END";
  parasha_id: string;
  aliyah_index: MetadataPlanAliyahIndex;
  ref_key_end: RefKey;
  ordinal: number;
};

export type MetadataPlanParashaEndCheckpoint = {
  checkpoint_id: string;
  kind: "PARASHA_END";
  parasha_id: string;
  aliyah_index: null;
  ref_key_end: RefKey;
  ordinal: number;
};

export type MetadataPlanCheckpoint =
  | MetadataPlanAliyahEndCheckpoint
  | MetadataPlanParashaEndCheckpoint;

export type MetadataPlanAliyahRangeSegment = {
  segment_id: string;
  kind: "ALIYAH";
  parasha_id: string;
  aliyah_index: MetadataPlanAliyahIndex;
  start: RefKey;
  end: RefKey;
  ordinal_start: number;
  ordinal_end: number;
};

export type MetadataPlanParashaRangeSegment = {
  segment_id: string;
  kind: "PARASHA";
  parasha_id: string;
  aliyah_index: null;
  start: RefKey;
  end: RefKey;
  ordinal_start: number;
  ordinal_end: number;
};

export type MetadataPlanRangeSegment =
  | MetadataPlanAliyahRangeSegment
  | MetadataPlanParashaRangeSegment;

export type MetadataPlanIR = {
  ir_version: MetadataPlanIrVersion;
  dataset_id: string;
  scope: MetadataPlanScope;
  cycle: MetadataPlanCycle;
  ref_order_source: MetadataPlanRefOrderSource;
  generated_at: string;
  plan_digest: string;
  checkpoints: MetadataPlanCheckpoint[];
  parashot?: MetadataPlanParashaSummary[];
  ranges?: MetadataPlanRangeSegment[];
  ref_to_segment_index?: Record<string, number>;
  ref_to_parasha?: Record<string, string>;
  ref_to_aliyah?: Record<string, MetadataPlanAliyahIndex>;
};

export function formatMetadataCheckpointId(args: {
  kind: MetadataCheckpointKind;
  parasha_id: string;
  aliyah_index: number | null;
  ref_key_end: RefKey;
}): string {
  return `${args.kind}:${args.parasha_id}:${String(args.aliyah_index ?? 0)}:${args.ref_key_end}`;
}
