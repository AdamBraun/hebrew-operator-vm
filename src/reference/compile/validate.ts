import { CompileError, Token } from "./types";
import { LetterRegistry } from "../letters/registry";

function isVavMode(mode: unknown): mode is NonNullable<Token["letter_mode"]> {
  return mode === "plain" || mode === "seeded" || mode === "transport";
}

function formatMode(mode: unknown): string {
  return typeof mode === "string" ? mode : JSON.stringify(mode);
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
    if (token.letter === "ה") {
      throw new CompileError(
        `Legacy ה letter_mode '${formatMode(mode)}' is no longer supported; ה only uses the head-family implementation`
      );
    }
    if (token.letter !== "ו") {
      throw new CompileError(
        `Unsupported letter_mode '${formatMode(mode)}' for '${token.letter}'; only ו supports letter_mode`
      );
    }
    if (!isVavMode(mode)) {
      throw new CompileError(`Unsupported letter_mode '${formatMode(mode)}' for 'ו'`);
    }
  }
}
