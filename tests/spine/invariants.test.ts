import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildSpineForRef } from "../../src/spine/build";
import { emitSpine } from "../../src/spine/emit";
import { computeSpineDigest } from "../../src/spine/hash";
import { defaultNormalizationOptions } from "../../src/spine/options";
import { type SpineRecord } from "../../src/spine/schema";
import { splitMarks } from "../../src/spine/unicode";

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

describe("spine invariants", () => {
  it("deterministic ordering: same input yields byte-identical JSONL", async () => {
    const rowsA = await collectRows("Genesis/1/1", "בְּרֵאשִׁ֖ית בָּרָא");
    const rowsB = await collectRows("Genesis/1/1", "בְּרֵאשִׁ֖ית בָּרָא");

    const dirA = fs.mkdtempSync(path.join(os.tmpdir(), "spine-invariants-"));
    const dirB = fs.mkdtempSync(path.join(os.tmpdir(), "spine-invariants-"));

    const emitA = await emitSpine({
      records: rowsA,
      input: { path: "fixture-a", sha256: "a".repeat(64) },
      options: {},
      outCacheDir: dirA
    });
    const emitB = await emitSpine({
      records: rowsB,
      input: { path: "fixture-a", sha256: "a".repeat(64) },
      options: {},
      outCacheDir: dirB
    });

    const jsonlA = fs.readFileSync(emitA.spinePath, "utf8");
    const jsonlB = fs.readFileSync(emitB.spinePath, "utf8");
    expect(jsonlA).toBe(jsonlB);
  });

  it("anchor uniqueness: no duplicate gid/gapid within a ref", async () => {
    const rows = await collectRows("Genesis/1/2", "וְהָאָֽרֶץ הָיְתָה");
    const gids = new Set<string>();
    const gapids = new Set<string>();

    for (const row of rows) {
      if (row.kind === "g") {
        expect(gids.has(row.gid)).toBe(false);
        gids.add(row.gid);
      } else {
        expect(gapids.has(row.gapid)).toBe(false);
        gapids.add(row.gapid);
      }
    }
  });

  it("contiguity: g_index is 0..n-1 and gap_index is 0..n", async () => {
    const rows = await collectRows("Genesis/1/3", "יְהִי אוֹר");
    const gRows = rows.filter(
      (row): row is Extract<SpineRecord, { kind: "g" }> => row.kind === "g"
    );
    const gapRows = rows.filter(
      (row): row is Extract<SpineRecord, { kind: "gap" }> => row.kind === "gap"
    );

    expect(gRows.map((row) => row.g_index)).toEqual(gRows.map((_, index) => index));
    expect(gapRows.map((row) => row.gap_index)).toEqual(gapRows.map((_, index) => index));
  });

  it("Convention A invariant: gapCount = graphemeCount + 1", async () => {
    const rows = await collectRows("Genesis/1/4", "וַיַּרְא");
    const graphemeCount = rows.filter((row) => row.kind === "g").length;
    const gapCount = rows.filter((row) => row.kind === "gap").length;
    expect(gapCount).toBe(graphemeCount + 1);
  });

  it("mark classification: niqqud/teamim split is stable for known marks", () => {
    const parsed = splitMarks("הִ֑");
    expect(parsed.base).toBe("ה");
    expect(parsed.niqqud).toEqual(["ִ"]);
    expect(parsed.teamim).toEqual(["֑"]);
    expect(parsed.otherMarks).toEqual([]);
  });

  it("punctuation handling: between-grapheme punctuation lands in gap.raw.chars", async () => {
    const rows = await collectRows("Genesis/1/5", "א,ב־ג");
    const gapRows = rows.filter(
      (row): row is Extract<SpineRecord, { kind: "gap" }> => row.kind === "gap"
    );

    expect(gapRows[1]?.raw.chars).toEqual([","]);
    expect(gapRows[2]?.raw.chars).toEqual(["־"]);
  });

  it("control chars: stripped when enabled, preserved otherwise", async () => {
    const stripOn = await collectRows("Genesis/1/6", "א\u0000ב", {
      ...defaultNormalizationOptions(),
      stripControlChars: true
    });
    const stripOff = await collectRows("Genesis/1/6", "א\u0000ב", {
      ...defaultNormalizationOptions(),
      stripControlChars: false
    });

    const stripOnGapRows = stripOn.filter(
      (row): row is Extract<SpineRecord, { kind: "gap" }> => row.kind === "gap"
    );
    const stripOffGapRows = stripOff.filter(
      (row): row is Extract<SpineRecord, { kind: "gap" }> => row.kind === "gap"
    );

    expect(stripOnGapRows[1]?.raw.chars).toEqual([]);
    expect(stripOffGapRows[1]?.raw.chars).toEqual(["\u0000"]);
  });

  it("normalizeFinals toggle changes output and digest", async () => {
    const optsOff = { ...defaultNormalizationOptions(), normalizeFinals: false };
    const optsOn = { ...defaultNormalizationOptions(), normalizeFinals: true };

    const offRows = await collectRows("Genesis/1/7", "מלך", optsOff);
    const onRows = await collectRows("Genesis/1/7", "מלך", optsOn);

    const offG = offRows.filter(
      (row): row is Extract<SpineRecord, { kind: "g" }> => row.kind === "g"
    );
    const onG = onRows.filter(
      (row): row is Extract<SpineRecord, { kind: "g" }> => row.kind === "g"
    );
    expect(offG.map((row) => row.base_letter)).toEqual(["מ", "ל", "ך"]);
    expect(onG.map((row) => row.base_letter)).toEqual(["מ", "ל", "כ"]);

    const digestOff = computeSpineDigest({
      inputSha256: "d".repeat(64),
      options: optsOff,
      codeFingerprint: "spine-module@1.0.0",
      schemaVersion: "1.0.0"
    });
    const digestOn = computeSpineDigest({
      inputSha256: "d".repeat(64),
      options: optsOn,
      codeFingerprint: "spine-module@1.0.0",
      schemaVersion: "1.0.0"
    });
    expect(digestOn).not.toBe(digestOff);
  });
});
