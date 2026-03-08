import { describe, expect, it } from "vitest";
import { createTokenDispatcher } from "@ref/dispatch/dispatcher";
import { createInitialState } from "@ref/state/state";

describe("vav behavior", () => {
  it("advances focus with a single continuation edge and no other semantic edges", () => {
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
          signature: "BASE=ו|MARKS=NONE",
          base: "ו",
          count: 1,
          op_family: "VAV",
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
            token_letter: "ו",
            read_letter: "ו",
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

    expect(newHandleIds).toEqual([wordOut]);
    expect(state.cont).toEqual(new Set([`${initialFocus}->${wordOut}`]));
    expect(state.carry.size).toBe(0);
    expect(state.supp.size).toBe(0);
    expect(state.links).toEqual([]);
  });
});
