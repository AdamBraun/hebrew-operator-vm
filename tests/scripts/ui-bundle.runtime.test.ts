import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseArgs,
  runBundleCommand,
  verifyBundleCommand,
  type UiBundleOptions
} from "@ref/scripts/uiBundle/runtime";

const FIXTURE_DIR = path.resolve(process.cwd(), "tests", "fixtures", "ui-contract");

function loadFixture(name: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8")) as Record<
    string,
    unknown
  >;
}

function writeJsonl(filePath: string, rows: unknown[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
}

function sha256File(filePath: string): string {
  const raw = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function collectFileHashes(rootDir: string): Record<string, string> {
  const files: string[] = [];

  const walk = (dir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  };

  walk(rootDir);
  files.sort((left, right) => left.localeCompare(right));

  const out: Record<string, string> = {};
  for (const filePath of files) {
    const rel = filePath
      .slice(rootDir.length + 1)
      .split(path.sep)
      .join("/");
    out[rel] = sha256File(filePath);
  }
  return out;
}

function buildFixtureOptions(tmpDir: string): UiBundleOptions {
  const corpusDir = path.join(tmpDir, "corpus");
  const indexDir = path.join(tmpDir, "index");
  const outputsGenesisDir = path.join(tmpDir, "outputs", "genesis");
  const renderDir = path.join(tmpDir, "render");
  const bundleDir = path.join(tmpDir, "ui-bundles", "latest");
  const uiPublicDir = path.join(tmpDir, "packages", "ui", "public", "data", "latest");
  const sourceManifestPath = path.join(tmpDir, "manifest.json");

  const wordTraceA = loadFixture("valid.word_trace.json");
  const wordTraceB = {
    ...wordTraceA,
    ref: {
      ...(wordTraceA.ref as Record<string, unknown>),
      verse: 2
    },
    ref_key: "Genesis/1/2/1",
    canonical_hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  };

  const verseTreeA = loadFixture("valid.verse_phrase_tree.json");
  const verseTreeB = {
    ...verseTreeA,
    ref_key: "Genesis/1/2",
    ref: {
      ...(verseTreeA.ref as Record<string, unknown>),
      verse: 2
    }
  };

  const roleA = loadFixture("valid.word_phrase_role.json");
  const roleB = {
    ...roleA,
    ref_key: "Genesis/1/2"
  };

  writeJsonl(path.join(corpusDir, "word_traces.jsonl"), [wordTraceA, wordTraceB]);
  writeJsonl(path.join(corpusDir, "verse_phrase_trees.jsonl"), [verseTreeA, verseTreeB]);
  writeJsonl(path.join(corpusDir, "word_phrase_roles.jsonl"), [roleA, roleB]);

  fs.mkdirSync(indexDir, { recursive: true });
  fs.writeFileSync(
    path.join(indexDir, "motif_index.json"),
    `${JSON.stringify({ schema_version: 1, motifs: [] })}\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(indexDir, "skeleton_to_occurrences.bin"),
    `${JSON.stringify({ schema_version: 1, skeleton_to_occurrences: {} })}\n`,
    "utf8"
  );

  fs.mkdirSync(outputsGenesisDir, { recursive: true });
  writeJsonl(path.join(outputsGenesisDir, "render_paraphrase.jsonl"), [
    { ref_key: "Genesis/1/1", style: "strict", text: "strict one" },
    { ref_key: "Genesis/1/1", style: "poetic", text: "poetic one" },
    { ref_key: "Genesis/1/2", style: "strict", text: "strict two" }
  ]);

  fs.mkdirSync(renderDir, { recursive: true });
  fs.writeFileSync(path.join(renderDir, "README.md"), "render docs\n", "utf8");

  fs.writeFileSync(
    sourceManifestPath,
    `${JSON.stringify(
      {
        schema_version: 1,
        corpus: "torah-corpus",
        artifact_set: "fixture",
        generated_at: "2026-02-15T00:00:00.000Z",
        version_contract: {
          trace_version: "1.1.0",
          semantics_version: "1.1.0",
          render_version: "1.1.0"
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return {
    wordTracesPath: path.join(corpusDir, "word_traces.jsonl"),
    versePhraseTreesPath: path.join(corpusDir, "verse_phrase_trees.jsonl"),
    wordPhraseRolesPath: path.join(corpusDir, "word_phrase_roles.jsonl"),
    sourceManifestPath,
    bundleDir,
    uiPublicDir,
    indexDir,
    outputsGenesisDir,
    renderDir,
    skipCopy: false
  };
}

describe("ui bundle runtime", () => {
  it("parses command and options", () => {
    const parsed = parseArgs([
      "verify",
      "--word-traces=/tmp/word.jsonl",
      "--verse-phrase-trees=/tmp/verse.jsonl",
      "--word-phrase-roles=/tmp/roles.jsonl",
      "--bundle-dir=/tmp/out",
      "--ui-public-dir=/tmp/ui",
      "--skip-copy=true"
    ]);

    expect(parsed.command).toBe("verify");
    expect(parsed.opts.wordTracesPath).toBe("/tmp/word.jsonl");
    expect(parsed.opts.versePhraseTreesPath).toBe("/tmp/verse.jsonl");
    expect(parsed.opts.wordPhraseRolesPath).toBe("/tmp/roles.jsonl");
    expect(parsed.opts.bundleDir).toBe("/tmp/out");
    expect(parsed.opts.uiPublicDir).toBe("/tmp/ui");
    expect(parsed.opts.skipCopy).toBe(true);
  });

  it("builds deterministic bundle and verifies checksums", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-bundle-runtime-test-"));
    const opts = buildFixtureOptions(tmpDir);

    const firstRun = await runBundleCommand(opts);
    expect(firstRun.wordChunks).toBe(2);
    expect(firstRun.verseChunks).toBe(2);
    expect(firstRun.paraphraseChunks).toBe(2);

    const bundleManifestPath = path.join(opts.bundleDir, "ui-manifest.json");
    const uiPublicManifestPath = path.join(opts.uiPublicDir, "ui-manifest.json");
    expect(fs.existsSync(bundleManifestPath)).toBe(true);
    expect(fs.existsSync(uiPublicManifestPath)).toBe(true);
    expect(
      fs.existsSync(path.join(opts.bundleDir, "optional", "index", "skeleton_to_occurrences.bin"))
    ).toBe(true);

    const firstManifest = fs.readFileSync(bundleManifestPath, "utf8");
    const firstHashes = collectFileHashes(opts.bundleDir);

    await runBundleCommand(opts);
    expect(fs.readFileSync(bundleManifestPath, "utf8")).toBe(firstManifest);
    expect(collectFileHashes(opts.bundleDir)).toEqual(firstHashes);

    await expect(verifyBundleCommand(opts)).resolves.toMatchObject({
      checkedFiles: expect.any(Number),
      mirrorChecked: true
    });

    const chunkToTamper = Object.keys(firstHashes).find((key) => key.startsWith("chunks/words/"));
    if (!chunkToTamper) {
      throw new Error("Expected at least one words chunk in bundle output");
    }
    fs.appendFileSync(path.join(opts.bundleDir, chunkToTamper), "tamper", "utf8");

    await expect(verifyBundleCommand(opts)).rejects.toThrow(/checksum mismatch/);
  });
});
