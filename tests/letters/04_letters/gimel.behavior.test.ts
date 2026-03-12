import { describe, expect, it } from "vitest";
import { createTokenDispatcher } from "@ref/dispatch/dispatcher";
import { createInitialState } from "@ref/state/state";

describe("gimel behavior", () => {
  it("advances through a shoulder node with cont -> carry -> cont", () => {
    const dispatcher = createTokenDispatcher({
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
});
