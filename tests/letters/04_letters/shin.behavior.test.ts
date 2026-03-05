import { describe, expect, it } from "vitest";
import { runProgram } from "@ref/vm/vm";

describe("shin behavior", () => {
  it("activates the right branch for shin-dot right", () => {
    const state = runProgram("שׁ");
    const shinId = state.vm.A[state.vm.A.length - 1];
    const handle = state.handles.get(shinId);
    const focus = handle?.meta.base as string;
    expect(handle?.meta.active).toBe("right");
    expect(handle?.meta.fork_direction).toBe("external");
    expect(state.handles.has(handle?.meta.left)).toBe(true);
    expect(state.handles.has(handle?.meta.right)).toBe(true);
    expect(state.handles.has(handle?.meta.spine)).toBe(true);
    expect(state.cont.has(`${focus}->${handle?.meta.left}`)).toBe(true);
    expect(state.cont.has(`${focus}->${handle?.meta.right}`)).toBe(true);
    expect(state.cont.has(`${focus}->${handle?.meta.spine}`)).toBe(true);
    expect(state.sub.size).toBe(0);
  });

  it("defaults to right branch for plain shin", () => {
    const state = runProgram("ש");
    const shinId = state.vm.A[state.vm.A.length - 1];
    const handle = state.handles.get(shinId);
    expect(handle?.meta.active).toBe("right");
    expect(handle?.meta.fork_direction).toBe("external");
  });

  it("uses internal fork for sin-dot left without samekh discharge edges", () => {
    const state = runProgram("שׂ");
    const shinId = state.vm.A[state.vm.A.length - 1];
    const focus = state.handles.get(shinId);
    const activeChild = focus?.meta.active_child as string;
    const forkChildren = focus?.meta.fork_children as string[];

    expect(focus?.meta.fork_direction).toBe("internal");
    expect(focus?.meta.active_branch).toBe("left");
    expect(typeof activeChild).toBe("string");
    expect(forkChildren.length).toBe(3);
    expect(state.sub.has(`${shinId}->${forkChildren[0]}`)).toBe(true);
    expect(state.sub.has(`${shinId}->${forkChildren[1]}`)).toBe(true);
    expect(state.sub.has(`${shinId}->${forkChildren[2]}`)).toBe(true);
    expect(state.cont.has(`${shinId}->${forkChildren[0]}`)).toBe(false);
    expect(state.cont.has(`${shinId}->${forkChildren[1]}`)).toBe(false);
    expect(state.cont.has(`${shinId}->${forkChildren[2]}`)).toBe(false);
    expect(state.supp.size).toBe(0);
  });
});
