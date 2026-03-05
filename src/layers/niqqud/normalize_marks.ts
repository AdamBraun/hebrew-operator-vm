import { NIQQUD_CLASS_ORDER, type NiqqudClass } from "./classes";
import { RAW_NIQQUD_TO_CLASS } from "./map";

export type NiqqudNormalizationResult = {
  normalized: NiqqudClass[];
  unhandled: string[];
};

const CLASS_ORDER_INDEX = new Map<NiqqudClass, number>(
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

function compareClass(left: NiqqudClass, right: NiqqudClass): number {
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
  const normalizedSet = new Set<NiqqudClass>();
  const unhandledSet = new Set<string>();

  for (const mark of raw) {
    if (typeof mark !== "string" || mark.length === 0) {
      if (typeof mark === "string") {
        unhandledSet.add(mark);
      }
      continue;
    }

    const mapped = RAW_NIQQUD_TO_CLASS[mark];
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
