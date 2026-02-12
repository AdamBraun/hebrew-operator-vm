import { TRACE_EVENT_KINDS, type TraceEventKind } from "../trace/types";
import { collectLexiconTerms, loadLexiconV1, type RenderLexiconV1 } from "./lexicon";

const LEXICON = loadLexiconV1();
const EVENT_KIND_SET = new Set<string>(TRACE_EVENT_KINDS as readonly string[]);

function assertEventKind(value: string): asserts value is TraceEventKind {
  if (!EVENT_KIND_SET.has(value)) {
    throw new Error(`atomic renderer: unknown event kind "${value}"`);
  }
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
