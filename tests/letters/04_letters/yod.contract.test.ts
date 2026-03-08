import { describe, expect, it } from "vitest";
import { yodOp } from "@ref/letters/yod";
import { BOT_ID, createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";

describe("yod contract", () => {
  it("meta is well-formed", () => {
    expect(yodOp.meta.arity_req).toBeTypeOf("number");
    expect(yodOp.meta.arity_opt).toBeTypeOf("number");
    expect(yodOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(yodOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(yodOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("allocates a cont-only pin, exports it, and leaves focus advancement to the caller", () => {
    const state = createInitialState();
    state.handles.set("X", createHandle("X", "scope"));
    state.vm.F = "X";
    state.vm.K = ["X", BOT_ID];
    const focusBefore = state.vm.F;
    const baselineHandleIds = new Set(state.handles.keys());
    const { cons } = yodOp.bound(state, { args: [focusBefore], prefs: {} });
    const freshHandleIds = Array.from(state.handles.keys()).filter(
      (id) => !baselineHandleIds.has(id)
    );

    expect(freshHandleIds).toHaveLength(1);
    const [pinId] = freshHandleIds;
    expect(pinId).toBeDefined();
    expect(Array.from(state.cont)).toEqual([`${focusBefore}->${pinId}`]);
    expect(Array.from(state.carry)).toEqual([]);
    expect(Array.from(state.supp)).toEqual([]);

    const { h, r, export_handle, advance_focus } = yodOp.seal(state, cons);

    expect(h).toBe(pinId);
    expect(export_handle).toBe(pinId);
    expect(advance_focus).toBe(false);
    expect(r).toBe(BOT_ID);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.get(h)?.meta).toMatchObject({
      pinOf: focusBefore,
      selectable_pin: 1
    });
    expect(state.vm.H.at(-1)).toMatchObject({
      type: "pin",
      data: {
        letter: "י",
        anchor: focusBefore,
        pin: pinId,
        exported: pinId,
        focus_before: focusBefore,
        focus_after: focusBefore,
        focus_unchanged: true,
        note: "focus remains unchanged",
        edges: [{ kind: "cont", from: focusBefore, to: pinId }]
      }
    });
  });
});
