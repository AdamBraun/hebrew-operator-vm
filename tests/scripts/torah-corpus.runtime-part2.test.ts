import { describe, expect, it } from "vitest";
import { buildPatternIndex } from "@ref/scripts/torahCorpus/runtimePart2";

describe("torah corpus runtimePart2", () => {
  it("indexes head-with-leg patterns instead of legacy he mode variants", () => {
    const index = buildPatternIndex([
      {
        ref_key: "Genesis/1/1/1",
        flow_compact: ["HE.HEAD_WITH_LEG", "MEM.OPEN"]
      },
      {
        ref_key: "Genesis/1/1/2",
        flow_compact: ["QOF.HEAD_WITH_LEG"]
      }
    ]);

    expect(index.explicit_patterns.HE_HEAD_WITH_LEG.count).toBe(1);
    expect(index.explicit_patterns.HE_HEAD_WITH_LEG.occurrences).toEqual(["Genesis/1/1/1"]);
    expect(index.explicit_patterns.QOF_HEAD_WITH_LEG.count).toBe(1);
    expect(index.explicit_patterns.QOF_HEAD_WITH_LEG.occurrences).toEqual(["Genesis/1/1/2"]);
    expect(index.explicit_patterns).not.toHaveProperty("HE_DECLARE_PUBLIC");
    expect(index.explicit_patterns).not.toHaveProperty("HE_DECLARE_BREATH");
  });
});
