import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBuildLayer } from "../../../src/cli/build-layer";
import { parseCantillationIRJsonl } from "../../../src/layers/cantillation/schema";

const SPINE_DIGEST = "d".repeat(64);

function writeSpineFixture(baseDir: string): { spinePath: string } {
  const spineDir = path.join(baseDir, "outputs", "cache", "spine", SPINE_DIGEST);
  const spinePath = path.join(spineDir, "spine.jsonl");
  const manifestPath = path.join(spineDir, "manifest.json");
  const ref = "Genesis/1/1";

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
      marks_raw: {
        niqqud: [],
        teamim: ["\u0596", "\u05AD"]
      },
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
    manifestPath,
    `${JSON.stringify(
      {
        layer: "spine",
        digests: { spineDigest: SPINE_DIGEST }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return { spinePath };
}

describe("build-layer cli (cantillation)", () => {
  it("builds cantillation from spine and cache-hits on repeated run", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-layer-cantillation-cli-"));
    const outRoot = path.join(tmp, "outputs");
    const outCache = path.join(outRoot, "cache", "cantillation");
    const { spinePath } = writeSpineFixture(tmp);

    const first = await runBuildLayer([
      "--layer",
      "cantillation",
      "--spine",
      spinePath,
      "--out",
      outCache,
      "--emit-unknown=true",
      "--dump-stats=true",
      "--cantillation-code-hash",
      "a".repeat(64)
    ]);

    expect(first.layer).toBe("cantillation");
    expect(first.cacheHit).toBe(false);
    expect(fs.existsSync(first.cantillationIrPath)).toBe(true);
    expect(fs.existsSync(first.manifestPath)).toBe(true);
    expect(first.statsPath && fs.existsSync(first.statsPath)).toBe(true);
    expect(fs.existsSync(first.aliasPath)).toBe(true);
    expect(first.outputDir).toBe(path.join(outCache, first.digest));
    const runAliasPath = path.join(outRoot, "runs", first.digest, "manifests", "cantillation.json");
    expect(fs.existsSync(runAliasPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(first.manifestPath, "utf8")) as {
      layer: string;
      layer_version: number;
      spine_digest: string;
      config_hash: string;
      code_hash: string;
      output_files: Array<{ path: string; sha256: string }>;
    };
    expect(manifest.layer).toBe("cantillation");
    expect(manifest.layer_version).toBe(1);
    expect(manifest.spine_digest).toBe(SPINE_DIGEST);
    expect(manifest.config_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.code_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.output_files.map((file) => file.path)).toEqual([
      "cantillation.ir.jsonl",
      "stats.json"
    ]);

    const records = parseCantillationIRJsonl(fs.readFileSync(first.cantillationIrPath, "utf8"));
    expect(records.map((row) => row.event.type)).toEqual([
      "TROPE_MARK",
      "UNKNOWN_MARK",
      "BOUNDARY"
    ]);
    expect(records[2]?.event).toEqual({
      type: "BOUNDARY",
      op: "CUT",
      rank: 3,
      reason: "SOF_PASUK"
    });

    const second = await runBuildLayer([
      "--layer=cantillation",
      `--spine=${spinePath}`,
      `--out=${outCache}`,
      "--emit-unknown=true",
      "--dump-stats=true",
      "--cantillation-code-hash",
      "a".repeat(64)
    ]);
    expect(second.cacheHit).toBe(true);
    expect(second.digest).toBe(first.digest);
    expect(second.outputDir).toBe(first.outputDir);
  });

  it("changes digest when cantillation config changes", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-layer-cantillation-cli-"));
    const outCache = path.join(tmp, "outputs", "cache", "cantillation");
    const { spinePath } = writeSpineFixture(tmp);

    const rank3 = await runBuildLayer([
      "--layer",
      "cantillation",
      "--spine",
      spinePath,
      "--out",
      outCache,
      "--emit-unknown=true",
      "--sof-pasuk-rank=3",
      "--cantillation-code-hash",
      "b".repeat(64)
    ]);
    const rank5 = await runBuildLayer([
      "--layer",
      "cantillation",
      "--spine",
      spinePath,
      "--out",
      outCache,
      "--emit-unknown=true",
      "--sof-pasuk-rank=5",
      "--cantillation-code-hash",
      "b".repeat(64)
    ]);

    expect(rank3.digest).not.toBe(rank5.digest);

    const rank5Records = parseCantillationIRJsonl(
      fs.readFileSync(rank5.cantillationIrPath, "utf8")
    );
    const sofPasuk = rank5Records.find(
      (row) =>
        row.anchor.kind === "gap" &&
        row.event.type === "BOUNDARY" &&
        row.event.reason === "SOF_PASUK"
    );
    expect(sofPasuk?.event).toEqual({
      type: "BOUNDARY",
      op: "CUT",
      rank: 5,
      reason: "SOF_PASUK"
    });
  }, 15000);
});
