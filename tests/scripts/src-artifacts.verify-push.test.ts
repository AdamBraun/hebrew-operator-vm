import { describe, expect, it } from "vitest";
import {
  CANONICAL_PATHS,
  requiredTrackedArtifactsForLayers
} from "../../scripts/src-artifacts/config.mjs";

describe("src-artifacts tracked output contract", () => {
  it("requires canonical latest jsonl outputs for orthogonal layers", () => {
    const impactedLayers = new Set([
      "spine",
      "letters",
      "niqqud",
      "cantillation",
      "layout",
      "metadata"
    ]);

    expect(requiredTrackedArtifactsForLayers(impactedLayers)).toEqual([
      CANONICAL_PATHS.cantillationIrPath,
      CANONICAL_PATHS.layoutIrPath,
      CANONICAL_PATHS.lettersIrPath,
      CANONICAL_PATHS.metadataPlanJsonlPath,
      CANONICAL_PATHS.niqqudIrPath,
      CANONICAL_PATHS.spineJsonlPath
    ]);
  });

  it("does not require tracked stitch proof artifacts", () => {
    expect(requiredTrackedArtifactsForLayers(new Set(["stitch"]))).toEqual([]);
    expect(requiredTrackedArtifactsForLayers(new Set(["letters", "stitch"]))).toEqual([
      CANONICAL_PATHS.lettersIrPath
    ]);
  });
});
