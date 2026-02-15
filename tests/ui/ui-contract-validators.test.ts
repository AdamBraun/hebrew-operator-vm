import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  uiDataManifestSchema,
  versePhraseTreeRecordSchema,
  wordPhraseRoleRecordSchema,
  wordTraceRecordSchema
} from "../../packages/ui/src/lib/contracts";

const FIXTURE_DIR = path.resolve(process.cwd(), "tests", "fixtures", "ui-contract");

function loadJson(fileName: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fileName), "utf8"));
}

describe("ui contract validators", () => {
  it("accepts valid fixtures", () => {
    const validCases = [
      {
        schema: wordTraceRecordSchema,
        fixture: "valid.word_trace.json"
      },
      {
        schema: versePhraseTreeRecordSchema,
        fixture: "valid.verse_phrase_tree.json"
      },
      {
        schema: wordPhraseRoleRecordSchema,
        fixture: "valid.word_phrase_role.json"
      },
      {
        schema: uiDataManifestSchema,
        fixture: "valid.manifest.json"
      }
    ] as const;

    for (const validCase of validCases) {
      const result = validCase.schema.safeParse(loadJson(validCase.fixture));
      expect(result.success, validCase.fixture).toBe(true);
    }
  });

  it("rejects fixtures with missing required fields", () => {
    const invalidCases = [
      {
        schema: wordTraceRecordSchema,
        fixture: "invalid.word_trace.missing-trace-version.json",
        missingField: "trace_version"
      },
      {
        schema: versePhraseTreeRecordSchema,
        fixture: "invalid.verse_phrase_tree.missing-tree.json",
        missingField: "tree"
      },
      {
        schema: wordPhraseRoleRecordSchema,
        fixture: "invalid.word_phrase_role.missing-phrase-role.json",
        missingField: "phrase_role"
      },
      {
        schema: uiDataManifestSchema,
        fixture: "invalid.manifest.missing-version-contract.json",
        missingField: "version_contract"
      }
    ] as const;

    for (const invalidCase of invalidCases) {
      const result = invalidCase.schema.safeParse(loadJson(invalidCase.fixture));
      expect(result.success, invalidCase.fixture).toBe(false);
      if (result.success) {
        continue;
      }

      const hasExpectedPath = result.error.issues.some(
        (issue) => issue.path.join(".") === invalidCase.missingField
      );
      expect(hasExpectedPath, invalidCase.fixture).toBe(true);
    }
  });
});
