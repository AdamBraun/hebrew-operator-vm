import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CANTILLATION_CODE_PATHS,
  computeCantillationCodeHash,
  computeCantillationConfigHash,
  computeCantillationDigest,
  type CantillationDigestConfig
} from "../../../src/layers/cantillation/hash";

const BASE_CONFIG: CantillationDigestConfig = {
  strict: false,
  emit_unknown: false,
  sof_pasuk_rank: 3,
  dump_stats: false,
  top_marks_limit: 10,
  placement_policy: {
    derived_boundaries_from_trope_marks: "wrapper",
    gid_disj_cut_placement: "next_gap_or_ref_end_gap",
    anchoring_version: 1,
    placement_version: 1
  }
};

describe("cantillation hash", () => {
  it("computes deterministic config hash", () => {
    const a = computeCantillationConfigHash(BASE_CONFIG);
    const b = computeCantillationConfigHash({ ...BASE_CONFIG });
    expect(a).toBe(b);
  });

  it("changes config hash when strict flags, placement policy, or sof-pasuk rank change", () => {
    const baseline = computeCantillationConfigHash(BASE_CONFIG);
    const strictChanged = computeCantillationConfigHash({
      ...BASE_CONFIG,
      strict: true
    });
    const emitUnknownChanged = computeCantillationConfigHash({
      ...BASE_CONFIG,
      emit_unknown: true
    });
    const sofRankChanged = computeCantillationConfigHash({
      ...BASE_CONFIG,
      sof_pasuk_rank: 5
    });
    const placementChanged = computeCantillationConfigHash({
      ...BASE_CONFIG,
      placement_policy: {
        ...BASE_CONFIG.placement_policy,
        derived_boundaries_from_trope_marks: "layer"
      }
    });

    expect(strictChanged).not.toBe(baseline);
    expect(emitUnknownChanged).not.toBe(baseline);
    expect(sofRankChanged).not.toBe(baseline);
    expect(placementChanged).not.toBe(baseline);
  });

  it("computes deterministic digest and changes when digest inputs change", () => {
    const config_hash = computeCantillationConfigHash(BASE_CONFIG);
    const baseline = computeCantillationDigest({
      spine_digest: "a".repeat(64),
      config_hash,
      code_hash: "b".repeat(64)
    });
    const changedSpine = computeCantillationDigest({
      spine_digest: "c".repeat(64),
      config_hash,
      code_hash: "b".repeat(64)
    });
    const changedConfig = computeCantillationDigest({
      spine_digest: "a".repeat(64),
      config_hash: "d".repeat(64),
      code_hash: "b".repeat(64)
    });
    const changedCode = computeCantillationDigest({
      spine_digest: "a".repeat(64),
      config_hash,
      code_hash: "e".repeat(64)
    });
    const changedLayerVersion = computeCantillationDigest({
      spine_digest: "a".repeat(64),
      config_hash,
      code_hash: "b".repeat(64),
      layer_version: 2
    });

    expect(changedSpine).not.toBe(baseline);
    expect(changedConfig).not.toBe(baseline);
    expect(changedCode).not.toBe(baseline);
    expect(changedLayerVersion).not.toBe(baseline);
  });
});

describe("cantillation code hash", () => {
  it("tracks only cantillation source files by default", () => {
    expect(DEFAULT_CANTILLATION_CODE_PATHS.length).toBeGreaterThan(0);
    for (const relPath of DEFAULT_CANTILLATION_CODE_PATHS) {
      expect(relPath.startsWith("src/layers/cantillation/")).toBe(true);
    }
    expect(DEFAULT_CANTILLATION_CODE_PATHS).toContain("src/layers/cantillation/stats.ts");
  });

  it("is deterministic for identical file bytes and changes on file edits", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cantillation-code-hash-"));
    const fileA = path.join(tmp, "a.ts");
    const fileB = path.join(tmp, "b.ts");
    fs.writeFileSync(fileA, "export const a = 1;\n", "utf8");
    fs.writeFileSync(fileB, "export const b = 2;\n", "utf8");

    const relA = path.relative(tmp, fileA);
    const relB = path.relative(tmp, fileB);

    const hashA = await computeCantillationCodeHash([relA, relB], tmp);
    const hashB = await computeCantillationCodeHash([relB, relA], tmp);
    expect(hashA).toBe(hashB);

    fs.writeFileSync(fileB, "export const b = 3;\n", "utf8");
    const hashC = await computeCantillationCodeHash([relA, relB], tmp);
    expect(hashC).not.toBe(hashA);
  });
});
