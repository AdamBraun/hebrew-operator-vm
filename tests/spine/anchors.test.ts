import { describe, expect, it } from "vitest";
import { makeGapId, makeGid } from "../../src/spine/anchors";

describe("spine anchors", () => {
  it("builds stable gid values for multiple refs and indices", () => {
    expect(makeGid("Genesis/1/1", 0)).toBe("Genesis/1/1#g:0");
    expect(makeGid("Genesis/1/1", 12)).toBe("Genesis/1/1#g:12");
    expect(makeGid("Exodus/20/13", 4)).toBe("Exodus/20/13#g:4");
    expect(makeGid("Genesis/1/1", 0)).toBe("Genesis/1/1#g:0");
  });

  it("builds stable gapid values for multiple refs and indices", () => {
    expect(makeGapId("Genesis/1/1", 0)).toBe("Genesis/1/1#gap:0");
    expect(makeGapId("Genesis/1/1", 13)).toBe("Genesis/1/1#gap:13");
    expect(makeGapId("Leviticus/3/2", 5)).toBe("Leviticus/3/2#gap:5");
    expect(makeGapId("Genesis/1/1", 0)).toBe("Genesis/1/1#gap:0");
  });

  it("rejects empty or newline ref_key", () => {
    expect(() => makeGid("", 0)).toThrow(/ref_key/);
    expect(() => makeGapId("", 0)).toThrow(/ref_key/);
    expect(() => makeGid("Genesis/1/1\nextra", 0)).toThrow(/newlines/);
    expect(() => makeGapId("Genesis/1/1\rextra", 0)).toThrow(/newlines/);
  });

  it("rejects non-ASCII ref_key values to keep anchors ASCII-safe", () => {
    expect(() => makeGid("בראשית/1/1", 0)).toThrow(/ASCII/);
    expect(() => makeGapId("בראשית/1/1", 0)).toThrow(/ASCII/);
  });

  it("rejects invalid indices", () => {
    expect(() => makeGid("Genesis/1/1", -1)).toThrow(/non-negative/);
    expect(() => makeGapId("Genesis/1/1", -1)).toThrow(/non-negative/);
    expect(() => makeGid("Genesis/1/1", 1.5)).toThrow(/finite integer/);
    expect(() => makeGapId("Genesis/1/1", Number.NaN)).toThrow(/finite integer/);
    expect(() => makeGapId("Genesis/1/1", Number.POSITIVE_INFINITY)).toThrow(/finite integer/);
  });
});
