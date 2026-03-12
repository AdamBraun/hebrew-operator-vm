import { describe, expect, it } from "vitest";
import { createTokenDispatcher } from "@ref/dispatch/dispatcher";
import { gimelOp } from "@ref/letters/gimel";
import { createInitialState } from "@ref/state/state";

function createSingleGimelDispatcher() {
  return createTokenDispatcher({
    schema_version: 1,
    source: { registry_path: "test", registry_sha256: null },
    semantics: {
      definitions_path: "test",
      schema_version: null,
      semver: "0.0.0-test",
      definitions_sha256: "test"
    },
    compile_policy: {
      illegal_combinations: "error",
      unknown_marks: "error",
      orthographic_noise: "strip"
    },
    stats: {
      tokens_total: 1,
      warning_count: 0,
      warning_by_code: {}
    },
    tokens: {
      "1": {
        token_id: 1,
        signature: "BASE=ג|MARKS=NONE",
        base: "ג",
        count: 1,
        op_family: "GIMEL",
        modifiers: [],
        raw_marks: [],
        derived: {
          rosh: [],
          toch: [],
          sof: [],
          dot_kind: "none",
          inside_dot_kind: "none",
          modes: [],
          ignored_marks: []
        },
        execution_plan: [],
        event_contract: [],
        warnings: [],
        runtime: {
          token_letter: "ג",
          read_letter: "ג",
          shape_letter: null,
          shape_effect_scope: null,
          rosh_branch: null,
          letter_mode_forced: null,
          has_shuruk: false,
          should_harden: false,
          sof_modifiers: []
        }
      }
    }
  });
}

function splitEdge(edge: string): [string, string] {
  return edge.split("->") as [string, string];
}

describe("gimel behavior", () => {
  it("advances through a shoulder node with cont -> carry -> cont", () => {
    const dispatcher = createSingleGimelDispatcher();
    const state = createInitialState();
    const initialFocus = state.vm.F;
    const initialHandleIds = new Set(state.handles.keys());

    dispatcher.apply(1, state, { isWordFinal: true });

    const wordOut = state.vm.F;
    const newHandleIds = Array.from(state.handles.keys()).filter((id) => !initialHandleIds.has(id));
    const incomingCont = Array.from(state.cont).filter((edge) => edge.endsWith(`->${wordOut}`));

    expect(incomingCont).toHaveLength(1);
    const shoulder = incomingCont[0]?.split("->")[0] ?? "";
    expect(new Set(newHandleIds)).toEqual(new Set([shoulder, wordOut]));
    expect(state.vm.F).toBe(wordOut);
    expect(state.cont).toEqual(
      new Set([`${initialFocus}->${shoulder}`, `${shoulder}->${wordOut}`])
    );
    expect(state.carry).toEqual(new Set([`${initialFocus}->${shoulder}`]));
    expect(state.head_of.size).toBe(0);
    expect(state.sub.size).toBe(0);
    expect(state.supp.size).toBe(0);
    expect(state.handles.get(shoulder)?.kind).toBe("scope");
    expect(state.handles.get(wordOut)?.kind).toBe("scope");
    expect(state.handles.get(shoulder)?.meta).toEqual({});
    expect(state.handles.get(wordOut)?.meta).toEqual({});
    expect(state.links).toEqual([]);
    expect(state.vm.H).toEqual([]);
  });

  it("emits exactly the intended shoulder topology and nothing else", () => {
    const dispatcher = createSingleGimelDispatcher();
    const state = createInitialState();
    const F0 = state.vm.F;
    const initialHandleIds = new Set(state.handles.keys());
    const initialCont = new Set(state.cont);
    const initialCarry = new Set(state.carry);
    const initialSupp = new Set(state.supp);
    const initialK = [...state.vm.K];
    const initialA = [...state.vm.A];
    const initialBoundaries = state.boundaries.length;
    const initialRules = state.rules.length;
    const initialLinks = state.links.length;
    const initialEvents = state.vm.H.length;

    const probeState = createInitialState();
    const selected = gimelOp.select(probeState);
    const { cons } = gimelOp.bound(selected.S, selected.ops);
    const sealResult = gimelOp.seal(selected.S, cons);

    expect("export_handle" in sealResult).toBe(false);

    dispatcher.apply(1, state, { isWordFinal: true });

    const F1 = state.vm.F;
    const newHandleIds = Array.from(state.handles.keys()).filter((id) => !initialHandleIds.has(id));
    const newCont = Array.from(state.cont).filter((edge) => !initialCont.has(edge));
    const newCarry = Array.from(state.carry).filter((edge) => !initialCarry.has(edge));
    const newSupp = Array.from(state.supp).filter((edge) => !initialSupp.has(edge));

    expect(newHandleIds).toHaveLength(2);
    expect(newCont).toHaveLength(2);
    expect(newCarry).toHaveLength(1);
    expect(newSupp).toHaveLength(0);

    const [carrySource, M] = splitEdge(newCarry[0] as string);
    expect(carrySource).toBe(F0);
    expect(newHandleIds).toContain(M);
    expect(newHandleIds).toContain(F1);
    expect(M).not.toBe(F1);
    expect(F1).not.toBe(F0);

    expect(newCont).toContain(`${F0}->${M}`);
    expect(newCont).toContain(`${M}->${F1}`);
    expect(state.vm.F).toBe(F1);
    expect(state.carry.has(`${F0}->${F1}`)).toBe(false);
    expect(state.supp.size).toBe(0);
    expect(state.head_of.size).toBe(0);
    expect(state.sub.size).toBe(0);
    expect(Object.keys(state.adjuncts)).toEqual([]);
    expect(state.boundaries.length).toBe(initialBoundaries);
    expect(state.rules.length).toBe(initialRules);
    expect(state.links.length).toBe(initialLinks);
    expect(state.vm.H.length).toBe(initialEvents);
    expect(state.vm.A).toEqual(initialA);
    expect(state.vm.K).toEqual([...initialK, F1]);
    expect(state.handles.get(M)?.kind).toBe("scope");
    expect(state.handles.get(F1)?.kind).toBe("scope");
    expect(state.handles.get(M)?.meta).toEqual({});
    expect(state.handles.get(F1)?.meta).toEqual({});
  });
});
