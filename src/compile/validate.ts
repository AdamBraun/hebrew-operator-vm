import { CompileError, Token } from "./types";
import { LetterRegistry } from "../letters/registry";

export function validateTokens(tokens: Token[], registry: LetterRegistry): void {
  for (const token of tokens) {
    if (token.letter === "□") {
      continue;
    }
    if (!registry[token.letter]) {
      throw new CompileError(`Unrecognized letter '${token.letter}'`);
    }
  }
}
