import { describe, expect, it } from "vitest";
import {
  parseAnchoredParaphraseLine,
  parseAnchorEvidencePointer
} from "../../packages/ui/src/pages/GenesisRephrase";
import type { RenderOutputRecord } from "../../packages/ui/src/lib/contracts";

describe("genesis rephrase anchor parser", () => {
  it("parses compact pointer strings with event spans", () => {
    const pointer = parseAnchorEvidencePointer("trace:Genesis/1/1/1#e2-4");

    expect(pointer).toEqual({
      kind: "trace",
      refKey: "Genesis/1/1/1",
      eventStart: 2,
      eventEnd: 4
    });
  });

  it("extracts anchor pointers from metadata mapping", () => {
    const record: RenderOutputRecord = {
      ref_key: "Genesis/1/1",
      style: "strict",
      text: "Seed line [[a1]] and expansion [[a2]].",
      metadata: {
        anchor_map: {
          a1: {
            ref_key: "Genesis/1/1",
            evidence: ["verse:Genesis/1/1", "word:Genesis/1/1/1", "trace:Genesis/1/1/1#e0-3"]
          },
          a2: {
            ref_key: "Genesis/1/1",
            evidence: [{ kind: "trace", ref_key: "Genesis/1/1/2", event_span: [1, 1] }]
          }
        }
      }
    };

    const parsed = parseAnchoredParaphraseLine(record);

    expect(parsed.anchors).toHaveLength(2);
    expect(parsed.anchors[0]?.anchorId).toBe("a1");
    expect(parsed.anchors[0]?.pointers).toEqual([
      {
        kind: "verse",
        refKey: "Genesis/1/1",
        eventStart: null,
        eventEnd: null
      },
      {
        kind: "word",
        refKey: "Genesis/1/1/1",
        eventStart: null,
        eventEnd: null
      },
      {
        kind: "trace",
        refKey: "Genesis/1/1/1",
        eventStart: 0,
        eventEnd: 3
      }
    ]);
    expect(parsed.anchors[1]?.anchorId).toBe("a2");
    expect(parsed.anchors[1]?.pointers).toEqual([
      {
        kind: "trace",
        refKey: "Genesis/1/1/2",
        eventStart: 1,
        eventEnd: 1
      }
    ]);
  });
});
