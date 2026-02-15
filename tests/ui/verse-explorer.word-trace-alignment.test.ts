import { describe, expect, it } from "vitest";
import type {
  WordPhraseRoleRecord,
  WordTraceRecord
} from "../../packages/ui/src/lib/contracts";
import { alignWordTracesToDisplayWords } from "../../packages/ui/src/pages/VerseExplorer";

function makeTrace(
  tokenIndex: number,
  surface: string,
  skeleton: string[] = [],
  flow = ""
): WordTraceRecord {
  return {
    record_kind: "WORD_TRACE",
    trace_version: "1.1.0",
    semantics_version: "1.1.0",
    render_version: "1.1.0",
    ref: {
      book: "Genesis",
      chapter: 1,
      verse: 1,
      token_index: tokenIndex
    },
    ref_key: `Genesis/1/1/${tokenIndex}`,
    surface,
    token_ids: [],
    events: [],
    skeleton,
    flow
  };
}

function makeRole(wordIndex: number, surface: string): WordPhraseRoleRecord {
  return {
    ref_key: "Genesis/1/1",
    word_index: wordIndex,
    surface,
    primary_accent: {
      word_index: wordIndex,
      class: "NONE",
      codepoint: null,
      name: null,
      precedence: 0,
      observed_teamim: []
    },
    phrase_role: "JOIN",
    phrase_path: [`w_${wordIndex}`],
    clause_id: "C1",
    subclause_id: "C1.1",
    phrase_version: "1.1.0"
  };
}

describe("verse explorer trace alignment", () => {
  it("aligns traces to displayed words when an early display word spans two traces", () => {
    const displayWords = [
      "בְּרֵאשִׁ֖ית",
      "בָּרָ֣א",
      "אֱלֹהִ֑ים",
      "אֵ֥ת",
      "הַשָּׁמַ֖יִם",
      "וְאֵ֥ת",
      "הָאָרֶץ"
    ];
    const roles = [
      makeRole(1, "בְּרֵאשִׁ֖ית"),
      makeRole(2, "בָּרָ֣א"),
      makeRole(3, "אֱלֹהִ֑ים"),
      makeRole(4, "אֵ֥ת"),
      makeRole(5, "הַשָּׁמַ֖יִם"),
      makeRole(6, "וְאֵ֥ת"),
      makeRole(7, "הָאָרֶץ")
    ];
    const traces = [
      makeTrace(1, "בְּ"),
      makeTrace(
        2,
        "רֵאשִׁית",
        ["RESH.BOUNDARY_CLOSE", "ALEPH.ALIAS", "SHIN.FORK", "TAV.FINALIZE"],
        "ר boundary close ⇢ א alias ⇢ ש fork route ⇢ ת finalize+stamp"
      ),
      makeTrace(
        3,
        "בָּרָא",
        ["RESH.BOUNDARY_CLOSE", "ALEPH.ALIAS"],
        "ר boundary close ⇢ א alias"
      ),
      makeTrace(
        4,
        "אֱלֹהִים",
        ["ALEPH.ALIAS", "LAMED.ENDPOINT", "HE.DECLARE", "FINAL_MEM.CLOSE"],
        "א alias ⇢ ל endpoint bind ⇢ ה declare(public) ⇢ ם close mem-zone"
      ),
      makeTrace(5, "אֵת", ["ALEPH.ALIAS", "TAV.FINALIZE"], "א alias ⇢ ת finalize+stamp"),
      makeTrace(
        6,
        "הַשָּׁמַיִם",
        ["HE.DECLARE", "SHIN.FORK", "MEM.OPEN", "FINAL_MEM.CLOSE"],
        "ה declare(public) ⇢ ש fork route ⇢ מ open mem-zone ⇢ ם close mem-zone"
      ),
      makeTrace(7, "וְאֵת", ["ALEPH.ALIAS", "TAV.FINALIZE"], "א alias ⇢ ת finalize+stamp"),
      makeTrace(
        8,
        "הָאָרֶץ",
        ["HE.DECLARE", "ALEPH.ALIAS", "RESH.BOUNDARY_CLOSE", "FINAL_TSADI.ALIGN_FINAL"],
        "ה declare(public) ⇢ א alias ⇢ ר boundary close ⇢ ץ final align"
      )
    ];

    const aligned = alignWordTracesToDisplayWords(displayWords, roles, traces);

    expect(aligned).toHaveLength(7);
    expect(aligned[2].surface).toBe("אֱלֹהִים");
    expect(aligned[2].skeleton).toEqual([
      "ALEPH.ALIAS",
      "LAMED.ENDPOINT",
      "HE.DECLARE",
      "FINAL_MEM.CLOSE"
    ]);
  });
});
