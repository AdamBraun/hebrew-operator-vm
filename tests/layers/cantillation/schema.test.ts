import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertCantillationIRRecord,
  assertCantillationIRRecords,
  assertCantillationIRRecordsAgainstSpine,
  formatCantillationIRJsonl,
  parseCantillationIRJsonl,
  readCantillationIRJsonl,
  writeCantillationIRJsonl,
  type CantillationIRRecord
} from "../../../src/layers/cantillation/schema";
import { assertSpineRecord, type SpineRecord } from "../../../src/spine/schema";

function loadSpineFixture(fileName: string): SpineRecord[] {
  const fixturePath = path.resolve(process.cwd(), "tests", "fixtures", fileName);
  const raw = fs.readFileSync(fixturePath, "utf8");
  const out: SpineRecord[] = [];

  for (const line of raw.split(/\r?\n/u)) {
    if (!line.trim()) {
      continue;
    }
    const parsed = JSON.parse(line) as unknown;
    assertSpineRecord(parsed);
    out.push(parsed);
  }

  return out;
}

describe("cantillation ir schema", () => {
  it("accepts valid gid and gap anchored events", () => {
    const gidRow: CantillationIRRecord = {
      kind: "cant_event",
      anchor: { kind: "gid", id: "Genesis/1/1#g:3" },
      ref_key: "Genesis/1/1",
      event: {
        type: "TROPE_MARK",
        mark: "ZAKEF_KATON",
        class: "DISJ",
        rank: 2
      },
      raw: {
        teamim: ["\u0595"]
      }
    };

    const unknownRow: CantillationIRRecord = {
      kind: "cant_event",
      anchor: { kind: "gid", id: "Genesis/1/1#g:4" },
      ref_key: "Genesis/1/1",
      event: {
        type: "UNKNOWN_MARK",
        codepoint: "U+05AD",
        rank: null
      },
      raw: {
        teamim: ["\u05AD"]
      }
    };

    const gapRow: CantillationIRRecord = {
      kind: "cant_event",
      anchor: { kind: "gap", id: "Genesis/1/1#gap:4" },
      ref_key: "Genesis/1/1",
      event: {
        type: "BOUNDARY",
        op: "CUT",
        rank: 3,
        reason: "SOF_PASUK"
      },
      raw: {
        source: "sof_pasuk_char"
      }
    };

    expect(() => assertCantillationIRRecord(gidRow)).not.toThrow();
    expect(() => assertCantillationIRRecord(unknownRow)).not.toThrow();
    expect(() => assertCantillationIRRecord(gapRow)).not.toThrow();
  });

  it("rejects anchor/ref mismatch", () => {
    const invalid = {
      kind: "cant_event",
      anchor: { kind: "gid", id: "Genesis/1/2#g:1" },
      ref_key: "Genesis/1/1",
      event: {
        type: "TROPE_MARK",
        mark: "MERKHA",
        class: "CONJ",
        rank: null
      },
      raw: {
        teamim: ["\u05A5"]
      }
    };

    expect(() => assertCantillationIRRecord(invalid)).toThrow(/must match ref_key/);
  });

  it("rejects unsorted teamim marks", () => {
    const invalid = {
      kind: "cant_event",
      anchor: { kind: "gid", id: "Genesis/1/1#g:3" },
      ref_key: "Genesis/1/1",
      event: {
        type: "TROPE_MARK",
        mark: "MERKHA",
        class: "CONJ",
        rank: null
      },
      raw: {
        teamim: ["\u05A5", "\u0595"]
      }
    };

    expect(() => assertCantillationIRRecord(invalid)).toThrow(/teamim marks must be sorted/);
  });

  it("formats deterministically and normalizes teamim order", () => {
    const rows: CantillationIRRecord[] = [
      {
        kind: "cant_event",
        anchor: { kind: "gap", id: "Genesis/1/1#gap:1" },
        ref_key: "Genesis/1/1",
        event: {
          type: "BOUNDARY",
          op: "CUT",
          rank: 2,
          reason: "PAUSE"
        },
        raw: {
          source: "derived"
        }
      },
      {
        kind: "cant_event",
        anchor: { kind: "gid", id: "Genesis/1/1#g:3" },
        ref_key: "Genesis/1/1",
        event: {
          type: "TROPE_MARK",
          mark: "MERKHA",
          class: "CONJ",
          rank: null
        },
        raw: {
          teamim: ["\u05A5", "\u0595"]
        }
      }
    ];

    const jsonl = formatCantillationIRJsonl(rows);
    const parsed = parseCantillationIRJsonl(jsonl);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.anchor.kind).toBe("gap");
    expect(parsed[1]?.anchor.kind).toBe("gid");
    expect(parsed[1]?.raw.teamim).toEqual(["\u0595", "\u05A5"]);

    const permuted = formatCantillationIRJsonl([...rows].reverse());
    expect(permuted).toBe(jsonl);
  });

  it("validates anchors against spine", () => {
    const spine = loadSpineFixture("spine-small.jsonl");
    const validRows: CantillationIRRecord[] = [
      {
        kind: "cant_event",
        anchor: { kind: "gid", id: "Genesis/1/1#g:0" },
        ref_key: "Genesis/1/1",
        event: {
          type: "TROPE_MARK",
          mark: "MUNACH",
          class: "CONJ",
          rank: null
        },
        raw: {
          teamim: []
        }
      },
      {
        kind: "cant_event",
        anchor: { kind: "gap", id: "Genesis/1/1#gap:1" },
        ref_key: "Genesis/1/1",
        event: {
          type: "BOUNDARY",
          op: "CUT",
          rank: 2,
          reason: "PAUSE"
        },
        raw: {
          source: "derived"
        }
      }
    ];

    expect(() => assertCantillationIRRecords(validRows)).not.toThrow();
    expect(() => assertCantillationIRRecordsAgainstSpine(validRows, spine)).not.toThrow();

    const invalidRows: CantillationIRRecord[] = [
      ...validRows,
      {
        kind: "cant_event",
        anchor: { kind: "gap", id: "Genesis/1/1#gap:999" },
        ref_key: "Genesis/1/1",
        event: {
          type: "BOUNDARY",
          op: "CUT",
          rank: 9,
          reason: "INVALID"
        },
        raw: {
          source: "test"
        }
      }
    ];

    expect(() => assertCantillationIRRecordsAgainstSpine(invalidRows, spine)).toThrow(
      /unknown spine anchor/
    );
  });

  it("writes and reads cantillation.ir.jsonl", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cantillation-ir-"));
    const filePath = path.join(tmp, "cantillation.ir.jsonl");
    const rows: CantillationIRRecord[] = [
      {
        kind: "cant_event",
        anchor: { kind: "gid", id: "Genesis/1/1#g:0" },
        ref_key: "Genesis/1/1",
        event: {
          type: "TROPE_MARK",
          mark: "MUNACH",
          class: "CONJ",
          rank: null
        },
        raw: {
          teamim: ["\u0595"]
        }
      },
      {
        kind: "cant_event",
        anchor: { kind: "gap", id: "Genesis/1/1#gap:1" },
        ref_key: "Genesis/1/1",
        event: {
          type: "BOUNDARY",
          op: "CUT",
          rank: 2,
          reason: "PAUSE"
        },
        raw: {
          source: "derived"
        }
      }
    ];

    await writeCantillationIRJsonl(filePath, rows);
    const loaded = await readCantillationIRJsonl(filePath);

    expect(loaded).toHaveLength(2);
    expect(loaded[0]?.anchor.kind).toBe("gid");
    expect(loaded[1]?.anchor.kind).toBe("gap");
  });
});
