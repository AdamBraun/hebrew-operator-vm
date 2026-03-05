import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBuildLayer } from "../../src/cli/build-layer";
import { runBuildLayerNiqqud } from "../../src/cli/build-layer-niqqud";
import { runBuildSpine } from "../../src/cli/build-spine";
import { runStitchProgram } from "../../src/cli/stitch-program";
import { parseLettersIRJsonl } from "../../src/layers/letters/schema";
import {
  parseProgramIRJsonl,
  type ProgramIRBoundaryRecord
} from "../../src/wrapper/program_schema";

const FIXTURE_DIR = path.resolve(
  process.cwd(),
  "tests",
  "fixtures",
  "pipeline",
  "stitch-integration"
);
const CREATED_AT = "2026-03-02T00:00:00.000Z";
const UPDATE_GOLDEN = process.env.UPDATE_GOLDEN === "1";

function fixturePath(fileName: string): string {
  return path.join(FIXTURE_DIR, fileName);
}

function sha256Hex(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writeGoldenIfRequested(filePath: string, content: string): void {
  if (!UPDATE_GOLDEN) {
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function expectGolden(filePath: string, actual: string): void {
  writeGoldenIfRequested(filePath, actual);
  const expected = fs.readFileSync(filePath, "utf8");
  expect(actual).toBe(expected);
}

function findBoundary(
  rows: ReturnType<typeof parseProgramIRJsonl>,
  gapid: string
): ProgramIRBoundaryRecord {
  const row = rows.find((entry) => entry.kind === "boundary" && entry.gapid === gapid);
  if (!row || row.kind !== "boundary") {
    throw new Error(`expected boundary row for gapid ${gapid}`);
  }
  return row;
}

describe("pipeline stitch integration", () => {
  it("runs spine -> layers -> stitch for real verse fixture with stable golden output", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stitch-integration-"));
    const outRoot = path.join(tmp, "outputs");
    const metadataPath = fixturePath("MetadataPlan.json");
    const stitchOutDir = path.join(tmp, "stitched");

    const spine = await runBuildSpine([
      "--input",
      fixturePath("corpus.json"),
      "--out",
      outRoot,
      "--force"
    ]);

    const letters = await runBuildLayer([
      "--layer",
      "letters",
      "--spine",
      spine.spinePath,
      "--out",
      path.join(outRoot, "cache", "letters"),
      "--letters-code-fingerprint",
      "a".repeat(64)
    ]);

    const niqqud = await runBuildLayerNiqqud([
      "--spine",
      spine.spinePath,
      "--out",
      path.join(outRoot, "cache", "niqqud"),
      "--force=true"
    ]);

    const cantillation = await runBuildLayer([
      "--layer",
      "cantillation",
      "--spine",
      spine.spinePath,
      "--out",
      path.join(outRoot, "cache", "cantillation"),
      "--cantillation-code-hash",
      "b".repeat(64),
      "--force"
    ]);

    const layout = await runBuildLayer([
      "--layer",
      "layout",
      "--spine",
      spine.spinePath,
      "--dataset",
      fixturePath("layout.dataset.json"),
      "--out",
      path.join(outRoot, "cache", "layout"),
      "--layout-code-digest",
      "c".repeat(64),
      "--force"
    ]);

    const stitchArgs = [
      "--spine",
      spine.spinePath,
      "--letters",
      letters.lettersIrPath,
      "--niqqud",
      niqqud.niqqudIrPath,
      "--cant",
      cantillation.cantillationIrPath,
      "--layout",
      layout.layoutIrPath,
      "--metadata",
      metadataPath,
      "--out",
      stitchOutDir,
      "--created-at",
      CREATED_AT
    ];

    const stitchedA = await runStitchProgram([...stitchArgs, "--force=true"]);
    const stitchedB = await runStitchProgram([...stitchArgs, "--force=true"]);
    const stitchedCache = await runStitchProgram(stitchArgs);

    expect(stitchedA.cacheHit).toBe(false);
    expect(stitchedB.cacheHit).toBe(false);
    expect(stitchedCache.cacheHit).toBe(true);

    const programTextA = fs.readFileSync(stitchedA.programPath, "utf8");
    const programTextB = fs.readFileSync(stitchedB.programPath, "utf8");
    const programHashA = sha256Hex(programTextA);
    const programHashB = sha256Hex(programTextB);
    expect(programHashA).toBe(programHashB);
    expect(stitchedA.programDigest).toBe(stitchedB.programDigest);
    expect(stitchedA.programDigest).toBe(programHashA);

    const metaText = fs.readFileSync(stitchedA.metaPath, "utf8");
    const meta = JSON.parse(metaText) as {
      counts: { ops: number; boundaries: number; checkpoints: number };
      programDigest: string;
      cacheDigest: string;
    };
    expect(meta.counts).toEqual({
      ops: 3,
      boundaries: 4,
      checkpoints: 1
    });
    expect(meta.programDigest).toBe(programHashA);
    expect(meta.cacheDigest).toMatch(/^[a-f0-9]{64}$/);

    const lettersRows = parseLettersIRJsonl(fs.readFileSync(letters.lettersIrPath, "utf8"));
    const programRows = parseProgramIRJsonl(programTextA);
    const opGids = programRows
      .filter((row) => row.kind === "op")
      .map((row) => row.gid)
      .sort();
    const letterGids = lettersRows.map((row) => row.gid).sort();
    expect(opGids).toEqual(letterGids);

    const maqafBoundary = findBoundary(programRows, "Genesis/1/1#gap:1");
    expect(maqafBoundary.layout.map((event) => event.type)).toEqual(["SETUMA"]);
    expect(maqafBoundary.cant).toEqual([
      {
        type: "BOUNDARY",
        op: "MAQAF_GLUE",
        rank: 0,
        reason: "MAQAF"
      }
    ]);

    const sofBoundary = findBoundary(programRows, "Genesis/1/1#gap:3");
    expect(sofBoundary.cant).toEqual([
      {
        type: "BOUNDARY",
        op: "CUT",
        rank: 3,
        reason: "SOF_PASUK"
      }
    ]);

    expectGolden(fixturePath("ProgramIR.expected.jsonl"), programTextA);
    expectGolden(fixturePath("program.meta.expected.json"), metaText);
  });
});
