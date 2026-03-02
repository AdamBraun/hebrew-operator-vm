import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type CantillationIRRecord } from "../../src/layers/cantillation/schema";
import { type LayoutIRRecord } from "../../src/layers/layout/schema";
import { type LettersIRRecord } from "../../src/layers/letters/schema";
import { type NiqqudIRRow } from "../../src/layers/niqqud/schema";
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

  it("emits deterministic ProgramIR across shuffled input rows", async () => {
    const tmpA = makeTmpDir("stitch-core-deterministic-a-");
    const tmpB = makeTmpDir("stitch-core-deterministic-b-");
    const inputA = buildInputPaths(tmpA);
    const inputB = buildInputPaths(tmpB);

    const letters = readJsonlRows<LettersIRRecord>(fixturePath("LettersIR.jsonl"));
    const niqqud = readJsonlRows<NiqqudIRRow>(fixturePath("NiqqudIR.jsonl"));
    const cant = readJsonlRows<CantillationIRRecord>(fixturePath("CantillationIR.jsonl"));
    const layout = readJsonlRows<LayoutIRRecord>(fixturePath("LayoutIR.jsonl"));

    const extraCantGapEvents: CantillationIRRecord[] = [
      {
        kind: "cant_event",
        anchor: { kind: "gap", id: "Genesis/1/1#gap:1" },
        ref_key: "Genesis/1/1",
        event: {
          type: "BOUNDARY",
          op: "ALPHA",
          rank: 9,
          reason: "TEST_HIGH"
        },
        raw: { source: "test-high" }
      },
      {
        kind: "cant_event",
        anchor: { kind: "gap", id: "Genesis/1/1#gap:1" },
        ref_key: "Genesis/1/1",
        event: {
          type: "BOUNDARY",
          op: "OMEGA",
          rank: 1,
          reason: "TEST_LOW"
        },
        raw: { source: "test-low" }
      }
    ];
    const extraLayoutEvents: LayoutIRRecord[] = [
      {
        gapid: "Genesis/1/1#gap:1",
        ref_key: "Genesis/1/1",
        gap_index: 1,
        layout_event: {
          type: "SETUMA",
          strength: "mid",
          source: "dataset"
        }
      }
    ];

    writeJsonl(inputA.lettersIrPath, [...letters]);
    writeJsonl(inputA.niqqudIrPath, [...niqqud]);
    writeJsonl(inputA.cantillationIrPath, [...cant, ...extraCantGapEvents]);
    writeJsonl(inputA.layoutIrPath, [...layout, ...extraLayoutEvents]);

    writeJsonl(inputB.lettersIrPath, [...letters].reverse());
    writeJsonl(inputB.niqqudIrPath, [...niqqud].reverse());
    writeJsonl(inputB.cantillationIrPath, [...extraCantGapEvents, ...cant].reverse());
    writeJsonl(inputB.layoutIrPath, [...extraLayoutEvents, ...layout].reverse());

    const runA = await stitchProgramRowsFromFiles(inputA);
    const runB = await stitchProgramRowsFromFiles(inputB);
    const jsonlA = formatProgramIRJsonl(runA.rows);
    const jsonlB = formatProgramIRJsonl(runB.rows);

    expect(jsonlA).toBe(jsonlB);

    const boundaryGap1 = runA.rows.find(
      (row) => row.kind === "boundary" && row.gapid === "Genesis/1/1#gap:1"
    );
    if (!boundaryGap1 || boundaryGap1.kind !== "boundary") {
      throw new Error("expected boundary row for Genesis/1/1#gap:1");
    }
    expect(boundaryGap1.layout.map((event) => event.type)).toEqual(["SPACE", "SETUMA"]);
    expect(
      boundaryGap1.cant.map((event) => (event as { rank?: number | null }).rank ?? null)
    ).toEqual([1, 9]);
  });
});
