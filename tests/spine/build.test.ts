import { describe, expect, it } from "vitest";
import { buildSpineForRef } from "../../src/spine/build";
import { defaultNormalizationOptions } from "../../src/spine/options";
import { type SpineRecord } from "../../src/spine/schema";

async function collectRows(
  ref_key: string,
  text: string,
  opts = defaultNormalizationOptions()
): Promise<SpineRecord[]> {
  const rows: SpineRecord[] = [];
  for await (const row of buildSpineForRef({ ref_key, text, opts })) {
    rows.push(row);
  }
  return rows;
}

describe("spine build", () => {
  it("emits Convention A rows with contiguous indices", async () => {
    const rows = await collectRows("Genesis/1/1", "בָּרָא אֱלֹהִים׃");
    const kinds = rows.map((row) => row.kind);
    expect(kinds[0]).toBe("gap");
    for (let i = 0; i < kinds.length - 1; i += 2) {
      expect(kinds[i]).toBe("gap");
      expect(kinds[i + 1]).toBe("g");
    }
    expect(kinds[kinds.length - 1]).toBe("gap");

    const gRows = rows.filter(
      (row): row is Extract<SpineRecord, { kind: "g" }> => row.kind === "g"
    );
    const gapRows = rows.filter(
      (row): row is Extract<SpineRecord, { kind: "gap" }> => row.kind === "gap"
    );

    expect(gapRows).toHaveLength(gRows.length + 1);
    expect(gRows.map((row) => row.g_index)).toEqual(gRows.map((_, index) => index));
    expect(gapRows.map((row) => row.gap_index)).toEqual(gapRows.map((_, index) => index));

    expect(gRows[0]?.gid).toBe("Genesis/1/1#g:0");
    expect(gapRows[0]?.gapid).toBe("Genesis/1/1#gap:0");
    expect(gapRows[3]?.raw.whitespace).toBe(true);
    expect(gapRows[gapRows.length - 1]?.raw.chars).toEqual(["׃"]);
  });

  it("drops punctuation chars when preservePunctuation is false", async () => {
    const rows = await collectRows("Genesis/2/1", "כָל־טוֹב", {
      ...defaultNormalizationOptions(),
      preservePunctuation: false
    });
    const gapRows = rows.filter(
      (row): row is Extract<SpineRecord, { kind: "gap" }> => row.kind === "gap"
    );
    expect(gapRows.some((gap) => gap.raw.chars.length > 0)).toBe(false);
  });

  it("normalizes final letters when normalizeFinals is true", async () => {
    const rows = await collectRows("Genesis/3/1", "מלך", {
      ...defaultNormalizationOptions(),
      normalizeFinals: true
    });
    const gRows = rows.filter(
      (row): row is Extract<SpineRecord, { kind: "g" }> => row.kind === "g"
    );
    expect(gRows.map((row) => row.base_letter)).toEqual(["מ", "ל", "כ"]);
    expect(gRows[2]?.raw.text).toBe("ך");
  });

  it("strips control characters when stripControlChars is true", async () => {
    const rows = await collectRows("Genesis/4/1", "א\u0000ב", {
      ...defaultNormalizationOptions(),
      stripControlChars: true
    });
    const gRows = rows.filter(
      (row): row is Extract<SpineRecord, { kind: "g" }> => row.kind === "g"
    );
    const gapRows = rows.filter(
      (row): row is Extract<SpineRecord, { kind: "gap" }> => row.kind === "gap"
    );
    expect(gRows).toHaveLength(2);
    expect(gapRows[1]?.raw.chars).toEqual([]);
  });

  it("strips injected markup metadata before building gaps", async () => {
    const rows = await collectRows("Genesis/1/1", "<big>בְּ</big>רֵאשִׁית");
    const gapRows = rows.filter(
      (row): row is Extract<SpineRecord, { kind: "gap" }> => row.kind === "gap"
    );
    const allGapChars = gapRows.flatMap((gap) => gap.raw.chars);

    expect(allGapChars).not.toContain("<");
    expect(allGapChars).not.toContain(">");
    expect(allGapChars).not.toContain("/");
  });

  it("throws on unknown marks when errorOnUnknownMark is true", async () => {
    const run = async (): Promise<SpineRecord[]> =>
      collectRows("Genesis/5/1", "א\u0301", {
        ...defaultNormalizationOptions(),
        errorOnUnknownMark: true
      });
    await expect(run()).rejects.toThrow(/unknown mark/i);
  });

  it("is deterministic across runs", async () => {
    const opts = defaultNormalizationOptions();
    const first = await collectRows("Genesis/6/1", "בְּרֵאשִׁ֖ית", opts);
    const second = await collectRows("Genesis/6/1", "בְּרֵאשִׁ֖ית", opts);
    expect(second).toEqual(first);
  });
});
