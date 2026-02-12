import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { TRACE_EVENT_KINDS } from "@ref/trace/types";
import {
  REQUIRED_NOUNS,
  REQUIRED_ROLES,
  REQUIRED_TONE_RULES,
  REQUIRED_VERBS,
  defaultLexiconV1Path,
  loadLexiconV1,
  parseLexiconV1Text,
  validateLexiconV1
} from "@ref/render/lexicon";

describe("render lexicon v1", () => {
  it("loads and validates required terms and event coverage", () => {
    const lexicon = loadLexiconV1();

    expect(lexicon.style).toBe("atomic");
    expect(lexicon.synonyms_policy).toBe("none");

    for (const term of REQUIRED_VERBS) {
      expect(lexicon.verbs).toContain(term);
    }
    for (const term of REQUIRED_NOUNS) {
      expect(lexicon.nouns).toContain(term);
    }
    for (const term of REQUIRED_ROLES) {
      expect(lexicon.roles).toContain(term);
    }
    for (const term of REQUIRED_TONE_RULES) {
      expect(lexicon.tone_rules).toContain(term);
    }

    expect(Object.keys(lexicon.event_templates).sort()).toEqual([...TRACE_EVENT_KINDS].sort());
  });

  it("rejects duplicates and missing required terms", () => {
    const raw = fs.readFileSync(defaultLexiconV1Path(), "utf8");

    const duplicateLexicon = parseLexiconV1Text(raw);
    duplicateLexicon.verbs = [...duplicateLexicon.verbs, duplicateLexicon.verbs[0]];
    expect(() => validateLexiconV1(duplicateLexicon)).toThrow(/duplicate term/u);

    const missingRequiredLexicon = parseLexiconV1Text(raw);
    missingRequiredLexicon.nouns = missingRequiredLexicon.nouns.filter(
      (noun) => noun !== "memory-zone"
    );
    expect(() => validateLexiconV1(missingRequiredLexicon)).toThrow(
      /must include required term "memory-zone"/u
    );
  });
});
