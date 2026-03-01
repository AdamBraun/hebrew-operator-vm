import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGapProjectionIndex,
  getGapId,
  projectSpineGapsFromJsonl,
  readSpineGapDescriptorsFromJsonl
} from "../../../src/layers/layout/spine_adapter";

function writeFixture(content: string): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "spine-adapter-"));
  const filePath = path.join(tmpDir, "spine.jsonl");
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

describe("layout spine adapter", () => {
  it("streams gap descriptors in spine order and builds mapping/summary", async () => {
    const fixture = [
      JSON.stringify({
        kind: "gap",
        gapid: "Genesis/1/1#gap:0",
        ref_key: "Genesis/1/1",
        gap_index: 0,
        raw: { whitespace: false, chars: [] }
      }),
      JSON.stringify({
        kind: "g",
        gid: "Genesis/1/1#g:0",
        ref_key: "Genesis/1/1",
        g_index: 0,
        base_letter: "א",
        marks_raw: { niqqud: [], teamim: [] },
        raw: { text: "א" }
      }),
      JSON.stringify({
        kind: "gap",
        gapid: "Genesis/1/1#gap:1",
        ref_key: "Genesis/1/1",
        gap_index: 1,
        raw: { whitespace: true, chars: ["\u05BE"] }
      }),
      JSON.stringify({
        kind: "g",
        gid: "Genesis/1/1#g:1",
        ref_key: "Genesis/1/1",
        g_index: 1,
        base_letter: "ב",
        marks_raw: { niqqud: [], teamim: [] },
        raw: { text: "ב" }
      }),
      JSON.stringify({
        kind: "gap",
        gapid: "Genesis/1/1#gap:2",
        ref_key: "Genesis/1/1",
        gap_index: 2,
        raw: { whitespace: false, chars: ["\u05C3"] }
      }),
      JSON.stringify({
        kind: "gap",
        gapid: "Genesis/1/2#gap:0",
        ref_key: "Genesis/1/2",
        gap_index: 0,
        raw: { whitespace: false, chars: [], custom_flag: true }
      }),
      ""
    ].join("\n");

    const spinePath = writeFixture(fixture);
    const projection = createGapProjectionIndex();
    const gaps = [];
    for await (const gap of readSpineGapDescriptorsFromJsonl(spinePath, { index: projection })) {
      gaps.push(gap);
    }

    expect(gaps.map((gap) => gap.gapid)).toEqual([
      "Genesis/1/1#gap:0",
      "Genesis/1/1#gap:1",
      "Genesis/1/1#gap:2",
      "Genesis/1/2#gap:0"
    ]);
    expect(gaps[1]?.whitespace).toBe(true);
    expect(gaps[1]?.raw_flags?.maqaf_char).toBe(true);
    expect(gaps[2]?.raw_flags?.sof_pasuk_char).toBe(true);
    expect(gaps[3]?.raw_flags?.custom_flag).toBe(true);

    expect(getGapId(projection, "Genesis/1/1", 0)).toBe("Genesis/1/1#gap:0");
    expect(getGapId(projection, "Genesis/1/1", 2)).toBe("Genesis/1/1#gap:2");
    expect(getGapId(projection, "Genesis/1/2", 0)).toBe("Genesis/1/2#gap:0");
    expect(getGapId(projection, "Genesis/1/2", 1)).toBeUndefined();

    expect(projection.maxGapIndexByRef.get("Genesis/1/1")).toBe(2);
    expect(projection.maxGapIndexByRef.get("Genesis/1/2")).toBe(0);
  });

  it("can project mapping/summaries in one streaming pass", async () => {
    const fixture = [
      JSON.stringify({
        kind: "gap",
        gapid: "Exodus/1/1#gap:0",
        ref_key: "Exodus/1/1",
        gap_index: 0,
        raw: { whitespace: false, chars: [] }
      }),
      JSON.stringify({
        kind: "gap",
        gapid: "Exodus/1/1#gap:1",
        ref_key: "Exodus/1/1",
        gap_index: 1,
        raw: { whitespace: true, chars: [] }
      }),
      ""
    ].join("\n");

    const spinePath = writeFixture(fixture);
    const projection = await projectSpineGapsFromJsonl(spinePath);

    expect(getGapId(projection, "Exodus/1/1", 0)).toBe("Exodus/1/1#gap:0");
    expect(getGapId(projection, "Exodus/1/1", 1)).toBe("Exodus/1/1#gap:1");
    expect(projection.maxGapIndexByRef.get("Exodus/1/1")).toBe(1);
  });

  it("fails on malformed gapid/ref_key/gap_index triples", async () => {
    const fixture = [
      JSON.stringify({
        kind: "gap",
        gapid: "Genesis/1/1#gap:9",
        ref_key: "Genesis/1/1",
        gap_index: 1,
        raw: { whitespace: false, chars: [] }
      }),
      ""
    ].join("\n");

    const spinePath = writeFixture(fixture);
    const run = async (): Promise<void> => {
      for await (const _gap of readSpineGapDescriptorsFromJsonl(spinePath)) {
        // noop
      }
    };

    await expect(run()).rejects.toThrow(/does not match ref_key/);
  });
});
