import { describe, expect, it } from "vitest";
import type { DeepTraceEntry, PreparedTraceToken } from "@ref/vm/vm";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace, runProgramWithTrace } from "@ref/vm/vm";

type RunWithTrace = ReturnType<typeof runProgramWithTrace>;

type ShinPayload = {
  focus: string;
  ports: [string, string, string];
  direction: "external" | "internal";
};

type SnapshotGraphState = {
  vm?: { F?: string };
  cont?: string[];
  carry?: string[];
  supp?: string[];
  head_of?: string[];
  sub?: string[];
  boundaries?: unknown[];
};

type UndirectedGraph = {
  adjacency: Map<string, Set<string>>;
  edgeCount: number;
};

function nonSpace<T extends { token: string }>(entries: T[]): T[] {
  return entries.filter((entry) => entry.token !== "□");
}

function parseEdge(edge: string): [string, string] {
  const [from, to] = String(edge).split("->");
  if (!from || !to) {
    throw new Error(`Invalid edge '${edge}'`);
  }
  return [from, to];
}

function edgeExists(edges: Set<string>, from: string, to: string): boolean {
  return edges.has(`${from}->${to}`);
}

function countEdgesFromToSet(edges: Set<string>, from: string, targets: readonly string[]): number {
  let count = 0;
  for (const target of targets) {
    if (edgeExists(edges, from, target)) {
      count += 1;
    }
  }
  return count;
}

function countEdgesWithinSet(edges: Set<string>, ids: readonly string[]): number {
  const idSet = new Set(ids);
  let count = 0;
  for (const edge of edges) {
    const [from, to] = parseEdge(edge);
    if (idSet.has(from) && idSet.has(to)) {
      count += 1;
    }
  }
  return count;
}

function undirectedSubConnected(edges: Set<string>, left: string, right: string): boolean {
  return edgeExists(edges, left, right) || edgeExists(edges, right, left);
}

function hasTrianglePairwiseAdjacency(
  edges: Set<string>,
  ports: readonly [string, string, string]
): boolean {
  return (
    undirectedSubConnected(edges, ports[0], ports[1]) &&
    undirectedSubConnected(edges, ports[1], ports[2]) &&
    undirectedSubConnected(edges, ports[2], ports[0])
  );
}

function hasDirectedTriangleCycle(
  edges: Set<string>,
  ports: readonly [string, string, string]
): boolean {
  return (
    edgeExists(edges, ports[0], ports[1]) &&
    edgeExists(edges, ports[1], ports[2]) &&
    edgeExists(edges, ports[2], ports[0])
  );
}

function hasNoSubEdgesBetweenPorts(
  edges: Set<string>,
  ports: readonly [string, string, string]
): boolean {
  return (
    !edgeExists(edges, ports[0], ports[1]) &&
    !edgeExists(edges, ports[1], ports[0]) &&
    !edgeExists(edges, ports[1], ports[2]) &&
    !edgeExists(edges, ports[2], ports[1]) &&
    !edgeExists(edges, ports[2], ports[0]) &&
    !edgeExists(edges, ports[0], ports[2])
  );
}

function extractShinPayload(run: RunWithTrace): ShinPayload {
  const tokenEntries = nonSpace(run.trace);
  for (const entry of tokenEntries) {
    const event = entry.events.find((item) => item.type === "shin");
    if (!event) {
      continue;
    }
    const focus = String(event.data?.focus ?? "");
    const ports = [
      String(event.data?.spine ?? ""),
      String(event.data?.left ?? ""),
      String(event.data?.right ?? "")
    ] as [string, string, string];
    const direction = event.data?.direction as "external" | "internal";
    return { focus, ports, direction };
  }
  throw new Error("Expected trace to include shin event");
}

function selectionTargets(entry: DeepTraceEntry): string[] {
  const select = entry.phases.find((phase) => phase.phase === "select")?.detail?.select_operands;
  const targets = select?.prefs?.selection_targets;
  return Array.isArray(targets) ? targets.map(String) : [];
}

function findTokenEntry(entries: DeepTraceEntry[], token: string): DeepTraceEntry {
  const entry = nonSpace(entries).find((candidate) => candidate.token === token);
  if (!entry) {
    throw new Error(`Expected deep trace to include token '${token}'`);
  }
  return entry;
}

function tokenExitSnapshot(entry: DeepTraceEntry): SnapshotGraphState {
  return (entry.phases.find((phase) => phase.phase === "token_exit")?.snapshot ??
    {}) as SnapshotGraphState;
}

function boundaryTargetsFromId(run: RunWithTrace, boundaryId: string): Set<string> {
  return new Set(
    run.state.links
      .filter((link) => link.label === "boundary" && link.from === boundaryId)
      .map((link) => link.to)
  );
}

function normalizedDiatriticKinds(token: PreparedTraceToken): string[] {
  return token.diacritics
    .map((diacritic) => diacritic.kind)
    .filter((kind) => kind !== "shin_dot_left" && kind !== "shin_dot_right")
    .sort();
}

function addUndirectedEdge(adjacency: Map<string, Set<string>>, left: string, right: string): void {
  if (!left || !right || left === right) {
    return;
  }
  const leftSet = adjacency.get(left) ?? new Set<string>();
  leftSet.add(right);
  adjacency.set(left, leftSet);
  const rightSet = adjacency.get(right) ?? new Set<string>();
  rightSet.add(left);
  adjacency.set(right, rightSet);
}

function collectGraphWithEventEdges(run: RunWithTrace): UndirectedGraph {
  const adjacency = new Map<string, Set<string>>();
  const edgeKeys = new Set<string>();

  const add = (left: string, right: string, label: string): void => {
    if (!left || !right || left === right) {
      return;
    }
    const [a, b] = left < right ? [left, right] : [right, left];
    const key = `${a}<->${b}:${label}`;
    if (edgeKeys.has(key)) {
      return;
    }
    edgeKeys.add(key);
    addUndirectedEdge(adjacency, left, right);
  };

  for (const link of run.state.links) {
    add(link.from, link.to, `link:${link.label}`);
  }

  for (const edge of run.state.cont) {
    const [from, to] = parseEdge(edge);
    add(from, to, "cont");
  }
  for (const edge of run.state.carry) {
    const [from, to] = parseEdge(edge);
    add(from, to, "carry");
  }
  for (const edge of run.state.sub) {
    const [from, to] = parseEdge(edge);
    add(from, to, "sub");
  }
  for (const edge of run.state.supp) {
    const [from, to] = parseEdge(edge);
    add(from, to, "supp");
  }
  for (const edge of run.state.head_of) {
    const [from, to] = parseEdge(edge);
    add(from, to, "head_of");
  }

  for (const step of run.trace) {
    for (const event of step.events) {
      const data = event.data ?? {};
      if (event.type === "WORD_START") {
        add(String(data.C0 ?? ""), String(data.F0 ?? ""), "event:word_start");
      }
      if (event.type === "approx") {
        add(String(data.id ?? ""), String(data.left ?? ""), "event:approx:left");
        add(String(data.id ?? ""), String(data.right ?? ""), "event:approx:right");
      }
      if (event.type === "shin") {
        for (const port of [data.spine, data.left, data.right]) {
          add(String(data.id ?? ""), String(port ?? ""), "event:shin");
        }
      }
    }
  }

  return { adjacency, edgeCount: edgeKeys.size };
}

function shortestPathLength(
  adjacency: Map<string, Set<string>>,
  start: string,
  target: string
): number | null {
  if (start === target) {
    return 0;
  }
  if (!adjacency.has(start) || !adjacency.has(target)) {
    return null;
  }

  const visited = new Set<string>([start]);
  const queue: Array<{ node: string; distance: number }> = [{ node: start, distance: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    for (const next of adjacency.get(current.node) ?? []) {
      if (visited.has(next)) {
        continue;
      }
      if (next === target) {
        return current.distance + 1;
      }
      visited.add(next);
      queue.push({ node: next, distance: current.distance + 1 });
    }
  }

  return null;
}

function firstWordStartC0(run: RunWithTrace): string {
  const first = run.trace.find((entry) =>
    entry.events.some((event) => event.type === "WORD_START")
  );
  const wordStart = first?.events.find((event) => event.type === "WORD_START");
  const c0 = String(wordStart?.data?.C0 ?? "");
  if (!c0) {
    throw new Error("Expected WORD_START event to provide C0");
  }
  return c0;
}

describe("Task 7: shin/sin topology and fan-in matrix", () => {
  it("7a: enforces structural invariants for שׁ tripod vs שׂ triangle", () => {
    const shinRun = runProgramWithTrace("שׁ", createInitialState());
    const sinRun = runProgramWithTrace("שׂ", createInitialState());
    const shin = extractShinPayload(shinRun);
    const sin = extractShinPayload(sinRun);

    expect(shin.direction).toBe("external");
    expect(sin.direction).toBe("internal");

    expect(countEdgesFromToSet(shinRun.state.cont, shin.focus, shin.ports)).toBe(3);
    expect(countEdgesFromToSet(sinRun.state.cont, sin.focus, sin.ports)).toBe(0);

    expect(countEdgesFromToSet(shinRun.state.sub, shin.focus, shin.ports)).toBe(0);
    expect(countEdgesFromToSet(sinRun.state.sub, sin.focus, sin.ports)).toBe(3);

    expect(countEdgesWithinSet(shinRun.state.sub, shin.ports)).toBe(0);
    expect(countEdgesWithinSet(sinRun.state.sub, sin.ports)).toBe(3);

    expect(shinRun.state.sub.size).toBe(0);
    expect(sinRun.state.sub.size).toBe(6);
    expect(shinRun.state.supp.size).toBe(0);
    expect(sinRun.state.supp.size).toBe(0);

    for (const port of shin.ports) {
      expect(shinRun.state.handles.get(port)?.kind).toBe("structured");
    }
    for (const port of sin.ports) {
      expect(sinRun.state.handles.get(port)?.kind).toBe("compartment");
    }

    expect(shinRun.state.handles.get(shin.focus)?.meta.active_branch).toBeUndefined();
    expect(shinRun.state.handles.get(shin.focus)?.meta.active_child).toBeUndefined();
    expect(sinRun.state.handles.get(sin.focus)?.meta.active_branch).toBeUndefined();
    expect(sinRun.state.handles.get(sin.focus)?.meta.active_child).toBeUndefined();

    expect(hasNoSubEdgesBetweenPorts(shinRun.state.sub, shin.ports)).toBe(true);
    expect(hasTrianglePairwiseAdjacency(sinRun.state.sub, sin.ports)).toBe(true);
    expect(hasDirectedTriangleCycle(sinRun.state.sub, sin.ports)).toBe(true);
  });

  it("7b: keeps triangle closure for sin words and no loop for shin words", () => {
    for (const word of ["שׂ", "שָׂבָע", "שָׂרָה", "כבשׂ", "שׂר"]) {
      const run = runProgramWithTrace(word, createInitialState());
      const sin = extractShinPayload(run);
      expect(sin.direction).toBe("internal");
      expect(hasTrianglePairwiseAdjacency(run.state.sub, sin.ports)).toBe(true);
      expect(hasDirectedTriangleCycle(run.state.sub, sin.ports)).toBe(true);
    }

    for (const word of ["שׁ", "שָׁבָע", "שָׁרָה", "כבשׁ", "שקר"]) {
      const run = runProgramWithTrace(word, createInitialState());
      const shin = extractShinPayload(run);
      expect(shin.direction).toBe("external");
      expect(hasNoSubEdgesBetweenPorts(run.state.sub, shin.ports)).toBe(true);
      expect(hasDirectedTriangleCycle(run.state.sub, shin.ports)).toBe(false);
    }
  });

  it("7c: enforces fan-in divergence for שָׂבָע vs שָׁבָע", () => {
    const sin = runProgramWithDeepTrace("שָׂבָע", createInitialState(), {
      includeStateSnapshots: false
    });
    const shin = runProgramWithDeepTrace("שָׁבָע", createInitialState(), {
      includeStateSnapshots: false
    });

    const sinFork = extractShinPayload(sin);
    const shinFork = extractShinPayload(shin);
    const sinBoundary = sin.state.boundaries[0];
    const shinBoundary = shin.state.boundaries[0];
    expect(sinBoundary).toBeDefined();
    expect(shinBoundary).toBeDefined();

    expect(sin.state.sub.size).toBe(6);
    expect(shin.state.sub.size).toBe(0);

    expect(sinBoundary?.members).toEqual([sinFork.focus, ...sinFork.ports]);
    expect(shinBoundary?.members).toEqual([shinFork.focus]);

    const sinTargets = boundaryTargetsFromId(sin, String(sinBoundary?.id ?? ""));
    expect(sinTargets.has(sinFork.focus)).toBe(true);
    for (const port of sinFork.ports) {
      expect(sinTargets.has(port)).toBe(true);
    }

    const shinTargets = boundaryTargetsFromId(shin, String(shinBoundary?.id ?? ""));
    expect(shinTargets).toEqual(new Set([shinFork.focus]));

    const sinDeep = nonSpace(sin.deepTrace);
    const shinDeep = nonSpace(shin.deepTrace);
    expect(selectionTargets(sinDeep[2] as DeepTraceEntry)).toEqual([]);
    expect(selectionTargets(shinDeep[2] as DeepTraceEntry)).toEqual([]);
  });

  it("7d: enforces fan-in divergence for שָׂרָה vs שָׁרָה", () => {
    const sin = runProgramWithDeepTrace("שָׂרָה", createInitialState(), {
      includeStateSnapshots: true
    });
    const shin = runProgramWithDeepTrace("שָׁרָה", createInitialState(), {
      includeStateSnapshots: true
    });

    const sinFork = extractShinPayload(sin);
    const shinFork = extractShinPayload(shin);
    const sinResh = findTokenEntry(sin.deepTrace, "ר");
    const shinResh = findTokenEntry(shin.deepTrace, "ר");
    const sinExit = tokenExitSnapshot(sinResh);
    const shinExit = tokenExitSnapshot(shinResh);
    const [sinHead, sinWhole] = parseEdge(sinExit.head_of?.[0] ?? "->");
    const [shinHead, shinWhole] = parseEdge(shinExit.head_of?.[0] ?? "->");

    expect(selectionTargets(sinResh)).toEqual(sinFork.ports);
    expect(selectionTargets(shinResh)).toEqual([]);

    expect(sinWhole).toBe(sinFork.focus);
    expect(shinWhole).toBe(shinFork.focus);
    expect(sinExit.head_of).toEqual([`${sinHead}->${sinFork.focus}`]);
    expect(shinExit.head_of).toEqual([`${shinHead}->${shinFork.focus}`]);
    expect(sinExit.carry).toContain(`${sinFork.focus}->${sinHead}`);
    expect(shinExit.carry).toContain(`${shinFork.focus}->${shinHead}`);
    expect(sinExit.supp).toEqual([]);
    expect(shinExit.supp).toEqual([]);
    expect(sinExit.boundaries).toEqual([]);
    expect(shinExit.boundaries).toEqual([]);
  });

  it("7e: preserves כבשׂ vs כבשׁ regression invariants with final-position shin/sin", () => {
    const sin = runProgramWithTrace("כבשׂ", createInitialState());
    const shin = runProgramWithTrace("כבשׁ", createInitialState());
    const sinFork = extractShinPayload(sin);
    const shinFork = extractShinPayload(shin);

    expect(sinFork.direction).toBe("internal");
    expect(shinFork.direction).toBe("external");

    expect(sin.state.sub.size).toBe(6);
    expect(shin.state.sub.size).toBe(0);
    expect(countEdgesWithinSet(sin.state.sub, sinFork.ports)).toBe(3);
    expect(countEdgesWithinSet(shin.state.sub, shinFork.ports)).toBe(0);

    expect(hasDirectedTriangleCycle(sin.state.sub, sinFork.ports)).toBe(true);
    expect(hasDirectedTriangleCycle(shin.state.sub, shinFork.ports)).toBe(false);

    expect(sin.state.boundaries[0]?.members).toEqual([sin.state.boundaries[0]?.inside]);
    expect(shin.state.boundaries[0]?.members).toEqual([shin.state.boundaries[0]?.inside]);
  });

  it("7f: keeps שקר denser while preserving a direct route from entry to the exposed head", () => {
    const qer = runProgramWithTrace("קר", createInitialState());
    const sheqer = runProgramWithTrace("שקר", createInitialState());

    const qerGraph = collectGraphWithEventEdges(qer);
    const sheqerGraph = collectGraphWithEventEdges(sheqer);
    const qerEntry = firstWordStartC0(qer);
    const sheqerEntry = firstWordStartC0(sheqer);
    const qerHead = parseEdge(Array.from(qer.state.head_of)[0] ?? "->")[0];
    const sheqerHead = parseEdge(Array.from(sheqer.state.head_of)[0] ?? "->")[0];
    const qerDistance = shortestPathLength(qerGraph.adjacency, qerEntry, qerHead);
    const sheqerDistance = shortestPathLength(sheqerGraph.adjacency, sheqerEntry, sheqerHead);

    expect(qerDistance).not.toBeNull();
    expect(sheqerDistance).not.toBeNull();
    expect(sheqerDistance).toBeLessThan(qerDistance as number);
    expect(sheqerGraph.edgeCount).toBeGreaterThan(qerGraph.edgeCount);
    expect(qer.state.boundaries).toEqual([]);
    expect(sheqer.state.boundaries).toEqual([]);
    expect(qer.state.head_of.size).toBe(2);
    expect(sheqer.state.head_of.size).toBe(2);
  });

  it("7g: captures שׂר bare-head topology and contrasts it with samekh resh", () => {
    const sinResh = runProgramWithDeepTrace("שׂר", createInitialState(), {
      includeStateSnapshots: true
    });
    const sinFork = extractShinPayload(sinResh);
    const sinReshEntry = findTokenEntry(sinResh.deepTrace, "ר");
    const sinExit = tokenExitSnapshot(sinReshEntry);
    const [sinHead, sinWhole] = parseEdge(sinExit.head_of?.[0] ?? "->");

    expect(sinFork.direction).toBe("internal");
    expect(sinExit.sub?.length).toBe(6);
    expect(sinHead.startsWith("ר:")).toBe(true);
    expect(sinWhole).toBe(sinFork.focus);
    expect(sinExit.boundaries).toEqual([]);
    expect(sinExit.carry).toEqual([`${sinFork.focus}->${sinHead}`]);
    expect(sinExit.supp).toEqual([]);
    expect(hasTrianglePairwiseAdjacency(sinResh.state.sub, sinFork.ports)).toBe(true);
    expect(hasDirectedTriangleCycle(sinResh.state.sub, sinFork.ports)).toBe(true);

    const samekhResh = runProgramWithDeepTrace("סר", createInitialState(), {
      includeStateSnapshots: true
    });
    const samekhReshEntry = findTokenEntry(samekhResh.deepTrace, "ר");
    const samekhExit = tokenExitSnapshot(samekhReshEntry);
    const [samekhHead, samekhWhole] = parseEdge(samekhExit.head_of?.[0] ?? "->");

    expect(samekhExit.sub).toEqual([]);
    expect(samekhExit.boundaries).toEqual([]);
    expect(samekhWhole).toBe(firstWordStartC0(samekhResh));
    expect(samekhExit.carry).toEqual([`${samekhWhole}->${samekhHead}`]);
    expect(samekhExit.supp).toEqual([]);

    const contextualSamekhResh = runProgramWithDeepTrace("נסר", createInitialState(), {
      includeStateSnapshots: true
    });
    const contextualReshEntry = findTokenEntry(contextualSamekhResh.deepTrace, "ר");
    const contextualExit = tokenExitSnapshot(contextualReshEntry);
    const [contextualHead, contextualWhole] = parseEdge(contextualExit.head_of?.[0] ?? "->");
    const contextualEntry = firstWordStartC0(contextualSamekhResh);

    expect(contextualWhole.startsWith("נ:")).toBe(true);
    expect(contextualExit.carry).toContain(`${contextualWhole}->${contextualHead}`);
    expect(contextualExit.supp).toEqual([`${contextualWhole}->${contextualEntry}`]);
    expect(contextualExit.supp?.includes(`${contextualHead}->${contextualWhole}`)).toBe(false);
    expect(contextualExit.boundaries).toEqual([]);
  });

  it("7h: preserves cross-pair consistency across sin-led and shin-led sets", () => {
    for (const word of ["שָׂבָע"]) {
      const run = runProgramWithTrace(word, createInitialState());
      const sin = extractShinPayload(run);
      const boundary = run.state.boundaries[0];

      expect(sin.direction).toBe("internal");
      expect(countEdgesFromToSet(run.state.sub, sin.focus, sin.ports)).toBe(3);
      expect(countEdgesWithinSet(run.state.sub, sin.ports)).toBe(3);
      expect(hasDirectedTriangleCycle(run.state.sub, sin.ports)).toBe(true);
      expect(boundary?.members).toEqual([sin.focus, ...sin.ports]);
    }

    for (const word of ["שָׁבָע"]) {
      const run = runProgramWithTrace(word, createInitialState());
      const shin = extractShinPayload(run);

      expect(shin.direction).toBe("external");
      expect(countEdgesFromToSet(run.state.cont, shin.focus, shin.ports)).toBe(3);
      expect(countEdgesWithinSet(run.state.sub, shin.ports)).toBe(0);
      expect(hasDirectedTriangleCycle(run.state.sub, shin.ports)).toBe(false);
      expect(run.state.boundaries.every((boundary) => (boundary.members ?? []).length === 1)).toBe(
        true
      );
    }

    for (const word of ["שָׂרָה"]) {
      const run = runProgramWithDeepTrace(word, createInitialState(), {
        includeStateSnapshots: true
      });
      const sin = extractShinPayload(run);
      const reshEntry = findTokenEntry(run.deepTrace, "ר");
      const reshExit = tokenExitSnapshot(reshEntry);

      expect(sin.direction).toBe("internal");
      expect(selectionTargets(reshEntry)).toEqual(sin.ports);
      expect(countEdgesFromToSet(run.state.sub, sin.focus, sin.ports)).toBe(3);
      expect(countEdgesWithinSet(run.state.sub, sin.ports)).toBe(3);
      expect(hasDirectedTriangleCycle(run.state.sub, sin.ports)).toBe(true);
      expect(reshExit.boundaries).toEqual([]);
      expect(reshExit.supp).toEqual([]);
      expect(reshExit.head_of?.length).toBe(1);
    }

    for (const word of ["שָׁרָה"]) {
      const run = runProgramWithDeepTrace(word, createInitialState(), {
        includeStateSnapshots: true
      });
      const shin = extractShinPayload(run);
      const reshEntry = findTokenEntry(run.deepTrace, "ר");
      const reshExit = tokenExitSnapshot(reshEntry);

      expect(shin.direction).toBe("external");
      expect(selectionTargets(reshEntry)).toEqual([]);
      expect(countEdgesFromToSet(run.state.cont, shin.focus, shin.ports)).toBe(3);
      expect(countEdgesWithinSet(run.state.sub, shin.ports)).toBe(0);
      expect(hasDirectedTriangleCycle(run.state.sub, shin.ports)).toBe(false);
      expect(reshExit.boundaries).toEqual([]);
      expect(reshExit.supp).toEqual([]);
      expect(reshExit.head_of?.length).toBe(1);
    }
  });

  it("7i: keeps all paired diacritics identical except shin/sin direction dots", () => {
    const pairs: Array<[string, string]> = [
      ["שָׂבָע", "שָׁבָע"],
      ["שָׂרָה", "שָׁרָה"],
      ["כבשׂ", "כבשׁ"]
    ];

    for (const [sinWord, shinWord] of pairs) {
      const sin = runProgramWithDeepTrace(sinWord, createInitialState(), {
        includeStateSnapshots: false
      });
      const shin = runProgramWithDeepTrace(shinWord, createInitialState(), {
        includeStateSnapshots: false
      });
      const sinPrepared = nonSpace(sin.preparedTokens);
      const shinPrepared = nonSpace(shin.preparedTokens);

      expect(sinPrepared).toHaveLength(shinPrepared.length);
      for (let index = 0; index < sinPrepared.length; index += 1) {
        expect(normalizedDiatriticKinds(sinPrepared[index] as PreparedTraceToken)).toEqual(
          normalizedDiatriticKinds(shinPrepared[index] as PreparedTraceToken)
        );
      }
    }
  });
});
