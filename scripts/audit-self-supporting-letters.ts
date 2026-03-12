import {
  collectLocalSelfSupportByLetter,
  type SelfSupportingLetterRecord
} from "../src/reference/letters/validation";

export type SelfSupportingLetterAudit = {
  scenario: "fresh_state";
  letters: SelfSupportingLetterRecord[];
};

export function collectSelfSupportingLetterAudit(): SelfSupportingLetterAudit {
  return {
    scenario: "fresh_state",
    letters: collectLocalSelfSupportByLetter()
  };
}

export function renderSelfSupportingLetterAudit(): string {
  return `${JSON.stringify(collectSelfSupportingLetterAudit(), null, 2)}\n`;
}

if (require.main === module) {
  process.stdout.write(renderSelfSupportingLetterAudit());
}
