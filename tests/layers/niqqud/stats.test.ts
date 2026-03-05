import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createNiqqudStatsAccumulator,
  createNiqqudWarning,
  recordNiqqudRow,
  recordNiqqudWarning,
  writeNiqqudQualityArtifacts
} from "../../../src/layers/niqqud/stats";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "niqqud-stats-"));
}

describe("niqqud stats + warnings", () => {
  it("tracks counts, frequencies, and ambiguity warnings without failing", () => {
    const acc = createNiqqudStatsAccumulator();

    recordNiqqudRow(acc, {
      gid: "Genesis/1/1#g:0",
      ref_key: "Genesis/1/1",
      g_index: 0,
      rawNiqqud: [],
      classes: [],
      unhandled: [],
      ambiguous: false
    });

    recordNiqqudRow(acc, {
      gid: "Genesis/1/1#g:1",
      ref_key: "Genesis/1/1",
      g_index: 1,
      rawNiqqud: ["ְ"],
      classes: ["SHVA"],
      unhandled: [],
      ambiguous: false
    });

    recordNiqqudRow(acc, {
      gid: "Genesis/1/1#g:2",
      ref_key: "Genesis/1/1",
      g_index: 2,
      rawNiqqud: ["ָ", "ֹ"],
      classes: ["QAMATS", "HOLAM"],
      unhandled: ["\u05BD"],
      ambiguous: true
    });

    expect(acc.stats.totalGraphemes).toBe(3);
    expect(acc.stats.graphemesWithNiqqud).toBe(2);
    expect(acc.stats.perClassFrequency).toMatchObject({
      SHVA: 1,
      QAMATS: 1,
      HOLAM: 1
    });
    expect(acc.stats.unhandledFrequency).toEqual({
      "\u05BD": 1
    });
    expect(acc.stats.ambiguityCount).toBe(1);
    expect(acc.stats.warningCount).toBe(2);
    expect(acc.stats.warningTypeFrequency).toEqual({
      MALFORMED_MARKS: 0,
      UNHANDLED_MARK: 1,
      AMBIGUOUS_COMBO: 1
    });

    expect(acc.warnings).toHaveLength(2);
    expect(acc.warnings[0]?.type).toBe("UNHANDLED_MARK");
    expect(acc.warnings[1]?.type).toBe("AMBIGUOUS_COMBO");
  });

  it("writes niqqud.stats.json and warnings.jsonl files", async () => {
    const acc = createNiqqudStatsAccumulator();
    recordNiqqudWarning(
      acc,
      createNiqqudWarning({
        gid: "Genesis/1/1#g:3",
        ref_key: "Genesis/1/1",
        g_index: 3,
        type: "MALFORMED_MARKS",
        detail: "marks_raw.niqqud invalid"
      })
    );

    const outputDir = createTmpDir();
    const written = await writeNiqqudQualityArtifacts({
      outputDir,
      stats: acc.stats,
      warnings: acc.warnings
    });

    expect(fs.existsSync(written.statsPath)).toBe(true);
    expect(fs.existsSync(written.warningsPath ?? "")).toBe(true);

    const statsPayload = JSON.parse(fs.readFileSync(written.statsPath, "utf8")) as {
      warningCount: number;
      warningTypeFrequency: Record<string, number>;
    };
    expect(statsPayload.warningCount).toBe(1);
    expect(statsPayload.warningTypeFrequency.MALFORMED_MARKS).toBe(1);

    const warningLines = fs
      .readFileSync(written.warningsPath ?? "", "utf8")
      .split(/\r?\n/u)
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as { type: string; detail: string });

    expect(warningLines).toEqual([
      {
        gid: "Genesis/1/1#g:3",
        ref_key: "Genesis/1/1",
        g_index: 3,
        type: "MALFORMED_MARKS",
        detail: "marks_raw.niqqud invalid"
      }
    ]);
  });

  it("can skip warnings.jsonl emission while still writing stats", async () => {
    const outputDir = createTmpDir();
    const acc = createNiqqudStatsAccumulator();

    const written = await writeNiqqudQualityArtifacts({
      outputDir,
      stats: acc.stats,
      warnings: [],
      writeWarningsJsonl: false
    });

    expect(fs.existsSync(written.statsPath)).toBe(true);
    expect(written.warningsPath).toBeUndefined();
    expect(fs.existsSync(path.join(outputDir, "warnings.jsonl"))).toBe(false);
  });
});
