import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import { runStitchProgram } from "../../src/cli/stitch-program";

const STITCH_FIXTURE_DIR = path.resolve(process.cwd(), "tests", "fixtures", "stitcher", "tiny");
const SCHEMA_PATH = path.resolve(process.cwd(), "src", "ir", "schema", "program_meta.schema.json");

function fixturePath(fileName: string): string {
  return path.join(STITCH_FIXTURE_DIR, fileName);
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

describe("program.meta schema", () => {
  it("accepts emitted program.meta.json from stitch cli", async () => {
    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8")) as Record<string, unknown>;
    const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "program-meta-schema-"));
    const dirs = makeLayerDirs(tmp);
    const result = await runStitchProgram([
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
      "2026-03-02T00:00:00.000Z"
    ]);

    const meta = JSON.parse(fs.readFileSync(result.metaPath, "utf8")) as Record<string, unknown>;
    expect(validate(meta)).toBe(true);
  });
});
