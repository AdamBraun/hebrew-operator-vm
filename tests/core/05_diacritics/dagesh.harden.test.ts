import { describe, expect, it } from "vitest";
import { createInitialState, serializeState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

function stripEnvelopeAndPolicy(state: ReturnType<typeof runProgram>): Record<string, any> {
  const json = serializeState(state);
  const vm = { ...json.vm };
  if (Array.isArray(vm.H)) {
    vm.H = vm.H.map((event: Record<string, any>) => {
      if (event?.type !== "WORD_START" || !event.data || typeof event.data !== "object") {
        return event;
      }
      const data = { ...event.data };
      delete data.wordText;
      return { ...event, data };
    });
  }
  return {
    ...json,
    vm,
    handles: json.handles.map(({ envelope: _envelope, policy: _policy, ...rest }) => {
      const meta = rest.meta ? { ...rest.meta } : {};
      delete (meta as { hard?: number }).hard;
      delete (meta as { word_text?: string }).word_text;
      return { ...rest, meta };
    })
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
    expect(hardenedHandle?.meta.hard).toBe(1);
    expect(plainHandle?.meta.hard).toBeUndefined();
  });
});
