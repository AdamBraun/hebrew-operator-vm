import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stitchProgramIRFromFiles } from "../../src/wrapper/program_schema";

const FIXTURE_DIR = path.resolve(process.cwd(), "tests", "fixtures", "stitcher", "tiny");
const CREATED_AT = "2026-03-02T00:00:00.000Z";

function fixturePath(fileName: string): string {
  return path.join(FIXTURE_DIR, fileName);
}

describe("program schema stitcher snapshot fixture", () => {
  it("is byte-deterministic and matches the ProgramIR golden output", async () => {
    const args = {
      spinePath: fixturePath("Spine.jsonl"),
      lettersIrPath: fixturePath("LettersIR.jsonl"),
      niqqudIrPath: fixturePath("NiqqudIR.jsonl"),
      cantillationIrPath: fixturePath("CantillationIR.jsonl"),
      layoutIrPath: fixturePath("LayoutIR.jsonl"),
      metadataPlanPath: fixturePath("MetadataPlan.json"),
      outputFormat: "jsonl" as const,
      createdAt: CREATED_AT
    };

    const runA = await stitchProgramIRFromFiles(args);
    const runB = await stitchProgramIRFromFiles(args);
    const expectedProgram = fs.readFileSync(fixturePath("ProgramIR.expected.jsonl"), "utf8");

    expect(runA.programIrJsonl).toBe(runB.programIrJsonl);
    expect(runA.programIrJsonl).toBe(expectedProgram);
    expect(runA.programIrJsonl.endsWith("\n")).toBe(true);
    expect(runA.rows).toHaveLength(5);

    expect(runA.manifestText).toBe(runB.manifestText);
    expect(runA.manifest.created_at).toBe(CREATED_AT);
    expect(runA.manifest.counts).toEqual({
      program_rows: 5,
      ops: 2,
      boundaries: 3,
      checkpoints: 1
    });
    expect(runA.manifest.output.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(runA.rows[0]?.kind).toBe("boundary");
    expect(runA.rows[1]?.kind).toBe("op");
  });
});
