import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { readNiqqudView } from "../../../src/layers/niqqud/spine_view";

function writeFixture(lines: unknown[]): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "niqqud-spine-view-"));
  const filePath = path.join(tmpDir, "spine.jsonl");
  const content = `${lines
    .map((line) => (typeof line === "string" ? line : JSON.stringify(line)))
    .join("\n")}\n`;
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

async function collectRows(spinePath: string) {
  const out = [];
  for await (const row of readNiqqudView(spinePath)) {
    out.push(row);
  }
  return out;
}

describe("niqqud spine view", () => {
  it("streams only grapheme rows and projects gid/ref/g_index/niqqud", async () => {
    const spinePath = writeFixture([
      {
        kind: "gap",
        gapid: "Genesis/1/1#gap:0",
        ref_key: "Genesis/1/1",
        gap_index: 0,
        raw: { whitespace: false, chars: [] }
      },
      {
        kind: "g",
        gid: "Genesis/1/1#g:0",
        ref_key: "Genesis/1/1",
        g_index: 0,
        base_letter: "ב",
        marks_raw: { niqqud: ["ְ", "ּ"], teamim: [] },
        raw: { text: "בְּ" }
      },
      {
        kind: "g",
        gid: "Genesis/1/1#g:1",
        ref_key: "Genesis/1/1",
        g_index: 1,
        base_letter: "א",
        marks_raw: { niqqud: [], teamim: [] },
        raw: { text: "א" }
      },
      {
        kind: "gap",
        gapid: "Genesis/1/1#gap:1",
        ref_key: "Genesis/1/1",
        gap_index: 1,
        raw: { whitespace: true, chars: [" "] }
      }
    ]);

    const rows = await collectRows(spinePath);
    expect(rows).toEqual([
      {
        gid: "Genesis/1/1#g:0",
        ref_key: "Genesis/1/1",
        g_index: 0,
        niqqud: ["ְ", "ּ"]
      },
      {
        gid: "Genesis/1/1#g:1",
        ref_key: "Genesis/1/1",
        g_index: 1,
        niqqud: []
      }
    ]);
  });

  it("defaults invalid marks_raw.niqqud to [] and logs structured warnings", async () => {
    const spinePath = writeFixture([
      {
        kind: "g",
        gid: "Genesis/1/1#g:0",
        ref_key: "Genesis/1/1",
        g_index: 0,
        base_letter: "ש",
        marks_raw: { niqqud: "not-array", teamim: [] },
        raw: { text: "ש" }
      },
      {
        kind: "g",
        gid: "Genesis/1/1#g:1",
        ref_key: "Genesis/1/1",
        g_index: 1,
        base_letter: "ר",
        raw: { text: "ר" }
      }
    ]);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const rows = await collectRows(spinePath);
      expect(rows.map((row) => row.niqqud)).toEqual([[], []]);
      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy.mock.calls[0]?.[0]).toMatchObject({
        gid: "Genesis/1/1#g:0",
        ref_key: "Genesis/1/1",
        g_index: 0,
        type: "MALFORMED_MARKS"
      });
      expect(String((warnSpy.mock.calls[0]?.[0] as { detail?: string }).detail ?? "")).toContain(
        spinePath
      );
      expect(String((warnSpy.mock.calls[0]?.[0] as { detail?: string }).detail ?? "")).toContain(
        "observed="
      );
      expect(warnSpy.mock.calls[0]?.[0]).toMatchObject({
        gid: "Genesis/1/1#g:0",
        ref_key: "Genesis/1/1"
      });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("fails on malformed gid/ref_key/g_index anchor tuples", async () => {
    const spinePath = writeFixture([
      {
        kind: "g",
        gid: "Genesis/1/1#g:9",
        ref_key: "Genesis/1/1",
        g_index: 0,
        base_letter: "א",
        marks_raw: { niqqud: [], teamim: [] },
        raw: { text: "א" }
      }
    ]);

    await expect(collectRows(spinePath)).rejects.toThrow(/must match ref_key/);
  });

  it("fails on non-object rows and invalid JSON", async () => {
    const nonObjectPath = writeFixture(["[]"]);
    await expect(collectRows(nonObjectPath)).rejects.toThrow(/expected JSON object record/);

    const badJsonPath = writeFixture(['{"kind":"g",']);
    await expect(collectRows(badJsonPath)).rejects.toThrow(/invalid JSON/);
  });
});
