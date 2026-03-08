import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createInitialState, serializeState } from "@ref/state/state";
import { DeepTraceEntry, runProgramWithDeepTrace } from "@ref/vm/vm";

const CASE_DIR = join(__dirname, "continuation_family");
const CASES: Record<string, string> = {
  vav: "ו",
  vav_vav: "וו",
  vav_nun: "ונ",
  nun_vav: "נו",
  vav_final_nun: "ון",
  vav_zayin: "וז"
};

type WitnessPack = {
  trace: string;
  graph: string;
  state: string;
};

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}

function normalizeTraceEntry(entry: DeepTraceEntry): Record<string, unknown> {
  return {
    index: entry.index,
    token: entry.token,
    token_raw: entry.token_raw,
    read_op: entry.read_op,
    shape_op: entry.shape_op,
    tauBefore: entry.tauBefore,
    tauAfter: entry.tauAfter,
    D: entry.D,
    F: entry.F,
    R: entry.R,
    KLength: entry.KLength,
    OStackLength: entry.OStackLength,
    boundary_mode: entry.boundary_mode ?? null,
    rank: entry.rank ?? null,
    continuation: entry.continuation ?? null,
    dot_kind: entry.dot_kind ?? null,
    inside_dot_kind: entry.inside_dot_kind ?? null,
    is_final: entry.is_final,
    word_index: entry.word_index ?? null,
    diacritics: entry.diacritics,
    boundary: entry.boundary ?? null,
    trope: entry.trope ?? null,
    events: entry.events,
    phases: entry.phases.map((phase) => ({
      phase: phase.phase,
      tau: phase.tau,
      detail: phase.detail ?? null
    }))
  };
}

function tokenExitSnapshot(entry: DeepTraceEntry): Record<string, unknown> {
  const snapshot = entry.phases.find((phase) => phase.phase === "token_exit")?.snapshot;
  if (!snapshot) {
    throw new Error(`Missing token_exit snapshot for '${entry.token_raw}'`);
  }
  return snapshot;
}

function buildWitnessPack(program: string): WitnessPack {
  const execution = runProgramWithDeepTrace(program, createInitialState(), {
    includeStateSnapshots: true
  });
  const finalState = serializeState(execution.state);

  const trace = {
    program,
    prepared_tokens: execution.preparedTokens,
    deep_trace: execution.deepTrace.map((entry) => normalizeTraceEntry(entry))
  };

  const graph = {
    program,
    token_exit: execution.deepTrace
      .filter((entry) => entry.token_raw !== "□")
      .map((entry) => ({
        index: entry.index,
        token_raw: entry.token_raw,
        tau: entry.tauAfter,
        snapshot: tokenExitSnapshot(entry)
      })),
    final_state: finalState
  };

  return {
    trace: formatJson(trace),
    graph: formatJson(graph),
    state: formatJson(finalState)
  };
}

describe("continuation family witness pack", () => {
  it("matches committed trace, graph, and state fixtures for the smallest continuation cases", () => {
    const fixtureDirs = readdirSync(CASE_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(fixtureDirs).toEqual(Object.keys(CASES).sort());

    for (const fixtureDir of fixtureDirs) {
      const program = CASES[fixtureDir];
      if (program === undefined) {
        throw new Error(`Missing program mapping for ${fixtureDir}`);
      }

      const pack = buildWitnessPack(program);
      expect(readFileSync(join(CASE_DIR, fixtureDir, "trace.json"), "utf8")).toBe(pack.trace);
      expect(readFileSync(join(CASE_DIR, fixtureDir, "graph.json"), "utf8")).toBe(pack.graph);
      expect(readFileSync(join(CASE_DIR, fixtureDir, "state.json"), "utf8")).toBe(pack.state);
    }
  });
});
