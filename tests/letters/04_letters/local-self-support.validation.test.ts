import { describe, expect, it } from "vitest";
import {
  collectLocalSelfSupportByLetter,
  formatLocalSelfSupportViolations,
  type SelfSupportingLetterRecord
} from "@ref/letters/validation";

const LOCAL_SELF_SUPPORT_CARRY_ALLOWLIST = new Set<string>();

function filterAllowlistedViolations(
  violations: SelfSupportingLetterRecord[]
): SelfSupportingLetterRecord[] {
  return violations
    .map((violation) => ({
      letter: violation.letter,
      pairs: violation.pairs.filter(
        (pair) => !LOCAL_SELF_SUPPORT_CARRY_ALLOWLIST.has(pair.allowlistKey)
      )
    }))
    .filter((violation) => violation.pairs.length > 0);
}

describe("letter validation", () => {
  it("forbids local self-support carry pairs unless allowlisted", () => {
    const violations = filterAllowlistedViolations(collectLocalSelfSupportByLetter());
    expect(LOCAL_SELF_SUPPORT_CARRY_ALLOWLIST.size).toBe(0);
    expect(violations, formatLocalSelfSupportViolations(violations)).toEqual([]);
  });
});
