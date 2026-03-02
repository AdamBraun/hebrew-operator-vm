import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runStitchProgram } from "../../src/cli/stitch-program";

const FIXTURE_DIR = path.resolve(process.cwd(), "tests", "fixtures", "stitcher", "tiny");
const CREATED_AT = "2026-03-02T00:00:00.000Z";

function fixturePath(fileName: string): string {
  return path.join(FIXTURE_DIR, fileName);
}

function sha256Hex(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function copyToDir(args: { srcFileName: string; targetDir: string; targetName: string }): string {
  fs.mkdirSync(args.targetDir, { recursive: true });
  const targetPath = path.join(args.targetDir, args.targetName);
  fs.copyFileSync(fixturePath(args.srcFileName), targetPath);
  return targetPath;
}

function makeLayerDirs(tmp: string): {
  spineDir: string;
  lettersDir: string;
  niqqudDir: string;
  cantDir: string;
  layoutDir: string;
  metadataDir: string;
  outDir: string;
} {
  const spineDir = path.join(tmp, "spine");
  const lettersDir = path.join(tmp, "letters");
  const niqqudDir = path.join(tmp, "niqqud");
  const cantDir = path.join(tmp, "cantillation");
  const layoutDir = path.join(tmp, "layout");
  const metadataDir = path.join(tmp, "metadata");
  const outDir = path.join(tmp, "out");

  copyToDir({ srcFileName: "Spine.jsonl", targetDir: spineDir, targetName: "Spine.jsonl" });
  copyToDir({
    srcFileName: "LettersIR.jsonl",
    targetDir: lettersDir,
    targetName: "LettersIR.jsonl"
  });
  copyToDir({ srcFileName: "NiqqudIR.jsonl", targetDir: niqqudDir, targetName: "NiqqudIR.jsonl" });
  copyToDir({
    srcFileName: "CantillationIR.jsonl",
    targetDir: cantDir,
    targetName: "CantillationIR.jsonl"
  });
  copyToDir({ srcFileName: "LayoutIR.jsonl", targetDir: layoutDir, targetName: "LayoutIR.jsonl" });
  copyToDir({
    srcFileName: "MetadataPlan.json",
    targetDir: metadataDir,
    targetName: "MetadataPlan.json"
  });

  return {
    spineDir,
    lettersDir,
    niqqudDir,
    cantDir,
    layoutDir,
    metadataDir,
    outDir
  };
}

describe("stitch-program cli", () => {
  it("writes ProgramIR.jsonl, program.meta.json, and program.manifest.json", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stitch-program-cli-"));
    const dirs = makeLayerDirs(tmp);
    const expectedProgram = fs.readFileSync(fixturePath("ProgramIR.expected.jsonl"), "utf8");

    const run = await runStitchProgram([
      "--spine",
      dirs.spineDir,
      "--letters",
      dirs.lettersDir,
      "--niqqud",
      dirs.niqqudDir,
      "--cant",
      dirs.cantDir,
      "--layout",
      dirs.layoutDir,
      "--metadata",
      dirs.metadataDir,
      "--out",
      dirs.outDir,
      "--created-at",
      CREATED_AT
    ]);

    expect(run.cacheHit).toBe(false);
    expect(fs.existsSync(run.programPath)).toBe(true);
    expect(fs.existsSync(run.metaPath)).toBe(true);
    expect(fs.existsSync(run.manifestPath)).toBe(true);

    const programText = fs.readFileSync(run.programPath, "utf8");
    expect(programText).toBe(expectedProgram);

    const meta = JSON.parse(fs.readFileSync(run.metaPath, "utf8")) as Record<string, unknown>;
    expect(meta.spineDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.lettersDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.niqqudDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.cantDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.layoutDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.metadataDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.cacheDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.programDigest).toBe(sha256Hex(programText));
    expect(meta.stitcherVersion).toBe("1.0.0");
    expect(meta.stitchConfig).toEqual({
      outputFormat: "jsonl",
      includeLetterCantillation: true,
      includeGapRaw: true
    });
    expect(meta.counts).toEqual({
      ops: 2,
      boundaries: 3,
      checkpoints: 1
    });
  });

  it("is deterministic across forced rebuilds and cache-hits when unchanged", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stitch-program-cli-determinism-"));
    const dirs = makeLayerDirs(tmp);
    const args = [
      "--spine",
      dirs.spineDir,
      "--letters",
      dirs.lettersDir,
      "--niqqud",
      dirs.niqqudDir,
      "--cant",
      dirs.cantDir,
      "--layout",
      dirs.layoutDir,
      "--metadata",
      dirs.metadataDir,
      "--out",
      dirs.outDir,
      "--created-at",
      CREATED_AT
    ];

    const runA = await runStitchProgram([...args, "--force=true"]);
    const programA = fs.readFileSync(runA.programPath, "utf8");
    const digestA = sha256Hex(programA);

    const runB = await runStitchProgram([...args, "--force=true"]);
    const programB = fs.readFileSync(runB.programPath, "utf8");
    const digestB = sha256Hex(programB);

    expect(runA.cacheHit).toBe(false);
    expect(runB.cacheHit).toBe(false);
    expect(digestA).toBe(digestB);
    expect(runA.programDigest).toBe(runB.programDigest);
    expect(runA.programDigest).toBe(digestA);

    const runC = await runStitchProgram(args);
    expect(runC.cacheHit).toBe(true);
    expect(runC.cacheDigest).toBe(runA.cacheDigest);
    expect(fs.readFileSync(runC.programPath, "utf8")).toBe(programA);
  });
});
