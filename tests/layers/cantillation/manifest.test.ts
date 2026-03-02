import { describe, expect, it } from "vitest";
import {
  assertCantillationManifest,
  assertCantillationManifestDigestInputs,
  createCantillationManifest,
  isCantillationManifest,
  stringifyCantillationManifestDigestInputs
} from "../../../src/layers/cantillation/manifest";

describe("cantillation manifest", () => {
  it("creates a valid manifest with sorted output_files", () => {
    const manifest = createCantillationManifest({
      spine_digest: "a".repeat(64),
      config_hash: "b".repeat(64),
      code_hash: "c".repeat(64),
      output_files: [
        { path: "manifest.json", sha256: "f".repeat(64) },
        { path: "cantillation.ir.jsonl", sha256: "e".repeat(64) }
      ]
    });

    expect(() => assertCantillationManifest(manifest)).not.toThrow();
    expect(isCantillationManifest(manifest)).toBe(true);
    expect(manifest.output_files.map((entry) => entry.path)).toEqual([
      "cantillation.ir.jsonl",
      "manifest.json"
    ]);
  });

  it("validates digest input shape", () => {
    const digestInputs = {
      layer: "cantillation",
      layer_version: 1,
      spine_digest: "a".repeat(64),
      config_hash: "b".repeat(64),
      code_hash: "c".repeat(64)
    } as const;

    expect(() => assertCantillationManifestDigestInputs(digestInputs)).not.toThrow();
    expect(stringifyCantillationManifestDigestInputs(digestInputs)).toContain(
      '"layer":"cantillation"'
    );
  });

  it("rejects non-sha256 hashes and duplicate output file paths", () => {
    expect(() =>
      createCantillationManifest({
        spine_digest: "not-a-sha",
        config_hash: "b".repeat(64),
        code_hash: "c".repeat(64),
        output_files: [{ path: "cantillation.ir.jsonl", sha256: "e".repeat(64) }]
      })
    ).toThrow(/sha256/);

    expect(() =>
      createCantillationManifest({
        spine_digest: "a".repeat(64),
        config_hash: "b".repeat(64),
        code_hash: "c".repeat(64),
        output_files: [
          { path: "cantillation.ir.jsonl", sha256: "e".repeat(64) },
          { path: "cantillation.ir.jsonl", sha256: "f".repeat(64) }
        ]
      })
    ).toThrow(/duplicate output file path/);
  });
});
