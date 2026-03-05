import { describe, expect, it } from "vitest";
import { runProgram } from "@ref/vm/vm";

describe("shin behavior", () => {
  it("creates three outward continuation ports for shin-dot right", () => {
    const state = runProgram("שׁ");
    const shinEvent = state.vm.H.find((event) => event.type === "shin");
    const focus = shinEvent?.data?.focus as string;
    const spine = shinEvent?.data?.spine as string;
    const left = shinEvent?.data?.left as string;
    const right = shinEvent?.data?.right as string;
    const handle = state.handles.get(focus);

    expect(shinEvent?.data?.direction).toBe("external");
    expect(state.handles.has(spine)).toBe(true);
    expect(state.handles.has(left)).toBe(true);
    expect(state.handles.has(right)).toBe(true);
    expect(state.cont.has(`${focus}->${spine}`)).toBe(true);
    expect(state.cont.has(`${focus}->${left}`)).toBe(true);
    expect(state.cont.has(`${focus}->${right}`)).toBe(true);
    expect(handle?.meta.fork_direction).toBe("external");
    expect(handle?.meta.fork_ports).toEqual([spine, left, right]);
    expect(handle?.meta.active_child).toBeUndefined();
    expect(handle?.meta.active_branch).toBeUndefined();
    expect(state.sub.size).toBe(0);
  });

  it("defaults to external direction for plain shin", () => {
    const state = runProgram("ש");
    const shinEvent = state.vm.H.find((event) => event.type === "shin");
    const focus = shinEvent?.data?.focus as string;
    const handle = state.handles.get(focus);

    expect(shinEvent?.data?.direction).toBe("external");
    expect(handle?.meta.fork_direction).toBe("external");
  });

  it("uses internal sub ports for sin-dot left without supp edges", () => {
    const state = runProgram("שׂ");
    const shinEvent = state.vm.H.find((event) => event.type === "shin");
    const focusId = shinEvent?.data?.focus as string;
    const focus = state.handles.get(focusId);
    const forkPorts = focus?.meta.fork_ports as string[];

    expect(shinEvent?.data?.direction).toBe("internal");
    expect(focus?.meta.fork_direction).toBe("internal");
    expect(focus?.meta.active_child).toBeUndefined();
    expect(focus?.meta.active_branch).toBeUndefined();
    expect(forkPorts.length).toBe(3);
    expect(state.sub.has(`${focusId}->${forkPorts[0]}`)).toBe(true);
    expect(state.sub.has(`${focusId}->${forkPorts[1]}`)).toBe(true);
    expect(state.sub.has(`${focusId}->${forkPorts[2]}`)).toBe(true);
    expect(state.cont.has(`${focusId}->${forkPorts[0]}`)).toBe(false);
    expect(state.cont.has(`${focusId}->${forkPorts[1]}`)).toBe(false);
    expect(state.cont.has(`${focusId}->${forkPorts[2]}`)).toBe(false);
    expect(state.supp.size).toBe(0);
  });
});
