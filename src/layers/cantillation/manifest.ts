export const CANTILLATION_MANIFEST_LAYER = "cantillation";

export const CANTILLATION_LAYER_VERSION = 1;

export type CantillationManifestDigestInputs = {
  layer: "cantillation";
  layer_version: number;
  spine_digest: string;
  config_hash: string;
  code_hash: string;
};

export type CantillationManifestOutputFile = {
  path: string;
  sha256: string;
};

export type CantillationManifest = CantillationManifestDigestInputs & {
  output_files: CantillationManifestOutputFile[];
};

export const CANTILLATION_MANIFEST_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "spec/schemas/cantillation-manifest.schema.json",
  title: "CantillationManifest",
  type: "object",
  additionalProperties: false,
  required: ["layer", "layer_version", "spine_digest", "config_hash", "code_hash", "output_files"],
  properties: {
    layer: { const: CANTILLATION_MANIFEST_LAYER },
    layer_version: { type: "integer", minimum: 0 },
    spine_digest: {
      type: "string",
      pattern: "^[a-f0-9]{64}$"
    },
    config_hash: {
      type: "string",
      pattern: "^[a-f0-9]{64}$"
    },
    code_hash: {
      type: "string",
      pattern: "^[a-f0-9]{64}$"
    },
    output_files: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "sha256"],
        properties: {
          path: {
            type: "string",
            minLength: 1
          },
          sha256: {
            type: "string",
            pattern: "^[a-f0-9]{64}$"
          }
        }
      }
    }
  }
} as const;

type UnknownRecord = Record<string, unknown>;

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

const OWN = Object.prototype.hasOwnProperty;
const SHA256_HEX = /^[a-f0-9]{64}$/;

function hasOwn(record: UnknownRecord, key: string): boolean {
  return OWN.call(record, key);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isOutputFile(value: unknown): value is CantillationManifestOutputFile {
  return (
    isRecord(value) &&
    isNonEmptyString(value.path) &&
    isSha256Hex(value.sha256) &&
    Object.keys(value).every((key) => key === "path" || key === "sha256")
  );
}

function toCanonicalJsonValue(value: unknown): CanonicalJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "bigint") {
    return value.toString(10);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => {
      const normalized = toCanonicalJsonValue(entry);
      return normalized === undefined ? null : normalized;
    });
  }
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, CanonicalJsonValue> = {};
    for (const key of Object.keys(source).sort(compareText)) {
      const normalized = toCanonicalJsonValue(source[key]);
      if (normalized !== undefined) {
        out[key] = normalized;
      }
    }
    return out;
  }
  return undefined;
}

function canonicalStringify(value: unknown): string {
  const normalized = toCanonicalJsonValue(value);
  return JSON.stringify(normalized === undefined ? null : normalized);
}

function fail(scope: string, path: string, message: string): never {
  throw new Error(`Invalid ${scope} at ${path}: ${message}`);
}

function describe(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function assertRecord(value: unknown, path: string, scope: string): asserts value is UnknownRecord {
  if (!isRecord(value)) {
    fail(scope, path, `expected object, got ${describe(value)}`);
  }
}

function assertNoUnknownKeys(
  record: UnknownRecord,
  allowed: readonly string[],
  path: string,
  scope: string
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      fail(scope, path, `unknown field '${key}'`);
    }
  }
}

function assertHas(record: UnknownRecord, key: string, path: string, scope: string): unknown {
  if (!hasOwn(record, key)) {
    fail(scope, `${path}.${key}`, "missing required field");
  }
  return record[key];
}

function assertSha256Hex(value: unknown, path: string, scope: string): asserts value is string {
  if (!isSha256Hex(value)) {
    fail(scope, path, `expected lowercase sha256 hex, got ${describe(value)}`);
  }
}

function assertNonNegativeInteger(
  value: unknown,
  path: string,
  scope: string
): asserts value is number {
  if (!isNonNegativeInteger(value)) {
    fail(scope, path, `expected non-negative integer, got ${describe(value)}`);
  }
}

export function assertCantillationManifestDigestInputs(
  value: unknown,
  path = "$",
  scope = "CantillationManifestDigestInputs"
): asserts value is CantillationManifestDigestInputs {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(
    value,
    ["layer", "layer_version", "spine_digest", "config_hash", "code_hash"],
    path,
    scope
  );

  const layer = assertHas(value, "layer", path, scope);
  if (layer !== CANTILLATION_MANIFEST_LAYER) {
    fail(
      scope,
      `${path}.layer`,
      `expected '${CANTILLATION_MANIFEST_LAYER}', got ${describe(layer)}`
    );
  }

  assertNonNegativeInteger(
    assertHas(value, "layer_version", path, scope),
    `${path}.layer_version`,
    scope
  );
  assertSha256Hex(assertHas(value, "spine_digest", path, scope), `${path}.spine_digest`, scope);
  assertSha256Hex(assertHas(value, "config_hash", path, scope), `${path}.config_hash`, scope);
  assertSha256Hex(assertHas(value, "code_hash", path, scope), `${path}.code_hash`, scope);
}

function normalizeOutputFiles(
  files: readonly CantillationManifestOutputFile[]
): CantillationManifestOutputFile[] {
  return [...files]
    .map((file) => ({
      path: file.path,
      sha256: file.sha256
    }))
    .sort((left, right) => compareText(left.path, right.path));
}

function assertOutputFiles(
  value: unknown,
  path: string,
  scope: string
): asserts value is CantillationManifestOutputFile[] {
  if (!Array.isArray(value)) {
    fail(scope, path, `expected array, got ${describe(value)}`);
  }

  const seenPaths = new Set<string>();
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (!isOutputFile(item)) {
      fail(scope, `${path}[${i}]`, "expected { path, sha256 } with lowercase sha256");
    }
    if (seenPaths.has(item.path)) {
      fail(scope, `${path}[${i}].path`, `duplicate output file path '${item.path}'`);
    }
    seenPaths.add(item.path);
  }
}

export function isCantillationManifestDigestInputs(
  value: unknown
): value is CantillationManifestDigestInputs {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.layer === CANTILLATION_MANIFEST_LAYER &&
    isNonNegativeInteger(value.layer_version) &&
    isSha256Hex(value.spine_digest) &&
    isSha256Hex(value.config_hash) &&
    isSha256Hex(value.code_hash)
  );
}

export function isCantillationManifest(value: unknown): value is CantillationManifest {
  if (!isRecord(value) || !isCantillationManifestDigestInputs(value)) {
    return false;
  }
  const outputFiles = (value as UnknownRecord).output_files;
  if (!Array.isArray(outputFiles)) {
    return false;
  }

  const seenPaths = new Set<string>();
  for (const file of outputFiles) {
    if (!isOutputFile(file)) {
      return false;
    }
    if (seenPaths.has(file.path)) {
      return false;
    }
    seenPaths.add(file.path);
  }

  return true;
}

export function assertCantillationManifest(
  value: unknown,
  path = "$",
  scope = "CantillationManifest"
): asserts value is CantillationManifest {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(
    value,
    ["layer", "layer_version", "spine_digest", "config_hash", "code_hash", "output_files"],
    path,
    scope
  );

  const digestInputs = {
    layer: assertHas(value, "layer", path, scope),
    layer_version: assertHas(value, "layer_version", path, scope),
    spine_digest: assertHas(value, "spine_digest", path, scope),
    config_hash: assertHas(value, "config_hash", path, scope),
    code_hash: assertHas(value, "code_hash", path, scope)
  };
  assertCantillationManifestDigestInputs(digestInputs, path, scope);
  assertOutputFiles(assertHas(value, "output_files", path, scope), `${path}.output_files`, scope);
}

export function createCantillationManifest(args: {
  layer_version?: number;
  spine_digest: string;
  config_hash: string;
  code_hash: string;
  output_files: readonly CantillationManifestOutputFile[];
}): CantillationManifest {
  assertSha256Hex(args.spine_digest, "spine_digest", "createCantillationManifest");
  assertSha256Hex(args.config_hash, "config_hash", "createCantillationManifest");
  assertSha256Hex(args.code_hash, "code_hash", "createCantillationManifest");
  assertOutputFiles(args.output_files, "output_files", "createCantillationManifest");

  const manifest: CantillationManifest = {
    layer: CANTILLATION_MANIFEST_LAYER,
    layer_version: args.layer_version ?? CANTILLATION_LAYER_VERSION,
    spine_digest: args.spine_digest,
    config_hash: args.config_hash,
    code_hash: args.code_hash,
    output_files: normalizeOutputFiles(args.output_files)
  };

  assertCantillationManifest(manifest);
  return manifest;
}

export function cantillationManifestDigestInputs(
  manifest: CantillationManifest | CantillationManifestDigestInputs
): CantillationManifestDigestInputs {
  if (isCantillationManifest(manifest)) {
    assertCantillationManifest(manifest);
  } else {
    assertCantillationManifestDigestInputs(manifest);
  }
  return {
    layer: CANTILLATION_MANIFEST_LAYER,
    layer_version: manifest.layer_version,
    spine_digest: manifest.spine_digest,
    config_hash: manifest.config_hash,
    code_hash: manifest.code_hash
  };
}

export function stringifyCantillationManifestDigestInputs(
  value: CantillationManifest | CantillationManifestDigestInputs
): string {
  return canonicalStringify(cantillationManifestDigestInputs(value));
}
