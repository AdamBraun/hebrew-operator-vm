import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  attachNiqqud,
  loadNiqqudIndex,
  type AttachedNiqqudPayload
} from "../../src/wrapper/stitch";

const NIQQUD_FIXTURE = path.resolve(process.cwd(), "tests", "fixtures", "niqqud.ir.expected.jsonl");

function readAttachedNiqqud(value: unknown): AttachedNiqqudPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected niqqud payload object");
  }
  const payload = value as Record<string, unknown>;
  if (!("mods" in payload) || !("unhandled" in payload) || !("flags" in payload)) {
    throw new Error("missing niqqud payload fields");
  }
  return payload as unknown as AttachedNiqqudPayload;
}

describe("wrapper stitch niqqud", () => {
  it("joins by gid and attaches matching niqqud payload", async () => {
    const index = await loadNiqqudIndex(NIQQUD_FIXTURE);
    const niqqudRow = index.get("Genesis/1/1#g:1");
    expect(niqqudRow).toBeDefined();

    const op = {
      gid: "Genesis/1/1#g:1",
      op_kind: "ך",
      modifiers: {
        existing: true
      }
    };

    const stitched = attachNiqqud(op, niqqudRow);
    const attached = readAttachedNiqqud((stitched.modifiers as Record<string, unknown>).niqqud);

    expect(attached.mods.classes).toEqual(["QAMATS", "DAGESH_SHURUK_DOT"]);
    expect(attached.unhandled).toEqual([]);
    expect(attached.flags).toEqual({ empty: false, ambiguous: false });
    expect((stitched.modifiers as Record<string, unknown>).existing).toBe(true);
  });

  it("is safe when no niqqud row is present and attaches empty modifiers", async () => {
    const index = await loadNiqqudIndex(NIQQUD_FIXTURE);
    const missingGid = "Genesis/9/9#g:0";
    expect(index.has(missingGid)).toBe(false);

    const stitched = attachNiqqud({ gid: missingGid, op_kind: "X" }, index.get(missingGid));
    const attached = readAttachedNiqqud((stitched.modifiers as Record<string, unknown>).niqqud);

    expect(attached.mods.classes).toEqual([]);
    expect(attached.mods.features).toEqual({
      hasDagesh: false,
      hasShva: false,
      vowelCount: 0
    });
    expect(attached.unhandled).toEqual([]);
    expect(attached.flags).toEqual({ empty: true, ambiguous: false });
  });
});
