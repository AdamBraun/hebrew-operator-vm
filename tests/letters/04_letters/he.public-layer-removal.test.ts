import { describe, expect, it } from "vitest";
import { tokenize } from "@ref/compile/tokenizer";
import { BOT_ID, createHandle } from "@ref/state/handles";
import { createInitialState, serializeState } from "@ref/state/state";
import { selectCurrentFocus } from "@ref/vm/select";
import { executeLetterForTest, runProgram, runProgramWithDeepTrace } from "@ref/vm/vm";

const LEGACY_REGISTRY_KEYS = [
  "publicLayer",
  "public_layer",
  "public_handles",
  "declarations",
  "declarationHandles",
  "declaration_handle",
  "declared",
  "globalDeclarations",
  "global_declarations",
  "visibility"
] as const;

const LEGACY_FLAG_KEYS = new Set([
  "public",
  "visible",
  "declared",
  "declaration",
  "announcement",
  "global"
]);

function parseEdge(edge: string): [string, string] {
  const [from, to] = edge.split("->");
  if (!from || !to) {
    throw new Error(`Invalid edge '${edge}'`);
  }
  return [from, to];
}

function executeHeOnOrdinaryFocus() {
  const state = createInitialState();
  const [token] = tokenize("ה");
  if (!token) {
    throw new Error("Missing token for ה");
  }

  state.handles.set("X", createHandle("X", "scope"));
  state.vm.F = "X";
  state.vm.K = ["X", BOT_ID];
  state.vm.R = BOT_ID;
  state.vm.wordHasContent = true;
  state.vm.activeConstruct = "C:mid";

  executeLetterForTest(state, token, {
    wordText: "אה",
    isWordFinal: false,
    prevBoundaryMode: "hard"
  });

  return state;
}

function normalizeHeTopology(state: ReturnType<typeof executeHeOnOrdinaryFocus>) {
  const [headOfEdge] = Array.from(state.head_of);
  if (!headOfEdge) {
    throw new Error("Missing head_of edge");
  }
  const [head, source] = parseEdge(headOfEdge);
  const [leg] = state.adjuncts[head] ?? [];
  if (!leg) {
    throw new Error("Missing detached leg");
  }

  const ids: Record<string, string> = {
    [source]: "X",
    [head]: "h",
    [leg]: "ℓ"
  };
  const normalize = (edges: Iterable<string>) =>
    Array.from(edges, (edge) => {
      const [from, to] = parseEdge(edge);
      return `${ids[from] ?? from}->${ids[to] ?? to}`;
    }).sort();

  return {
    head,
    leg,
    topology: {
      focus: ids[state.vm.F] ?? state.vm.F,
      head_of: normalize(state.head_of),
      carry: normalize(state.carry),
      cont: normalize(state.cont),
      supp: normalize(state.supp),
      sub: normalize(state.sub)
    }
  };
}

function findLegacyFlagPaths(value: unknown, path = "root"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findLegacyFlagPaths(entry, `${path}[${index}]`));
  }
  if (!value || typeof value !== "object") {
    return [];
  }

  const out: string[] = [];
  for (const [key, entry] of Object.entries(value)) {
    const nextPath = `${path}.${key}`;
    if (LEGACY_FLAG_KEYS.has(key)) {
      out.push(nextPath);
    }
    out.push(...findLegacyFlagPaths(entry, nextPath));
  }
  return out;
}

describe("he public/global layer removal", () => {
  it("A: produces no public/global declaration side effects", () => {
    const result = runProgramWithDeepTrace("ה", createInitialState(), {
      includeStateSnapshots: true
    });
    const state = result.state;
    const heTrace = result.trace.find((entry) => entry.token === "ה");
    const serialized = serializeState(state);
    const eventTypes = heTrace?.events.map((event) => event.type) ?? [];

    expect(state.rules).toEqual([]);
    expect(Array.from(state.handles.values()).some((handle) => handle.kind === "rule")).toBe(false);
    expect(eventTypes).toContain("head_with_leg");
    expect(eventTypes.some((type) => type.startsWith("declare"))).toBe(false);
    expect(
      findLegacyFlagPaths(Array.from(state.handles.values()).map((handle) => handle.meta ?? {}))
    ).toEqual([]);
    expect(findLegacyFlagPaths(heTrace?.events ?? [])).toEqual([]);
    expect(findLegacyFlagPaths(serialized)).toEqual([]);
  });

  it("B: emits only the resolved head-with-leg topology and seals focus on the head", () => {
    const state = executeHeOnOrdinaryFocus();
    const { head, leg, topology } = normalizeHeTopology(state);

    expect(topology).toEqual({
      focus: "h",
      head_of: ["h->X"],
      carry: ["X->h", "h->ℓ"],
      cont: ["X->h", "h->ℓ"],
      supp: ["h->X", "ℓ->h"],
      sub: ["h->ℓ"]
    });
    expect(state.vm.F).toBe(head);
    expect(state.adjuncts[head]).toEqual([leg]);
  });

  it("C: legacy ה public/declaration/global registries are gone", () => {
    const state = runProgram("ה", createInitialState());
    const serialized = serializeState(state) as Record<string, unknown>;
    const prefs = selectCurrentFocus(state).ops.prefs as Record<string, unknown>;

    for (const key of LEGACY_REGISTRY_KEYS) {
      expect(Reflect.has(state as object, key), `state.${key}`).toBe(false);
      expect(Reflect.get(state as Record<string, unknown>, key), `state.${key}`).toBeUndefined();
      expect(Reflect.has(state.vm as object, key), `state.vm.${key}`).toBe(false);
      expect(
        Reflect.get(state.vm as Record<string, unknown>, key),
        `state.vm.${key}`
      ).toBeUndefined();
      expect(Reflect.has(serialized, key), `serialized.${key}`).toBe(false);
      expect(Reflect.get(serialized, key), `serialized.${key}`).toBeUndefined();
      expect(Reflect.get(prefs, key), `prefs.${key}`).toBeUndefined();
    }
  });

  it("D: non-ה runtime paths still work after the public/global layer removal", () => {
    const daletState = runProgram("דא", createInitialState());
    const finalPeState = runProgram("ף", createInitialState());
    const [daletHead, daletWhole] = String(Array.from(daletState.head_of)[0] ?? "->").split("->");
    const finalPeRuleHandles = Array.from(finalPeState.handles.values()).filter(
      (handle) => handle.kind === "rule"
    );

    expect(daletWhole).toBe("Ω");
    expect(daletHead.length).toBeGreaterThan(0);
    expect(daletState.supp.has(`${daletHead}->Ω`)).toBe(true);
    expect(daletState.vm.H.some((event) => event.type === "head_backed")).toBe(true);

    expect(finalPeState.rules).toHaveLength(1);
    expect(finalPeRuleHandles).toHaveLength(1);
    expect(finalPeRuleHandles[0]?.policy).toBe("final");
    expect(finalPeState.vm.H.some((event) => event.type === "utter_close")).toBe(true);
  });
});
