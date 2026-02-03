import { describe, expect, it } from "vitest";
import { createInitialState, serializeState } from "../../state/state";
import { runProgram } from "../../vm/vm";

function stripEnvelopeAndPolicy(state: ReturnType<typeof runProgram>): Record<string, any> {
  const json = serializeState(state);
  return {
    ...json,
    handles: json.handles.map(({ envelope, policy, ...rest }) => rest)
  };
}

function findOpenedBy(state: ReturnType<typeof runProgram>, letter: string) {
  for (const handle of state.handles.values()) {
    if (handle.meta?.openedBy === letter) {
      return handle;
    }
  }
  return undefined;
}

describe("dagesh harden", () => {
  it("preserves topology while hardening the output envelope", () => {
    const hardened = runProgram("בּ", createInitialState());
    const plain = runProgram("ב", createInitialState());

    expect(stripEnvelopeAndPolicy(hardened)).toEqual(stripEnvelopeAndPolicy(plain));

    const hardenedHandle = findOpenedBy(hardened, "ב");
    const plainHandle = findOpenedBy(plain, "ב");
    expect(hardenedHandle).toBeDefined();
    expect(plainHandle).toBeDefined();
    expect(hardenedHandle?.envelope.policy).toBe("framed_lock");
    expect(plainHandle?.envelope.policy).toBe("soft");
  });
});
