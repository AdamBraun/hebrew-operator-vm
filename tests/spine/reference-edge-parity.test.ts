import { describe, expect, it } from "vitest";
import { buildSpineForRef } from "../../src/spine/build";
import { defaultNormalizationOptions } from "../../src/spine/options";
import { type SpineRecord } from "../../src/spine/schema";
import { splitIntoGraphemes, splitMarks } from "../../src/spine/unicode";

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

describe("spine reference edge parity", () => {
  it("clusters Hebrew base + combining marks and splits adjacent bases", () => {
    expect(splitIntoGraphemes("נָ")).toEqual(["נָ"]);
    expect(splitIntoGraphemes("נס")).toEqual(["נ", "ס"]);
  });

  it("keeps whitespace signal for newline and tab boundaries when control stripping is disabled", async () => {
    const opts = {
      ...defaultNormalizationOptions(),
      stripControlChars: false
    };
    const rowsNewline = await collectRows("Genesis/9/1", "נ\nס", opts);
    const rowsTab = await collectRows("Genesis/9/2", "נ\tס", opts);

    const gapNewline = rowsNewline.filter(
      (row): row is Extract<SpineRecord, { kind: "gap" }> => row.kind === "gap"
    );
    const gapTab = rowsTab.filter(
      (row): row is Extract<SpineRecord, { kind: "gap" }> => row.kind === "gap"
    );
    expect(gapNewline[1]?.raw.whitespace).toBe(true);
    expect(gapTab[1]?.raw.whitespace).toBe(true);
  });

  it("preserves maqaf and sof-pasuq as raw punctuation chars in gaps", async () => {
    const rows = await collectRows("Genesis/9/3", "א־ב׃");
    const gapRows = rows.filter(
      (row): row is Extract<SpineRecord, { kind: "gap" }> => row.kind === "gap"
    );
    expect(gapRows[1]?.raw.chars).toEqual(["־"]);
    expect(gapRows[2]?.raw.chars).toEqual(["׃"]);
  });

  it("fails loudly on unknown combining marks when policy is strict", async () => {
    await expect(
      collectRows("Genesis/9/4", "א\u0301", {
        ...defaultNormalizationOptions(),
        errorOnUnknownMark: true
      })
    ).rejects.toThrow(/unknown mark/i);
  });

  it("keeps dangling leading marks deterministic as raw gap chars", async () => {
    const rows = await collectRows("Genesis/9/5", "\u05B0א");
    const gapRows = rows.filter(
      (row): row is Extract<SpineRecord, { kind: "gap" }> => row.kind === "gap"
    );
    const gRows = rows.filter(
      (row): row is Extract<SpineRecord, { kind: "g" }> => row.kind === "g"
    );

    expect(gRows).toHaveLength(1);
    expect(gRows[0]?.base_letter).toBe("א");
    expect(gapRows[0]?.raw.chars).toEqual(["ְ"]);
  });

  it("matches expected niqqud/teamim split for known edge mark mix", () => {
    const parsed = splitMarks("שִׁ֖");
    expect(parsed.base).toBe("ש");
    expect(parsed.niqqud).toEqual(["ִ", "ׁ"]);
    expect(parsed.teamim).toEqual(["֖"]);
    expect(parsed.otherMarks).toEqual([]);
  });
});
