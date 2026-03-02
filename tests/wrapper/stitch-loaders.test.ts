import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadCantillationIndexes,
  loadLayoutByGap,
  loadLettersByGid,
  loadMetadataPlan,
  loadNiqqudByGid,
  loadStitchAnchorIndexes
} from "../../src/wrapper/stitch/loaders";

function makeTmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJsonl(filePath: string, rows: readonly unknown[]): void {
  const text = rows.map((row) => JSON.stringify(row)).join("\n");
  fs.writeFileSync(filePath, `${text}\n`, "utf8");
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function letterRow(gid: string, gIndex: number): Record<string, unknown> {
  return {
    kind: "letter_ir",
    gid,
    ref_key: "Genesis/1/1",
    g_index: gIndex,
    letter: gIndex % 2 === 0 ? "א" : "ב",
    op_kind: gIndex % 2 === 0 ? "א" : "ב",
    source: {
      spine_digest: "a".repeat(64)
    }
  };
}

function niqqudRow(gid: string, gIndex: number): Record<string, unknown> {
  return {
    kind: "niqqud",
    version: 1,
    gid,
    ref_key: "Genesis/1/1",
    g_index: gIndex,
    raw: {
      niqqud: []
    },
    mods: {
      classes: [],
      features: {
        vowelCount: 0
      }
    },
    unhandled: []
  };
}

describe("stitch loaders", () => {
  it("rejects duplicate letters/niqqud gids but collects cant/layout duplicates", async () => {
    const tmp = makeTmpDir("stitch-loaders-duplicates-");

    const duplicateGid = "Genesis/1/1#g:0";
    const lettersPath = path.join(tmp, "letters.ir.jsonl");
    writeJsonl(lettersPath, [letterRow(duplicateGid, 0), letterRow(duplicateGid, 0)]);

    await expect(loadLettersByGid(lettersPath)).rejects.toThrow(/duplicate LettersIR gid/);

    const niqqudPath = path.join(tmp, "niqqud.ir.jsonl");
    writeJsonl(niqqudPath, [niqqudRow(duplicateGid, 0), niqqudRow(duplicateGid, 0)]);

    await expect(loadNiqqudByGid(niqqudPath)).rejects.toThrow(/duplicate NiqqudIR gid/);

    const cantPath = path.join(tmp, "cantillation.ir.jsonl");
    writeJsonl(cantPath, [
      {
        kind: "cant_event",
        anchor: {
          kind: "gid",
          id: "Genesis/1/1#g:0"
        },
        ref_key: "Genesis/1/1",
        event: {
          type: "TROPE_MARK",
          mark: "TIPCHA",
          class: "DISJ",
          rank: 1
        },
        raw: {
          teamim: ["\u0596"]
        }
      },
      {
        kind: "cant_event",
        anchor: {
          kind: "gid",
          id: "Genesis/1/1#g:0"
        },
        ref_key: "Genesis/1/1",
        event: {
          type: "TROPE_MARK",
          mark: "TIPCHA",
          class: "DISJ",
          rank: 1
        },
        raw: {
          teamim: ["\u0596"]
        }
      }
    ]);

    const cant = await loadCantillationIndexes(cantPath);
    expect(cant.cantByGid.get("Genesis/1/1#g:0")).toHaveLength(2);

    const layoutPath = path.join(tmp, "layout.ir.jsonl");
    writeJsonl(layoutPath, [
      {
        gapid: "Genesis/1/1#gap:1",
        ref_key: "Genesis/1/1",
        gap_index: 1,
        layout_event: {
          type: "SPACE",
          strength: "weak",
          source: "spine_whitespace"
        }
      },
      {
        gapid: "Genesis/1/1#gap:1",
        ref_key: "Genesis/1/1",
        gap_index: 1,
        layout_event: {
          type: "SPACE",
          strength: "weak",
          source: "spine_whitespace"
        }
      }
    ]);

    const layout = await loadLayoutByGap(layoutPath);
    expect(layout.get("Genesis/1/1#gap:1")).toHaveLength(2);
  });

  it("sorts cantillation/layout collisions deterministically per anchor", async () => {
    const tmp = makeTmpDir("stitch-loaders-order-");

    const cantPath = path.join(tmp, "cantillation.ir.jsonl");
    writeJsonl(cantPath, [
      {
        kind: "cant_event",
        anchor: {
          kind: "gid",
          id: "Genesis/1/1#g:0"
        },
        ref_key: "Genesis/1/1",
        event: {
          type: "TROPE_MARK",
          mark: "ZAQEF_GADOL",
          class: "DISJ",
          rank: 2
        },
        raw: {
          teamim: ["\u0595"]
        }
      },
      {
        kind: "cant_event",
        anchor: {
          kind: "gid",
          id: "Genesis/1/1#g:0"
        },
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
      },
      {
        kind: "cant_event",
        anchor: {
          kind: "gap",
          id: "Genesis/1/1#gap:2"
        },
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
      },
      {
        kind: "cant_event",
        anchor: {
          kind: "gap",
          id: "Genesis/1/1#gap:2"
        },
        ref_key: "Genesis/1/1",
        event: {
          type: "BOUNDARY",
          op: "CONJ",
          rank: 0,
          reason: "JOIN"
        },
        raw: {
          source: "test"
        }
      }
    ]);

    const cant = await loadCantillationIndexes(cantPath);
    expect(cant.cantByGid.get("Genesis/1/1#g:0")).toEqual([
      {
        type: "TROPE_MARK",
        mark: "MERKHA",
        class: "CONJ",
        rank: null
      },
      {
        type: "TROPE_MARK",
        mark: "ZAQEF_GADOL",
        class: "DISJ",
        rank: 2
      }
    ]);
    expect(cant.cantByGap.get("Genesis/1/1#gap:2")).toEqual([
      {
        type: "BOUNDARY",
        op: "CONJ",
        rank: 0,
        reason: "JOIN"
      },
      {
        type: "BOUNDARY",
        op: "CUT",
        rank: 3,
        reason: "SOF_PASUK"
      }
    ]);

    const layoutPath = path.join(tmp, "layout.ir.jsonl");
    writeJsonl(layoutPath, [
      {
        gapid: "Genesis/1/1#gap:2",
        ref_key: "Genesis/1/1",
        gap_index: 2,
        layout_event: {
          type: "BOOK_BREAK",
          strength: "max",
          source: "dataset"
        }
      },
      {
        gapid: "Genesis/1/1#gap:2",
        ref_key: "Genesis/1/1",
        gap_index: 2,
        layout_event: {
          type: "SPACE",
          strength: "weak",
          source: "spine_whitespace"
        }
      },
      {
        gapid: "Genesis/1/1#gap:2",
        ref_key: "Genesis/1/1",
        gap_index: 2,
        layout_event: {
          type: "SETUMA",
          strength: "mid",
          source: "dataset"
        }
      }
    ]);

    const layout = await loadLayoutByGap(layoutPath);
    expect(layout.get("Genesis/1/1#gap:2")).toEqual([
      {
        type: "SPACE",
        strength: "weak",
        source: "spine_whitespace"
      },
      {
        type: "SETUMA",
        strength: "mid",
        source: "dataset"
      },
      {
        type: "BOOK_BREAK",
        strength: "max",
        source: "dataset"
      }
    ]);
  });

  it("streams large JSONL inputs correctly and builds metadata checkpoint index", async () => {
    const tmp = makeTmpDir("stitch-loaders-stream-");

    const lettersPath = path.join(tmp, "letters.ir.jsonl");
    const niqqudPath = path.join(tmp, "niqqud.ir.jsonl");
    const cantPath = path.join(tmp, "cantillation.ir.jsonl");
    const layoutPath = path.join(tmp, "layout.ir.jsonl");
    const metadataPath = path.join(tmp, "metadata.plan.json");

    const lettersRows: unknown[] = [];
    const niqqudRows: unknown[] = [];
    const cantRows: unknown[] = [];
    const layoutRows: unknown[] = [];

    const total = 1500;
    for (let i = 0; i < total; i += 1) {
      const gid = `Genesis/1/1#g:${String(i)}`;
      const gapid = `Genesis/1/1#gap:${String(i)}`;
      lettersRows.push(letterRow(gid, i));
      niqqudRows.push(niqqudRow(gid, i));
      cantRows.push({
        kind: "cant_event",
        anchor: {
          kind: "gid",
          id: gid
        },
        ref_key: "Genesis/1/1",
        event: {
          type: "TROPE_MARK",
          mark: "TIPCHA",
          class: "DISJ",
          rank: 1
        },
        raw: {
          teamim: []
        }
      });
      cantRows.push({
        kind: "cant_event",
        anchor: {
          kind: "gap",
          id: gapid
        },
        ref_key: "Genesis/1/1",
        event: {
          type: "BOUNDARY",
          op: "CUT",
          rank: 3,
          reason: "SOF_PASUK"
        },
        raw: {
          source: "generated"
        }
      });
      layoutRows.push({
        gapid,
        ref_key: "Genesis/1/1",
        gap_index: i,
        layout_event: {
          type: i % 2 === 0 ? "SPACE" : "BOOK_BREAK",
          strength: i % 2 === 0 ? "weak" : "max",
          source: i % 2 === 0 ? "spine_whitespace" : "dataset"
        }
      });
    }

    writeJsonl(lettersPath, lettersRows);
    writeJsonl(niqqudPath, niqqudRows);
    writeJsonl(cantPath, cantRows);
    writeJsonl(layoutPath, layoutRows);
    writeJson(metadataPath, {
      version: 1,
      checkpoints: [
        {
          ref_end: "Genesis/1/1",
          label: "end-a"
        },
        {
          ref_end: "Genesis/1/1",
          label: "end-b"
        },
        {
          ref_end: "Genesis/1/2",
          label: "end-c"
        }
      ]
    });

    const indexes = await loadStitchAnchorIndexes({
      lettersIrPath: lettersPath,
      niqqudIrPath: niqqudPath,
      cantillationIrPath: cantPath,
      layoutIrPath: layoutPath,
      metadataPlanPath: metadataPath
    });

    expect(indexes.lettersByGid.size).toBe(total);
    expect(indexes.niqqudByGid.size).toBe(total);
    expect(indexes.cantByGid.size).toBe(total);
    expect(indexes.cantByGap.size).toBe(total);
    expect(indexes.layoutByGap.size).toBe(total);

    expect(indexes.lettersByGid.get("Genesis/1/1#g:1499")?.g_index).toBe(1499);
    expect(indexes.niqqudByGid.get("Genesis/1/1#g:1499")?.features.vowelCount).toBe(0);
    expect(indexes.cantByGid.get("Genesis/1/1#g:1499")).toEqual([
      {
        type: "TROPE_MARK",
        mark: "TIPCHA",
        class: "DISJ",
        rank: 1
      }
    ]);
    expect(indexes.cantByGap.get("Genesis/1/1#gap:1499")).toEqual([
      {
        type: "BOUNDARY",
        op: "CUT",
        rank: 3,
        reason: "SOF_PASUK"
      }
    ]);
    expect(indexes.layoutByGap.get("Genesis/1/1#gap:1499")).toEqual([
      {
        type: "BOOK_BREAK",
        strength: "max",
        source: "dataset"
      }
    ]);

    expect(indexes.metadataPlan.version).toBe(1);
    expect(indexes.checkpointByRefEnd.get("Genesis/1/1")).toHaveLength(2);
    expect(indexes.checkpointByRefEnd.get("Genesis/1/2")).toHaveLength(1);
  });

  it("loads metadata plan and groups checkpoints by ref_end", async () => {
    const tmp = makeTmpDir("stitch-loaders-metadata-");
    const metadataPath = path.join(tmp, "metadata.plan.json");
    writeJson(metadataPath, {
      version: 1,
      notes: "metadata checkpoint grouping",
      checkpoints: [
        {
          ref_end: "Exodus/1/1",
          label: "first"
        },
        {
          ref_end: "Exodus/1/1",
          label: "second"
        },
        {
          ref_end: "Exodus/1/2",
          label: "third"
        }
      ]
    });

    const metadata = await loadMetadataPlan(metadataPath);
    expect(metadata.metadataPlan.notes).toBe("metadata checkpoint grouping");
    expect(metadata.checkpointByRefEnd.get("Exodus/1/1")).toEqual([
      {
        ref_end: "Exodus/1/1",
        label: "first"
      },
      {
        ref_end: "Exodus/1/1",
        label: "second"
      }
    ]);
    expect(metadata.checkpointByRefEnd.get("Exodus/1/2")).toEqual([
      {
        ref_end: "Exodus/1/2",
        label: "third"
      }
    ]);
  });

  it("rejects metadata checkpoints that are not canonical RefKey values", async () => {
    const tmp = makeTmpDir("stitch-loaders-metadata-invalid-refkey-");
    const metadataPath = path.join(tmp, "metadata.plan.json");
    writeJson(metadataPath, {
      version: 1,
      checkpoints: [
        {
          ref_end: "Genesis/1/1#g:0",
          label: "invalid-anchor-key"
        }
      ]
    });

    await expect(loadMetadataPlan(metadataPath)).rejects.toThrow(/Invalid RefKey/);
  });
});
