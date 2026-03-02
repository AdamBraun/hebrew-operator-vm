import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emitProgram } from "../../src/wrapper/stitch/emitProgram";

const FIXTURE_DIR = path.resolve(process.cwd(), "tests", "fixtures", "stitcher", "tiny");
const CREATED_AT = "2026-03-02T00:00:00.000Z";

function fixturePath(fileName: string): string {
  return path.join(FIXTURE_DIR, fileName);
}

describe("emit program snapshot", () => {
  it("emits ProgramIR + manifest deterministically for tiny fixture", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "emit-program-snapshot-"));
    const runA = await emitProgram({
      spinePath: fixturePath("Spine.jsonl"),
      lettersIrPath: fixturePath("LettersIR.jsonl"),
      niqqudIrPath: fixturePath("NiqqudIR.jsonl"),
      cantillationIrPath: fixturePath("CantillationIR.jsonl"),
      layoutIrPath: fixturePath("LayoutIR.jsonl"),
      metadataPlanPath: fixturePath("MetadataPlan.json"),
      outDir,
      outputFormat: "jsonl",
      createdAt: CREATED_AT
    });
    const runB = await emitProgram({
      spinePath: fixturePath("Spine.jsonl"),
      lettersIrPath: fixturePath("LettersIR.jsonl"),
      niqqudIrPath: fixturePath("NiqqudIR.jsonl"),
      cantillationIrPath: fixturePath("CantillationIR.jsonl"),
      layoutIrPath: fixturePath("LayoutIR.jsonl"),
      metadataPlanPath: fixturePath("MetadataPlan.json"),
      outDir,
      outputFormat: "jsonl",
      createdAt: CREATED_AT
    });

    const expectedProgram = fs.readFileSync(fixturePath("ProgramIR.expected.jsonl"), "utf8");
    const emittedProgram = fs.readFileSync(runA.programPath, "utf8");
    const emittedManifest = JSON.parse(fs.readFileSync(runA.manifestPath, "utf8")) as Record<
      string,
      unknown
    >;

    expect(emittedProgram).toBe(expectedProgram);
    expect(emittedProgram).toBe(runB.programIrJsonl);
    expect(runA.manifestText).toBe(runB.manifestText);
    expect(runA.manifest.created_at).toBe(CREATED_AT);

    expect(runA.manifest.counts).toEqual({
      program_rows: 5,
      ops: 2,
      boundaries: 3,
      checkpoints: 1
    });

    expect(emittedManifest.layer).toBe("program");
    expect((emittedManifest as { stitcher?: { version?: string } }).stitcher?.version).toBe(
      "1.0.0"
    );
    expect(
      (emittedManifest as { input_digests?: Record<string, string> }).input_digests
        ?.spine_sha256 as string
    ).toMatch(/^[a-f0-9]{64}$/);
    expect((emittedManifest as { output?: { sha256?: string } }).output?.sha256 as string).toMatch(
      /^[a-f0-9]{64}$/
    );
  });
});
