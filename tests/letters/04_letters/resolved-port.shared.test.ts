import { afterEach, describe, expect, it, vi } from "vitest";
import { zayinOp } from "@ref/letters/zayin";
import { hetOp } from "@ref/letters/het";
import * as portBuilders from "@ref/letters/ports";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";

describe("shared resolved-port builder", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes both standalone ז and bridged ח ports through spawnResolvedPort", () => {
    const portSpy = vi.spyOn(portBuilders, "spawnResolvedPort");

    const zayinState = createInitialState();
    zayinOp.bound(zayinState, { args: [zayinState.vm.F], prefs: {} });

    expect(portSpy).toHaveBeenCalledTimes(1);
    expect(portSpy.mock.calls[0]?.[1]).toMatchObject({
      portOf: "Ω",
      prefix: "ז",
      exportToK: true
    });

    const hetState = createInitialState();
    hetState.handles.set("inside", createHandle("inside", "scope"));
    hetState.handles.set("outside", createHandle("outside", "scope"));
    hetState.vm.F = "inside";
    hetState.vm.R = "outside";
    hetOp.bound(hetState, { args: [hetState.vm.F], prefs: {} });

    expect(portSpy).toHaveBeenCalledTimes(3);
    expect(portSpy.mock.calls[1]?.[1]).toMatchObject({
      portOf: "inside",
      prefix: "ז",
      exportToK: false
    });
    expect(portSpy.mock.calls[2]?.[1]).toMatchObject({
      portOf: "outside",
      prefix: "ז",
      exportToK: false
    });
  });
});
