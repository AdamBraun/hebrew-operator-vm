export type MetadataPlanScalar = string | number | boolean | null;

export type Checkpoint = {
  ref_end: string;
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
