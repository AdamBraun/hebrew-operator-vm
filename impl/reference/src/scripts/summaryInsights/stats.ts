export type DescriptiveStats = {
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  p90: number | null;
  p99: number | null;
  stdev: number | null;
};

export type RunLength = {
  id: string | null;
  startSeq: number;
  endSeq: number;
  length: number;
};

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percentile(sorted: readonly number[], ratio: number): number | null {
  if (sorted.length === 0) {
    return null;
  }
  if (sorted.length === 1) {
    return sorted[0];
  }
  const clamped = Math.min(1, Math.max(0, ratio));
  const position = (sorted.length - 1) * clamped;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

export function describe(nums: readonly number[]): DescriptiveStats {
  const values = nums
    .map((value) => toFiniteNumber(value))
    .filter((value): value is number => value !== null);
  if (values.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      mean: null,
      median: null,
      p90: null,
      p99: null,
      stdev: null
    };
  }

  const sorted = [...values].sort((left, right) => left - right);
  const count = sorted.length;
  const min = sorted[0];
  const max = sorted[count - 1];
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const mean = sum / count;
  const median = percentile(sorted, 0.5);
  const p90 = percentile(sorted, 0.9);
  const p99 = percentile(sorted, 0.99);
  const variance = sorted.reduce((acc, value) => acc + (value - mean) ** 2, 0) / count;
  const stdev = Math.sqrt(variance);

  return {
    count,
    min,
    max,
    mean,
    median,
    p90,
    p99,
    stdev
  };
}

function readSequence(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const sequence = (value as { sequence?: unknown }).sequence;
  const parsed = toFiniteNumber(sequence);
  if (parsed === null) {
    return null;
  }
  return parsed;
}

function readRefKey(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }
  const refKey = (value as { ref_key?: unknown; refKey?: unknown }).ref_key;
  if (typeof refKey === "string") {
    return refKey;
  }
  const camelRef = (value as { ref_key?: unknown; refKey?: unknown }).refKey;
  if (typeof camelRef === "string") {
    return camelRef;
  }
  return "";
}

export function topN<T>(items: readonly T[], n: number, keyFn: (item: T) => number): T[] {
  const limit = Math.max(0, Math.trunc(Number(n)));
  if (limit === 0 || items.length === 0) {
    return [];
  }

  const ranked = items.map((item, index) => ({
    item,
    index,
    metric: toFiniteNumber(keyFn(item)) ?? Number.NEGATIVE_INFINITY,
    sequence: readSequence(item),
    refKey: readRefKey(item)
  }));

  ranked.sort((left, right) => {
    if (left.metric !== right.metric) {
      return right.metric - left.metric;
    }

    const leftSequence = left.sequence;
    const rightSequence = right.sequence;
    if (leftSequence !== null && rightSequence !== null && leftSequence !== rightSequence) {
      return leftSequence - rightSequence;
    }

    if (left.refKey !== right.refKey) {
      return left.refKey.localeCompare(right.refKey, "en");
    }

    return left.index - right.index;
  });

  return ranked.slice(0, Math.min(limit, ranked.length)).map((entry) => entry.item);
}

export function deltas(nums: readonly number[]): number[] {
  if (nums.length < 2) {
    return [];
  }
  const out: number[] = [];
  for (let index = 1; index < nums.length; index += 1) {
    const prev = toFiniteNumber(nums[index - 1]);
    const next = toFiniteNumber(nums[index]);
    if (prev === null || next === null) {
      continue;
    }
    out.push(next - prev);
  }
  return out;
}

export function runLengths(ids: readonly (string | null)[]): RunLength[] {
  if (ids.length === 0) {
    return [];
  }

  const out: RunLength[] = [];
  let currentId: string | null = ids[0] ?? null;
  let startSeq = 1;

  for (let index = 1; index < ids.length; index += 1) {
    const id = ids[index] ?? null;
    if (id === currentId) {
      continue;
    }
    out.push({
      id: currentId,
      startSeq,
      endSeq: index,
      length: index - startSeq + 1
    });
    currentId = id;
    startSeq = index + 1;
  }

  out.push({
    id: currentId,
    startSeq,
    endSeq: ids.length,
    length: ids.length - startSeq + 1
  });

  return out;
}

export function jaccard<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): number {
  if (a.size === 0 && b.size === 0) {
    return 1;
  }
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) {
      intersection += 1;
    }
  }
  const union = a.size + b.size - intersection;
  if (union === 0) {
    return 0;
  }
  return intersection / union;
}

export function groupBy<T>(items: readonly T[], keyFn: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const key = String(keyFn(item));
    const group = out.get(key);
    if (group) {
      group.push(item);
    } else {
      out.set(key, [item]);
    }
  }
  return out;
}
