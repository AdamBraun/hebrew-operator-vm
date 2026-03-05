type UnknownRecord = Record<string, unknown>;

type KeyViolation = {
  path: string;
  key: string;
};

type StringViolation = {
  path: string;
  value: string;
};

const LETTERS_FORBIDDEN_KEY_PATTERN =
  /(^|_)(niqqud|cantillation|cant|teamim|taam|taamim|trope|tropes)(_|$)/i;

const NIQQUD_FORBIDDEN_KEYS = new Set([
  "letter",
  "letter_op",
  "letter_kind",
  "letter_class",
  "op_kind",
  "base_letter"
]);

const LAYOUT_EVENT_TOKENS = new Set(["SPACE", "SETUMA", "PETUCHA", "BOOK_BREAK"]);

const CANTILLATION_EVENT_TOKENS = new Set([
  "BOUNDARY",
  "TROPE_MARK",
  "UNKNOWN_MARK",
  "CUT",
  "CONJ",
  "MAQAF",
  "MAQAF_GLUE",
  "SOF_PASUK"
]);

const PROGRAM_RUNTIME_KEYS = new Set(["handle", "handles", "link", "links"]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toLowerCase();
}

function canonicalToken(value: string): string {
  return value
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

function findFirstForbiddenKey(
  value: unknown,
  path: string,
  isForbidden: (normalizedKey: string, rawKey: string) => boolean
): KeyViolation | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const nested = findFirstForbiddenKey(value[i], `${path}[${String(i)}]`, isForbidden);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const key of Object.keys(value).sort()) {
    const normalized = normalizeKey(key);
    if (isForbidden(normalized, key)) {
      return {
        path: `${path}.${key}`,
        key
      };
    }
    const nested = findFirstForbiddenKey(value[key], `${path}.${key}`, isForbidden);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function findFirstForbiddenString(
  value: unknown,
  path: string,
  forbiddenTokens: ReadonlySet<string>
): StringViolation | null {
  if (typeof value === "string") {
    const token = canonicalToken(value);
    if (forbiddenTokens.has(token)) {
      return {
        path,
        value
      };
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const nested = findFirstForbiddenString(value[i], `${path}[${String(i)}]`, forbiddenTokens);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const key of Object.keys(value).sort()) {
    const nested = findFirstForbiddenString(value[key], `${path}.${key}`, forbiddenTokens);
    if (nested) {
      return nested;
    }
  }

  return null;
}

export function assertLettersIRNoBleed(value: unknown, path: string): void {
  const violation = findFirstForbiddenKey(value, path, (normalized) =>
    LETTERS_FORBIDDEN_KEY_PATTERN.test(normalized)
  );
  if (violation) {
    throw new Error(
      `stitch contract: LettersIR contamination at ${violation.path}: forbidden key '${violation.key}'`
    );
  }
}

export function assertNiqqudIRNoBleed(value: unknown, path: string): void {
  const violation = findFirstForbiddenKey(value, path, (normalized) =>
    NIQQUD_FORBIDDEN_KEYS.has(normalized)
  );
  if (violation) {
    throw new Error(
      `stitch contract: NiqqudIR contamination at ${violation.path}: forbidden key '${violation.key}'`
    );
  }
}

export function assertCantillationIRNoBleed(value: unknown, path: string): void {
  const violation = findFirstForbiddenString(value, path, LAYOUT_EVENT_TOKENS);
  if (violation) {
    throw new Error(
      `stitch contract: CantillationIR contamination at ${violation.path}: forbidden layout token '${violation.value}'`
    );
  }
}

export function assertLayoutIRNoBleed(value: unknown, path: string): void {
  const violation = findFirstForbiddenString(value, path, CANTILLATION_EVENT_TOKENS);
  if (violation) {
    throw new Error(
      `stitch contract: LayoutIR contamination at ${violation.path}: forbidden cantillation token '${violation.value}'`
    );
  }
}

export function assertProgramIRNoRuntimeState(value: unknown, path: string): void {
  const violation = findFirstForbiddenKey(value, path, (normalized) =>
    PROGRAM_RUNTIME_KEYS.has(normalized)
  );
  if (violation) {
    throw new Error(
      `stitch contract: ProgramIR runtime-state contamination at ${violation.path}: forbidden key '${violation.key}'`
    );
  }
}
