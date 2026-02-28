import { describe, expect, it } from "vitest";
import {
  deltas,
  describe as describeStats,
  groupBy,
  jaccard,
  runLengths,
  topN
} from "@ref/scripts/summaryInsights/stats";

describe("summary insights stats utilities", () => {
  it("describe handles empty input", () => {
    expect(describeStats([])).toEqual({
      count: 0,
      min: null,
      max: null,
      mean: null,
      median: null,
      p90: null,
      p99: null,
      stdev: null
    });
  });

  it("describe computes deterministic descriptive stats", () => {
    const stats = describeStats([5, 1, 4, 2, 3]);
    expect(stats.count).toBe(5);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(5);
    expect(stats.mean).toBe(3);
    expect(stats.median).toBe(3);
    expect(stats.p90).toBeCloseTo(4.6, 8);
    expect(stats.p99).toBeCloseTo(4.96, 8);
    expect(stats.stdev).toBeCloseTo(Math.sqrt(2), 8);
  });

  it("topN uses metric sort with stable tie-breaks by sequence/ref/index", () => {
    const rows = [
      { sequence: 2, ref_key: "Genesis/1/2", score: 10 },
      { sequence: 1, ref_key: "Genesis/1/1", score: 10 },
      { sequence: 3, ref_key: "Genesis/1/3", score: 12 },
      { sequence: 4, ref_key: "Genesis/1/4", score: 10 }
    ];
    const top = topN(rows, 3, (row) => row.score);
    expect(top.map((row) => row.ref_key)).toEqual(["Genesis/1/3", "Genesis/1/1", "Genesis/1/2"]);

    const tiedWithoutSequence = topN(
      [
        { ref_key: "b", score: 5 },
        { ref_key: "a", score: 5 }
      ],
      2,
      (row) => row.score
    );
    expect(tiedWithoutSequence.map((row) => row.ref_key)).toEqual(["a", "b"]);
    expect(topN(rows, 0, (row) => row.score)).toEqual([]);
  });

  it("deltas handles empty and computes adjacent differences", () => {
    expect(deltas([])).toEqual([]);
    expect(deltas([9])).toEqual([]);
    expect(deltas([2, 5, 4, 10])).toEqual([3, -1, 6]);
  });

  it("runLengths returns contiguous id segments with 1-based ranges", () => {
    expect(runLengths([])).toEqual([]);
    expect(runLengths([null, null, "a", "a", "b", null, null])).toEqual([
      { id: null, startSeq: 1, endSeq: 2, length: 2 },
      { id: "a", startSeq: 3, endSeq: 4, length: 2 },
      { id: "b", startSeq: 5, endSeq: 5, length: 1 },
      { id: null, startSeq: 6, endSeq: 7, length: 2 }
    ]);
  });

  it("jaccard handles empty sets and overlap ratios", () => {
    expect(jaccard(new Set<string>(), new Set<string>())).toBe(1);
    expect(jaccard(new Set(["a", "b"]), new Set<string>())).toBe(0);
    expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3, 8);
  });

  it("groupBy builds deterministic grouped maps", () => {
    const grouped = groupBy(
      [
        { ref: "Genesis/1/1", book: "Genesis" },
        { ref: "Genesis/1/2", book: "Genesis" },
        { ref: "Exodus/1/1", book: "Exodus" }
      ],
      (row) => row.book
    );
    expect(Array.from(grouped.keys())).toEqual(["Genesis", "Exodus"]);
    expect(grouped.get("Genesis")?.map((row) => row.ref)).toEqual(["Genesis/1/1", "Genesis/1/2"]);
    expect(grouped.get("Exodus")?.map((row) => row.ref)).toEqual(["Exodus/1/1"]);
  });
});
