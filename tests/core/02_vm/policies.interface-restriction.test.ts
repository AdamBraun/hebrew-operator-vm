import { describe, expect, it } from "vitest";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import {
  applyEnvelopeToHandle,
  defaultEnvelope,
  harden,
  restrictToPortAccess
} from "@ref/state/policies";

describe("restrictToPortAccess", () => {
  it("requires explicit port access without freezing the handle", () => {
    const restricted = restrictToPortAccess(defaultEnvelope(), ["ט:port"]);

    expect(restricted.x_flow).toBe("EXPLICIT_ONLY");
    expect(restricted.edit_flow).toBe("TIGHT");
    expect(restricted.data_flow).toBe("LIVE");
    expect(restricted.coupling).toBe("LINK");
    expect(restricted.policy).toBe("framed_lock");
    expect([...restricted.ports]).toEqual(["ט:port"]);
  });

  it("is narrower than harden() and applies in place to an existing handle", () => {
    const base = defaultEnvelope();
    const restricted = restrictToPortAccess(base, ["ט:port"]);
    const frozen = harden(base);

    expect(restricted.data_flow).toBe("LIVE");
    expect(frozen.data_flow).toBe("SNAPSHOT");
    expect(restricted.coupling).toBe("LINK");
    expect(frozen.coupling).toBe("CopyNoBacklink");

    const state = createInitialState();
    const target = "target";
    const handle = createHandle(target, "scope");
    state.handles.set(target, handle);

    applyEnvelopeToHandle(state, target, restricted);

    expect(state.handles.get(target)).toBe(handle);
    expect(handle.envelope.x_flow).toBe("EXPLICIT_ONLY");
    expect(handle.envelope.data_flow).toBe("LIVE");
    expect(handle.envelope.ports.has("ט:port")).toBe(true);
  });
});
