import { tokenize as refTokenize } from "@ref/compile/tokenizer";
import type { Token } from "@ref/compile/types";

export type { Token } from "@ref/compile/types";

export function tokenize(input: string): Token[] {
  return refTokenize(input);
}
