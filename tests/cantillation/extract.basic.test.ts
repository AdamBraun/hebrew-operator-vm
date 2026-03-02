import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCantillationIR } from "../../src/layers/cantillation/extract";
import { parseCantillationIRJsonl } from "../../src/layers/cantillation/schema";

const SPINE_DIGEST = "f".repeat(64);
const SPINE_FIXTURE = path.resolve(process.cwd(), "tests", "fixtures", "spine.small.jsonl");
const EXPECTED_FIXTURE = path.resolve(
  process.cwd(),
  "tests",
  "fixtures",
  "cantillation.ir.expected.jsonl"
);

function setupFixture(tmpRoot: string): {
  spinePath: string;
  spineManifestPath: string;
} {
  const spineDir = path.join(tmpRoot, "outputs", "cache", "spine", SPINE_DIGEST);
  const spinePath = path.join(spineDir, "spine.jsonl");
  const spineManifestPath = path.join(spineDir, "manifest.json");

  fs.mkdirSync(spineDir, { recursive: true });
  fs.copyFileSync(SPINE_FIXTURE, spinePath);
  fs.writeFileSync(
    spineManifestPath,
    `${JSON.stringify(
      {
        layer: "spine",
        digests: {
          spineDigest: SPINE_DIGEST
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return { spinePath, spineManifestPath };
}

describe("cantillation extractor basic fixture", () => {
  it("emits disj/conj trope marks on gid and sof-pasuk boundary on gap", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cantillation-basic-fixture-"));
    const { spinePath, spineManifestPath } = setupFixture(tmp);
    const outCache = path.join(tmp, "outputs", "cache", "cantillation");

    const run = await extractCantillationIR(spinePath, outCache, {
      spineManifestPath,
      strict: false,
      emitUnknown: false
    });

    const actual = parseCantillationIRJsonl(fs.readFileSync(run.cantillationIrPath, "utf8"));
    const expected = parseCantillationIRJsonl(fs.readFileSync(EXPECTED_FIXTURE, "utf8"));

    expect(actual).toEqual(expected);
    expect(actual.map((row) => row.anchor.id)).toEqual([
      "Genesis/1/1#g:0",
      "Genesis/1/1#g:1",
      "Genesis/1/2#gap:4"
    ]);

    const disj = actual.find((row) => row.anchor.id === "Genesis/1/1#g:0");
    expect(disj?.event).toEqual({
      type: "TROPE_MARK",
      mark: "ZAQEF_GADOL",
      class: "DISJ",
      rank: 2
    });

    const conj = actual.find((row) => row.anchor.id === "Genesis/1/1#g:1");
    expect(conj?.event).toEqual({
      type: "TROPE_MARK",
      mark: "MERKHA",
      class: "CONJ",
      rank: null
    });

    const sofPasuk = actual.find((row) => row.anchor.id === "Genesis/1/2#gap:4");
    expect(sofPasuk?.event).toEqual({
      type: "BOUNDARY",
      op: "CUT",
      rank: 3,
      reason: "SOF_PASUK"
    });
  });

  it("is byte-identical for same spine input and config", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cantillation-determinism-fixture-"));
    const { spinePath, spineManifestPath } = setupFixture(tmp);

    const runA = await extractCantillationIR(path.resolve(spinePath), path.join(tmp, "cache-a"), {
      spineManifestPath,
      strict: false,
      emitUnknown: false
    });
    const runB = await extractCantillationIR(path.resolve(spinePath), path.join(tmp, "cache-b"), {
      spineManifestPath,
      strict: false,
      emitUnknown: false
    });

    const bytesA = fs.readFileSync(runA.cantillationIrPath, "utf8");
    const bytesB = fs.readFileSync(runB.cantillationIrPath, "utf8");

    expect(bytesA).toBe(bytesB);
    expect(bytesA.endsWith("\n")).toBe(true);
  });
});
