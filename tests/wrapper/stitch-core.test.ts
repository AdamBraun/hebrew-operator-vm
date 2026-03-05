import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type LayoutIRRecord } from "../../src/layers/layout/schema";
import { type LettersIRRecord } from "../../src/layers/letters/schema";
import { formatProgramIRJsonl } from "../../src/wrapper/program_schema";
import { stitchProgramRowsFromFiles } from "../../src/wrapper/stitch/stitch";

const FIXTURE_DIR = path.resolve(process.cwd(), "tests", "fixtures", "stitcher", "tiny");

function fixturePath(fileName: string): string {
  return path.join(FIXTURE_DIR, fileName);
}

function makeTmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function readJsonlRows<T>(filePath: string): T[] {
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) {
    return [];
  }
  return text.split("\n").map((line) => JSON.parse(line) as T);
}

function writeJsonl(filePath: string, rows: readonly unknown[]): void {
  const text = rows.map((row) => JSON.stringify(row)).join("\n");
  fs.writeFileSync(filePath, `${text}\n`, "utf8");
}

function copyFixtureFileToTmp(tmpDir: string, fileName: string): string {
  const target = path.join(tmpDir, fileName);
  fs.copyFileSync(fixturePath(fileName), target);
  return target;
}

function buildInputPaths(tmpDir: string): {
  spinePath: string;
  lettersIrPath: string;
  niqqudIrPath: string;
  cantillationIrPath: string;
  layoutIrPath: string;
  metadataPlanPath: string;
} {
  return {
    spinePath: copyFixtureFileToTmp(tmpDir, "Spine.jsonl"),
    lettersIrPath: copyFixtureFileToTmp(tmpDir, "LettersIR.jsonl"),
    niqqudIrPath: copyFixtureFileToTmp(tmpDir, "NiqqudIR.jsonl"),
    cantillationIrPath: copyFixtureFileToTmp(tmpDir, "CantillationIR.jsonl"),
    layoutIrPath: copyFixtureFileToTmp(tmpDir, "LayoutIR.jsonl"),
    metadataPlanPath: copyFixtureFileToTmp(tmpDir, "MetadataPlan.json")
  };
}

describe("wrapper stitch core join", () => {
  it("errors when a spine gid has no LettersIR row", async () => {
    const tmp = makeTmpDir("stitch-core-missing-letters-");
    const paths = buildInputPaths(tmp);
    const lettersRows = readJsonlRows<LettersIRRecord>(paths.lettersIrPath);
    writeJsonl(
      paths.lettersIrPath,
      lettersRows.filter((row) => row.gid !== "Genesis/1/1#g:1")
    );

    await expect(stitchProgramRowsFromFiles(paths)).rejects.toThrow(
      /missing LettersIR record for gid 'Genesis\/1\/1#g:1'/
    );
  });

  it("errors on unknown layout anchor with source file + line number", async () => {
    const tmp = makeTmpDir("stitch-core-unknown-layout-");
    const paths = buildInputPaths(tmp);
    const unknownLayoutRow: LayoutIRRecord = {
      gapid: "Genesis/1/9#gap:0",
      ref_key: "Genesis/1/9",
      gap_index: 0,
      layout_event: {
        type: "SPACE",
        strength: "weak",
        source: "spine_whitespace"
      }
    };
    writeJsonl(paths.layoutIrPath, [unknownLayoutRow]);

    await expect(stitchProgramRowsFromFiles(paths)).rejects.toThrow(/LayoutIR\.jsonl:1/);
    await expect(stitchProgramRowsFromFiles(paths)).rejects.toThrow(
      /LayoutIR gapid 'Genesis\/1\/9#gap:0' missing from Spine/
    );
  });

  it("errors on conflicting duplicate niqqud gid with precise locations", async () => {
    const tmp = makeTmpDir("stitch-core-conflict-niqqud-");
    const paths = buildInputPaths(tmp);
    const niqqudRows = readJsonlRows<Record<string, unknown>>(paths.niqqudIrPath);
    const first = niqqudRows[0];
    if (!first) {
      throw new Error("expected niqqud fixture row");
    }
    const duplicate = JSON.parse(JSON.stringify(first)) as Record<string, unknown>;
    duplicate.mods = {
      classes: ["TEST"],
      features: {
        hasDagesh: true,
        hasShva: false,
        vowelCount: 1
      }
    };
    writeJsonl(paths.niqqudIrPath, [first, duplicate, ...niqqudRows.slice(1)]);

    await expect(stitchProgramRowsFromFiles(paths)).rejects.toThrow(
      /conflicting duplicate NiqqudIR gid 'Genesis\/1\/1#g:0'/
    );
    await expect(stitchProgramRowsFromFiles(paths)).rejects.toThrow(/NiqqudIR\.jsonl:2/);
  });

  it("rejects non-canonical input ordering before stitch", async () => {
    const tmp = makeTmpDir("stitch-core-ordering-");
    const paths = buildInputPaths(tmp);
    const letters = readJsonlRows<LettersIRRecord>(paths.lettersIrPath);
    writeJsonl(paths.lettersIrPath, [...letters].reverse());

    await expect(stitchProgramRowsFromFiles(paths)).rejects.toThrow(
      /LettersIR stream must be in strict deterministic order/
    );
    await expect(stitchProgramRowsFromFiles(paths)).rejects.toThrow(
      /saw gid 'Genesis\/1\/1#g:0' after 'Genesis\/1\/1#g:1'/
    );
  });

  it("emits stable ProgramIR rows for canonical tiny fixture", async () => {
    const tmp = makeTmpDir("stitch-core-stable-canonical-");
    const paths = buildInputPaths(tmp);
    const run = await stitchProgramRowsFromFiles(paths);
    const programJsonl = formatProgramIRJsonl(run.rows);
    expect(programJsonl.length).toBeGreaterThan(0);

    const boundaryGap1 = run.rows.find(
      (row) => row.kind === "boundary" && row.gapid === "Genesis/1/1#gap:1"
    );
    if (!boundaryGap1 || boundaryGap1.kind !== "boundary") {
      throw new Error("expected boundary row for Genesis/1/1#gap:1");
    }
    expect(boundaryGap1.layout.map((event) => event.type)).toEqual(["SPACE"]);
  });
});
