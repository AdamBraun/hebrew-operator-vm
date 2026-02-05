import { BOT_ID, Handle, OMEGA_ID, createHandle } from "./handles";
import type { Envelope } from "./policies";

export type ObligationKind = "MEM_ZONE" | "SUPPORT" | "BOUNDARY";

export type Obligation = {
  kind: ObligationKind;
  parent: string;
  child: string;
  payload: Record<string, any>;
  tau_created: number;
};

export type VMEvent = { type: string; tau: number; data: any };

export type VM = {
  tau: number;
  Omega: string;
  F: string;
  R: string;
  K: string[];
  E: Array<{ F: string; lambda: "student" | "group" | "class"; Omega_frame: string }>;
  W: string[];
  OStack_word: Obligation[];
  H: VMEvent[];
  A: string[];
  wordHasContent: boolean;
  wordLastSealedArtifact?: string;
  metaCounter?: Record<string, number>;
};

export type State = {
  vm: VM;
  handles: Map<string, Handle>;
  cont: Set<string>;
  links: Array<{ from: string; to: string; label: string }>;
  boundaries: Array<{ inside: string; outside: string; anchor: 0 | 1; id: string }>;
  rules: Array<{ id: string; target: string; patch: any; priority: number }>;
};

export function createInitialState(): State {
  const handles = new Map<string, Handle>();
  handles.set(OMEGA_ID, createHandle(OMEGA_ID, "scope"));
  handles.set(BOT_ID, createHandle(BOT_ID, "empty"));

  const vm: VM = {
    tau: 0,
    Omega: OMEGA_ID,
    F: OMEGA_ID,
    R: BOT_ID,
    K: [OMEGA_ID, BOT_ID],
    E: [],
    W: [],
    OStack_word: [],
    H: [],
    A: [],
    wordHasContent: false,
    wordLastSealedArtifact: undefined
  };

  return {
    vm,
    handles,
    cont: new Set(),
    links: [],
    boundaries: [],
    rules: []
  };
}

export function serializeState(state: State): Record<string, any> {
  const serializeEnvelope = (envelope: Envelope): Record<string, any> => ({
    ...envelope,
    ports: Array.from(envelope.ports).sort()
  });
  const { wordLastSealedArtifact, metaCounter, ...vmRest } = state.vm;
  const vm: Record<string, any> = { ...vmRest };
  if (wordLastSealedArtifact !== undefined) {
    vm.wordLastSealedArtifact = wordLastSealedArtifact;
  }
  if (metaCounter) {
    vm.metaCounter = { ...metaCounter };
  }
  return {
    vm,
    handles: Array.from(state.handles.entries())
      .map(([, handle]) => ({
        ...handle,
        envelope: serializeEnvelope(handle.envelope)
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    cont: Array.from(state.cont).sort(),
    links: [...state.links],
    boundaries: [...state.boundaries],
    rules: [...state.rules]
  };
}
