import { describe, expect, it } from "vitest";
import { eff, isCarryResolved, isCarryUnresolved } from "@ref/state/eff";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

type HeSnapshot = {
  head_of?: string[];
  carry?: string[];
  supp?: string[];
};

function inspectHeadQuery(
  word: "דבה" | "רבה",
  letter: "ד" | "ר"
): {
  state: ReturnType<typeof runProgramWithDeepTrace>["state"];
  head: string;
  whole: string;
  snapshot: HeSnapshot;
} {
  const state = createInitialState();
  const omega = state.handles.get("Ω");
  omega!.meta = { ...omega!.meta, witness: { ambient: 1 } };

  const result = runProgramWithDeepTrace(word, state, {
    includeStateSnapshots: true
  });
  const entry = result.deepTrace.find((traceEntry) => traceEntry.token === letter);
  const snapshot = (entry?.phases.find((phase) => phase.phase === "token_exit")?.snapshot ??
    {}) as HeSnapshot;
  const headEdge = snapshot.head_of?.find((edge) => edge.startsWith(`${letter}:`)) ?? "->";
  const [head = "", whole = ""] = headEdge.split("->");

  return {
    state: result.state,
    head,
    whole,
    snapshot
  };
}

describe("eff integration: dalet vs resh head exposure", () => {
  it("sees the same ambient bundle but different resolution states in {ד|ר}בה", () => {
    const dalet = inspectHeadQuery("דבה", "ד");
    const resh = inspectHeadQuery("רבה", "ר");

    expect(dalet.whole).toBe("Ω");
    expect(resh.whole).toBe("Ω");
    expect(dalet.snapshot.carry).toEqual([`Ω->${dalet.head}`]);
    expect(resh.snapshot.carry).toEqual([`Ω->${resh.head}`]);
    expect(dalet.snapshot.supp).toEqual([`${dalet.head}->Ω`]);
    expect(resh.snapshot.supp).toEqual([]);

    expect(eff(dalet.state, dalet.head, { focusNodeId: dalet.head })).toEqual({ ambient: 1 });
    expect(eff(resh.state, resh.head, { focusNodeId: resh.head })).toEqual({ ambient: 1 });

    expect(isCarryResolved(dalet.state, "Ω", dalet.head, { focusNodeId: dalet.head })).toBe(true);
    expect(isCarryUnresolved(resh.state, "Ω", resh.head, { focusNodeId: resh.head })).toBe(true);
  });
});
