import { describe, expect, it } from "vitest";
import { makeGapId } from "../../src/spine/anchors";
import { buildSpineForRef } from "../../src/spine/build";
import { defaultNormalizationOptions } from "../../src/spine/options";
import { type SpineRecord } from "../../src/spine/schema";

async function collectRows(ref_key: string, text: string): Promise<SpineRecord[]> {
  const rows: SpineRecord[] = [];
  for await (const row of buildSpineForRef({
    ref_key,
    text,
    opts: defaultNormalizationOptions()
  })) {
    rows.push(row);
  }
  return rows;
}

describe("spine layout guardrail", () => {
  it("never emits layout classifications even when external layout hints exist", async () => {
    const refKey = "Genesis/1/1";
    const text = "א, ב";

    const externalLayoutHints = {
      [makeGapId(refKey, 1)]: "SETUMA",
      [makeGapId(refKey, 2)]: "PETUCHA"
    } as const;
    expect(externalLayoutHints[makeGapId(refKey, 1)]).toBe("SETUMA");

    const rows = await collectRows(refKey, text);
    const gapRows = rows.filter(
      (row): row is Extract<SpineRecord, { kind: "gap" }> => row.kind === "gap"
    );
    expect(gapRows.length).toBeGreaterThan(0);

    for (const gap of gapRows) {
      const gapObj = gap as unknown as Record<string, unknown>;
      expect(Object.keys(gapObj).sort()).toEqual(["gap_index", "gapid", "kind", "raw", "ref_key"]);
      expect(gapObj.layout_event).toBeUndefined();
      expect(gapObj.SETUMA).toBeUndefined();
      expect(gapObj.PETUCHA).toBeUndefined();
      expect(gapObj.BOOK_BREAK).toBeUndefined();

      const rawObj = gap.raw as unknown as Record<string, unknown>;
      expect(Object.keys(rawObj).sort()).toEqual(["chars", "whitespace"]);
      expect(rawObj.layout).toBeUndefined();
      expect(rawObj.classification).toBeUndefined();
    }

    const serialized = rows.map((row) => JSON.stringify(row)).join("\n");
    expect(serialized).not.toContain("SETUMA");
    expect(serialized).not.toContain("PETUCHA");
    expect(serialized).not.toContain("BOOK_BREAK");
  });
});
