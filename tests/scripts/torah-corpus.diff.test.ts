import { describe, expect, it } from "vitest";
import { buildDiffPayload } from "@ref/scripts/torahCorpus/diff";

describe("torah corpus diff payload builder", () => {
  it("groups additions/removals and field-level changes", () => {
    const payload = buildDiffPayload(
      `${process.cwd()}/outputs/a/word_flows.full.jsonl`,
      `${process.cwd()}/outputs/b/word_flows.full.jsonl`,
      [
        {
          ref_key: "Genesis/1/1/1",
          surface: "אב",
          tokens: [1],
          events: ["ALEPH.ALIAS"],
          flow_skeleton: ["ALEPH.ALIAS"],
          one_liner: "a"
        },
        {
          ref_key: "Genesis/1/1/2",
          surface: "גד",
          tokens: [2],
          events: ["GIMEL.BESTOW"],
          flow_skeleton: ["GIMEL.BESTOW"],
          one_liner: "b"
        }
      ],
      [
        {
          ref_key: "Genesis/1/1/1",
          surface: "אב",
          tokens: [1],
          events: ["ALEPH.ALIAS"],
          flow_skeleton: ["ALEPH.ALIAS", "TAV.FINALIZE"],
          one_liner: "a2"
        },
        {
          ref_key: "Genesis/1/1/3",
          surface: "הו",
          tokens: [3],
          events: ["HE.DECLARE"],
          flow_skeleton: ["HE.DECLARE"],
          one_liner: "c"
        }
      ]
    );

    expect(payload.summary.changed_words).toBe(3);
    expect(payload.groups.removed).toEqual(["Genesis/1/1/2"]);
    expect(payload.groups.added).toEqual(["Genesis/1/1/3"]);
    expect(payload.groups.flow_skeleton_changed).toEqual(["Genesis/1/1/1"]);
    expect(payload.groups.one_liner_changed).toEqual(["Genesis/1/1/1"]);
  });
});
