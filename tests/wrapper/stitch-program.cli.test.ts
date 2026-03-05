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
    const manifest = JSON.parse(fs.readFileSync(run.manifestPath, "utf8")) as Record<string, unknown>;
    const inputDigests = meta.inputDigests as Record<string, unknown>;
    expect(inputDigests).toBeDefined();
    expect(inputDigests.spine_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(inputDigests.letters_ir_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(inputDigests.niqqud_ir_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(inputDigests.cantillation_ir_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(inputDigests.layout_ir_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(inputDigests.metadata_plan_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.spineDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.lettersDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.niqqudDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.cantDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.layoutDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.metadataDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.programSchemaVersion).toBe("1.0.0");
    expect(meta.stitchConfigDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.cacheDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.programDigest).toBe(sha256Hex(programText));
    expect(meta.stitcherVersion).toBe("1.0.0");
    expect(meta.programPathRel).toBe(run.programPathRel);
    expect(meta.metaPathRel).toBe(run.metaPathRel);
    expect(run.programPathRel).toBe("ProgramIR.jsonl");
    expect(run.metaPathRel).toBe("program.meta.json");
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
    expect(meta.checkpoints).toEqual([
      {
        kind: "CHECKPOINT",
        parasha_id: null,
        aliyah_index: null,
        plan_index_end: 4,
        ref_key_end: "Genesis/1/1"
      }
    ]);
    expect(meta.checkpointsByRefEnd).toEqual({
      "Genesis/1/1": [
        {
          kind: "CHECKPOINT",
          parasha_id: null,
          aliyah_index: null,
          plan_index_end: 4,
          ref_key_end: "Genesis/1/1"
        }
      ]
    });
    expect(meta.checkpointsByIndex).toEqual({
      "4": [
        {
          kind: "CHECKPOINT",
          parasha_id: null,
          aliyah_index: null,
          plan_index_end: 4,
          ref_key_end: "Genesis/1/1"
        }
      ]
    });

    expect(manifest.programSchemaVersion).toBe("1.0.0");
    expect((manifest as { build?: { generatedAt?: string } }).build?.generatedAt).toBe(CREATED_AT);
    expect((manifest as { stitchConfigDigest?: string }).stitchConfigDigest).toMatch(/^[a-f0-9]{64}$/);
    expect((manifest as { cacheDigest?: string }).cacheDigest).toBe(meta.cacheDigest);
    expect(
      (manifest as { contains?: Record<string, unknown> }).contains
    ).toEqual({
      layout: true,
      cantillation: true,
      letterCantillation: true,
      gapRaw: true,
      metadataCheckpoints: true
    });
    expect(
      (
        manifest as {
          integrity?: {
            anchors?: Record<string, unknown>;
            countsByRef?: Record<string, unknown>;
            rollingHash?: { chunkSize?: number; chunkDigests?: unknown[] };
          };
        }
      ).integrity?.anchors
    ).toEqual({
      firstRefKey: "Genesis/1/1",
      lastRefKey: "Genesis/1/1",
      firstGid: "Genesis/1/1#g:0",
      lastGid: "Genesis/1/1#g:1",
      firstGapid: "Genesis/1/1#gap:0",
      lastGapid: "Genesis/1/1#gap:2"
    });
    expect(
      (manifest as { integrity?: { countsByRef?: { refCount?: number; meanOpsPerRef?: number } } })
        .integrity?.countsByRef?.refCount
    ).toBe(1);
    expect(
      (manifest as { integrity?: { countsByRef?: { maxOpsPerRef?: number } } }).integrity
        ?.countsByRef?.maxOpsPerRef
    ).toBe(2);
    expect(
      (
        manifest as { integrity?: { rollingHash?: { chunkSize?: number; chunkDigests?: string[] } } }
      ).integrity?.rollingHash?.chunkSize
    ).toBe(50_000);
    expect(
      (
        manifest as { integrity?: { rollingHash?: { chunkDigests?: string[] } } }
      ).integrity?.rollingHash?.chunkDigests?.[0]
    ).toMatch(/^[a-f0-9]{64}$/);
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

  it("supports --metadata off without changing ProgramIR semantics", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stitch-program-cli-metadata-off-"));
    const dirs = makeLayerDirs(tmp);
    const outWithMetadata = path.join(tmp, "out-with-metadata");
    const outMetadataOff = path.join(tmp, "out-metadata-off");

    const runWithMetadata = await runStitchProgram([
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
      outWithMetadata,
      "--created-at",
      CREATED_AT,
      "--force=true"
    ]);

    const runMetadataOff = await runStitchProgram([
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
      "off",
      "--out",
      outMetadataOff,
      "--created-at",
      CREATED_AT,
      "--force=true"
    ]);

    const programWithMetadata = fs.readFileSync(runWithMetadata.programPath, "utf8");
    const programMetadataOff = fs.readFileSync(runMetadataOff.programPath, "utf8");
    expect(programMetadataOff).toBe(programWithMetadata);

    const metaWithMetadata = JSON.parse(
      fs.readFileSync(runWithMetadata.metaPath, "utf8")
    ) as Record<string, unknown>;
    const metaMetadataOff = JSON.parse(fs.readFileSync(runMetadataOff.metaPath, "utf8")) as Record<
      string,
      unknown
    >;

    expect(metaWithMetadata.counts).toEqual({
      ops: 2,
      boundaries: 3,
      checkpoints: 1
    });
    expect(metaMetadataOff.counts).toEqual({
      ops: 2,
      boundaries: 3,
      checkpoints: 0
    });
    expect(metaMetadataOff.checkpoints).toEqual([]);
    expect(metaMetadataOff.checkpointsByRefEnd).toEqual({});
    expect(metaMetadataOff.checkpointsByIndex).toEqual({});
    expect(metaMetadataOff.programDigest).toBe(metaWithMetadata.programDigest);
  });
});
