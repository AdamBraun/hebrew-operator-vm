import { describe, expect, it } from "vitest";
import { createTokenDispatcher } from "@ref/dispatch/dispatcher";
import { createInitialState } from "@ref/state/state";

describe("compiled token letter-mode validation", () => {
  it("rejects legacy forced he modes in compiled runtime bundles", () => {
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
          signature: "BASE=ה|MARKS=NONE",
          base: "ה",
          count: 1,
          op_family: "ה",
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
            token_letter: "ה",
            read_letter: "ה",
            shape_letter: null,
            shape_effect_scope: null,
            rosh_branch: null,
            letter_mode_forced: "public" as any,
            has_shuruk: false,
            should_harden: false,
            sof_modifiers: []
          }
        }
      }
    });

    expect(() => dispatcher.apply(1, createInitialState(), { isWordFinal: true })).toThrow(
      /Legacy ה letter_mode 'public' is no longer supported/
    );
  });
});
