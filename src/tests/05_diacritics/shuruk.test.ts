import { describe, expect, it } from "vitest";
import { BOT_ID } from "../../state/handles";
import { createInitialState } from "../../state/state";
import { runProgram } from "../../vm/vm";

describe("shuruk carrier activation", () => {
  it("vav + shuruk sets carrier_active", () => {
    const state = runProgram("וּ", createInitialState());
    const bot = state.handles.get(BOT_ID);
    expect(bot?.meta.carrier_active).toBe(true);
  });

  it("vav without dot does not set carrier_active", () => {
    const state = runProgram("ו", createInitialState());
    const bot = state.handles.get(BOT_ID);
    expect(bot?.meta.carrier_active).toBeUndefined();
  });

  it("dagesh on non-vav does not set carrier_active", () => {
    const state = runProgram("בּ", createInitialState());
    const bot = state.handles.get(BOT_ID);
    expect(bot?.meta.carrier_active).toBeUndefined();
  });
});
