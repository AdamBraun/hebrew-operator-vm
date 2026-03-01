import { describe, expect, it } from "vitest";
import { computeLayoutDatasetDigest, computeLayoutDigest } from "../../../src/layers/layout/hash";

describe("layout digest", () => {
  const baseArgs = {
    spineDigest: "a".repeat(64),
    layoutDatasetDigest: "b".repeat(64),
    layoutLayerCodeDigest: "layout-module@1.0.0",
    layoutConfig: {
      jsonl_trailing_newline: true,
      jsonl_indent: 0
    }
  };

  it("is deterministic for identical digest inputs", () => {
    const a = computeLayoutDigest(baseArgs);
    const b = computeLayoutDigest(baseArgs);
    expect(a).toBe(b);
  });

  it("changes when spineDigest changes", () => {
    const baseline = computeLayoutDigest(baseArgs);
    const changed = computeLayoutDigest({
      ...baseArgs,
      spineDigest: "c".repeat(64)
    });
    expect(changed).not.toBe(baseline);
  });

  it("changes when layoutDatasetDigest changes", () => {
    const baseline = computeLayoutDigest(baseArgs);
    const changed = computeLayoutDigest({
      ...baseArgs,
      layoutDatasetDigest: "d".repeat(64)
    });
    expect(changed).not.toBe(baseline);
  });

  it("changes when layoutLayerCodeDigest changes", () => {
    const baseline = computeLayoutDigest(baseArgs);
    const changed = computeLayoutDigest({
      ...baseArgs,
      layoutLayerCodeDigest: "layout-module@1.0.1"
    });
    expect(changed).not.toBe(baseline);
  });

  it("changes when layoutConfig changes", () => {
    const baseline = computeLayoutDigest(baseArgs);
    const changed = computeLayoutDigest({
      ...baseArgs,
      layoutConfig: {
        ...baseArgs.layoutConfig,
        jsonl_indent: 2
      }
    });
    expect(changed).not.toBe(baseline);
  });

  it("uses stable key ordering for layoutConfig objects", () => {
    const a = computeLayoutDigest({
      ...baseArgs,
      layoutConfig: {
        jsonl_indent: 0,
        jsonl_trailing_newline: true
      }
    });
    const b = computeLayoutDigest({
      ...baseArgs,
      layoutConfig: {
        jsonl_trailing_newline: true,
        jsonl_indent: 0
      }
    });
    expect(a).toBe(b);
  });

  it("computes dataset digest from raw file bytes deterministically", () => {
    const bytes = Buffer.from('{"dataset_id":"torah_layout_breaks.v1"}\n', "utf8");
    const a = computeLayoutDatasetDigest(bytes);
    const b = computeLayoutDatasetDigest(bytes);
    const c = computeLayoutDatasetDigest('{"dataset_id":"torah_layout_breaks.v1"}\n');

    expect(a).toBe(b);
    expect(c).toBe(a);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects invalid hash inputs", () => {
    expect(() =>
      computeLayoutDigest({
        ...baseArgs,
        spineDigest: "XYZ"
      })
    ).toThrow(/spineDigest/);
    expect(() =>
      computeLayoutDigest({
        ...baseArgs,
        layoutDatasetDigest: "XYZ"
      })
    ).toThrow(/layoutDatasetDigest/);
    expect(() =>
      computeLayoutDigest({
        ...baseArgs,
        layoutLayerCodeDigest: ""
      })
    ).toThrow(/layoutLayerCodeDigest/);
    expect(() =>
      computeLayoutDigest({
        ...baseArgs,
        layoutConfig: [] as unknown as Record<string, unknown>
      })
    ).toThrow(/layoutConfig/);
  });
});
