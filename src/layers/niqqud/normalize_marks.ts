export type NiqqudNormalizationResult = {
  normalized: string[];
  unhandled: string[];
};

export const RAW_NIQQUD_MARK_TO_CLASS: Readonly<Record<string, string>> = {
  "\u05B0": "SHVA",
  "\u05B1": "HATAF_SEGOL",
  "\u05B2": "HATAF_PATAH",
  "\u05B3": "HATAF_QAMATS",
  "\u05B4": "HIRIQ",
  "\u05B5": "TSERE",
  "\u05B6": "SEGOL",
  "\u05B7": "PATAH",
  "\u05B8": "QAMATS",
  "\u05B9": "HOLAM",
  "\u05BA": "HOLAM",
  "\u05BB": "QUBUTS",
  "\u05BC": "DAGESH_OR_MAPIQ",
  "\u05BF": "RAFE",
  "\u05C1": "SHIN_DOT_RIGHT",
  "\u05C2": "SHIN_DOT_LEFT",
  "\u05C7": "QAMATS"
};

export const NIQQUD_CLASS_ORDER: readonly string[] = [
  "SHVA",
  "HATAF_SEGOL",
  "HATAF_PATAH",
  "HATAF_QAMATS",
  "HIRIQ",
  "TSERE",
  "SEGOL",
  "PATAH",
  "QAMATS",
  "HOLAM",
  "QUBUTS",
  "DAGESH_OR_MAPIQ",
  "RAFE",
  "SHIN_DOT_RIGHT",
  "SHIN_DOT_LEFT"
] as const;

const CLASS_ORDER_INDEX = new Map<string, number>(
  NIQQUD_CLASS_ORDER.map((entry, index) => [entry, index])
);

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function toCodePoints(value: string): number[] {
  const out: number[] = [];
  for (const ch of value) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined) {
      out.push(cp);
    }
  }
  return out;
}

function compareByCodePoint(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  const l = toCodePoints(left);
  const r = toCodePoints(right);
  const len = Math.max(l.length, r.length);
  for (let i = 0; i < len; i += 1) {
    const lc = l[i];
    const rc = r[i];
    if (lc === undefined) {
      return -1;
    }
    if (rc === undefined) {
      return 1;
    }
    if (lc !== rc) {
      return lc - rc;
    }
  }

  return compareText(left, right);
}

function compareClass(left: string, right: string): number {
  const l = CLASS_ORDER_INDEX.get(left);
  const r = CLASS_ORDER_INDEX.get(right);

  if (l !== undefined && r !== undefined && l !== r) {
    return l - r;
  }
  if (l !== undefined && r === undefined) {
    return -1;
  }
  if (l === undefined && r !== undefined) {
    return 1;
  }
  return compareText(left, right);
}

export function normalizeNiqqudMarks(raw: string[]): NiqqudNormalizationResult {
  const normalizedSet = new Set<string>();
  const unhandledSet = new Set<string>();

  for (const mark of raw) {
    if (typeof mark !== "string" || mark.length === 0) {
      if (typeof mark === "string") {
        unhandledSet.add(mark);
      }
      continue;
    }

    const mapped = RAW_NIQQUD_MARK_TO_CLASS[mark];
    if (mapped) {
      normalizedSet.add(mapped);
      continue;
    }

    unhandledSet.add(mark);
  }

  const normalized = [...normalizedSet].sort(compareClass);
  const unhandled = [...unhandledSet].sort(compareByCodePoint);
  return { normalized, unhandled };
}
