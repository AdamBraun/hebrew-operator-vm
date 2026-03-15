import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderSelfSupportingLetterAudit } from "../../scripts/audit-self-supporting-letters";

const EXPECTED_FIXTURE = path.resolve(
  process.cwd(),
  "tests",
  "fixtures",
  "self-supporting-letters.expected.json"
);

describe("self-supporting letter audit fixture", () => {
  it("matches the committed audit output", () => {
    const expected = fs.readFileSync(EXPECTED_FIXTURE, "utf8");
    expect(renderSelfSupportingLetterAudit()).toBe(expected);
  });
});
