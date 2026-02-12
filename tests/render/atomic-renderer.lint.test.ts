import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TRACE_EVENT_KINDS } from "@ref/trace/types";
import {
  createAtomicRenderContext,
  formatAtomicRenderedEvent,
  getAtomicAllowedTerms,
  renderAtomicEvent,
  renderAtomicSkeleton,
  renderAtomicTraceEvent,
  renderAtomicWordEvents,
  type AtomicWordRecord
} from "@ref/render/atomic";

const VALID_WORD_TRACE_FIXTURE = path.resolve(
  process.cwd(),
  "tests",
  "fixtures",
  "trace-schema",
  "valid.word-trace.json"
);

function sourceForEventKind(kind: string): string {
  if (kind === "EXTENSION") {
    return "extension";
  }
  if (kind === "SPACE.MEM_AUTO_CLOSE") {
    return "derived_boundary";
  }
  if (
    kind === "MEM.OPEN" ||
    kind === "FINAL_MEM.CLOSE" ||
    kind === "NUN.SUPPORT_DEBT" ||
    kind === "FINAL_NUN.SUPPORT_DEBT" ||
    kind === "FINAL_NUN.SUPPORT_DISCHARGE"
  ) {
    return "derived_obligation";
  }
  if (kind.startsWith("ERROR.")) {
    return "error";
  }
  return "vm_event";
}

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

  it("renders every trace event kind without unknown fallback text", () => {
    for (const kind of TRACE_EVENT_KINDS) {
      const rendered = renderAtomicTraceEvent(
        {
          kind,
          index: 0,
          tau: 0,
          source: sourceForEventKind(kind),
          payload: {}
        },
        createAtomicRenderContext()
      );
      expect(rendered).toContain(`kind=${kind}`);
      expect(rendered).not.toContain("UNKNOWN EVENT");
    }
  });

  it("renders known canonical fixture to exact anchored atomic lines", () => {
    const fixture = JSON.parse(fs.readFileSync(VALID_WORD_TRACE_FIXTURE, "utf8")) as {
      ref_key: string;
      ref: {
        token_index: number;
      };
      events: AtomicWordRecord["events"];
    };
    const rows = renderAtomicWordEvents({
      ref_key: fixture.ref_key,
      word_index: fixture.ref.token_index,
      events: fixture.events
    });
    const lines = rows.map((row) => formatAtomicRenderedEvent(row));

    expect(lines).toEqual([
      "Genesis/1/1/2\t2\t0\tclose boundary kind=RESH.BOUNDARY_CLOSE source=vm_event tau=2 payload.anchor=0 payload.id=h1 payload.inside=h2 payload.outside=h3.",
      "Genesis/1/1/2\t2\t1\talias handle alias kind=ALEPH.ALIAS source=vm_event tau=3 payload.id=h4 payload.left=h5 payload.right=h2.",
      "Genesis/1/1/2\t2\t2\tfork handle kind=SHIN.FORK source=vm_event tau=4 payload.active=h6 payload.focus=h4 payload.id=h7 payload.left=h6 payload.right=h8 payload.spine=h9.",
      "Genesis/1/1/2\t2\t3\tseal handle kind=TAV.FINALIZE source=vm_event tau=5 payload.boundaryId=h10 payload.id=h11 payload.outside=h2 payload.residueId=h12 payload.target=h7."
    ]);
  });
});
