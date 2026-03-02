import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBuildLayerNiqqud } from "../../src/cli/build-layer-niqqud";
import { parseNiqqudIRJsonl } from "../../src/layers/niqqud/schema";

type WarningRow = {
  gid: string;
  ref_key: string;
  g_index: number;
  type: string;
  detail: string;
};

type StatsRow = {
  unhandledFrequency: Record<string, number>;
  warningTypeFrequency: Record<string, number>;
};

function writeUnhandledFixture(tmpRoot: string): { spinePath: string } {
  const digest = "d".repeat(64);
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
      marks_raw: { niqqud: ["\u05BD"], teamim: [] },
      raw: { text: "אֽ" }
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

  return { spinePath };
}

describe("niqqud extractor unhandled marks", () => {
  it("keeps unknown marks non-fatal, emits warnings, and updates stats", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "niqqud-unhandled-fixture-"));
    const { spinePath } = writeUnhandledFixture(tmp);
    const outCache = path.join(tmp, "outputs", "cache", "niqqud");

    const run = await runBuildLayerNiqqud([
      "--spine",
      spinePath,
      "--out",
      outCache,
      "--strict=true",
      "--code-fingerprint",
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    ]);

    const rows = parseNiqqudIRJsonl(fs.readFileSync(run.niqqudIrPath, "utf8"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.unhandled).toEqual(["\u05BD"]);

    const warnings = fs
      .readFileSync(run.warningsPath ?? "", "utf8")
      .split(/\r?\n/u)
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as WarningRow);

    expect(warnings.some((warning) => warning.type === "UNHANDLED_MARK")).toBe(true);

    const stats = JSON.parse(fs.readFileSync(run.statsPath ?? "", "utf8")) as StatsRow;
    expect(stats.unhandledFrequency["\u05BD"]).toBe(1);
    expect(stats.warningTypeFrequency.UNHANDLED_MARK).toBeGreaterThan(0);
  });
});
