import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizePlanDataset } from "../../src/layers/metadata/normalizePlanDataset";
import {
  validatePlanDataset,
  type Torah1YPlanDataset
} from "../../src/layers/metadata/validatePlanDataset";

const DATASET_PATH = path.resolve(
  process.cwd(),
  "src",
  "layers",
  "metadata",
  "datasets",
  "torah_1y_plan.v1.json"
);

function loadDataset(): unknown {
  return JSON.parse(fs.readFileSync(DATASET_PATH, "utf8")) as unknown;
}

function makeToyDatasetUnsorted(): Torah1YPlanDataset {
  return {
    dataset_id: "torah_1y_plan.v1",
    scope: "torah",
    cycle: "one_year",
    parashot: [
      {
        parasha_id: "BETA-PARASHA",
        parasha_name_he: "בטא",
        parasha_name_en: "Beta",
        range: { start: "Genesis/1/15", end: "Genesis/1/28" },
        aliyot: [
          { aliyah_index: 7, range: { start: "Genesis/1/27", end: "Genesis/1/28" } },
          { aliyah_index: 6, range: { start: "Genesis/1/25", end: "Genesis/1/26" } },
          { aliyah_index: 5, range: { start: "Genesis/1/23", end: "Genesis/1/24" } },
          { aliyah_index: 4, range: { start: "Genesis/1/21", end: "Genesis/1/22" } },
          { aliyah_index: 3, range: { start: "Genesis/1/19", end: "Genesis/1/20" } },
          { aliyah_index: 2, range: { start: "Genesis/1/17", end: "Genesis/1/18" } },
          { aliyah_index: 1, range: { start: "Genesis/1/15", end: "Genesis/1/16" } }
        ]
      },
      {
        parasha_id: "Alpha-Parasha",
        parasha_name_he: "אלפא",
        parasha_name_en: "Alpha",
        range: { start: "Genesis/1/1", end: "Genesis/1/14" },
        aliyot: [
          { aliyah_index: 7, range: { start: "Genesis/1/13", end: "Genesis/1/14" } },
          { aliyah_index: 6, range: { start: "Genesis/1/11", end: "Genesis/1/12" } },
          { aliyah_index: 5, range: { start: "Genesis/1/9", end: "Genesis/1/10" } },
          { aliyah_index: 4, range: { start: "Genesis/1/7", end: "Genesis/1/8" } },
          { aliyah_index: 3, range: { start: "Genesis/1/5", end: "Genesis/1/6" } },
          { aliyah_index: 2, range: { start: "Genesis/1/3", end: "Genesis/1/4" } },
          { aliyah_index: 1, range: { start: "Genesis/1/1", end: "Genesis/1/2" } }
        ]
      }
    ]
  };
}

describe("metadata plan dataset normalize + validate", () => {
  it("is idempotent across repeated normalize + validate runs", () => {
    const normalizedA = normalizePlanDataset(loadDataset());
    expect(() => validatePlanDataset(normalizedA)).not.toThrow();

    const normalizedB = normalizePlanDataset(normalizedA);
    expect(() => validatePlanDataset(normalizedB)).not.toThrow();

    expect(JSON.stringify(normalizedA)).toBe(JSON.stringify(normalizedB));
    expect(normalizedA.parashot.every((entry) => !entry.parasha_id.includes("-"))).toBe(true);
  });

  it("canonicalizes slugs and sorts parashot + aliyot deterministically", () => {
    const normalized = normalizePlanDataset(makeToyDatasetUnsorted());

    expect(normalized.parashot[0]?.parasha_id).toBe("alpha_parasha");
    expect(normalized.parashot[1]?.parasha_id).toBe("beta_parasha");

    expect(normalized.parashot[0]?.aliyot.map((entry) => entry.aliyah_index)).toEqual([
      1, 2, 3, 4, 5, 6, 7
    ]);
    expect(normalized.parashot[1]?.aliyot.map((entry) => entry.aliyah_index)).toEqual([
      1, 2, 3, 4, 5, 6, 7
    ]);
  });

  it("fails fast with precise path when a range is outside parasha bounds", () => {
    const normalized = normalizePlanDataset(loadDataset());
    normalized.parashot[0]!.aliyot[0]!.range.start = "Genesis/7/1";

    expect(() => validatePlanDataset(normalized)).toThrow(
      /^metadata plan dataset invalid at \$\.parashot\[0\]\.aliyot\[0\]\.range:/
    );
  });

  it("fails fast with precise path when parasha ordering overlaps", () => {
    const normalized = normalizePlanDataset(loadDataset());
    normalized.parashot[1]!.range.start = normalized.parashot[0]!.range.end;

    expect(() => validatePlanDataset(normalized)).toThrow(
      /^metadata plan dataset invalid at \$\.parashot\[1\]\.range\.start:/
    );
  });
});
