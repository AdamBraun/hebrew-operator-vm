const NEWLINE_PATTERN = /[\r\n]/;
const ASCII_PATTERN = /^[\x20-\x7E]+$/;

function assertValidRefKey(ref_key: string): void {
  if (typeof ref_key !== "string") {
    throw new Error(`Invalid ref_key: expected string, got ${typeof ref_key}`);
  }
  if (ref_key.length === 0) {
    throw new Error("Invalid ref_key: expected non-empty string");
  }
  if (NEWLINE_PATTERN.test(ref_key)) {
    throw new Error("Invalid ref_key: newlines are not allowed");
  }
  if (!ASCII_PATTERN.test(ref_key)) {
    throw new Error("Invalid ref_key: expected printable ASCII");
  }
}

function assertValidIndex(kind: "g_index" | "gap_index", index: number): void {
  if (typeof index !== "number" || !Number.isFinite(index) || !Number.isInteger(index)) {
    throw new Error(`Invalid ${kind}: expected finite integer, got ${String(index)}`);
  }
  if (index < 0) {
    throw new Error(`Invalid ${kind}: expected non-negative integer, got ${String(index)}`);
  }
}

export function makeGid(ref_key: string, g_index: number): string {
  assertValidRefKey(ref_key);
  assertValidIndex("g_index", g_index);
  return `${ref_key}#g:${g_index}`;
}

export function makeGapId(ref_key: string, gap_index: number): string {
  assertValidRefKey(ref_key);
  assertValidIndex("gap_index", gap_index);
  return `${ref_key}#gap:${gap_index}`;
}
