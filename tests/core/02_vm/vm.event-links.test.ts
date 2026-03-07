import { describe, expect, it } from "vitest";
import { applyEventLinks } from "@ref/state/eventLinks";
import { createHandle } from "@ref/state/handles";
import { createInitialState, type VMEvent } from "@ref/state/state";

describe("vm event links", () => {
  it("keeps current link synthesis and ignores retired he declaration events", () => {
    const state = createInitialState();
    for (const id of ["a", "b", "c", "d", "e", "f", "g"]) {
      state.handles.set(id, createHandle(id, "entity"));
    }

    const events: VMEvent[] = [
      { type: "alias", tau: 1, data: { left: "a", right: "b" } },
      { type: "endpoint", tau: 1, data: { endpoint: "c", id: "d" } },
      { type: "declare", tau: 1, data: { target: "e", id: "f" } },
      { type: "declare_pin", tau: 1, data: { declaration: "e", pin: "g" } },
      { type: "declare_alias", tau: 1, data: { declaration: "e", referent: "a" } }
    ];

    applyEventLinks(state, events);

    expect(state.links).toEqual([
      { from: "a", to: "b", label: "transport" },
      { from: "b", to: "a", label: "transport" },
      { from: "c", to: "d", label: "endpoint" }
    ]);
  });
});
