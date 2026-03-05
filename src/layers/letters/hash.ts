import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { LETTERS_IR_VERSION } from "./schema";

export type LettersDigestConfig = {
  include_word_segmentation: boolean;
  strict_letters: boolean;
  [key: string]: unknown;
};

export type ComputeLettersDigestArgs = {
  spineDigest: string;
  config: LettersDigestConfig;
  codeFingerprint: string;
  version: string;
};

const SHA256_HEX = /^[a-f0-9]{64}$/;

export const DEFAULT_LETTERS_CODE_PATHS: readonly string[] = [
  "src/layers/letters/schema.ts",
  "src/layers/letters/opMap.ts",
  "src/layers/letters/wordSeg.ts",
  "src/layers/letters/validate.ts",
  "src/layers/letters/extract.ts",
  "src/layers/letters/hash.ts"
];

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function assertSha256Hex(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SHA256_HEX.test(value)) {
    throw new Error(`computeLettersDigest: ${label} must be lowercase sha256 hex`);
  }
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`computeLettersDigest: ${label} must be non-empty string`);
  }
}

function assertConfig(value: unknown): asserts value is LettersDigestConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("computeLettersDigest: config must be an object");
  }
  if (
    typeof (value as { include_word_segmentation?: unknown }).include_word_segmentation !==
    "boolean"
  ) {
    throw new Error("computeLettersDigest: config.include_word_segmentation must be boolean");
  }
  if (typeof (value as { strict_letters?: unknown }).strict_letters !== "boolean") {
    throw new Error("computeLettersDigest: config.strict_letters must be boolean");
  }
}

export function computeLettersDigest(args: ComputeLettersDigestArgs): string {
  assertSha256Hex(args.spineDigest, "spineDigest");
  assertConfig(args.config);
  assertNonEmptyString(args.codeFingerprint, "codeFingerprint");
  assertNonEmptyString(args.version, "version");

  const configJson = JSON.stringify(args.config);
  const basis = `letters${args.version}${args.codeFingerprint}${configJson}${args.spineDigest}`;
  return crypto.createHash("sha256").update(basis, "utf8").digest("hex");
}

export async function computeLettersLayerCodeFingerprint(
  codePaths: readonly string[] = DEFAULT_LETTERS_CODE_PATHS,
  cwd = process.cwd()
): Promise<string> {
  if (!Array.isArray(codePaths) || codePaths.length === 0) {
    throw new Error("computeLettersLayerCodeFingerprint: codePaths must be non-empty array");
  }

  const hash = crypto.createHash("sha256");
  for (const relPath of [...codePaths].sort(compareText)) {
    assertNonEmptyString(relPath, "codePath");
    const absPath = path.resolve(cwd, relPath);
    const content = await fs.readFile(absPath);
    hash.update(relPath);
    hash.update("\u0000");
    hash.update(content);
    hash.update("\u0000");
  }
  return hash.digest("hex");
}

export const DEFAULT_LETTERS_DIGEST_VERSION = LETTERS_IR_VERSION;
