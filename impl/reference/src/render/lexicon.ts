import fs from "node:fs";
import path from "node:path";
import { TRACE_EVENT_KINDS, type TraceEventKind } from "../trace/types";
import { RENDER_VERSION, type SemVer } from "../version";

export const REQUIRED_VERBS = [
  "declare",
  "bind",
  "fork",
  "seal",
  "export",
  "discharge",
  "fall"
] as const;

export const REQUIRED_NOUNS = [
  "obligation",
  "handle",
  "boundary",
  "support",
  "memory-zone"
] as const;

export const REQUIRED_ROLES = ["rosh", "toch", "sof"] as const;

export const REQUIRED_TONE_RULES = ["literal", "no_metaphor", "no_creative_variants"] as const;

const TERM_PATTERN = /^[a-z][a-z0-9-]*$/u;
const TONE_RULE_PATTERN = /^[a-z][a-z0-9_-]*$/u;

export type AtomicEventTemplate = {
  verb: string;
  nouns: string[];
  roles?: string[];
};

export type RenderLexiconV1 = {
  lexicon_version: string;
  render_version: SemVer;
  style: "atomic";
  synonyms_policy: "none";
  tone_rules: string[];
  verbs: string[];
  nouns: string[];
  roles: string[];
  event_templates: Partial<Record<TraceEventKind, AtomicEventTemplate>> &
    Record<string, AtomicEventTemplate>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`render lexicon: ${label} must be a string`);
  }
  return value;
}

function requireStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`render lexicon: ${label} must be an array`);
  }
  const out: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (typeof item !== "string") {
      throw new Error(`render lexicon: ${label}[${index}] must be a string`);
    }
    out.push(item);
  }
  return out;
}

function requireTermArray(value: unknown, label: string): string[] {
  const out = requireStringArray(value, label);
  if (out.length === 0) {
    throw new Error(`render lexicon: ${label} must not be empty`);
  }
  const seen = new Set<string>();
  for (const term of out) {
    if (!TERM_PATTERN.test(term)) {
      throw new Error(
        `render lexicon: ${label} contains invalid term "${term}" (expected lowercase ASCII tokens)`
      );
    }
    if (seen.has(term)) {
      throw new Error(`render lexicon: ${label} contains duplicate term "${term}"`);
    }
    seen.add(term);
  }
  return out;
}

function requireToneRuleArray(value: unknown, label: string): string[] {
  const out = requireStringArray(value, label);
  if (out.length === 0) {
    throw new Error(`render lexicon: ${label} must not be empty`);
  }
  const seen = new Set<string>();
  for (const term of out) {
    if (!TONE_RULE_PATTERN.test(term)) {
      throw new Error(`render lexicon: ${label} contains invalid token "${term}"`);
    }
    if (seen.has(term)) {
      throw new Error(`render lexicon: ${label} contains duplicate term "${term}"`);
    }
    seen.add(term);
  }
  return out;
}

function requireIncludesAll(
  haystack: readonly string[],
  required: readonly string[],
  label: string
): void {
  const set = new Set(haystack);
  for (const term of required) {
    if (!set.has(term)) {
      throw new Error(`render lexicon: ${label} must include required term "${term}"`);
    }
  }
}

export function defaultLexiconV1Path(): string {
  return path.resolve(__dirname, "../../../../render/lexicon.v1.yml");
}

export function parseLexiconV1Text(text: string): RenderLexiconV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `render lexicon: lexicon.v1.yml must be YAML 1.2 JSON-compatible text (${String(error)})`
    );
  }
  if (!isRecord(parsed)) {
    throw new Error("render lexicon: root must be an object");
  }
  return parsed as RenderLexiconV1;
}

export function validateLexiconV1(lexicon: RenderLexiconV1): void {
  requireString(lexicon.lexicon_version, "lexicon_version");
  if (lexicon.style !== "atomic") {
    throw new Error(`render lexicon: style must be "atomic", received "${String(lexicon.style)}"`);
  }
  if (lexicon.synonyms_policy !== "none") {
    throw new Error(
      `render lexicon: synonyms_policy must be "none", received "${String(lexicon.synonyms_policy)}"`
    );
  }
  if (lexicon.render_version !== RENDER_VERSION) {
    throw new Error(
      `render lexicon: render_version "${lexicon.render_version}" must match RENDER_VERSION "${RENDER_VERSION}"`
    );
  }

  const verbs = requireTermArray(lexicon.verbs, "verbs");
  const nouns = requireTermArray(lexicon.nouns, "nouns");
  const roles = requireTermArray(lexicon.roles, "roles");
  const toneRules = requireToneRuleArray(lexicon.tone_rules, "tone_rules");

  requireIncludesAll(verbs, REQUIRED_VERBS, "verbs");
  requireIncludesAll(nouns, REQUIRED_NOUNS, "nouns");
  requireIncludesAll(roles, REQUIRED_ROLES, "roles");
  requireIncludesAll(toneRules, REQUIRED_TONE_RULES, "tone_rules");

  if (!isRecord(lexicon.event_templates)) {
    throw new Error("render lexicon: event_templates must be an object");
  }

  const verbSet = new Set(verbs);
  const nounSet = new Set(nouns);
  const roleSet = new Set(roles);
  const eventKinds = new Set(TRACE_EVENT_KINDS as readonly string[]);
  const templates = lexicon.event_templates;

  for (const eventKind of TRACE_EVENT_KINDS) {
    const template = templates[eventKind];
    if (!template) {
      throw new Error(`render lexicon: missing event template for "${eventKind}"`);
    }
  }

  for (const [eventKind, templateValue] of Object.entries(templates)) {
    if (!eventKinds.has(eventKind)) {
      throw new Error(`render lexicon: unknown event template key "${eventKind}"`);
    }
    if (!isRecord(templateValue)) {
      throw new Error(`render lexicon: event template "${eventKind}" must be an object`);
    }

    const verb = requireString(templateValue.verb, `event_templates.${eventKind}.verb`);
    if (!verbSet.has(verb)) {
      throw new Error(`render lexicon: event template "${eventKind}" uses unknown verb "${verb}"`);
    }

    const templateNouns = requireTermArray(
      templateValue.nouns,
      `event_templates.${eventKind}.nouns`
    );
    for (const noun of templateNouns) {
      if (!nounSet.has(noun)) {
        throw new Error(
          `render lexicon: event template "${eventKind}" uses unknown noun "${noun}"`
        );
      }
    }

    if (templateValue.roles !== undefined) {
      const templateRoles = requireTermArray(
        templateValue.roles,
        `event_templates.${eventKind}.roles`
      );
      for (const role of templateRoles) {
        if (!roleSet.has(role)) {
          throw new Error(
            `render lexicon: event template "${eventKind}" uses unknown role "${role}"`
          );
        }
      }
    }
  }
}

export function loadLexiconV1(filePath: string = defaultLexiconV1Path()): RenderLexiconV1 {
  const raw = fs.readFileSync(filePath, "utf8");
  const lexicon = parseLexiconV1Text(raw);
  validateLexiconV1(lexicon);
  return lexicon;
}

export function collectLexiconTerms(lexicon: RenderLexiconV1): Set<string> {
  return new Set([...lexicon.verbs, ...lexicon.nouns, ...lexicon.roles]);
}
