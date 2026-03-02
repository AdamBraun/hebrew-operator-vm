import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCantillationIR } from "../../src/layers/cantillation/extract";
import { parseCantillationIRJsonl } from "../../src/layers/cantillation/schema";

const SPINE_DIGEST = "c".repeat(64);
const SPINE_FIXTURE = path.resolve(process.cwd(), "tests", "fixtures", "spine.small.jsonl");

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

describe("cantillation extractor unknown marks", () => {
  it("strict=false tracks unknown marks and can skip UNKNOWN_MARK emission", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cantillation-unknown-skip-"));
    const { spinePath, spineManifestPath } = setupFixture(tmp);
    const outCache = path.join(tmp, "outputs", "cache", "cantillation");

    const run = await extractCantillationIR(spinePath, outCache, {
      spineManifestPath,
      strict: false,
      emitUnknown: false
    });
    const rows = parseCantillationIRJsonl(fs.readFileSync(run.cantillationIrPath, "utf8"));

    expect(run.stats.totals.marks_unknown).toBe(1);
    expect(rows.some((row) => row.event.type === "UNKNOWN_MARK")).toBe(false);
  });

  it("strict=false can emit UNKNOWN_MARK events", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cantillation-unknown-emit-"));
    const { spinePath, spineManifestPath } = setupFixture(tmp);
    const outCache = path.join(tmp, "outputs", "cache", "cantillation");

    const run = await extractCantillationIR(spinePath, outCache, {
      spineManifestPath,
      strict: false,
      emitUnknown: true
    });
    const rows = parseCantillationIRJsonl(fs.readFileSync(run.cantillationIrPath, "utf8"));
    const unknown = rows.filter((row) => row.event.type === "UNKNOWN_MARK");

    expect(run.stats.totals.marks_unknown).toBe(1);
    expect(unknown).toHaveLength(1);
    expect(unknown[0]?.anchor.id).toBe("Genesis/1/1#g:2");
  });

  it("strict=true throws on unknown marks", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cantillation-unknown-strict-"));
    const { spinePath, spineManifestPath } = setupFixture(tmp);
    const outCache = path.join(tmp, "outputs", "cache", "cantillation");

    await expect(
      extractCantillationIR(spinePath, outCache, {
        spineManifestPath,
        strict: true,
        emitUnknown: true
      })
    ).rejects.toThrow(/unknown teamim mark/);
    await expect(
      extractCantillationIR(spinePath, outCache, {
        spineManifestPath,
        strict: true,
        emitUnknown: true
      })
    ).rejects.toThrow(/gid='Genesis\/1\/1#g:2'/);
  });
});
