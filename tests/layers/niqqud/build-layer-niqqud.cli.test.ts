import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBuildLayerNiqqud } from "../../../src/cli/build-layer-niqqud";
import { runBuildSpine } from "../../../src/cli/build-spine";
import { parseNiqqudIRJsonl } from "../../../src/layers/niqqud/schema";

function makeFixtureInput(filePath: string): void {
  const payload = {
    books: [
      {
        name: "Genesis",
        chapters: [
          {
            n: 1,
            verses: [{ n: 1, he: "בְּרֵאשִׁית" }]
          }
        ]
      }
    ]
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function makeMalformedSpineFixture(spineDir: string, digest: string): { spinePath: string } {
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
      marks_raw: { niqqud: "not-an-array", teamim: [] },
      raw: { text: "א" }
    },
    {
      kind: "gap",
      gapid: `${ref}#gap:1`,
      ref_key: ref,
      gap_index: 1,
      raw: { whitespace: false, chars: [] }
    },
    {
      kind: "g",
      gid: `${ref}#g:1`,
      ref_key: ref,
      g_index: 1,
      base_letter: "ב",
      marks_raw: { niqqud: ["\u05BD"], teamim: [] },
      raw: { text: "בֽ" }
    },
    {
      kind: "gap",
      gapid: `${ref}#gap:2`,
      ref_key: ref,
      gap_index: 2,
      raw: { whitespace: false, chars: [] }
    }
  ];

  fs.mkdirSync(spineDir, { recursive: true });
  fs.writeFileSync(spinePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  fs.writeFileSync(
    manifestPath,
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
  return { spinePath };
}

describe("build-layer-niqqud cli", () => {
  it("builds NiqqudIR + stats + manifest and cache-hits on repeat", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-layer-niqqud-cli-"));
    const inputPath = path.join(tmp, "data", "torah.json");
    const outRoot = path.join(tmp, "outputs");
    const outCache = path.join(outRoot, "cache", "niqqud");

    makeFixtureInput(inputPath);
    const spine = await runBuildSpine(["--input", inputPath, "--out", outRoot]);

    const first = await runBuildLayerNiqqud(["--spine", spine.spinePath, "--out", outCache]);

    expect(first.layer).toBe("niqqud");
    expect(first.cacheHit).toBe(false);
    expect(fs.existsSync(first.niqqudIrPath)).toBe(true);
    expect(fs.existsSync(first.statsPath ?? "")).toBe(true);
    expect(fs.existsSync(first.manifestPath)).toBe(true);
    expect(first.outputDir).toBe(path.join(outCache, first.digest));

    const ir = parseNiqqudIRJsonl(fs.readFileSync(first.niqqudIrPath, "utf8"));
    expect(ir.length).toBeGreaterThan(0);

    const stats = JSON.parse(fs.readFileSync(first.statsPath ?? "", "utf8")) as {
      totalGraphemes: number;
      graphemesWithNiqqud: number;
    };
    expect(stats.totalGraphemes).toBe(ir.length);
    expect(stats.graphemesWithNiqqud).toBeGreaterThan(0);

    const manifest = JSON.parse(fs.readFileSync(first.manifestPath, "utf8")) as {
      layer: string;
      layer_version: string;
      spine_digest: string;
      config_digest: string;
      code_fingerprint: string;
      output_files: string[];
    };
    expect(manifest.layer).toBe("niqqud");
    expect(manifest.layer_version).toBe("1.0.0");
    expect(manifest.spine_digest).toBe(spine.spineDigest);
    expect(typeof manifest.config_digest).toBe("string");
    expect(manifest.config_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(typeof manifest.code_fingerprint).toBe("string");
    expect(manifest.code_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.output_files).toEqual(
      expect.arrayContaining(["niqqud.ir.jsonl", "niqqud.stats.json", "manifest.json"])
    );

    const second = await runBuildLayerNiqqud(["--spine", spine.spinePath, "--out", outCache]);
    expect(second.cacheHit).toBe(true);
    expect(second.digest).toBe(first.digest);
    expect(second.outputDir).toBe(first.outputDir);
  });

  it("rebuilds when cache manifest exists but does not match expected digest inputs", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-layer-niqqud-cli-"));
    const inputPath = path.join(tmp, "data", "torah.json");
    const outRoot = path.join(tmp, "outputs");
    const outCache = path.join(outRoot, "cache", "niqqud");
    makeFixtureInput(inputPath);

    const spine = await runBuildSpine(["--input", inputPath, "--out", outRoot]);
    const first = await runBuildLayerNiqqud(["--spine", spine.spinePath, "--out", outCache]);
    const firstManifest = JSON.parse(fs.readFileSync(first.manifestPath, "utf8")) as {
      code_fingerprint: string;
    };

    const tampered = JSON.parse(fs.readFileSync(first.manifestPath, "utf8")) as {
      code_fingerprint: string;
    };
    tampered.code_fingerprint = "f".repeat(64);
    fs.writeFileSync(first.manifestPath, `${JSON.stringify(tampered, null, 2)}\n`, "utf8");

    const second = await runBuildLayerNiqqud(["--spine", spine.spinePath, "--out", outCache]);
    expect(second.cacheHit).toBe(false);
    expect(second.digest).toBe(first.digest);

    const repairedManifest = JSON.parse(fs.readFileSync(second.manifestPath, "utf8")) as {
      code_fingerprint: string;
    };
    expect(repairedManifest.code_fingerprint).toBe(firstManifest.code_fingerprint);
  });

  it("records malformed/unhandled warnings non-fatally even with --strict", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-layer-niqqud-cli-"));
    const digest = "e".repeat(64);
    const spineDir = path.join(tmp, "outputs", "cache", "spine", digest);
    const outCache = path.join(tmp, "outputs", "cache", "niqqud");
    const { spinePath } = makeMalformedSpineFixture(spineDir, digest);

    const run = await runBuildLayerNiqqud([
      "--spine",
      spinePath,
      "--out",
      outCache,
      "--strict=true"
    ]);

    expect(run.cacheHit).toBe(false);
    const ir = parseNiqqudIRJsonl(fs.readFileSync(run.niqqudIrPath, "utf8"));
    expect(ir[0]?.raw.niqqud).toEqual([]);
    expect(ir[1]?.unhandled).toEqual(["\u05BD"]);

    const warnings = fs
      .readFileSync(run.warningsPath ?? "", "utf8")
      .split(/\r?\n/u)
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as { type: string });

    expect(warnings.map((entry) => entry.type)).toEqual(
      expect.arrayContaining(["MALFORMED_MARKS", "UNHANDLED_MARK"])
    );
  });

  it("supports --emit-stats=false", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-layer-niqqud-cli-"));
    const inputPath = path.join(tmp, "data", "torah.json");
    const outRoot = path.join(tmp, "outputs");
    const outCache = path.join(outRoot, "cache", "niqqud");
    makeFixtureInput(inputPath);
    const spine = await runBuildSpine(["--input", inputPath, "--out", outRoot]);

    const run = await runBuildLayerNiqqud([
      "--spine",
      spine.spinePath,
      "--out",
      outCache,
      "--emit-stats=false"
    ]);

    expect(fs.existsSync(run.niqqudIrPath)).toBe(true);
    expect(run.statsPath).toBeUndefined();
    expect(run.warningsPath).toBeUndefined();
    expect(fs.existsSync(path.join(run.outputDir, "niqqud.stats.json"))).toBe(false);
    expect(fs.existsSync(path.join(run.outputDir, "warnings.jsonl"))).toBe(false);
  });
});
