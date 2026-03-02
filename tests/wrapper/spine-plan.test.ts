import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSpineTraversalPlan,
  readSpineTraversalPlanFromJsonl,
  type SpineTraversalStep
} from "../../src/wrapper/stitch/spinePlan";
import { type SpineRecord } from "../../src/spine/schema";

const SPINE_FIXTURE = path.resolve(process.cwd(), "tests", "fixtures", "spine.small.jsonl");

function gap(ref_key: string, gap_index: number): SpineRecord {
  return {
    kind: "gap",
    gapid: `${ref_key}#gap:${String(gap_index)}`,
    ref_key,
    gap_index,
    raw: {
      whitespace: false,
      chars: []
    }
  };
}

function g(ref_key: string, g_index: number, gid?: string): SpineRecord {
  return {
    kind: "g",
    gid: gid ?? `${ref_key}#g:${String(g_index)}`,
    ref_key,
    g_index,
    base_letter: "א",
    marks_raw: {
      niqqud: [],
      teamim: []
    },
    raw: {
      text: "א"
    }
  };
}

function writeSpineJsonl(filePath: string, rows: readonly SpineRecord[]): void {
  const text = rows.map((row) => JSON.stringify(row)).join("\n");
  fs.writeFileSync(filePath, `${text}\n`, "utf8");
}

describe("spine traversal plan", () => {
  it("preserves spine order exactly and handles cross-ref boundaries", async () => {
    const plan = await readSpineTraversalPlanFromJsonl(SPINE_FIXTURE);

    expect(plan.graphemes).toHaveLength(8);
    expect(plan.gaps).toHaveLength(10);
    expect(plan.plan).toHaveLength(18);

    const firstSteps: SpineTraversalStep[] = plan.plan.slice(0, 3);
    expect(firstSteps).toEqual([
      { kind: "gap", gapid: "Genesis/1/1#gap:0" },
      { kind: "g", gid: "Genesis/1/1#g:0" },
      { kind: "gap", gapid: "Genesis/1/1#gap:1" }
    ]);

    const lastRef1Index = plan.plan.findIndex(
      (step) => step.kind === "gap" && step.gapid === "Genesis/1/1#gap:4"
    );
    expect(lastRef1Index).toBeGreaterThanOrEqual(0);
    expect(plan.plan[lastRef1Index + 1]).toEqual({
      kind: "gap",
      gapid: "Genesis/1/2#gap:0"
    });

    expect(plan.gidSet.has("Genesis/1/2#g:3")).toBe(true);
    expect(plan.gapidSet.has("Genesis/1/2#gap:4")).toBe(true);
  });

  it("rejects duplicate gid and duplicate gapid", async () => {
    const ref = "Genesis/1/1";
    await expect(
      buildSpineTraversalPlan([gap(ref, 0), g(ref, 0), gap(ref, 1), g(ref, 1, `${ref}#g:0`)])
    ).rejects.toThrow(/duplicate gid/);

    await expect(buildSpineTraversalPlan([gap(ref, 0), g(ref, 0), gap(ref, 0)])).rejects.toThrow(
      /duplicate gapid/
    );
  });

  it("rejects non-increasing g_index within a ref_key", async () => {
    const ref = "Genesis/1/1";
    await expect(
      buildSpineTraversalPlan([gap(ref, 0), g(ref, 1), gap(ref, 1), g(ref, 0)])
    ).rejects.toThrow(/strictly increasing g_index/);
  });

  it("reads spine JSONL from stream and preserves serialized step order", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spine-plan-streaming-"));
    const spinePath = path.join(tmp, "spine.jsonl");
    const rows: SpineRecord[] = [
      gap("Exodus/1/1", 0),
      g("Exodus/1/1", 0),
      gap("Exodus/1/1", 1),
      g("Exodus/1/1", 1),
      gap("Exodus/1/1", 2),
      gap("Exodus/1/2", 0),
      g("Exodus/1/2", 0),
      gap("Exodus/1/2", 1)
    ];
    writeSpineJsonl(spinePath, rows);

    const plan = await readSpineTraversalPlanFromJsonl(spinePath);
    expect(plan.plan).toEqual([
      { kind: "gap", gapid: "Exodus/1/1#gap:0" },
      { kind: "g", gid: "Exodus/1/1#g:0" },
      { kind: "gap", gapid: "Exodus/1/1#gap:1" },
      { kind: "g", gid: "Exodus/1/1#g:1" },
      { kind: "gap", gapid: "Exodus/1/1#gap:2" },
      { kind: "gap", gapid: "Exodus/1/2#gap:0" },
      { kind: "g", gid: "Exodus/1/2#g:0" },
      { kind: "gap", gapid: "Exodus/1/2#gap:1" }
    ]);
  });
});
