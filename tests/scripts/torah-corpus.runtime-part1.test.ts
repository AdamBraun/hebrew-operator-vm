import { describe, expect, it } from "vitest";
import {
  deriveSignatureNotes,
  extractWordFlow,
  mapRawEventToFlow
} from "@ref/scripts/torahCorpus/runtimePart1";

describe("torah corpus runtimePart1", () => {
  it("does not infer pinned he modes from mappiq signatures", () => {
    expect(
      deriveSignatureNotes({
        base: "ה",
        rosh: [],
        toch: ["mappiq"],
        sof: []
      })
    ).toEqual([]);
  });

  it("derives gimel as a shoulder operator without a transfer vm event", () => {
    const flow = extractWordFlow([
      {
        read_op: "ג",
        OStackLength: 0,
        tauAfter: 7,
        events: []
      }
    ]);

    expect(flow.flow_compact).toEqual(["GIMEL.SHOULDER"]);
    expect(flow.trace_events).toEqual([
      {
        kind: "GIMEL.SHOULDER",
        index: 0,
        tau: 7,
        source: "derived_operator",
        payload: {}
      }
    ]);
    expect(flow.one_liner).toBe("ג shoulder continuation");
  });

  it("maps head_with_leg events for he without legacy mode payloads", () => {
    const mapped = mapRawEventToFlow(
      {
        type: "head_with_leg",
        data: {
          letter: "ה",
          source: "X",
          head: "h",
          adjunct: "leg",
          focus: "h",
          exported_adjuncts: ["leg"],
          edges: [
            { kind: "head_of", from: "h", to: "X" },
            { kind: "cont", from: "X", to: "h" },
            { kind: "supp", from: "h", to: "X" },
            { kind: "cont", from: "h", to: "leg" },
            { kind: "supp", from: "leg", to: "h" }
          ],
          resolved: true
        }
      },
      { read_op: "ה" }
    );

    expect(mapped).toEqual({
      op_family: "HE.HEAD_WITH_LEG",
      params_summary: "resolved head with detached leg",
      trace_source: "vm_event",
      payload: {
        source: "X",
        head: "h",
        adjunct: "leg",
        focus: "h",
        exported_adjuncts: ["leg"],
        edges: [
          { kind: "head_of", from: "h", to: "X" },
          { kind: "cont", from: "X", to: "h" },
          { kind: "supp", from: "h", to: "X" },
          { kind: "cont", from: "h", to: "leg" },
          { kind: "supp", from: "leg", to: "h" }
        ],
        resolved: true
      }
    });
  });

  it("ignores retired he declaration mode events", () => {
    const mapped = mapRawEventToFlow(
      {
        type: "declare_pin",
        data: { declaration: "d", pin: "p" }
      },
      { read_op: "ה" }
    );

    expect(mapped).toBeNull();
  });
});
