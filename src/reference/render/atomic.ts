import { canonicalStringify } from "../trace/hash";
import { TRACE_EVENT_KINDS, type TraceEventKind } from "../trace/types";
import { collectLexiconTerms, loadLexiconV1, type RenderLexiconV1 } from "./lexicon";

const LEXICON = loadLexiconV1();
const EVENT_KIND_SET = new Set<string>(TRACE_EVENT_KINDS as readonly string[]);
const HANDLE_PAYLOAD_KEYS = new Set<string>([
  "active",
  "alias",
  "boundaryId",
  "child",
  "declaration",
  "domain",
  "endpoint",
  "exemplar",
  "focus",
  "from",
  "handle",
  "id",
  "inside",
  "left",
  "outside",
  "parent",
  "pin",
  "referent",
  "residueId",
  "right",
  "source",
  "spine",
  "target",
  "to",
  "zone"
]);

type ObligationPolicy = {
  kind: "support" | "memory-zone";
  keyFields: readonly string[];
};

const OBLIGATION_POLICY_BY_EVENT: Record<TraceEventKind, ObligationPolicy | null> = {
  "ALEPH.ALIAS": null,
  "GIMEL.BESTOW": null,
  "DALET.BOUNDARY_CLOSE": null,
  "RESH.BOUNDARY_CLOSE": null,
  "HE.DECLARE": null,
  "HE.DECLARE_BREATH": null,
  "HE.DECLARE_PIN": null,
  "HE.DECLARE_ALIAS": null,
  "ZAYIN.GATE": null,
  "HET.COMPARTMENT": null,
  "TET.COVERT": null,
  "LAMED.ENDPOINT": null,
  "MEM.OPEN": {
    kind: "memory-zone",
    keyFields: ["zone", "handle", "parent"]
  },
  "FINAL_MEM.CLOSE": {
    kind: "memory-zone",
    keyFields: ["zone", "handle", "parent"]
  },
  "NUN.SUPPORT_DEBT": {
    kind: "support",
    keyFields: ["parent", "child"]
  },
  "SAMEKH.SUPPORT_DISCHARGE": {
    kind: "support",
    keyFields: ["parent", "child"]
  },
  "PE.UTTER": null,
  "TSADI.ALIGN": null,
  "QOF.APPROX": null,
  "SHIN.FORK": null,
  "TAV.FINALIZE": null,
  "FINAL_NUN.SUPPORT_DEBT": {
    kind: "support",
    keyFields: ["parent", "child"]
  },
  "FINAL_NUN.SUPPORT_DISCHARGE": {
    kind: "support",
    keyFields: ["parent", "child"]
  },
  "FINAL_PE.UTTER_CLOSE": null,
  "FINAL_TSADI.ALIGN_FINAL": null,
  "SPACE.SUPPORT_DISCHARGE": {
    kind: "support",
    keyFields: ["parent", "child"]
  },
  "SPACE.BOUNDARY_AUTO_CLOSE": null,
  "SPACE.MEM_AUTO_CLOSE": {
    kind: "memory-zone",
    keyFields: ["zone", "handle", "parent", "count"]
  },
  "ERROR.RUNTIME": null,
  "ERROR.UNKNOWN_SIGNATURE": null,
  EXTENSION: null
};

export type AtomicEventRecord = {
  kind: TraceEventKind;
  index: number;
  tau: number;
  source: string;
  payload: unknown;
};

export type AtomicWordRecord = {
  ref_key: string;
  word_index: number;
  events: readonly AtomicEventRecord[];
};

export type AtomicRenderedEvent = {
  ref_key: string;
  word_index: number;
  event_index: number;
  event_kind: TraceEventKind;
  event_text: string;
};

export type AtomicRenderContext = {
  handlesByRaw: Map<string, string>;
  obligationsByKey: Map<string, string>;
  nextHandleIndex: number;
  nextObligationIndex: number;
};

function assertEventKind(value: string): asserts value is TraceEventKind {
  if (!EVENT_KIND_SET.has(value)) {
    throw new Error(`atomic renderer: unknown event kind "${value}"`);
  }
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function asFiniteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

function asNonNegativeInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 0) {
    return parsed;
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatPayloadValue(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value === null || value === undefined) {
    return "null";
  }
  return canonicalStringify(value);
}

function getHandleLabel(context: AtomicRenderContext, raw: string): string {
  const normalized = String(raw);
  const existing = context.handlesByRaw.get(normalized);
  if (existing) {
    return existing;
  }
  const next = `h${context.nextHandleIndex}`;
  context.nextHandleIndex += 1;
  context.handlesByRaw.set(normalized, next);
  return next;
}

function getObligationLabel(context: AtomicRenderContext, key: string): string {
  const existing = context.obligationsByKey.get(key);
  if (existing) {
    return existing;
  }
  const next = `o${context.nextObligationIndex}`;
  context.nextObligationIndex += 1;
  context.obligationsByKey.set(key, next);
  return next;
}

function buildObligationKey(event: AtomicEventRecord, policy: ObligationPolicy): string {
  const payload = isRecord(event.payload) ? event.payload : {};
  let hasAnyValue = false;
  const parts: string[] = [policy.kind];

  for (const key of policy.keyFields) {
    const value = payload[key];
    if (value === undefined || value === null || value === "") {
      parts.push(`${key}=_`);
      continue;
    }
    hasAnyValue = true;
    if (typeof value === "string") {
      parts.push(`${key}=${value}`);
      continue;
    }
    parts.push(`${key}=${canonicalStringify(value)}`);
  }

  if (!hasAnyValue) {
    parts.push(`event_index=${asNonNegativeInt(event.index, 0)}`);
  }

  return parts.join("|");
}

function renderPayloadFacts(event: AtomicEventRecord, context: AtomicRenderContext): string[] {
  if (!isRecord(event.payload)) {
    return [`payload=${formatPayloadValue(event.payload)}`];
  }

  const facts: string[] = [];
  const payload = event.payload;
  for (const key of Object.keys(payload).sort(compareText)) {
    const value = payload[key];
    if (typeof value === "string" && HANDLE_PAYLOAD_KEYS.has(key)) {
      facts.push(`payload.${key}=${getHandleLabel(context, value)}`);
      continue;
    }
    facts.push(`payload.${key}=${formatPayloadValue(value)}`);
  }
  return facts;
}

function compareAtomicEvents(left: AtomicEventRecord, right: AtomicEventRecord): number {
  const leftIndex = asNonNegativeInt(left.index, 0);
  const rightIndex = asNonNegativeInt(right.index, 0);
  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }

  const leftTau = asFiniteNumber(left.tau, 0);
  const rightTau = asFiniteNumber(right.tau, 0);
  if (leftTau !== rightTau) {
    return leftTau - rightTau;
  }

  const sourceCmp = compareText(String(left.source), String(right.source));
  if (sourceCmp !== 0) {
    return sourceCmp;
  }

  return compareText(left.kind, right.kind);
}

export function getAtomicLexicon(): RenderLexiconV1 {
  return LEXICON;
}

export function getAtomicAllowedTerms(): Set<string> {
  return collectLexiconTerms(LEXICON);
}

export function listAtomicEventKinds(): TraceEventKind[] {
  return [...TRACE_EVENT_KINDS];
}

export function renderAtomicEvent(kind: TraceEventKind): string {
  const template = LEXICON.event_templates[kind];
  if (!template) {
    throw new Error(`atomic renderer: missing template for "${kind}"`);
  }
  const parts = [template.verb, ...template.nouns];
  if (Array.isArray(template.roles) && template.roles.length > 0) {
    parts.push(...template.roles);
  }
  return parts.join(" ");
}

export function createAtomicRenderContext(): AtomicRenderContext {
  return {
    handlesByRaw: new Map<string, string>(),
    obligationsByKey: new Map<string, string>(),
    nextHandleIndex: 1,
    nextObligationIndex: 1
  };
}

export function renderAtomicTraceEvent(
  event: AtomicEventRecord,
  context: AtomicRenderContext = createAtomicRenderContext()
): string {
  assertEventKind(event.kind);

  const basePhrase = renderAtomicEvent(event.kind);
  const facts: string[] = [
    `kind=${event.kind}`,
    `source=${String(event.source)}`,
    `tau=${asFiniteNumber(event.tau, 0)}`
  ];

  const obligationPolicy = OBLIGATION_POLICY_BY_EVENT[event.kind];
  if (obligationPolicy) {
    const obligationKey = buildObligationKey(event, obligationPolicy);
    facts.push(`obligation=${getObligationLabel(context, obligationKey)}`);
  }

  facts.push(...renderPayloadFacts(event, context));
  return `${basePhrase} ${facts.join(" ")}.`;
}

export function renderAtomicWordEvents(word: AtomicWordRecord): AtomicRenderedEvent[] {
  const context = createAtomicRenderContext();
  const sortedEvents = [...word.events].sort(compareAtomicEvents);

  return sortedEvents.map((event, index) => ({
    ref_key: word.ref_key,
    word_index: asNonNegativeInt(word.word_index, 0),
    event_index: asNonNegativeInt(event.index, index),
    event_kind: event.kind,
    event_text: renderAtomicTraceEvent(event, context)
  }));
}

export function formatAtomicRenderedEvent(
  row: AtomicRenderedEvent,
  separator: string = "\t"
): string {
  return [row.ref_key, String(row.word_index), String(row.event_index), row.event_text].join(
    separator
  );
}

export function renderAtomicRenderedEventsText(
  rows: readonly AtomicRenderedEvent[],
  separator: string = "\t"
): string {
  if (rows.length === 0) {
    return "";
  }
  return `${rows.map((row) => formatAtomicRenderedEvent(row, separator)).join("\n")}\n`;
}

export function renderAtomicRenderedEventsJsonl(rows: readonly AtomicRenderedEvent[]): string {
  if (rows.length === 0) {
    return "";
  }
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

export function renderAtomicSkeleton(
  skeleton: readonly string[],
  separator: string = " ⇢ "
): string {
  if (skeleton.length === 0) {
    return "(no semantic events)";
  }
  const labels: string[] = [];
  for (const kind of skeleton) {
    assertEventKind(kind);
    labels.push(renderAtomicEvent(kind));
  }
  return labels.join(separator);
}
