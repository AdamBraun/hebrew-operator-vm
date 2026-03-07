import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WordInspector } from "../../packages/ui/src/components/WordInspector";
import type { WordPhraseRoleRecord, WordTraceRecord } from "../../packages/ui/src/lib/contracts";

describe("word inspector component", () => {
  it("renders expected fields from a selected word record", () => {
    const traceRecord: WordTraceRecord = {
      record_kind: "WORD_TRACE",
      trace_version: "1.1.0",
      semantics_version: "1.1.0",
      render_version: "1.1.0",
      ref: {
        book: "Genesis",
        chapter: 1,
        verse: 1,
        token_index: 2
      },
      ref_key: "Genesis/1/1/2",
      surface: "בָּרָא",
      token_ids: [149, 51, 280],
      events: [
        {
          kind: "HE.HEAD_WITH_LEG",
          index: 0,
          tau: 1,
          source: "vm_event",
          payload: {
            source: "Ω",
            head: "ה:1:1",
            adjunct: "ה:1:2",
            focus: "ה:1:1",
            exported_adjuncts: ["ה:1:2"],
            resolved: true,
            edges: [
              { kind: "head_of", from: "ה:1:1", to: "Ω" },
              { kind: "carry", from: "Ω", to: "ה:1:1" },
              { kind: "supp", from: "ה:1:1", to: "Ω" },
              { kind: "cont", from: "ה:1:1", to: "ה:1:2" },
              { kind: "carry", from: "ה:1:1", to: "ה:1:2" },
              { kind: "supp", from: "ה:1:2", to: "ה:1:1" }
            ]
          }
        }
      ],
      skeleton: ["HE.HEAD_WITH_LEG", "RESH.BOUNDARY_CLOSE"],
      flow: "ה backed head + detached leg ⇢ ר head expose",
      mode: "WORD",
      extensions: {
        grapheme_signatures: ["בָ", "ּרָ", "א"]
      }
    };

    const phraseRoleRecord: WordPhraseRoleRecord = {
      ref_key: "Genesis/1/1",
      word_index: 2,
      surface: "בָּרָא",
      primary_accent: {
        word_index: 2,
        class: "DISJUNCTIVE",
        codepoint: "U+0591",
        name: "ETNAHTA",
        precedence: 8,
        observed_teamim: ["U+0591"]
      },
      phrase_role: "HEAD",
      phrase_path: ["n_1_3_split", "n_1_2_join"],
      clause_id: "C1",
      subclause_id: "C1.2",
      phrase_version: "1.1.0"
    };

    const markup = renderToStaticMarkup(
      createElement(WordInspector, {
        selectedWordIndex: 2,
        surface: "בָּרָא",
        wordTrace: traceRecord,
        wordPhraseRole: phraseRoleRecord
      })
    );

    expect(markup).toContain("surface form");
    expect(markup).toContain("בָּרָא");
    expect(markup).toContain("149, 51, 280");
    expect(markup).toContain("בָ, ּרָ, א");
    expect(markup).toContain("HE.HEAD_WITH_LEG -&gt; RESH.BOUNDARY_CLOSE");
    expect(markup).toContain("ה backed head + detached leg ⇢ ר head expose");
    expect(markup).toContain("HEAD");
    expect(markup).toContain("n_1_3_split &gt; n_1_2_join");
    expect(markup).toContain("C1.2");
    expect(markup).toContain("Genesis/1/1/2");
    expect(markup).toContain("semantic_version");
    expect(markup).toContain("1.1.0");
    expect(markup).toContain("Copy skeleton key");
    expect(markup).toContain("Copy flow");
    expect(markup).toContain("Copy ref anchor");
  });
});
