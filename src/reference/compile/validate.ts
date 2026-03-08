import { CompileError, Token } from "./types";
import { LetterRegistry } from "../letters/registry";

function formatMode(mode: unknown): string {
  return typeof mode === "string" ? mode : JSON.stringify(mode);
}

function rejectLegacyLetterMode(letter: string, mode: unknown): never {
  const formattedMode = formatMode(mode);
  if (letter === "ה") {
    throw new CompileError(
      `Legacy ה letter_mode '${formattedMode}' is no longer supported; ה only uses the head-family implementation`
    );
  }
  if (letter === "ו") {
    throw new CompileError(
      `Legacy ו letter_mode '${formattedMode}' is no longer supported; ו no longer performs grouping and only advances the spine`
    );
  }
  throw new CompileError(
    `Legacy letter_mode '${formattedMode}' is no longer supported for '${letter}'`
  );
}

export function validateTokens(tokens: Token[], registry: LetterRegistry): void {
  for (const token of tokens) {
    if (token.letter === "□") {
      continue;
    }
    if (!registry[token.letter]) {
      throw new CompileError(`Unrecognized letter '${token.letter}'`);
    }
    const mode = (token as Token & { letter_mode?: unknown }).letter_mode;
    if (mode === undefined) {
      continue;
    }
    rejectLegacyLetterMode(token.letter, mode);
  }
}
