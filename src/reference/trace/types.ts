import type { SemVer, TraceVersion } from "../version";
export type { SemVer, TraceVersion } from "../version";

export type HandleId = string;

export type WordTraceRef = {
  book: string;
  chapter: number;
  verse: number;
  token_index: number;
};

export type VerseTraceRef = {
  book: string;
  chapter: number;
  verse: number;
};

export const TRACE_EVENT_SOURCES = [
  "vm_event",
  "derived_obligation",
  "derived_boundary",
  "error",
  "extension"
] as const;

export type TraceEventSource = (typeof TRACE_EVENT_SOURCES)[number];

export const TRACE_EVENT_KINDS = [
  "ALEPH.ALIAS",
  "GIMEL.BESTOW",
  "DALET.BOUNDARY_CLOSE",
  "RESH.BOUNDARY_CLOSE",
  "HE.DECLARE",
  "HE.DECLARE_BREATH",
  "HE.DECLARE_PIN",
  "HE.DECLARE_ALIAS",
  "ZAYIN.GATE",
  "HET.COMPARTMENT",
  "TET.COVERT",
  "LAMED.ENDPOINT",
  "MEM.OPEN",
  "FINAL_MEM.CLOSE",
  "NUN.SUPPORT_DEBT",
  "SAMEKH.SUPPORT_DISCHARGE",
  "PE.UTTER",
  "TSADI.ALIGN",
  "QOF.APPROX",
  "SHIN.FORK",
  "TAV.FINALIZE",
  "FINAL_NUN.SUPPORT_DEBT",
  "FINAL_NUN.SUPPORT_DISCHARGE",
  "FINAL_PE.UTTER_CLOSE",
  "FINAL_TSADI.ALIGN_FINAL",
  "SPACE.SUPPORT_DISCHARGE",
  "SPACE.BOUNDARY_AUTO_CLOSE",
  "SPACE.MEM_AUTO_CLOSE",
  "ERROR.RUNTIME",
  "ERROR.UNKNOWN_SIGNATURE",
  "EXTENSION"
] as const;

export type TraceEventKind = (typeof TRACE_EVENT_KINDS)[number];
export type KnownTraceEventKind = Exclude<TraceEventKind, "EXTENSION">;

export type FlowMode = "WORD" | "VERSE" | "WINDOW";

export type TraceEventBase<
  K extends TraceEventKind,
  S extends TraceEventSource,
  P extends Record<string, unknown>
> = {
  kind: K;
  index: number;
  tau: number;
  source: S;
  payload: P;
};

export type AliasEvent = TraceEventBase<
  "ALEPH.ALIAS",
  "vm_event",
  {
    id: HandleId;
    left: HandleId;
    right: HandleId;
  }
>;

export type BestowEvent = TraceEventBase<
  "GIMEL.BESTOW",
  "vm_event",
  {
    from: HandleId;
    to: HandleId;
    payload: unknown;
  }
>;

export type BoundaryCloseEvent = TraceEventBase<
  "DALET.BOUNDARY_CLOSE" | "RESH.BOUNDARY_CLOSE",
  "vm_event",
  {
    id: HandleId;
    inside: HandleId;
    outside: HandleId;
    anchor?: 0 | 1;
  }
>;

export type DeclareEvent = TraceEventBase<
  "HE.DECLARE",
  "vm_event",
  {
    id: HandleId;
    target: HandleId;
    mode: "public" | "pinned" | "alias";
  }
>;

export type DeclareBreathEvent = TraceEventBase<
  "HE.DECLARE_BREATH",
  "vm_event",
  {
    target: HandleId;
  }
>;

export type DeclarePinEvent = TraceEventBase<
  "HE.DECLARE_PIN",
  "vm_event",
  {
    declaration: HandleId;
    pin: HandleId;
  }
>;

export type DeclareAliasEvent = TraceEventBase<
  "HE.DECLARE_ALIAS",
  "vm_event",
  {
    declaration: HandleId;
    referent: HandleId;
    alias: HandleId;
  }
>;

export type GateEvent = TraceEventBase<
  "ZAYIN.GATE",
  "vm_event",
  {
    id: HandleId;
    target: HandleId;
  }
>;

export type CompartmentEvent = TraceEventBase<
  "HET.COMPARTMENT",
  "vm_event",
  {
    id: HandleId;
    inside: HandleId;
    outside: HandleId;
    boundaryId: HandleId;
  }
>;

export type CovertEvent = TraceEventBase<
  "TET.COVERT",
  "vm_event",
  {
    id: HandleId;
    target: HandleId;
    patch: unknown;
  }
>;

export type EndpointEvent = TraceEventBase<
  "LAMED.ENDPOINT",
  "vm_event",
  {
    id: HandleId;
    endpoint: HandleId;
    domain: HandleId;
    boundaryId: HandleId;
  }
>;

export type MemOpenEvent = TraceEventBase<
  "MEM.OPEN",
  "derived_obligation",
  {
    obligation_kind: "MEM_ZONE";
    action: "open";
    parent?: HandleId;
    zone?: HandleId;
  }
>;

export type FinalMemCloseEvent = TraceEventBase<
  "FINAL_MEM.CLOSE",
  "derived_obligation",
  {
    obligation_kind: "MEM_ZONE";
    action: "close";
    mode: "existing" | "synthetic";
    zone?: HandleId;
    handle?: HandleId;
  }
>;

export type NunSupportDebtEvent = TraceEventBase<
  "NUN.SUPPORT_DEBT",
  "derived_obligation",
  {
    obligation_kind: "SUPPORT";
    action: "open";
    parent?: HandleId;
    child?: HandleId;
  }
>;

export type SupportDischargeEvent = TraceEventBase<
  "SAMEKH.SUPPORT_DISCHARGE",
  "vm_event",
  {
    child: HandleId;
    parent: HandleId;
  }
>;

export type UtterEvent = TraceEventBase<
  "PE.UTTER",
  "vm_event",
  {
    id: HandleId;
    source: HandleId;
    payload: unknown;
    target: HandleId;
  }
>;

export type AlignEvent = TraceEventBase<
  "TSADI.ALIGN",
  "vm_event",
  {
    id: HandleId;
    focus: HandleId;
    exemplar: HandleId;
  }
>;

export type ApproxEvent = TraceEventBase<
  "QOF.APPROX",
  "vm_event",
  {
    id: HandleId;
    left: HandleId;
    right: HandleId;
  }
>;

export type ShinEvent = TraceEventBase<
  "SHIN.FORK",
  "vm_event",
  {
    id: HandleId;
    focus: HandleId;
    spine: HandleId;
    left: HandleId;
    right: HandleId;
    active?: HandleId;
    direction?: "external" | "internal";
  }
>;

export type FinalizeEvent = TraceEventBase<
  "TAV.FINALIZE",
  "vm_event",
  {
    id: HandleId;
    target: HandleId;
    outside: HandleId;
    boundaryId: HandleId;
    residueId: HandleId;
  }
>;

export type FinalNunSupportDebtEvent = TraceEventBase<
  "FINAL_NUN.SUPPORT_DEBT",
  "derived_obligation",
  {
    obligation_kind: "SUPPORT";
    action: "open";
    parent?: HandleId;
    child?: HandleId;
  }
>;

export type FinalNunSupportDischargeEvent = TraceEventBase<
  "FINAL_NUN.SUPPORT_DISCHARGE",
  "derived_obligation",
  {
    obligation_kind: "SUPPORT";
    action: "discharge";
    mode: "same_word";
    parent?: HandleId;
    child?: HandleId;
  }
>;

export type FinalPeCloseEvent = TraceEventBase<
  "FINAL_PE.UTTER_CLOSE",
  "vm_event",
  {
    id: HandleId;
  }
>;

export type FinalTsadiAlignEvent = TraceEventBase<
  "FINAL_TSADI.ALIGN_FINAL",
  "vm_event",
  {
    id: HandleId;
    focus: HandleId;
    exemplar: HandleId;
  }
>;

export type SpaceSupportDischargeEvent = TraceEventBase<
  "SPACE.SUPPORT_DISCHARGE",
  "vm_event",
  {
    child: HandleId;
    parent: HandleId;
  }
>;

export type SpaceBoundaryAutoCloseEvent = TraceEventBase<
  "SPACE.BOUNDARY_AUTO_CLOSE",
  "vm_event",
  {
    id: HandleId;
    inside: HandleId;
    outside: HandleId;
  }
>;

export type SpaceMemAutoCloseEvent = TraceEventBase<
  "SPACE.MEM_AUTO_CLOSE",
  "derived_boundary",
  {
    obligation_kind: "MEM_ZONE";
    action: "auto_close";
    count?: number;
    zone?: HandleId;
  }
>;

export type RuntimeErrorEvent = TraceEventBase<
  "ERROR.RUNTIME",
  "error",
  {
    message: string;
    name?: string;
  }
>;

export type UnknownSignatureErrorEvent = TraceEventBase<
  "ERROR.UNKNOWN_SIGNATURE",
  "error",
  {
    signature: string;
  }
>;

export type ExtensionEvent = TraceEventBase<
  "EXTENSION",
  "extension",
  {
    extension_kind: string;
    data: unknown;
  }
>;

export type TraceEvent =
  | AliasEvent
  | BestowEvent
  | BoundaryCloseEvent
  | DeclareEvent
  | DeclareBreathEvent
  | DeclarePinEvent
  | DeclareAliasEvent
  | GateEvent
  | CompartmentEvent
  | CovertEvent
  | EndpointEvent
  | MemOpenEvent
  | FinalMemCloseEvent
  | NunSupportDebtEvent
  | SupportDischargeEvent
  | UtterEvent
  | AlignEvent
  | ApproxEvent
  | ShinEvent
  | FinalizeEvent
  | FinalNunSupportDebtEvent
  | FinalNunSupportDischargeEvent
  | FinalPeCloseEvent
  | FinalTsadiAlignEvent
  | SpaceSupportDischargeEvent
  | SpaceBoundaryAutoCloseEvent
  | SpaceMemAutoCloseEvent
  | RuntimeErrorEvent
  | UnknownSignatureErrorEvent
  | ExtensionEvent;

export type CrossWordEvent = {
  ref_key: string;
  token_index: number;
  baseline_skeleton: KnownTraceEventKind[];
  observed_skeleton: KnownTraceEventKind[];
  explanation: string;
};

export type VerseBoundaryOperator = {
  op_family: "VERSE.BOUNDARY_RESOLUTION";
  trigger: "explicit_verse_boundary";
  support_opened: number;
  support_discharged: number;
  support_resolved_at_boundary: number;
  mem_opened: number;
  mem_closed: number;
  mem_resolved_at_boundary: number;
  boundary_ops_seen: number;
  finalize_refs: string[];
  action: "discharge_or_close_pending" | "confirm_stable_closure";
};

export type PhraseBreakEvent = {
  kind: "PHRASE_BREAK";
  phrase_node_id: string;
  split_word_index: number;
  word_span: {
    start: number;
    end: number;
  };
  evidence: {
    verse_ref_key: string;
    phrase_version: string;
  };
};

export type VerseBoundaryEvents = {
  total: number;
  by_type: Record<string, number>;
  verse_end: string[];
  phrase_breaks: PhraseBreakEvent[];
  verse_boundary_operator: VerseBoundaryOperator;
};

export type NotableMotif = {
  motif: string;
  count: number;
  samples?: unknown[];
  refs?: string[];
  ops?: string[];
  action?: string;
};

export type SafetyRail = {
  active: boolean;
  provisional_delta_count: number;
  provisional_delta_rate: number;
  threshold: number;
};

export type WordTraceRecord = {
  record_kind: "WORD_TRACE";
  trace_version: TraceVersion;
  semantics_version: SemVer;
  render_version: SemVer;
  ref: WordTraceRef;
  ref_key: string;
  surface: string;
  token_ids: number[];
  events: TraceEvent[];
  skeleton?: KnownTraceEventKind[];
  flow?: string;
  mode?: FlowMode;
  window_start?: number;
  canonical_hash?: string;
  extensions?: Record<string, unknown>;
};

export type VerseTraceRecord = {
  record_kind: "VERSE_TRACE";
  trace_version: TraceVersion;
  semantics_version: SemVer;
  render_version: SemVer;
  ref: VerseTraceRef;
  ref_key: string;
  mode: string;
  words_total: number;
  total_events: number;
  boundary_events: VerseBoundaryEvents;
  cross_word_events: CrossWordEvent[];
  notable_motifs: NotableMotif[];
  window_size?: number;
  safety_rail?: SafetyRail;
  canonical_hash?: string;
  extensions?: Record<string, unknown>;
};

export type TraceRecord = WordTraceRecord | VerseTraceRecord;

export const TRACE_EVENT_SOURCE_ORDER: Record<TraceEventSource, number> = {
  vm_event: 0,
  derived_obligation: 1,
  derived_boundary: 2,
  error: 3,
  extension: 4
};

export function compareTraceEvents(left: TraceEvent, right: TraceEvent): number {
  if (left.index !== right.index) {
    return left.index - right.index;
  }
  if (left.tau !== right.tau) {
    return left.tau - right.tau;
  }
  const sourceRank = TRACE_EVENT_SOURCE_ORDER[left.source] - TRACE_EVENT_SOURCE_ORDER[right.source];
  if (sourceRank !== 0) {
    return sourceRank;
  }
  return left.kind.localeCompare(right.kind, "en");
}

export function deriveSkeleton(events: readonly TraceEvent[]): KnownTraceEventKind[] {
  const out: KnownTraceEventKind[] = [];
  for (const event of events) {
    if (event.kind === "EXTENSION") {
      continue;
    }
    out.push(event.kind);
  }
  return out;
}

export function isTraceEventKind(value: string): value is TraceEventKind {
  return (TRACE_EVENT_KINDS as readonly string[]).includes(value);
}
