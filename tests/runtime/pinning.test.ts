import { describe, expect, it } from "vitest";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { isPinned, listPinned, pinHandle } from "@ref/state/pinning";

describe("state pinning helpers", () => {
  it("pins an existing handle and reports it as pinned", () => {
    const state = createInitialState();
    state.handles.set("h:1", createHandle("h:1", "entity"));

    pinHandle(state, "h:1");

    expect(isPinned(state, "h:1")).toBe(true);
    expect(listPinned(state)).toEqual(["h:1"]);
    expect(state.handles.get("h:1")?.meta?.pinned).toBe(true);
  });

  it("returns false for unknown handles and keeps list deterministic", () => {
    const state = createInitialState();
    state.handles.set("z", createHandle("z", "entity"));
    state.handles.set("a", createHandle("a", "entity"));

    pinHandle(state, "z");
    pinHandle(state, "a");

    expect(isPinned(state, "missing")).toBe(false);
    expect(listPinned(state)).toEqual(["a", "z"]);
  });
});
