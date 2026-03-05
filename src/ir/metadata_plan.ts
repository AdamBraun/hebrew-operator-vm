import type { RefKey } from "./refkey";

export type MetadataPlanScalar = string | number | boolean | null;

export type Checkpoint = {
  ref_end: RefKey;
  label?: string;
  [key: string]: unknown;
};

export type MetadataPlan = {
  version: number;
  notes?: string;
  labels?: string[];
  options?: Record<string, MetadataPlanScalar>;
  checkpoints?: Checkpoint[];
};
