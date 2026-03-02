import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCantillationIR } from "../../src/layers/cantillation/extract";
import { parseCantillationIRJsonl } from "../../src/layers/cantillation/schema";

function writeInvalidAnchorFixture(tmpRoot: string): {
  spinePath: string;
  spineManifestPath: string;
} {
  const digest = "a".repeat(64);
  const ref = "Genesis/1/1";
  const spineDir = path.join(tmpRoot, "outputs", "cache", "spine", digest);
  const spinePath = path.join(spineDir, "spine.jsonl");
  const spineManifestPath = path.join(spineDir, "manifest.json");
  const rows = [
    {
      kind: "gap",
      gapid: `${ref}#gap:0`,
      ref_key: ref,
      gap_index: 0,
      raw: { whitespace: false, chars: [] }
    },
    {
      kind: "g",
      gid: `${ref}#g:9`,
      ref_key: ref,
      g_index: 0,
      base_letter: "א",
      marks_raw: { niqqud: [], teamim: ["\u0595"] },
      raw: { text: "א" }
    },
    {
      kind: "gap",
      gapid: `${ref}#gap:1`,
      ref_key: ref,
      gap_index: 1,
      raw: { whitespace: false, chars: [] }
    }
  ];

  fs.mkdirSync(spineDir, { recursive: true });
  fs.writeFileSync(spinePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  fs.writeFileSync(
    spineManifestPath,
    `${JSON.stringify(
      {
        layer: "spine",
        digests: { spineDigest: digest }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return { spinePath, spineManifestPath };
}

function writeValidFixture(tmpRoot: string): { spinePath: string; spineManifestPath: string } {
  const digest = "b".repeat(64);
  const ref = "Genesis/1/1";
  const spineDir = path.join(tmpRoot, "outputs", "cache", "spine", digest);
  const spinePath = path.join(spineDir, "spine.jsonl");
  const spineManifestPath = path.join(spineDir, "manifest.json");
  const rows = [
    {
      kind: "gap",
      gapid: `${ref}#gap:0`,
      ref_key: ref,
      gap_index: 0,
      raw: { whitespace: false, chars: [] }
    },
    {
      kind: "g",
      gid: `${ref}#g:0`,
      ref_key: ref,
      g_index: 0,
      base_letter: "א",
      marks_raw: { niqqud: [], teamim: ["\u0595"] },
      raw: { text: "א" }
    },
    {
      kind: "gap",
      gapid: `${ref}#gap:1`,
      ref_key: ref,
      gap_index: 1,
      raw: { whitespace: false, chars: ["\u05C3"] }
    }
  ];

  fs.mkdirSync(spineDir, { recursive: true });
  fs.writeFileSync(spinePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  fs.writeFileSync(
    spineManifestPath,
    `${JSON.stringify(
      {
        layer: "spine",
        digests: { spineDigest: digest }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return { spinePath, spineManifestPath };
}

describe("cantillation extractor anchor validation", () => {
  it("fails fast on malformed/mismatched spine anchors", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cantillation-anchor-invalid-"));
    const { spinePath, spineManifestPath } = writeInvalidAnchorFixture(tmp);
    const outCache = path.join(tmp, "outputs", "cache", "cantillation");

    await expect(
      extractCantillationIR(spinePath, outCache, {
        spineManifestPath,
        strict: true
      })
    ).rejects.toThrow(/gid 'Genesis\/1\/1#g:9' must match ref_key='Genesis\/1\/1' and g_index=0/);
  });

  it("emits only anchors that exist in spine under strict mode", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cantillation-anchor-valid-"));
    const { spinePath, spineManifestPath } = writeValidFixture(tmp);
    const outCache = path.join(tmp, "outputs", "cache", "cantillation");

    const run = await extractCantillationIR(spinePath, outCache, {
      spineManifestPath,
      strict: true
    });

    const emitted = parseCantillationIRJsonl(fs.readFileSync(run.cantillationIrPath, "utf8"));
    const validAnchors = new Set<string>();
    for (const line of fs.readFileSync(spinePath, "utf8").split(/\r?\n/u)) {
      if (!line.trim()) {
        continue;
      }
      const parsed = JSON.parse(line) as { kind: string; gid?: string; gapid?: string };
      if (parsed.kind === "g" && parsed.gid) {
        validAnchors.add(parsed.gid);
      }
      if (parsed.kind === "gap" && parsed.gapid) {
        validAnchors.add(parsed.gapid);
      }
    }

    expect(emitted.length).toBeGreaterThan(0);
    for (const row of emitted) {
      expect(validAnchors.has(row.anchor.id)).toBe(true);
    }
  });
});
