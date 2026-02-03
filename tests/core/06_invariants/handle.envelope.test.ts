import { describe, expect, it } from "vitest";
import { createHandle } from "@ref/state/handles";

describe("handle envelope defaults", () => {
  it("assigns a default envelope to new handles", () => {
    const handle = createHandle("X", "scope");
    expect(handle.envelope.ctx_flow).toBe("LOW");
    expect(handle.envelope.x_flow).toBe("IMPLICIT_OK");
    expect(handle.envelope.data_flow).toBe("LIVE");
    expect(handle.envelope.edit_flow).toBe("OPEN");
    expect(handle.envelope.coupling).toBe("LINK");
    expect(handle.envelope.policy).toBe(handle.policy);
    expect(handle.envelope.ports).toBeInstanceOf(Set);
    expect(handle.envelope.ports.size).toBe(0);
  });

  it("keeps envelope policy in sync when overriding", () => {
    const handle = createHandle("Y", "scope", { policy: "framed_lock" });
    expect(handle.envelope.policy).toBe("framed_lock");
    expect(handle.policy).toBe("framed_lock");
  });
});
