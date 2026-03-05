import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertLayoutIRRecord,
  assertLayoutIRRecords,
  assertLayoutIRRecordsAgainstKnownGaps,
  formatLayoutIRJsonl,
  parseLayoutIRJsonl,
  readLayoutIRJsonl,
  writeLayoutIRJsonl,
  type LayoutIRRecord
} from "../../../src/layers/layout/schema";

describe("layout ir schema", () => {
  it("accepts a valid record", () => {
    const record: LayoutIRRecord = {
      gapid: "Genesis/1/1#gap:3",
      ref_key: "Genesis/1/1",
      gap_index: 3,
      layout_event: {
        type: "SPACE",
        strength: "weak",
        source: "spine_whitespace",
        meta: { note: "derived from gap whitespace" }
      }
    };

    expect(() => assertLayoutIRRecord(record)).not.toThrow();
  });

  it("rejects invalid strength mapping", () => {
    const invalid = {
      gapid: "Genesis/1/1#gap:4",
      ref_key: "Genesis/1/1",
      gap_index: 4,
      layout_event: {
        type: "SETUMA",
        strength: "weak",
        source: "dataset"
      }
    };

    expect(() => assertLayoutIRRecord(invalid)).toThrow(/expected 'mid' for type 'SETUMA'/);
  });

  it("rejects invalid source mapping", () => {
    const invalid = {
      gapid: "Genesis/1/1#gap:2",
      ref_key: "Genesis/1/1",
      gap_index: 2,
      layout_event: {
        type: "SPACE",
        strength: "weak",
        source: "dataset"
      }
    };

    expect(() => assertLayoutIRRecord(invalid)).toThrow(
      /expected 'spine_whitespace' for type 'SPACE'/
    );
  });

  it("sorts and serializes deterministically", () => {
    const a: LayoutIRRecord = {
      gapid: "Genesis/1/1#gap:5",
      ref_key: "Genesis/1/1",
      gap_index: 5,
      layout_event: { type: "SETUMA", strength: "mid", source: "dataset" }
    };
    const b: LayoutIRRecord = {
      gapid: "Genesis/1/1#gap:5",
      ref_key: "Genesis/1/1",
      gap_index: 5,
      layout_event: { type: "SPACE", strength: "weak", source: "spine_whitespace" }
    };
    const c: LayoutIRRecord = {
      gapid: "Genesis/1/2#gap:1",
      ref_key: "Genesis/1/2",
      gap_index: 1,
      layout_event: { type: "PETUCHA", strength: "strong", source: "dataset" }
    };

    const jsonlOne = formatLayoutIRJsonl([c, a, b]);
    const jsonlTwo = formatLayoutIRJsonl([b, c, a]);
    expect(jsonlOne).toBe(jsonlTwo);

    const parsed = parseLayoutIRJsonl(jsonlOne);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]?.layout_event.type).toBe("SPACE");
    expect(parsed[1]?.layout_event.type).toBe("SETUMA");
    expect(parsed[2]?.ref_key).toBe("Genesis/1/2");
  });

  it("rejects duplicate (gapid, type) pairs", () => {
    const dup: LayoutIRRecord[] = [
      {
        gapid: "Genesis/1/1#gap:2",
        ref_key: "Genesis/1/1",
        gap_index: 2,
        layout_event: { type: "SPACE", strength: "weak", source: "spine_whitespace" }
      },
      {
        gapid: "Genesis/1/1#gap:2",
        ref_key: "Genesis/1/1",
        gap_index: 2,
        layout_event: { type: "SPACE", strength: "weak", source: "spine_whitespace" }
      }
    ];

    expect(() => assertLayoutIRRecords(dup)).toThrow(/duplicate \(gapid,type\) pair/);
  });

  it("enforces known-gap coverage when provided", () => {
    const rows: LayoutIRRecord[] = [
      {
        gapid: "Genesis/1/1#gap:1",
        ref_key: "Genesis/1/1",
        gap_index: 1,
        layout_event: { type: "SPACE", strength: "weak", source: "spine_whitespace" }
      }
    ];

    expect(() =>
      assertLayoutIRRecordsAgainstKnownGaps(rows, ["Genesis/1/1#gap:1", "Genesis/1/1#gap:2"])
    ).not.toThrow();

    expect(() => assertLayoutIRRecordsAgainstKnownGaps(rows, ["Genesis/1/1#gap:2"])).toThrow(
      /unknown gapid/
    );
  });

  it("writes and reads layout.ir.jsonl files", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "layout-ir-"));
    const filePath = path.join(tmp, "layout.ir.jsonl");

    const rows: LayoutIRRecord[] = [
      {
        gapid: "Genesis/1/1#gap:3",
        ref_key: "Genesis/1/1",
        gap_index: 3,
        layout_event: { type: "SETUMA", strength: "mid", source: "dataset" }
      },
      {
        gapid: "Genesis/1/1#gap:3",
        ref_key: "Genesis/1/1",
        gap_index: 3,
        layout_event: { type: "SPACE", strength: "weak", source: "spine_whitespace" }
      }
    ];

    await writeLayoutIRJsonl(filePath, rows);
    const loaded = await readLayoutIRJsonl(filePath);

    expect(loaded).toHaveLength(2);
    expect(loaded[0]?.layout_event.type).toBe("SPACE");
    expect(loaded[1]?.layout_event.type).toBe("SETUMA");
  });
});
