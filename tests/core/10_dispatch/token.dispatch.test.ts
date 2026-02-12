import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { tokenize, makeSpaceToken } from "@ref/compile/tokenizer";
import { createTokenDispatcher } from "@ref/dispatch/dispatcher";
import { CompiledTokensFile } from "@ref/dispatch/types";
import { createInitialState, serializeState } from "@ref/state/state";
import { applySpace } from "@ref/vm/space";
import { runProgram } from "@ref/vm/vm";

function toCodepoint(mark: string): string {
  const codepoint = mark.codePointAt(0);
  if (codepoint === undefined) {
    throw new Error("mark missing codepoint");
  }
  return `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

function signatureFromRaw(raw: string): string {
  const normalized = String(raw).normalize("NFD");
  const chars = Array.from(normalized);
  const base = chars[0] ?? "";
  const marks = chars
    .slice(1)
    .map((mark) => toCodepoint(mark))
    .sort((left, right) => {
      const leftInt = Number.parseInt(left.replace(/^U\+/u, ""), 16);
      const rightInt = Number.parseInt(right.replace(/^U\+/u, ""), 16);
      return leftInt - rightInt;
    });
  return `BASE=${base}|MARKS=${marks.length > 0 ? marks.join(",") : "NONE"}`;
}

function loadCompiledAndRegistry(): {
  compiled: CompiledTokensFile;
  signatureToTokenId: Map<string, number>;
} {
  const compiledPath = path.resolve(process.cwd(), "data", "tokens.compiled.json");
  const registryPath = path.resolve(process.cwd(), "data", "tokens.registry.json");
  const compiled = JSON.parse(fs.readFileSync(compiledPath, "utf8")) as CompiledTokensFile;
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8")) as {
    tokens: Record<string, { signature: string }>;
  };

  const signatureToTokenId = new Map<string, number>();
  for (const [tokenId, descriptor] of Object.entries(registry.tokens)) {
    signatureToTokenId.set(descriptor.signature, Number(tokenId));
  }

  return { compiled, signatureToTokenId };
}

function runDispatchedWord(
  word: string,
  compiled: CompiledTokensFile,
  signatureToTokenId: Map<string, number>
): Record<string, unknown> {
  const dispatcher = createTokenDispatcher(compiled);
  const state = createInitialState();

  const tokens = tokenize(word);
  const withBoundaries = [makeSpaceToken(), ...tokens];
  if (tokens.length === 0 || tokens[tokens.length - 1].letter !== "□") {
    withBoundaries.push(makeSpaceToken());
  }

  for (let index = 0; index < withBoundaries.length; index += 1) {
    const token = withBoundaries[index];
    if (token.letter === "□") {
      applySpace(state);
      continue;
    }
    const signature = signatureFromRaw(token.raw);
    const tokenId = signatureToTokenId.get(signature);
    if (!tokenId) {
      throw new Error(`Missing token id for signature '${signature}'`);
    }
    const isWordFinal =
      index === withBoundaries.length - 1 || withBoundaries[index + 1].letter === "□";
    dispatcher.apply(tokenId, state, { isWordFinal });
  }

  return serializeState(state);
}

describe("compiled token dispatch", () => {
  it("matches existing VM behavior on representative words", () => {
    const { compiled, signatureToTokenId } = loadCompiledAndRegistry();
    const words = ["וּ", "לָהּ", "שָׂר", "בָּ", "שָׁלוֹם", "נָס"];

    for (const word of words) {
      const baseline = serializeState(runProgram(word, createInitialState()));
      const dispatched = runDispatchedWord(word, compiled, signatureToTokenId);
      expect(dispatched).toEqual(baseline);
    }
  });

  it("dispatch hot path depends only on precompiled runtime fields", () => {
    const { compiled, signatureToTokenId } = loadCompiledAndRegistry();
    const signature = "BASE=ב|MARKS=U+05B8,U+05BC";
    const tokenId = signatureToTokenId.get(signature);
    if (!tokenId) {
      throw new Error(`Missing token id for '${signature}'`);
    }

    const mutated = JSON.parse(JSON.stringify(compiled)) as CompiledTokensFile;
    mutated.tokens[String(tokenId)].raw_marks = ["U+FFFF"];
    mutated.tokens[String(tokenId)].derived.rosh = ["HOLAM"];
    mutated.tokens[String(tokenId)].derived.toch = ["SHIN_DOT_LEFT"];
    mutated.tokens[String(tokenId)].derived.sof = ["KUBUTZ"];
    mutated.tokens[String(tokenId)].modifiers = ["KUBUTZ"];

    const baseline = runDispatchedWord("בָּ", compiled, signatureToTokenId);
    const altered = runDispatchedWord("בָּ", mutated, signatureToTokenId);
    expect(altered).toEqual(baseline);
  });
});
