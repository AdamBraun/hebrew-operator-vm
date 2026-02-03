import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { createInitialState, serializeState } from "../../state/state";
import { runProgram } from "../../vm/vm";

const CASE_DIR = join(__dirname, "cases");
const CASES: Record<string, string> = {
  empty: "",
  nun: "נ",
  nun_samekh: "נס",
  nun_space_samekh: "נ ס",
  mem: "מ",
  mem_final: "מם",
  mem_space_final: "מ ם",
  final_nun: "ן",
  mixed: "נמםס",
  shuruk: "וּ"
};

describe("golden state dumps", () => {
  it("matches curated golden fixtures", () => {
    const files = readdirSync(CASE_DIR).filter((file) => file.endsWith(".json"));
    for (const file of files) {
      const name = file.replace(/\.json$/, "");
      const program = CASES[name];
      if (program === undefined) {
        throw new Error(`Missing program mapping for ${name}`);
      }
      const state = runProgram(program, createInitialState());
      const json = serializeState(state);
      const expected = JSON.parse(readFileSync(join(CASE_DIR, file), "utf8"));
      expect(json).toEqual(expected);
    }
  });
});
