import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBuildLayer } from "../../../src/cli/build-layer";
import { runBuildSpine } from "../../../src/cli/build-spine";

function makeFixtureInput(filePath: string): void {
  const payload = {
    books: [
      {
        name: "Genesis",
        chapters: [
          {
            n: 1,
            verses: [{ n: 1, he: "א ב" }]
          }
        ]
      }
    ]
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function makeInvalidSpineFixture(spineDir: string, digest: string): { spinePath: string } {
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
      marks_raw: { niqqud: [], teamim: [] },
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
      base_letter: "@",
      marks_raw: { niqqud: [], teamim: [] },
      raw: { text: "@" }
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

describe("build-layer cli (letters)", () => {
  it("builds letters from spine and cache-hits on repeated run", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-layer-letters-cli-"));
    const inputPath = path.join(tmp, "data", "torah.json");
    const outRoot = path.join(tmp, "outputs");
    const outCache = path.join(outRoot, "cache", "letters");

    makeFixtureInput(inputPath);
    const spine = await runBuildSpine(["--input", inputPath, "--out", outRoot]);

    const first = await runBuildLayer([
      "--layer",
      "letters",
      "--spine",
      spine.spinePath,
      "--out",
      outCache
    ]);

    expect(first.layer).toBe("letters");
    expect(first.cacheHit).toBe(false);
    expect(fs.existsSync(first.lettersIrPath)).toBe(true);
    expect(fs.existsSync(first.manifestPath)).toBe(true);
    expect(fs.existsSync(first.aliasPath)).toBe(true);
    expect(first.outputDir).toBe(path.join(outCache, first.digest));

    const manifest = JSON.parse(fs.readFileSync(first.manifestPath, "utf8")) as {
      layer: string;
      version: string;
      inputs: { spine_digest: string; spine_path: string };
      config: { include_word_segmentation: boolean; strict_letters: boolean };
      outputs: { letters_ir_path: string };
      counts: { letters_emitted: number; refs_seen: number };
    };
    expect(manifest.layer).toBe("letters");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.inputs.spine_digest).toBe(spine.spineDigest);
    expect(manifest.inputs.spine_path).toBe(spine.spinePath);
    expect(manifest.config.include_word_segmentation).toBe(true);
    expect(manifest.config.strict_letters).toBe(false);
    expect(manifest.outputs.letters_ir_path).toBe(first.lettersIrPath);
    expect(manifest.counts).toEqual({
      letters_emitted: 2,
      refs_seen: 1
    });

    const second = await runBuildLayer([
      "--layer=letters",
      `--spine=${spine.spinePath}`,
      `--out=${outCache}`
    ]);
    expect(second.layer).toBe("letters");
    expect(second.cacheHit).toBe(true);
    expect(second.digest).toBe(first.digest);
    expect(second.outputDir).toBe(first.outputDir);
  });

  it("changes letters digest when letters config changes", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-layer-letters-cli-"));
    const inputPath = path.join(tmp, "data", "torah.json");
    const outRoot = path.join(tmp, "outputs");
    const outCache = path.join(outRoot, "cache", "letters");

    makeFixtureInput(inputPath);
    const spine = await runBuildSpine(["--input", inputPath, "--out", outRoot]);

    const withWords = await runBuildLayer([
      "--layer",
      "letters",
      "--spine",
      spine.spinePath,
      "--out",
      outCache,
      "--include-word-segmentation=true"
    ]);
    const withoutWords = await runBuildLayer([
      "--layer",
      "letters",
      "--spine",
      spine.spinePath,
      "--out",
      outCache,
      "--include-word-segmentation=false"
    ]);

    expect(withWords.digest).not.toBe(withoutWords.digest);

    const strict = await runBuildLayer([
      "--layer",
      "letters",
      "--spine",
      spine.spinePath,
      "--out",
      outCache,
      "--strict-letters=true"
    ]);
    expect(strict.digest).not.toBe(withWords.digest);
  });

  it("changes letters digest when letters code fingerprint changes", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-layer-letters-cli-"));
    const inputPath = path.join(tmp, "data", "torah.json");
    const outRoot = path.join(tmp, "outputs");
    const outCache = path.join(outRoot, "cache", "letters");

    makeFixtureInput(inputPath);
    const spine = await runBuildSpine(["--input", inputPath, "--out", outRoot]);

    const runA = await runBuildLayer([
      "--layer",
      "letters",
      "--spine",
      spine.spinePath,
      "--out",
      outCache,
      "--letters-code-fingerprint",
      "letters-code-a"
    ]);
    const runB = await runBuildLayer([
      "--layer",
      "letters",
      "--spine",
      spine.spinePath,
      "--out",
      outCache,
      "--letters-code-fingerprint",
      "letters-code-b"
    ]);

    expect(runA.digest).not.toBe(runB.digest);
  });

  it("skips unknown base letters by default and throws with --strict-letters", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-layer-letters-cli-"));
    const digest = "d".repeat(64);
    const spineDir = path.join(tmp, "outputs", "cache", "spine", digest);
    const outCache = path.join(tmp, "outputs", "cache", "letters");
    const { spinePath } = makeInvalidSpineFixture(spineDir, digest);

    const nonStrict = await runBuildLayer([
      "--layer",
      "letters",
      "--spine",
      spinePath,
      "--out",
      outCache
    ]);
    const manifest = JSON.parse(fs.readFileSync(nonStrict.manifestPath, "utf8")) as {
      counts: { letters_emitted: number; refs_seen: number };
      config: { strict_letters: boolean };
    };
    expect(manifest.config.strict_letters).toBe(false);
    expect(manifest.counts).toEqual({ letters_emitted: 1, refs_seen: 1 });

    await expect(
      runBuildLayer([
        "--layer",
        "letters",
        "--spine",
        spinePath,
        "--out",
        outCache,
        "--strict-letters"
      ])
    ).rejects.toThrow(/base_letter="@"/);
    await expect(
      runBuildLayer([
        "--layer",
        "letters",
        "--spine",
        spinePath,
        "--out",
        outCache,
        "--strict-letters"
      ])
    ).rejects.toThrow(/ref_key='Genesis\/1\/1'/);
    await expect(
      runBuildLayer([
        "--layer",
        "letters",
        "--spine",
        spinePath,
        "--out",
        outCache,
        "--strict-letters"
      ])
    ).rejects.toThrow(/gid='Genesis\/1\/1#g:1'/);
  });
});
