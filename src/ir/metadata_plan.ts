export type MetadataPlanScalar = string | number | boolean | null;

export type MetadataPlan = {
  version: number;
  notes?: string;
  labels?: string[];
  options?: Record<string, MetadataPlanScalar>;
};
