import { describe, expect, it } from "vitest";
import { TRACE_EVENT_KINDS } from "@ref/trace/types";
import { getAtomicAllowedTerms, renderAtomicEvent, renderAtomicSkeleton } from "@ref/render/atomic";

describe("atomic renderer lint", () => {
  it("emits lexicon-only terms for every trace event kind", () => {
    const allowedTerms = getAtomicAllowedTerms();

    for (const kind of TRACE_EVENT_KINDS) {
      const phrase = renderAtomicEvent(kind);
      const emittedTerms = phrase.split(/\s+/u).filter((token) => token.length > 0);

      expect(emittedTerms.length).toBeGreaterThan(1);
      for (const term of emittedTerms) {
        expect(allowedTerms.has(term), `event ${kind} emitted non-lexicon term "${term}"`).toBe(
          true
        );
      }
    }
  });

  it("renders deterministic atomic skeleton strings", () => {
    expect(renderAtomicSkeleton(["ALEPH.ALIAS", "TAV.FINALIZE", "ERROR.RUNTIME"])).toBe(
      "alias handle alias ⇢ seal handle ⇢ fall runtime-error"
    );
  });
});
