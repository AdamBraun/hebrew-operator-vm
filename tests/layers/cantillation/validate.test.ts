import { describe, expect, it } from "vitest";
import { type CantillationIRRecord } from "../../../src/layers/cantillation/schema";
import { CantillationAnchorValidator } from "../../../src/layers/cantillation/validate";

describe("cantillation anchor validation", () => {
  it("accepts gid and gap events when anchor is known in active ref", () => {
    const validator = new CantillationAnchorValidator();
    validator.registerSpineAnchor({
      kind: "gap",
      gapid: "Genesis/1/1#gap:0",
      ref_key: "Genesis/1/1"
    });
    validator.registerSpineAnchor({
      kind: "g",
      gid: "Genesis/1/1#g:0",
      ref_key: "Genesis/1/1"
    });

    const gidEvent: CantillationIRRecord = {
      kind: "cant_event",
      anchor: { kind: "gid", id: "Genesis/1/1#g:0" },
      ref_key: "Genesis/1/1",
      event: {
        type: "TROPE_MARK",
        mark: "TIPCHA",
        class: "DISJ",
        rank: 1
      },
      raw: {
        teamim: ["\u0596"]
      }
    };
    const gapEvent: CantillationIRRecord = {
      kind: "cant_event",
      anchor: { kind: "gap", id: "Genesis/1/1#gap:0" },
      ref_key: "Genesis/1/1",
      event: {
        type: "BOUNDARY",
        op: "CUT",
        rank: 3,
        reason: "SOF_PASUK"
      },
      raw: {
        source: "sof_pasuk_char"
      }
    };

    expect(() => validator.assertEventAnchorExists(gidEvent)).not.toThrow();
    expect(() => validator.assertEventAnchorExists(gapEvent)).not.toThrow();
  });

  it("fails with ref_key, anchor id, and event payload when anchor is missing", () => {
    const validator = new CantillationAnchorValidator();
    validator.registerSpineAnchor({
      kind: "g",
      gid: "Genesis/1/1#g:0",
      ref_key: "Genesis/1/1"
    });

    const missing: CantillationIRRecord = {
      kind: "cant_event",
      anchor: { kind: "gap", id: "Genesis/1/1#gap:9" },
      ref_key: "Genesis/1/1",
      event: {
        type: "BOUNDARY",
        op: "CUT",
        rank: 2,
        reason: "PAUSE"
      },
      raw: {
        source: "test"
      }
    };

    expect(() => validator.assertEventAnchorExists(missing)).toThrow(
      /ref_key='Genesis\/1\/1'.*anchor='Genesis\/1\/1#gap:9'.*event=\{"type":"BOUNDARY","op":"CUT","rank":2,"reason":"PAUSE"\}/
    );
  });

  it("tracks only active ref_key in streaming mode", () => {
    const validator = new CantillationAnchorValidator();
    validator.registerSpineAnchor({
      kind: "g",
      gid: "Genesis/1/1#g:0",
      ref_key: "Genesis/1/1"
    });
    validator.registerSpineAnchor({
      kind: "g",
      gid: "Genesis/1/2#g:0",
      ref_key: "Genesis/1/2"
    });

    const staleRefEvent: CantillationIRRecord = {
      kind: "cant_event",
      anchor: { kind: "gid", id: "Genesis/1/1#g:0" },
      ref_key: "Genesis/1/1",
      event: {
        type: "TROPE_MARK",
        mark: "TIPCHA",
        class: "DISJ",
        rank: 1
      },
      raw: {
        teamim: ["\u0596"]
      }
    };

    expect(() => validator.assertEventAnchorExists(staleRefEvent)).toThrow(
      /does not match active ref_key='Genesis\/1\/2'/
    );
  });
});
