#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import traceSchemaAdapter from "./lib/trace-schema-adapter.cjs";

const cjsRequire = createRequire(import.meta.url);
const { getSemanticVersion } = traceSchemaAdapter;

function loadTorahCorpusArgs() {
  const argsModulePath = path.resolve(process.cwd(), "impl/reference/dist/scripts/torahCorpus/args");
  try {
    return cjsRequire(argsModulePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "MODULE_NOT_FOUND") {
      throw new Error(
        "Missing compiled torah corpus args module. Run `npm run build` before `node scripts/torah-corpus.mjs`."
      );
    }
    throw error;
  }
}

const torahCorpusArgs = loadTorahCorpusArgs();
const {
  DEFAULT_INPUT,
  DEFAULT_OUT_DIR,
  DEFAULT_PROMOTE_OUT,
  DEFAULT_TRACE_OUT,
  DEFAULT_FLOWS_OUT,
  DEFAULT_EXECUTION_REPORT_OUT,
  DEFAULT_VERSE_TRACE_OUT,
  DEFAULT_VERSE_EXECUTION_REPORT_OUT,
  DEFAULT_VERSE_MOTIF_INDEX_OUT,
  DEFAULT_DIFF_REPORT_OUT,
  DEFAULT_GOLDENS_OUT,
  DEFAULT_REGRESSION_REPORT_OUT,
  DEFAULT_TOKEN_REGISTRY_PATH,
  DEFAULT_COMPILED_BUNDLES_PATH,
  DEFAULT_SEMANTICS_DEFS_PATH,
  DEFAULT_WINDOW_SIZE,
  printHelp,
  parseCommonRunArgs,
  parseExecuteArgs,
  parseDiffArgs,
  parsePromoteArgs,
  parseVerifyArgs,
  parseRegressArgs
} = torahCorpusArgs;

function loadTorahCorpusReport() {
  const reportModulePath = path.resolve(process.cwd(), "impl/reference/dist/scripts/torahCorpus/report");
  try {
    return cjsRequire(reportModulePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "MODULE_NOT_FOUND") {
      throw new Error(
        "Missing compiled torah corpus report module. Run `npm run build` before `node scripts/torah-corpus.mjs`."
      );
    }
    throw error;
  }
}

const torahCorpusReport = loadTorahCorpusReport();
const {
  workspaceRelativePath,
  totalFromCounts,
  formatWarningCounts,
  summarizeSemanticVersions,
  prettyRef,
  markdownSafe
} = torahCorpusReport;

function loadTorahCorpusExecute() {
  const executeModulePath = path.resolve(
    process.cwd(),
    "impl/reference/dist/scripts/torahCorpus/execute"
  );
  try {
    return cjsRequire(executeModulePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "MODULE_NOT_FOUND") {
      throw new Error(
        "Missing compiled torah corpus execute module. Run `npm run build` before `node scripts/torah-corpus.mjs`."
      );
    }
    throw error;
  }
}

const torahCorpusExecute = loadTorahCorpusExecute();
const { buildExecuteReports } = torahCorpusExecute;

function loadTorahCorpusDiff() {
  const diffModulePath = path.resolve(process.cwd(), "impl/reference/dist/scripts/torahCorpus/diff");
  try {
    return cjsRequire(diffModulePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "MODULE_NOT_FOUND") {
      throw new Error(
        "Missing compiled torah corpus diff module. Run `npm run build` before `node scripts/torah-corpus.mjs`."
      );
    }
    throw error;
  }
}

const torahCorpusDiff = loadTorahCorpusDiff();
const { buildDiffPayload } = torahCorpusDiff;

function loadTorahCorpusRegress() {
  const regressModulePath = path.resolve(
    process.cwd(),
    "impl/reference/dist/scripts/torahCorpus/regress"
  );
  try {
    return cjsRequire(regressModulePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "MODULE_NOT_FOUND") {
      throw new Error(
        "Missing compiled torah corpus regress module. Run `npm run build` before `node scripts/torah-corpus.mjs`."
      );
    }
    throw error;
  }
}

const torahCorpusRegress = loadTorahCorpusRegress();
const { buildCuratedGoldens, buildRegressionReport } = torahCorpusRegress;

const TRACE_VERSION = "1.0.0";
const TRACE_RENDER_VERSION = "1.0.0";
const SPACE_TOKEN = "□";

const FINAL_MAP = {
  ך: "כ",
  ם: "מ",
  ן: "נ",
  ף: "פ",
  ץ: "צ"
};

const HEBREW_LETTERS = new Set([
  "א",
  "ב",
  "ג",
  "ד",
  "ה",
  "ו",
  "ז",
  "ח",
  "ט",
  "י",
  "כ",
  "ך",
  "ל",
  "מ",
  "ם",
  "נ",
  "ן",
  "ס",
  "ע",
  "פ",
  "ף",
  "צ",
  "ץ",
  "ק",
  "ר",
  "ש",
  "ת"
]);

const ALLOWED_MARKS = new Set([
  "\u05B0",
  "\u05B1",
  "\u05B2",
  "\u05B3",
  "\u05B4",
  "\u05B5",
  "\u05B6",
  "\u05B7",
  "\u05B8",
  "\u05B9",
  "\u05BB",
  "\u05BC",
  "\u05C1",
  "\u05C2"
]);
const ALLOWED_MARK_CODEPOINTS = new Set(
  Array.from(ALLOWED_MARKS)
    .map((mark) => mark.codePointAt(0))
    .filter((codepoint) => codepoint !== undefined)
);
const SIGNATURE_MARK_ALIAS_MAP = new Map([[0x05c7, 0x05b8]]);

const RO_SH_ORDER = ["holam"];
const TOCH_ORDER = ["mappiq", "shuruk", "dagesh", "shinDot", "sinDot"];
const SOF_ORDER = ["shva", "hiriq", "tzere", "segol", "patach", "kamatz", "kubutz"];

const DIACRITIC_KIND_MAP = {
  shva: "shva",
  hiriq: "hiriq",
  tzere: "tzere",
  segol: "segol",
  patach: "patach",
  kamatz: "kamatz",
  holam: "holam",
  kubutz: "kubutz",
  dagesh: "dagesh",
  shin_dot_right: "shinDot",
  shin_dot_left: "sinDot"
};

const OP_FLOW_LABEL = {
  "ALEPH.ALIAS": "א alias",
  "GIMEL.BESTOW": "ג bestowal",
  "DALET.BOUNDARY_CLOSE": "ד boundary close",
  "HE.DECLARE": "ה declare(public)",
  "HE.DECLARE_BREATH": "ה breath tail",
  "HE.DECLARE_PIN": "ה pin export",
  "HE.DECLARE_ALIAS": "ה declare+alias",
  "VAV.TRANSPORT": "ו transport",
  "ZAYIN.GATE": "ז gate",
  "HET.COMPARTMENT": "ח compartment",
  "TET.COVERT": "ט covert",
  "LAMED.ENDPOINT": "ל endpoint bind",
  "MEM.OPEN": "מ open mem-zone",
  "NUN.SUPPORT_DEBT": "נ support debt",
  "SAMEKH.SUPPORT_DISCHARGE": "ס support discharge",
  "AYIN.SELECT": "ע witness/select",
  "PE.UTTER": "פ utterance",
  "TSADI.ALIGN": "צ normalize-to-exemplar",
  "QOF.APPROX": "ק approximate",
  "RESH.BOUNDARY_CLOSE": "ר boundary close",
  "SHIN.FORK": "ש fork route",
  "TAV.FINALIZE": "ת finalize+stamp",
  "FINAL_KAF.FINALIZE": "ך final kaf seal",
  "FINAL_MEM.CLOSE": "ם close mem-zone",
  "FINAL_NUN.SUPPORT_DEBT": "ן support debt",
  "FINAL_NUN.SUPPORT_DISCHARGE": "ן same-word discharge",
  "FINAL_PE.UTTER_CLOSE": "ף close utterance",
  "FINAL_TSADI.ALIGN_FINAL": "ץ final align",
  "SPACE.SUPPORT_DISCHARGE": "□ boundary support discharge",
  "SPACE.BOUNDARY_AUTO_CLOSE": "□ boundary auto-close",
  "SPACE.MEM_AUTO_CLOSE": "□ mem auto-close"
};

const IMPORTANT_EVENT_TYPES = new Set([
  "alias",
  "bestow",
  "declare",
  "declare_breath",
  "declare_pin",
  "declare_alias",
  "finalize",
  "support",
  "fall",
  "align",
  "align_final",
  "boundary_close",
  "boundary_auto_close",
  "utter",
  "utter_close",
  "compartment",
  "endpoint",
  "covert",
  "gate",
  "approx",
  "shin"
]);

const BOUNDARY_FLOW_OPS = new Set([
  "SPACE.SUPPORT_DISCHARGE",
  "SPACE.BOUNDARY_AUTO_CLOSE",
  "SPACE.MEM_AUTO_CLOSE",
  "DALET.BOUNDARY_CLOSE",
  "RESH.BOUNDARY_CLOSE"
]);
const SUPPORT_DEBT_OPS = new Set(["NUN.SUPPORT_DEBT", "FINAL_NUN.SUPPORT_DEBT"]);
const SUPPORT_DISCHARGE_OPS = new Set([
  "SAMEKH.SUPPORT_DISCHARGE",
  "FINAL_NUN.SUPPORT_DISCHARGE",
  "SPACE.SUPPORT_DISCHARGE"
]);
const SAFETY_RAIL_ALLOWLIST = new Set([
  ...BOUNDARY_FLOW_OPS,
  ...SUPPORT_DEBT_OPS,
  ...SUPPORT_DISCHARGE_OPS,
  "MEM.OPEN",
  "FINAL_MEM.CLOSE"
]);

function sanitizeText(text, opts) {
  if (!text) {
    return "";
  }
  let cleaned = String(text);
  cleaned = cleaned.replace(/<[^>]*>/g, " ");
  cleaned = cleaned.replace(/&[^;]+;/g, " ");
  cleaned = cleaned.normalize("NFD");

  cleaned = cleaned.replace(/\u05C7/g, "\u05B8");
  cleaned = cleaned.replace(/\u05BE/g, " ");
  cleaned = cleaned.replace(/\u05C3/g, " ");
  cleaned = cleaned.replace(/\u05C0/g, " ");
  cleaned = cleaned.replace(/\u05F3|\u05F4/g, "");

  let out = "";
  let lastWasLetter = false;
  for (const ch of cleaned) {
    if (HEBREW_LETTERS.has(ch) || FINAL_MAP[ch]) {
      const normalized = opts.normalizeFinals && FINAL_MAP[ch] ? FINAL_MAP[ch] : ch;
      if (!HEBREW_LETTERS.has(normalized)) {
        continue;
      }
      out += normalized;
      lastWasLetter = true;
      continue;
    }
    if (ALLOWED_MARKS.has(ch)) {
      if (lastWasLetter) {
        out += ch;
      }
      continue;
    }
    if (/\s/u.test(ch)) {
      out += " ";
      lastWasLetter = false;
    }
  }

  return out.replace(/\s+/g, " ").trim();
}

function uniqPreserveOrder(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}

function sortByOrder(values, order) {
  const rank = new Map(order.map((item, index) => [item, index]));
  return [...values].sort((left, right) => {
    const leftRank = rank.has(left) ? rank.get(left) : Number.MAX_SAFE_INTEGER;
    const rightRank = rank.has(right) ? rank.get(right) : Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.localeCompare(right, "en");
  });
}

function mapTochKinds(token) {
  const toch = token.diacritics
    .filter((diacritic) => diacritic.tier === "toch")
    .map((diacritic) => DIACRITIC_KIND_MAP[diacritic.kind] ?? diacritic.kind);

  if (token.dot_kind === "mappiq") {
    const idx = toch.indexOf("dagesh");
    if (idx >= 0) {
      toch[idx] = "mappiq";
    } else {
      toch.push("mappiq");
    }
  } else if (token.dot_kind === "shuruk") {
    const idx = toch.indexOf("dagesh");
    if (idx >= 0) {
      toch[idx] = "shuruk";
    } else {
      toch.push("shuruk");
    }
  }

  return sortByOrder(uniqPreserveOrder(toch), TOCH_ORDER);
}

function tokenBaseLetter(token) {
  const normalized = String(token.raw ?? token.letter ?? "").normalize("NFD");
  return normalized.length > 0 ? normalized[0] : token.letter;
}

function deriveSignatureNotes(signature) {
  const notes = [];
  if (signature.toch.includes("mappiq")) {
    notes.push("forcesPinnedHehMode");
  }
  if (signature.toch.includes("shuruk")) {
    notes.push("seedsVavCarrierMode");
  }
  if (signature.toch.includes("sinDot")) {
    notes.push("sinCompositeReadSamekhShapeShin");
  }
  return notes;
}

function makeSignature(token) {
  const rosh = sortByOrder(
    uniqPreserveOrder(
      token.diacritics
        .filter((diacritic) => diacritic.tier === "rosh")
        .map((diacritic) => DIACRITIC_KIND_MAP[diacritic.kind] ?? diacritic.kind)
    ),
    RO_SH_ORDER
  );
  const toch = mapTochKinds(token);
  const sof = sortByOrder(
    uniqPreserveOrder(
      token.diacritics
        .filter((diacritic) => diacritic.tier === "sof")
        .map((diacritic) => DIACRITIC_KIND_MAP[diacritic.kind] ?? diacritic.kind)
    ),
    SOF_ORDER
  );

  const signature = {
    base: tokenBaseLetter(token),
    rosh,
    toch,
    sof
  };
  return { ...signature, notes: deriveSignatureNotes(signature) };
}

function signatureKey(signature) {
  return [
    signature.base,
    `r:${signature.rosh.join(",")}`,
    `t:${signature.toch.join(",")}`,
    `s:${signature.sof.join(",")}`
  ].join("|");
}

function toCodepoint(codepoint) {
  return `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

function encodeRegistrySignature(base, markCodepoints) {
  const marksValue =
    markCodepoints.length === 0 ? "NONE" : markCodepoints.map(toCodepoint).join(",");
  return `BASE=${base}|MARKS=${marksValue}`;
}

function parseCodepointString(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }
  const stripped = text.replace(/^U\+/iu, "");
  const parsed = Number.parseInt(stripped, 16);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function markCodepointsFromDescriptor(descriptor) {
  if (Array.isArray(descriptor?.marks)) {
    return descriptor.marks
      .map((mark) => parseCodepointString(mark))
      .filter((codepoint) => codepoint !== null);
  }

  if (typeof descriptor?.signature === "string") {
    const parts = descriptor.signature.split("|");
    const marksPart = parts.find((part) => part.startsWith("MARKS="));
    if (!marksPart) {
      return [];
    }
    const value = marksPart.slice("MARKS=".length);
    if (!value || value === "NONE") {
      return [];
    }
    return value
      .split(",")
      .map((mark) => parseCodepointString(mark))
      .filter((codepoint) => codepoint !== null);
  }

  return [];
}

function baseLetterFromDescriptor(descriptor) {
  if (typeof descriptor?.base === "string" && descriptor.base.length > 0) {
    return descriptor.base;
  }
  if (typeof descriptor?.signature === "string") {
    const match = descriptor.signature.match(/^BASE=([^|]+)\|MARKS=/u);
    if (match?.[1]) {
      return match[1];
    }
  }
  return "";
}

function normalizeMarkCodepointsForRuntime(markCodepoints) {
  const normalized = [];
  for (const markCodepoint of markCodepoints) {
    const mapped = SIGNATURE_MARK_ALIAS_MAP.get(markCodepoint) ?? markCodepoint;
    if (!ALLOWED_MARK_CODEPOINTS.has(mapped)) {
      continue;
    }
    normalized.push(mapped);
  }
  return normalized.sort((left, right) => left - right);
}

function tokenRegistrySignature(token) {
  const raw = String(token.raw ?? token.letter ?? "").normalize("NFD");
  const chars = [...raw];
  const base = chars[0] ?? tokenBaseLetter(token);
  const markCodepoints = normalizeMarkCodepointsForRuntime(
    chars
      .slice(1)
      .map((mark) => mark.codePointAt(0))
      .filter((codepoint) => codepoint !== undefined)
  );
  return encodeRegistrySignature(base, markCodepoints);
}

function buildTokenIdBySignature(registryPayload) {
  const descriptors = [];
  const map = new Map();
  const exactSignatures = new Set();

  for (const [tokenIdRaw, descriptor] of Object.entries(registryPayload?.tokens ?? {})) {
    const tokenId = Number(tokenIdRaw);
    if (!Number.isFinite(tokenId)) {
      continue;
    }

    const base = baseLetterFromDescriptor(descriptor);
    if (!base) {
      continue;
    }
    const descriptorMarkCodepoints = markCodepointsFromDescriptor(descriptor);
    const signature =
      descriptor?.signature ?? encodeRegistrySignature(base, descriptorMarkCodepoints);
    map.set(signature, tokenId);
    exactSignatures.add(signature);
    descriptors.push({ tokenId, base, signature, descriptorMarkCodepoints });
  }

  const ambiguousAliases = new Set();
  for (const descriptor of descriptors) {
    const normalizedSignature = encodeRegistrySignature(
      descriptor.base,
      normalizeMarkCodepointsForRuntime(descriptor.descriptorMarkCodepoints)
    );
    if (
      normalizedSignature === descriptor.signature ||
      exactSignatures.has(normalizedSignature) ||
      ambiguousAliases.has(normalizedSignature)
    ) {
      continue;
    }

    const existing = map.get(normalizedSignature);
    if (existing === undefined || existing === descriptor.tokenId) {
      map.set(normalizedSignature, descriptor.tokenId);
      continue;
    }

    map.delete(normalizedSignature);
    ambiguousAliases.add(normalizedSignature);
  }

  return map;
}

function dedupeConsecutive(values) {
  const out = [];
  for (const value of values) {
    if (out.length > 0 && out[out.length - 1] === value) {
      continue;
    }
    out.push(value);
  }
  return out;
}

function summarizeEvent(type, event, traceEntry) {
  switch (type) {
    case "declare":
      return `mode=${event.data?.mode ?? "public"}`;
    case "declare_breath":
      return "mode=breath";
    case "declare_pin":
      return "mode=pinned";
    case "declare_alias":
      return "mode=alias";
    case "bestow":
      return "directed transfer";
    case "finalize":
      return "hard finalize + stamp";
    case "align":
      return "normalize to exemplar";
    case "align_final":
      return "final alignment";
    case "support":
      return "same-word support discharge";
    case "fall":
      return "boundary support discharge";
    case "boundary_close":
      return traceEntry.read_op === "ד" ? "close via dalet" : "close via resh";
    case "boundary_auto_close":
      return "auto-close at space";
    case "alias":
      return "bidirectional alias bind";
    case "utter":
      return "open utterance";
    case "utter_close":
      return "close utterance";
    case "compartment":
      return "compartmentalize";
    case "endpoint":
      return "pin endpoint";
    case "covert":
      return "covert annotation";
    case "gate":
      return "gate target";
    case "approx":
      return "approximation bind";
    case "shin":
      return "route fork";
    default:
      return "event";
  }
}

function asHandleId(value, fallback = "unknown") {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

function mapRawEventToFlow(event, traceEntry) {
  const data = event?.data ?? {};
  switch (event.type) {
    case "align":
      return {
        op_family: "TSADI.ALIGN",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          id: asHandleId(data.id),
          focus: asHandleId(data.focus),
          exemplar: asHandleId(data.exemplar)
        }
      };
    case "align_final":
      return {
        op_family: "FINAL_TSADI.ALIGN_FINAL",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          id: asHandleId(data.id),
          focus: asHandleId(data.focus),
          exemplar: asHandleId(data.exemplar)
        }
      };
    case "finalize":
      return {
        op_family: "TAV.FINALIZE",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          id: asHandleId(data.id),
          target: asHandleId(data.target),
          outside: asHandleId(data.outside),
          boundaryId: asHandleId(data.boundaryId),
          residueId: asHandleId(data.residueId)
        }
      };
    case "bestow":
      return {
        op_family: "GIMEL.BESTOW",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          from: asHandleId(data.from),
          to: asHandleId(data.to),
          payload: data.payload
        }
      };
    case "declare":
      return {
        op_family: "HE.DECLARE",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          id: asHandleId(data.id),
          target: asHandleId(data.target),
          mode: data.mode === "pinned" || data.mode === "alias" ? data.mode : "public"
        }
      };
    case "declare_breath":
      return {
        op_family: "HE.DECLARE_BREATH",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          target: asHandleId(data.target)
        }
      };
    case "declare_pin":
      return {
        op_family: "HE.DECLARE_PIN",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          declaration: asHandleId(data.declaration),
          pin: asHandleId(data.pin)
        }
      };
    case "declare_alias":
      return {
        op_family: "HE.DECLARE_ALIAS",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          declaration: asHandleId(data.declaration),
          referent: asHandleId(data.referent),
          alias: asHandleId(data.alias)
        }
      };
    case "alias":
      return {
        op_family: "ALEPH.ALIAS",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          id: asHandleId(data.id),
          left: asHandleId(data.left),
          right: asHandleId(data.right)
        }
      };
    case "support":
      return {
        op_family: "SAMEKH.SUPPORT_DISCHARGE",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          child: asHandleId(data.child),
          parent: asHandleId(data.parent)
        }
      };
    case "fall":
      return {
        op_family: "SPACE.SUPPORT_DISCHARGE",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          child: asHandleId(data.child),
          parent: asHandleId(data.parent)
        }
      };
    case "boundary_auto_close":
      return {
        op_family: "SPACE.BOUNDARY_AUTO_CLOSE",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          id: asHandleId(data.id),
          inside: asHandleId(data.inside),
          outside: asHandleId(data.outside)
        }
      };
    case "boundary_close": {
      const payload = {
        id: asHandleId(data.id),
        inside: asHandleId(data.inside),
        outside: asHandleId(data.outside)
      };
      if (data.anchor === 0 || data.anchor === 1) {
        payload.anchor = data.anchor;
      }
      return {
        op_family: traceEntry.read_op === "ד" ? "DALET.BOUNDARY_CLOSE" : "RESH.BOUNDARY_CLOSE",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload
      };
    }
    case "utter":
      return {
        op_family: "PE.UTTER",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          id: asHandleId(data.id),
          source: asHandleId(data.source),
          payload: data.payload,
          target: asHandleId(data.target)
        }
      };
    case "utter_close":
      return {
        op_family: "FINAL_PE.UTTER_CLOSE",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          id: asHandleId(data.id)
        }
      };
    case "compartment":
      return {
        op_family: "HET.COMPARTMENT",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          id: asHandleId(data.id),
          inside: asHandleId(data.inside),
          outside: asHandleId(data.outside),
          boundaryId: asHandleId(data.boundaryId)
        }
      };
    case "endpoint":
      return {
        op_family: "LAMED.ENDPOINT",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          id: asHandleId(data.id),
          endpoint: asHandleId(data.endpoint),
          domain: asHandleId(data.domain),
          boundaryId: asHandleId(data.boundaryId)
        }
      };
    case "covert":
      return {
        op_family: "TET.COVERT",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          id: asHandleId(data.id),
          target: asHandleId(data.target),
          patch: data.patch
        }
      };
    case "gate":
      return {
        op_family: "ZAYIN.GATE",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          id: asHandleId(data.id),
          target: asHandleId(data.target)
        }
      };
    case "approx":
      return {
        op_family: "QOF.APPROX",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          id: asHandleId(data.id),
          left: asHandleId(data.left),
          right: asHandleId(data.right)
        }
      };
    case "shin":
      return {
        op_family: "SHIN.FORK",
        params_summary: summarizeEvent(event.type, event, traceEntry),
        trace_source: "vm_event",
        payload: {
          id: asHandleId(data.id),
          focus: asHandleId(data.focus),
          spine: asHandleId(data.spine),
          left: asHandleId(data.left),
          right: asHandleId(data.right),
          active: asHandleId(data.active)
        }
      };
    default:
      return null;
  }
}

function compileFlowString(flowCompact, separator = " -> ") {
  if (flowCompact.length === 0) {
    return "(no semantic events)";
  }
  const labels = flowCompact.map((op) => OP_FLOW_LABEL[op] ?? op.toLowerCase());
  return labels.join(separator);
}

function compileOneLiner(flowCompact) {
  return compileFlowString(flowCompact, " -> ");
}

function makeRuntimeErrorTraceEvent(message) {
  return {
    kind: "ERROR.RUNTIME",
    index: 0,
    tau: 0,
    source: "error",
    payload: {
      message: String(message ?? "RuntimeError")
    }
  };
}

function makeUnknownSignatureTraceEvent(signature) {
  return {
    kind: "ERROR.UNKNOWN_SIGNATURE",
    index: 0,
    tau: 0,
    source: "error",
    payload: {
      signature: String(signature ?? "unknown")
    }
  };
}

function extractWordFlow(trace) {
  const events = [];
  const flow_skeleton = [];
  const flow_compact = [];
  const trace_events = [];

  let prevOStackLength = 0;

  const addFlow = (op_family, params_summary, source, traceEvent = null) => {
    events.push({ type: op_family, source, params_summary });
    flow_skeleton.push([op_family, params_summary]);
    flow_compact.push(op_family);
    if (traceEvent) {
      trace_events.push({
        kind: op_family,
        index: trace_events.length,
        tau: Number(traceEvent.tau ?? 0),
        source: traceEvent.source,
        payload: traceEvent.payload
      });
    }
  };

  for (const traceEntry of trace) {
    const delta = traceEntry.OStackLength - prevOStackLength;
    prevOStackLength = traceEntry.OStackLength;

    if (traceEntry.read_op === "מ" && delta > 0) {
      addFlow("MEM.OPEN", "open mem zone debt", "derived", {
        tau: traceEntry.tauAfter,
        source: "derived_obligation",
        payload: {
          obligation_kind: "MEM_ZONE",
          action: "open"
        }
      });
    }
    if (traceEntry.read_op === "ם") {
      addFlow(
        "FINAL_MEM.CLOSE",
        delta < 0 ? "close existing mem zone" : "close/synthesize mem zone",
        "derived",
        {
          tau: traceEntry.tauAfter,
          source: "derived_obligation",
          payload: {
            obligation_kind: "MEM_ZONE",
            action: "close",
            mode: delta < 0 ? "existing" : "synthetic"
          }
        }
      );
    }
    if (traceEntry.read_op === "נ" && delta > 0) {
      addFlow("NUN.SUPPORT_DEBT", "open support debt", "derived", {
        tau: traceEntry.tauAfter,
        source: "derived_obligation",
        payload: {
          obligation_kind: "SUPPORT",
          action: "open"
        }
      });
    }
    if (traceEntry.read_op === "ן") {
      addFlow("FINAL_NUN.SUPPORT_DEBT", "open support debt", "derived", {
        tau: traceEntry.tauAfter,
        source: "derived_obligation",
        payload: {
          obligation_kind: "SUPPORT",
          action: "open"
        }
      });
      addFlow("FINAL_NUN.SUPPORT_DISCHARGE", "immediate same-word discharge", "derived", {
        tau: traceEntry.tauAfter,
        source: "derived_obligation",
        payload: {
          obligation_kind: "SUPPORT",
          action: "discharge",
          mode: "same_word"
        }
      });
    }

    for (const event of traceEntry.events ?? []) {
      if (!IMPORTANT_EVENT_TYPES.has(event.type)) {
        continue;
      }
      const mapped = mapRawEventToFlow(event, traceEntry);
      if (!mapped) {
        continue;
      }
      addFlow(mapped.op_family, mapped.params_summary, "vm_event", {
        tau: event.tau,
        source: mapped.trace_source,
        payload: mapped.payload
      });
    }

    if (traceEntry.token === SPACE_TOKEN && delta < 0) {
      const supportFalls = (traceEntry.events ?? []).filter(
        (event) => event.type === "fall"
      ).length;
      const boundaryAuto = (traceEntry.events ?? []).filter(
        (event) => event.type === "boundary_auto_close"
      ).length;
      const memAutoClose = Math.max(0, -delta - supportFalls - boundaryAuto);
      for (let i = 0; i < memAutoClose; i += 1) {
        addFlow("SPACE.MEM_AUTO_CLOSE", "auto-close mem zone at boundary", "derived", {
          tau: traceEntry.tauAfter,
          source: "derived_boundary",
          payload: {
            obligation_kind: "MEM_ZONE",
            action: "auto_close",
            count: 1
          }
        });
      }
    }
  }

  return {
    events,
    flow_skeleton,
    flow_compact,
    trace_events,
    one_liner: compileOneLiner(flow_compact)
  };
}

function isBoundaryFlowOp(op) {
  return BOUNDARY_FLOW_OPS.has(op);
}

function extractBoundaryOps(skeleton) {
  return skeleton.filter((op) => isBoundaryFlowOp(op));
}

function splitTraceIntoWordSegments(trace) {
  const segments = [];
  let current = [];
  let pendingLeadingSpace = [];

  for (const traceEntry of trace) {
    if (traceEntry.token === SPACE_TOKEN) {
      if (current.length > 0) {
        current.push(traceEntry);
        segments.push(current);
        current = [];
      } else {
        pendingLeadingSpace = [traceEntry];
      }
      continue;
    }

    if (current.length === 0 && pendingLeadingSpace.length > 0) {
      current.push(pendingLeadingSpace[pendingLeadingSpace.length - 1]);
      pendingLeadingSpace = [];
    }
    current.push(traceEntry);
  }

  return segments;
}

function collectExecutableVerses(data, opts) {
  const verses = [];
  let versesTotal = 0;
  let versesSanitized = 0;
  let versesSkipped = 0;
  let wordsTotal = 0;

  for (const book of data.books ?? []) {
    const bookName = String(book?.name ?? "").trim();
    if (!bookName) {
      throw new Error("Missing explicit book name while collecting verse boundaries");
    }
    for (const chapter of book.chapters ?? []) {
      const chapterNumber = Number(chapter?.n);
      if (!Number.isFinite(chapterNumber)) {
        throw new Error(`Missing explicit chapter boundary in book ${bookName}`);
      }
      for (const verse of chapter.verses ?? []) {
        const verseNumber = Number(verse?.n);
        if (!Number.isFinite(verseNumber)) {
          throw new Error(`Missing explicit verse boundary in ${bookName} ${chapterNumber}`);
        }

        versesTotal += 1;
        const rawText =
          opts.lang === "en" ? verse.en : opts.lang === "both" ? (verse.he ?? verse.en) : verse.he;
        const cleaned = sanitizeText(rawText, opts);
        if (!cleaned) {
          versesSkipped += 1;
          continue;
        }
        if (String(rawText ?? "") !== cleaned) {
          versesSanitized += 1;
        }

        const words = cleaned.split(" ").filter(Boolean);
        if (words.length === 0) {
          versesSkipped += 1;
          continue;
        }
        wordsTotal += words.length;

        verses.push({
          ref: {
            book: bookName,
            chapter: chapterNumber,
            verse: verseNumber
          },
          ref_key: `${bookName}/${chapterNumber}/${verseNumber}`,
          words
        });
      }
    }
  }

  return {
    verses,
    stats: {
      versesTotal,
      versesSanitized,
      versesSkipped,
      wordsTotal
    }
  };
}

function resolveWordTokenIds({ surface, tokenize, tokenIdBySignature, compiledTokenIdSet }) {
  const tokens = tokenize(surface).filter((token) => token.letter !== SPACE_TOKEN);
  const token_ids = [];
  const unknown_signatures = [];
  const missing_bundle_ids = [];

  for (const token of tokens) {
    const signature = tokenRegistrySignature(token);
    const tokenId = tokenIdBySignature.get(signature);
    if (tokenId === undefined) {
      unknown_signatures.push(signature);
      continue;
    }
    token_ids.push(tokenId);
    if (!compiledTokenIdSet.has(String(tokenId))) {
      missing_bundle_ids.push(tokenId);
    }
  }

  return { token_ids, unknown_signatures, missing_bundle_ids };
}

function runIsolatedWordFlow({
  surface,
  runProgramWithTrace,
  createInitialState,
  allowRuntimeErrors
}) {
  try {
    const { trace } = runProgramWithTrace(surface, createInitialState());
    const flow = extractWordFlow(trace);
    return {
      flowRaw: flow.flow_compact,
      flowCompact: dedupeConsecutive(flow.flow_compact),
      traceEvents: flow.trace_events,
      runtimeErrorMessage: "",
      windowStart: 1
    };
  } catch (err) {
    if (!allowRuntimeErrors || err?.name !== "RuntimeError") {
      throw err;
    }
    const message = String(err?.message ?? "RuntimeError");
    return {
      flowRaw: ["ERROR.RUNTIME"],
      flowCompact: ["ERROR.RUNTIME"],
      traceEvents: [makeRuntimeErrorTraceEvent(message)],
      runtimeErrorMessage: message,
      windowStart: 1
    };
  }
}

function runVerseWordFlows({
  words,
  runProgramWithTrace,
  createInitialState,
  allowRuntimeErrors,
  verseRefKey
}) {
  try {
    const verseText = words.join(" ");
    const { trace } = runProgramWithTrace(verseText, createInitialState());
    const segments = splitTraceIntoWordSegments(trace);
    if (segments.length !== words.length) {
      throw new Error(
        `Verse trace segmentation failed for ${verseRefKey}: expected ${words.length} words, got ${segments.length}`
      );
    }
    return segments.map((segment) => {
      const flow = extractWordFlow(segment);
      return {
        flowRaw: flow.flow_compact,
        flowCompact: dedupeConsecutive(flow.flow_compact),
        traceEvents: flow.trace_events,
        runtimeErrorMessage: "",
        windowStart: 1
      };
    });
  } catch (err) {
    if (!allowRuntimeErrors || err?.name !== "RuntimeError") {
      throw err;
    }
    const message = String(err?.message ?? "RuntimeError");
    return words.map(() => ({
      flowRaw: ["ERROR.RUNTIME"],
      flowCompact: ["ERROR.RUNTIME"],
      traceEvents: [makeRuntimeErrorTraceEvent(message)],
      runtimeErrorMessage: message,
      windowStart: 1
    }));
  }
}

function runWindowWordFlows({
  words,
  windowSize,
  runProgramWithTrace,
  createInitialState,
  allowRuntimeErrors,
  verseRefKey
}) {
  const out = [];

  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    const windowStart = Math.max(0, wordIndex - windowSize + 1);
    const phraseText = words.slice(windowStart, wordIndex + 1).join(" ");

    try {
      const { trace } = runProgramWithTrace(phraseText, createInitialState());
      const segments = splitTraceIntoWordSegments(trace);
      const expectedSegments = wordIndex - windowStart + 1;
      if (segments.length !== expectedSegments) {
        throw new Error(
          `Window trace segmentation failed for ${verseRefKey} word ${wordIndex + 1}: expected ${expectedSegments}, got ${segments.length}`
        );
      }
      const flow = extractWordFlow(segments[segments.length - 1]);
      out.push({
        flowRaw: flow.flow_compact,
        flowCompact: dedupeConsecutive(flow.flow_compact),
        traceEvents: flow.trace_events,
        runtimeErrorMessage: "",
        windowStart: windowStart + 1
      });
    } catch (err) {
      if (!allowRuntimeErrors || err?.name !== "RuntimeError") {
        throw err;
      }
      const message = String(err?.message ?? "RuntimeError");
      out.push({
        flowRaw: ["ERROR.RUNTIME"],
        flowCompact: ["ERROR.RUNTIME"],
        traceEvents: [makeRuntimeErrorTraceEvent(message)],
        runtimeErrorMessage: message,
        windowStart: windowStart + 1
      });
    }
  }

  return out;
}

function explainDeltaByMode({ mode, tokenIndex, windowStart, boundaryOps }) {
  const parts = [];
  if (mode === "VERSE" && tokenIndex > 1) {
    parts.push(`shared verse state from words 1-${tokenIndex - 1}`);
  }
  if (mode === "WINDOW" && windowStart < tokenIndex) {
    parts.push(`sliding window context words ${windowStart}-${tokenIndex - 1}`);
  }
  if (boundaryOps.length > 0) {
    parts.push(`boundary operators observed: ${boundaryOps.join(", ")}`);
  }
  if (parts.length === 0) {
    parts.push("shared-state execution context");
  }
  return parts.join("; ");
}

function countOps(ops) {
  const counts = new Map();
  for (const op of ops) {
    counts.set(op, (counts.get(op) ?? 0) + 1);
  }
  return counts;
}

function skeletonDeltaOps(previousSkeleton, nextSkeleton) {
  const previousCounts = countOps(previousSkeleton);
  const nextCounts = countOps(nextSkeleton);
  const keys = new Set([...previousCounts.keys(), ...nextCounts.keys()]);
  const delta = [];
  for (const key of keys) {
    if ((previousCounts.get(key) ?? 0) !== (nextCounts.get(key) ?? 0)) {
      delta.push(key);
    }
  }
  return delta.sort(sortRefLike);
}

function isSafetyRailDeltaAllowed(deltaOps) {
  return deltaOps.every((op) => SAFETY_RAIL_ALLOWLIST.has(op));
}

function buildDebtDischargeSpans(verseWordRows) {
  const spans = [];
  for (let fromIndex = 0; fromIndex < verseWordRows.length; fromIndex += 1) {
    const fromRow = verseWordRows[fromIndex];
    const hasDebt = fromRow.skeleton.some((op) => SUPPORT_DEBT_OPS.has(op));
    if (!hasDebt) {
      continue;
    }
    for (let toIndex = fromIndex + 1; toIndex < verseWordRows.length; toIndex += 1) {
      const toRow = verseWordRows[toIndex];
      const hasDischarge = toRow.skeleton.some((op) => SUPPORT_DISCHARGE_OPS.has(op));
      if (!hasDischarge) {
        continue;
      }
      spans.push({
        from_ref_key: fromRow.ref_key,
        to_ref_key: toRow.ref_key,
        span_words: toIndex - fromIndex
      });
      break;
    }
  }
  return spans;
}

function buildVerseBoundaryResolution(verseWordRows, boundaryByType) {
  let supportOpened = 0;
  let supportDischarged = 0;
  let memOpened = 0;
  let memClosed = 0;
  const finalizeAtWord = [];

  for (let index = 0; index < verseWordRows.length; index += 1) {
    const row = verseWordRows[index];
    for (const op of row.skeleton) {
      if (SUPPORT_DEBT_OPS.has(op)) {
        supportOpened += 1;
      }
      if (SUPPORT_DISCHARGE_OPS.has(op)) {
        supportDischarged += 1;
      }
      if (op === "MEM.OPEN") {
        memOpened += 1;
      }
      if (op === "FINAL_MEM.CLOSE" || op === "SPACE.MEM_AUTO_CLOSE") {
        memClosed += 1;
      }
      if (op === "TAV.FINALIZE") {
        finalizeAtWord.push(row.ref_key);
      }
    }
  }

  const supportBalance = Math.max(0, supportOpened - supportDischarged);
  const memBalance = Math.max(0, memOpened - memClosed);
  const boundaryCount = Object.values(boundaryByType).reduce((sum, count) => sum + Number(count), 0);
  const requiresDischarge = supportBalance > 0 || memBalance > 0;

  return {
    op_family: "VERSE.BOUNDARY_RESOLUTION",
    trigger: "explicit_verse_boundary",
    support_opened: supportOpened,
    support_discharged: supportDischarged,
    support_resolved_at_boundary: supportBalance,
    mem_opened: memOpened,
    mem_closed: memClosed,
    mem_resolved_at_boundary: memBalance,
    boundary_ops_seen: boundaryCount,
    finalize_refs: finalizeAtWord.slice(0, 20),
    action: requiresDischarge ? "discharge_or_close_pending" : "confirm_stable_closure"
  };
}

function buildVerseMotifs({ verseWordRows, crossWordEvents, verseBoundaryResolution }) {
  const motifs = [];
  if (crossWordEvents.length > 0) {
    motifs.push({
      motif: "CROSS_WORD_DELTA",
      count: crossWordEvents.length,
      samples: crossWordEvents.slice(0, 6).map((event) => ({
        ref_key: event.ref_key,
        token_index: event.token_index
      }))
    });
  }

  const debtSpans = buildDebtDischargeSpans(verseWordRows);
  if (debtSpans.length > 0) {
    motifs.push({
      motif: "SUPPORT_DEBT_DISCHARGE_CROSS_WORD",
      count: debtSpans.length,
      samples: debtSpans.slice(0, 6)
    });
  }

  if (verseBoundaryResolution.boundary_ops_seen > 0) {
    motifs.push({
      motif: "VERSE_BOUNDARY_RESOLUTION",
      count: verseBoundaryResolution.boundary_ops_seen,
      action: verseBoundaryResolution.action
    });
  }

  if (verseBoundaryResolution.support_resolved_at_boundary > 0) {
    motifs.push({
      motif: "SUPPORT_RESOLVED_AT_VERSE_BOUNDARY",
      count: verseBoundaryResolution.support_resolved_at_boundary
    });
  }

  if (verseBoundaryResolution.mem_resolved_at_boundary > 0) {
    motifs.push({
      motif: "MEM_RESOLVED_AT_VERSE_BOUNDARY",
      count: verseBoundaryResolution.mem_resolved_at_boundary
    });
  }

  const finalizeRows = verseWordRows
    .filter((row) => row.skeleton.includes("TAV.FINALIZE"))
    .map((row) => row.ref_key);
  if (finalizeRows.length === 1 && finalizeRows[0] === verseWordRows[verseWordRows.length - 1].ref_key) {
    motifs.push({
      motif: "FINALIZE_AT_VERSE_EDGE",
      count: 1,
      refs: finalizeRows
    });
  }

  return motifs;
}

function buildVerseMotifIndex({
  modeLabel,
  semanticVersion,
  verseRows,
  safetyRailSummary,
  verseTraceSha256
}) {
  const motifByName = new Map();
  const boundaryCounts = {};
  let crossWordEventCount = 0;

  for (const row of verseRows) {
    crossWordEventCount += (row.cross_word_events ?? []).length;
    for (const [op, count] of Object.entries(row.boundary_events?.by_type ?? {})) {
      boundaryCounts[op] = (boundaryCounts[op] ?? 0) + Number(count);
    }
    for (const motif of row.notable_motifs ?? []) {
      const entry = motifByName.get(motif.motif) ?? {
        motif: motif.motif,
        count: 0,
        verse_refs: [],
        samples: []
      };
      entry.count += Number(motif.count ?? 0);
      if (entry.verse_refs.length < 40) {
        entry.verse_refs.push(row.ref_key);
      }
      const sampleCandidate = motif.samples ?? motif.refs ?? motif.ops ?? motif.action ?? null;
      if (sampleCandidate !== null && entry.samples.length < 20) {
        entry.samples.push(sampleCandidate);
      }
      motifByName.set(motif.motif, entry);
    }
  }

  const motifs = Array.from(motifByName.values()).sort(
    (left, right) => right.count - left.count || sortRefLike(left.motif, right.motif)
  );

  return {
    schema_version: 1,
    mode: modeLabel,
    semantic_version: semanticVersion,
    verse_trace_sha256: verseTraceSha256,
    verses_indexed: verseRows.length,
    cross_word_event_count: crossWordEventCount,
    boundary_operator_totals: sortCountObjectByKey(boundaryCounts),
    safety_rail: safetyRailSummary,
    motifs
  };
}

function buildPatternIndex(fullRows) {
  const explicitPatterns = {
    MEM_OPEN_TO_MEM_CLOSE: {
      description: "MEM.OPEN ... FINAL_MEM.CLOSE (or boundary mem auto-close)",
      occurrences: []
    },
    SUPPORT_DEBT_TO_SAMEWORD_DISCHARGE: {
      description: "support debt resolved in the same word",
      occurrences: []
    },
    FINALIZE_AT_END: {
      description: "word ends with TAV.FINALIZE",
      occurrences: []
    },
    HE_DECLARE_PUBLIC: {
      description: "HE.DECLARE (public)",
      occurrences: []
    },
    HE_DECLARE_BREATH: {
      description: "HE.DECLARE_BREATH (breath tail)",
      occurrences: []
    }
  };

  const bigrams = new Map();
  const trigrams = new Map();

  const addNgram = (store, pattern, ref_key) => {
    const key = pattern.join(" -> ");
    const entry = store.get(key) ?? { pattern, count: 0, occurrences: [] };
    entry.count += 1;
    if (entry.occurrences.length < 40) {
      entry.occurrences.push(ref_key);
    }
    store.set(key, entry);
  };

  for (const row of fullRows) {
    const ops = row.flow_compact;
    if (ops.length === 0) {
      continue;
    }

    const hasMemOpen = ops.includes("MEM.OPEN");
    const hasMemClose = ops.includes("FINAL_MEM.CLOSE") || ops.includes("SPACE.MEM_AUTO_CLOSE");
    if (hasMemOpen && hasMemClose) {
      explicitPatterns.MEM_OPEN_TO_MEM_CLOSE.occurrences.push(row.ref_key);
    }

    const hasSupportDebt =
      ops.includes("NUN.SUPPORT_DEBT") || ops.includes("FINAL_NUN.SUPPORT_DEBT");
    const hasSameWordDischarge =
      ops.includes("SAMEKH.SUPPORT_DISCHARGE") || ops.includes("FINAL_NUN.SUPPORT_DISCHARGE");
    if (hasSupportDebt && hasSameWordDischarge) {
      explicitPatterns.SUPPORT_DEBT_TO_SAMEWORD_DISCHARGE.occurrences.push(row.ref_key);
    }

    if (ops[ops.length - 1] === "TAV.FINALIZE") {
      explicitPatterns.FINALIZE_AT_END.occurrences.push(row.ref_key);
    }
    if (ops.includes("HE.DECLARE")) {
      explicitPatterns.HE_DECLARE_PUBLIC.occurrences.push(row.ref_key);
    }
    if (ops.includes("HE.DECLARE_BREATH")) {
      explicitPatterns.HE_DECLARE_BREATH.occurrences.push(row.ref_key);
    }

    for (let i = 0; i + 1 < ops.length; i += 1) {
      addNgram(bigrams, [ops[i], ops[i + 1]], row.ref_key);
    }
    for (let i = 0; i + 2 < ops.length; i += 1) {
      addNgram(trigrams, [ops[i], ops[i + 1], ops[i + 2]], row.ref_key);
    }
  }

  const toSortedArray = (map) =>
    Array.from(map.values())
      .sort(
        (left, right) =>
          right.count - left.count || left.pattern.join().localeCompare(right.pattern.join())
      )
      .slice(0, 250);

  return {
    explicit_patterns: Object.fromEntries(
      Object.entries(explicitPatterns).map(([key, value]) => [
        key,
        {
          description: value.description,
          count: value.occurrences.length,
          occurrences: value.occurrences
        }
      ])
    ),
    frequent_ngrams: {
      bigrams: toSortedArray(bigrams),
      trigrams: toSortedArray(trigrams)
    }
  };
}

function buildExemplarLibrary(fullRows) {
  const bySkeleton = new Map();

  for (const row of fullRows) {
    if (row.flow_compact.length === 0) {
      continue;
    }
    const key = row.flow_compact.join(" -> ");
    const entry = bySkeleton.get(key) ?? { flow_compact: row.flow_compact, count: 0, examples: [] };
    entry.count += 1;
    if (entry.examples.length < 3) {
      entry.examples.push({
        ref: row.ref,
        ref_key: row.ref_key,
        surface: row.surface,
        one_liner: row.one_liner
      });
    }
    bySkeleton.set(key, entry);
  }

  const top = Array.from(bySkeleton.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 60);

  return {
    exemplars: top.map((entry) => ({
      skeleton: entry.flow_compact,
      count: entry.count,
      examples: entry.examples
    }))
  };
}

function sha256FromBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function sha256FromFile(pathName) {
  const buffer = await fs.readFile(pathName);
  return sha256FromBuffer(buffer);
}

function countLines(rows) {
  return rows.length;
}

async function writeJson(pathName, payload) {
  await fs.mkdir(path.dirname(pathName), { recursive: true });
  await fs.writeFile(pathName, JSON.stringify(payload, null, 2), "utf8");
}

async function writeJsonl(pathName, rows) {
  await fs.mkdir(path.dirname(pathName), { recursive: true });
  const content = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  await fs.writeFile(pathName, content, "utf8");
}

async function readJson(pathName) {
  const raw = await fs.readFile(pathName, "utf8");
  return JSON.parse(raw);
}

async function readJsonl(pathName) {
  const raw = await fs.readFile(pathName, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function buildRefKey(ref) {
  return `${ref.book}/${ref.chapter}/${ref.verse}/${ref.token_index}`;
}

function resolveCorpusFilePath(inputPathOrDir) {
  const full = path.resolve(inputPathOrDir);
  if (full.endsWith(".jsonl")) {
    return full;
  }
  return path.join(full, "word_flows.full.jsonl");
}

async function pathExists(pathName) {
  try {
    await fs.access(pathName);
    return true;
  } catch {
    return false;
  }
}

async function resolveTraceFilePath(inputPathOrDir) {
  const full = path.resolve(inputPathOrDir);
  if (full.endsWith(".jsonl")) {
    if (!(await pathExists(full))) {
      throw new Error(`Missing trace file: ${full}`);
    }
    return full;
  }

  const candidates = [
    path.join(full, "word_traces.jsonl"),
    path.join(full, "word_flows.full.jsonl"),
    path.join(full, "word_flows.skeleton.jsonl")
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    `Unable to resolve trace file from '${inputPathOrDir}'. Tried: ${candidates
      .map((candidate) => workspaceRelativePath(candidate))
      .join(", ")}`
  );
}

function toEventOp(value) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  if (value && typeof value === "object" && typeof value.type === "string") {
    return value.type;
  }
  return "";
}

function normalizeSkeleton(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => toEventOp(entry)).filter(Boolean);
}

function skeletonFromRow(row) {
  if (Array.isArray(row?.skeleton)) {
    return normalizeSkeleton(row.skeleton);
  }
  if (Array.isArray(row?.flow_compact)) {
    return normalizeSkeleton(row.flow_compact);
  }
  if (Array.isArray(row?.flow_skeleton)) {
    return normalizeSkeleton(row.flow_skeleton);
  }
  if (Array.isArray(row?.events)) {
    return normalizeSkeleton(row.events);
  }
  return [];
}

function normalizeTokenIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry))
    .map((entry) => Number(entry));
}

function parseRefKey(refKey) {
  const pieces = String(refKey ?? "").split("/");
  if (pieces.length < 4) {
    return null;
  }
  const tokenIndexRaw = pieces.pop();
  const verseRaw = pieces.pop();
  const chapterRaw = pieces.pop();
  const book = pieces.join("/");
  const chapter = Number(chapterRaw);
  const verse = Number(verseRaw);
  const tokenIndex = Number(tokenIndexRaw);
  if (
    !book ||
    !Number.isFinite(chapter) ||
    !Number.isFinite(verse) ||
    !Number.isFinite(tokenIndex)
  ) {
    return null;
  }
  return {
    book,
    chapter,
    verse,
    token_index: tokenIndex
  };
}

function rowRefKey(row) {
  if (typeof row?.ref_key === "string" && row.ref_key.length > 0) {
    return row.ref_key;
  }
  const ref = row?.ref;
  if (ref && typeof ref === "object") {
    const tokenIndex =
      ref.token_index ?? ref.word_index_in_verse ?? ref.word_index ?? ref.index ?? null;
    if (
      typeof ref.book === "string" &&
      Number.isFinite(Number(ref.chapter)) &&
      Number.isFinite(Number(ref.verse)) &&
      Number.isFinite(Number(tokenIndex))
    ) {
      return `${ref.book}/${Number(ref.chapter)}/${Number(ref.verse)}/${Number(tokenIndex)}`;
    }
  }
  return "";
}

function normalizeTraceRow(row, index, sourcePath) {
  const key = rowRefKey(row);
  if (!key) {
    throw new Error(
      `Row ${index + 1} in ${workspaceRelativePath(sourcePath)} is missing a stable identity (ref_key or ref + token_index)`
    );
  }
  const skeleton = skeletonFromRow(row);
  const flow =
    typeof row?.flow === "string"
      ? row.flow
      : typeof row?.one_liner === "string"
        ? row.one_liner
        : compileFlowString(skeleton, " ⇢ ");
  const refFromRow = row?.ref && typeof row.ref === "object" ? row.ref : null;
  const ref = refFromRow ?? parseRefKey(key) ?? null;

  return {
    key,
    ref,
    surface: String(row?.surface ?? ""),
    skeleton,
    flow,
    semantic_version: getSemanticVersion(row),
    token_ids: normalizeTokenIds(row?.token_ids ?? row?.tokens ?? []),
    source_path: workspaceRelativePath(sourcePath),
    row_index: index + 1
  };
}

function sortRefLike(left, right) {
  return String(left).localeCompare(String(right), "en", { numeric: true });
}

async function loadTraceRun(inputPathOrDir, label) {
  const tracePath = await resolveTraceFilePath(inputPathOrDir);
  const raw = await fs.readFile(tracePath, "utf8");
  const traceSha256 = sha256FromBuffer(Buffer.from(raw, "utf8"));
  const parsedRows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const map = new Map();
  const rows = [];
  const duplicates = [];
  const semanticVersions = new Set();

  for (let index = 0; index < parsedRows.length; index += 1) {
    const normalized = normalizeTraceRow(parsedRows[index], index, tracePath);
    semanticVersions.add(normalized.semantic_version);
    if (map.has(normalized.key)) {
      duplicates.push(normalized.key);
      continue;
    }
    map.set(normalized.key, normalized);
    rows.push(normalized);
  }

  if (duplicates.length > 0) {
    throw new Error(
      `Stable identity failure (${label}): duplicate keys detected in ${workspaceRelativePath(
        tracePath
      )}: ${duplicates.slice(0, 10).join(", ")}`
    );
  }

  return {
    label,
    input_path: path.resolve(inputPathOrDir),
    trace_path: tracePath,
    trace_sha256: traceSha256,
    rows,
    map,
    semantic_versions: Array.from(semanticVersions).sort(sortRefLike)
  };
}

function sortCountObjectByKey(obj) {
  const out = {};
  for (const key of Object.keys(obj ?? {}).sort(sortRefLike)) {
    out[key] = obj[key];
  }
  return out;
}

function mergeCountObjects(base, delta) {
  const out = { ...base };
  for (const [key, count] of Object.entries(delta ?? {})) {
    out[key] = (out[key] ?? 0) + Number(count ?? 0);
  }
  return out;
}

function buildTokenWarningIndex(compiledPayload) {
  const tokenWarnings = new Map();
  for (const [tokenIdRaw, tokenMeta] of Object.entries(compiledPayload?.tokens ?? {})) {
    const tokenId = Number(tokenIdRaw);
    if (!Number.isFinite(tokenId)) {
      continue;
    }
    const warnings = Array.isArray(tokenMeta?.warnings) ? tokenMeta.warnings : [];
    const byCode = {};
    for (const warning of warnings) {
      const code =
        typeof warning?.code === "string" && warning.code.length > 0
          ? warning.code
          : "UNKNOWN_WARNING";
      byCode[code] = (byCode[code] ?? 0) + 1;
    }
    if (Object.keys(byCode).length > 0) {
      tokenWarnings.set(tokenId, byCode);
    }
  }
  return tokenWarnings;
}

function wordWarningSummary(row, compileContext) {
  if (!compileContext?.token_warning_index) {
    return { total: 0, by_code: {} };
  }
  let byCode = {};
  for (const tokenId of row?.token_ids ?? []) {
    const tokenCounts = compileContext.token_warning_index.get(Number(tokenId));
    if (!tokenCounts) {
      continue;
    }
    byCode = mergeCountObjects(byCode, tokenCounts);
  }
  byCode = sortCountObjectByKey(byCode);
  return {
    total: totalFromCounts(byCode),
    by_code: byCode
  };
}

function warningDeltaText(leftSummary, rightSummary) {
  const leftText = formatWarningCounts(leftSummary?.by_code ?? {});
  const rightText = formatWarningCounts(rightSummary?.by_code ?? {});
  if (leftText === rightText) {
    return `compile warnings unchanged (${leftText})`;
  }
  return `compile warnings ${leftText} -> ${rightText}`;
}

async function resolveCompiledPath(explicitPath, run) {
  if (explicitPath) {
    const resolved = path.resolve(explicitPath);
    if (!(await pathExists(resolved))) {
      throw new Error(`Missing compiled bundle: ${resolved}`);
    }
    return resolved;
  }

  const candidates = [];
  const seen = new Set();
  const pushCandidate = (candidate) => {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) {
      return;
    }
    seen.add(resolved);
    candidates.push(resolved);
  };

  let dir = path.dirname(run.trace_path);
  for (let i = 0; i < 4; i += 1) {
    pushCandidate(path.join(dir, "tokens.compiled.json"));
    pushCandidate(path.join(dir, "data", "tokens.compiled.json"));
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  pushCandidate(DEFAULT_COMPILED_BUNDLES_PATH);

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  return "";
}

async function loadCompileContext(explicitPath, run) {
  const compiledPath = await resolveCompiledPath(explicitPath, run);
  if (!compiledPath) {
    return {
      path: "",
      semver: "unknown",
      registry_sha256: "unknown",
      definitions_sha256: "unknown",
      warning_count: null,
      warning_by_code: {},
      token_warning_index: null,
      load_error: "not found"
    };
  }

  try {
    const payload = await readJson(compiledPath);
    const warningByCode = sortCountObjectByKey(payload?.stats?.warning_by_code ?? {});
    return {
      path: compiledPath,
      semver: payload?.semantics?.semver ?? "unknown",
      registry_sha256: payload?.source?.registry_sha256 ?? "unknown",
      definitions_sha256: payload?.semantics?.definitions_sha256 ?? "unknown",
      warning_count:
        typeof payload?.stats?.warning_count === "number"
          ? payload.stats.warning_count
          : totalFromCounts(warningByCode),
      warning_by_code: warningByCode,
      token_warning_index: buildTokenWarningIndex(payload),
      load_error: ""
    };
  } catch (err) {
    if (explicitPath) {
      throw err;
    }
    return {
      path: compiledPath,
      semver: "unknown",
      registry_sha256: "unknown",
      definitions_sha256: "unknown",
      warning_count: null,
      warning_by_code: {},
      token_warning_index: null,
      load_error: String(err?.message ?? err)
    };
  }
}

function arraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function sameEventMultiset(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  const counts = new Map();
  for (const event of left) {
    counts.set(event, (counts.get(event) ?? 0) + 1);
  }
  for (const event of right) {
    if (!counts.has(event)) {
      return false;
    }
    const next = counts.get(event) - 1;
    if (next === 0) {
      counts.delete(event);
    } else {
      counts.set(event, next);
    }
  }
  return counts.size === 0;
}

function buildLcsTable(left, right) {
  const table = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      if (left[i - 1] === right[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }
  return table;
}

function buildEditOps(left, right) {
  const table = buildLcsTable(left, right);
  const reversed = [];
  let i = left.length;
  let j = right.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && left[i - 1] === right[j - 1]) {
      i -= 1;
      j -= 1;
      continue;
    }
    const up = i > 0 ? table[i - 1][j] : -1;
    const leftCell = j > 0 ? table[i][j - 1] : -1;
    if (i > 0 && (j === 0 || up >= leftCell)) {
      reversed.push({ kind: "delete", event: left[i - 1], index: i - 1 });
      i -= 1;
      continue;
    }
    if (j > 0) {
      reversed.push({ kind: "insert", event: right[j - 1], index: j - 1 });
      j -= 1;
      continue;
    }
  }

  return reversed.reverse();
}

function compressEditOps(ops) {
  const out = [];
  for (let index = 0; index < ops.length; index += 1) {
    const current = ops[index];
    const next = ops[index + 1];
    if (current.kind === "delete" && next?.kind === "insert") {
      out.push({
        kind: "replace",
        from_event: current.event,
        to_event: next.event,
        index: current.index
      });
      index += 1;
      continue;
    }
    if (current.kind === "insert" && next?.kind === "delete") {
      out.push({
        kind: "replace",
        from_event: next.event,
        to_event: current.event,
        index: next.index
      });
      index += 1;
      continue;
    }
    out.push(current);
  }
  return out;
}

function positionText(index, length) {
  if (index <= 0) {
    return "at start";
  }
  if (index >= length - 1) {
    return "at end";
  }
  return `at position ${index + 1}`;
}

function classifySkeletonDelta(previousSkeleton, nextSkeleton) {
  if (arraysEqual(previousSkeleton, nextSkeleton)) {
    return {
      change_type: "unchanged",
      signature: "UNCHANGED",
      summary: "No skeleton change",
      operations: []
    };
  }

  if (sameEventMultiset(previousSkeleton, nextSkeleton)) {
    let start = 0;
    while (
      start < previousSkeleton.length &&
      start < nextSkeleton.length &&
      previousSkeleton[start] === nextSkeleton[start]
    ) {
      start += 1;
    }
    let endPrev = previousSkeleton.length - 1;
    let endNext = nextSkeleton.length - 1;
    while (
      endPrev >= start &&
      endNext >= start &&
      previousSkeleton[endPrev] === nextSkeleton[endNext]
    ) {
      endPrev -= 1;
      endNext -= 1;
    }
    const movedFrom = previousSkeleton.slice(start, endPrev + 1);
    const movedTo = nextSkeleton.slice(start, endNext + 1);
    return {
      change_type: "event_order_changed",
      signature: `ORDER:${movedFrom.join("->")}=>${movedTo.join("->")}`,
      summary: `Reordered events ${movedFrom.join(" -> ")} => ${movedTo.join(" -> ")}`,
      operations: [
        {
          kind: "order",
          from: movedFrom,
          to: movedTo
        }
      ]
    };
  }

  const operations = compressEditOps(buildEditOps(previousSkeleton, nextSkeleton));
  const inserts = operations.filter((op) => op.kind === "insert");
  const deletes = operations.filter((op) => op.kind === "delete");
  const replaces = operations.filter((op) => op.kind === "replace");

  if (inserts.length > 0 && deletes.length === 0 && replaces.length === 0) {
    const events = inserts.map((entry) => entry.event);
    if (events.length === 1) {
      const op = inserts[0];
      return {
        change_type: "event_inserted",
        signature: `INSERT:${op.event}`,
        summary: `Inserted ${op.event} ${positionText(op.index, nextSkeleton.length)}`,
        operations
      };
    }
    return {
      change_type: "event_inserted",
      signature: `INSERT:${events.join(",")}`,
      summary: `Inserted ${events.length} events: ${events.join(", ")}`,
      operations
    };
  }

  if (deletes.length > 0 && inserts.length === 0 && replaces.length === 0) {
    const events = deletes.map((entry) => entry.event);
    if (events.length === 1) {
      const op = deletes[0];
      return {
        change_type: "event_removed",
        signature: `REMOVE:${op.event}`,
        summary: `Removed ${op.event} ${positionText(op.index, previousSkeleton.length)}`,
        operations
      };
    }
    return {
      change_type: "event_removed",
      signature: `REMOVE:${events.join(",")}`,
      summary: `Removed ${events.length} events: ${events.join(", ")}`,
      operations
    };
  }

  if (replaces.length > 0 && inserts.length === 0 && deletes.length === 0) {
    const pairs = replaces.map((entry) => `${entry.from_event}→${entry.to_event}`);
    if (pairs.length === 1) {
      const op = replaces[0];
      return {
        change_type: "event_replaced",
        signature: `REPLACE:${op.from_event}→${op.to_event}`,
        summary: `Replaced ${op.from_event} with ${op.to_event} ${positionText(
          op.index,
          previousSkeleton.length
        )}`,
        operations
      };
    }
    return {
      change_type: "event_replaced",
      signature: `REPLACE:${pairs.join("|")}`,
      summary: `Replaced ${pairs.length} events: ${pairs.join(", ")}`,
      operations
    };
  }

  const compact = operations.map((entry) => {
    if (entry.kind === "replace") {
      return `${entry.from_event}→${entry.to_event}`;
    }
    return entry.kind === "insert" ? `+${entry.event}` : `-${entry.event}`;
  });
  return {
    change_type: "mixed_delta",
    signature: `MIXED:${compact.join("|")}`,
    summary: `Mixed delta: ${compact.join(", ")}`,
    operations
  };
}

function compareDeltaGroupEntries(left, right) {
  if (left.count !== right.count) {
    return right.count - left.count;
  }
  return sortRefLike(left.signature, right.signature);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeGoldenCase(caseRow, index) {
  const key = rowRefKey(caseRow) || caseRow?.key;
  if (!key) {
    throw new Error(`Golden case at index ${index} is missing key/ref`);
  }
  const expectedSkeleton = normalizeSkeleton(
    caseRow?.expected_skeleton ?? caseRow?.expectedSkeleton ?? caseRow?.skeleton ?? []
  );
  return {
    key,
    ref: caseRow?.ref ?? parseRefKey(key) ?? null,
    surface: typeof caseRow?.surface === "string" ? caseRow.surface : "",
    expected_skeleton: expectedSkeleton,
    notes: typeof caseRow?.notes === "string" ? caseRow.notes : "curated"
  };
}

async function loadGoldens(pathName) {
  if (!(await pathExists(pathName))) {
    return null;
  }
  const payload = await readJson(pathName);
  const rawCases = Array.isArray(payload) ? payload : asArray(payload?.cases);
  const cases = rawCases.map((caseRow, index) => normalizeGoldenCase(caseRow, index));
  return {
    payload,
    cases
  };
}

async function runAll(argv) {
  const opts = parseCommonRunArgs(argv);
  const inputPath = path.resolve(opts.input);
  const outDir = path.resolve(opts.outDir);

  const rawBuffer = await fs.readFile(inputPath);
  const raw = rawBuffer.toString("utf8");
  const data = JSON.parse(raw);
  const inputSha256 = sha256FromBuffer(rawBuffer);
  const runConfig = {
    lang: opts.lang,
    normalize_finals: opts.normalizeFinals,
    allow_runtime_errors: opts.allowRuntimeErrors
  };
  const inputMeta = {
    path: workspaceRelativePath(inputPath),
    sha256: inputSha256
  };

  const require = createRequire(import.meta.url);
  const { tokenize } = require(
    path.resolve(process.cwd(), "impl/reference/dist/compile/tokenizer")
  );
  const { runProgramWithTrace } = require(path.resolve(process.cwd(), "impl/reference/dist/vm/vm"));
  const { createInitialState } = require(
    path.resolve(process.cwd(), "impl/reference/dist/state/state")
  );

  const signatureByKey = new Map();
  const analysisCache = new Map();
  const occurrences = [];

  let versesTotal = 0;
  let versesSanitized = 0;
  let versesSkipped = 0;
  let wordsTotal = 0;
  let wordsErrored = 0;
  let cacheHits = 0;
  let cacheMisses = 0;

  for (const book of data.books ?? []) {
    for (const chapter of book.chapters ?? []) {
      for (const verse of chapter.verses ?? []) {
        versesTotal += 1;
        const rawText =
          opts.lang === "en" ? verse.en : opts.lang === "both" ? (verse.he ?? verse.en) : verse.he;
        const cleaned = sanitizeText(rawText, opts);
        if (!cleaned) {
          versesSkipped += 1;
          continue;
        }
        if (cleaned !== rawText) {
          versesSanitized += 1;
        }

        const words = cleaned.split(" ").filter(Boolean);
        for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
          const surface = words[wordIndex];
          wordsTotal += 1;

          let analysis = analysisCache.get(surface);
          if (analysis) {
            cacheHits += 1;
          } else {
            cacheMisses += 1;
            const tokens = tokenize(surface).filter((token) => token.letter !== SPACE_TOKEN);
            const signatures = tokens.map(makeSignature);
            const signature_keys = signatures.map(signatureKey);
            signatures.forEach((signature, index) => {
              const key = signature_keys[index];
              if (!signatureByKey.has(key)) {
                signatureByKey.set(key, {
                  ...signature,
                  sample_surface: tokens[index].raw
                });
              }
            });

            let flow;
            try {
              const { trace } = runProgramWithTrace(surface, createInitialState());
              flow = extractWordFlow(trace);
            } catch (err) {
              if (!opts.allowRuntimeErrors || err?.name !== "RuntimeError") {
                throw err;
              }
              wordsErrored += 1;
              flow = {
                events: [
                  {
                    type: "ERROR.RUNTIME",
                    source: "vm",
                    params_summary: String(err?.message ?? "RuntimeError")
                  }
                ],
                flow_skeleton: [["ERROR.RUNTIME", String(err?.message ?? "RuntimeError")]],
                flow_compact: ["ERROR.RUNTIME"],
                one_liner: `runtime error: ${String(err?.message ?? "RuntimeError")}`
              };
            }

            analysis = { signature_keys, ...flow };
            analysisCache.set(surface, analysis);
          }

          const ref = {
            book: book.name,
            chapter: chapter.n,
            verse: verse.n,
            token_index: wordIndex + 1
          };
          const ref_key = buildRefKey(ref);

          occurrences.push({
            ref,
            ref_key,
            surface,
            signature_keys: analysis.signature_keys,
            events: analysis.events,
            flow_skeleton: analysis.flow_skeleton,
            flow_compact: analysis.flow_compact,
            one_liner: analysis.one_liner
          });
        }
      }
    }
  }

  const sortedSignatureKeys = Array.from(signatureByKey.keys()).sort((left, right) =>
    left.localeCompare(right, "he")
  );
  const tokenIdBySignature = new Map(sortedSignatureKeys.map((key, index) => [key, index + 1]));

  const tokenRegistry = {};
  for (const key of sortedSignatureKeys) {
    const tokenId = tokenIdBySignature.get(key);
    const signature = signatureByKey.get(key);
    tokenRegistry[tokenId] = {
      base: signature.base,
      rosh: signature.rosh,
      toch: signature.toch,
      sof: signature.sof,
      notes: signature.notes,
      sample_surface: signature.sample_surface
    };
  }

  const fullRows = occurrences.map((occurrence) => ({
    ref: occurrence.ref,
    ref_key: occurrence.ref_key,
    surface: occurrence.surface,
    tokens: occurrence.signature_keys.map((key) => tokenIdBySignature.get(key)),
    events: occurrence.events,
    flow_skeleton: occurrence.flow_skeleton,
    flow_compact: occurrence.flow_compact,
    one_liner: occurrence.one_liner
  }));

  const skeletonRows = fullRows.map((row) => ({
    ref: row.ref,
    ref_key: row.ref_key,
    surface: row.surface,
    tokens: row.tokens,
    events: row.events,
    flow_skeleton: row.flow_skeleton
  }));

  const oneLinerRows = fullRows.map((row) => ({
    ref: row.ref,
    ref_key: row.ref_key,
    surface: row.surface,
    one_liner: row.one_liner
  }));

  const patternIndex = buildPatternIndex(fullRows);
  const exemplars = buildExemplarLibrary(fullRows);

  await fs.mkdir(outDir, { recursive: true });
  const artifactPaths = {
    "token_registry.json": path.join(outDir, "token_registry.json"),
    "word_flows.skeleton.jsonl": path.join(outDir, "word_flows.skeleton.jsonl"),
    "word_flows.one_liner.jsonl": path.join(outDir, "word_flows.one_liner.jsonl"),
    "word_flows.full.jsonl": path.join(outDir, "word_flows.full.jsonl"),
    "pattern_index.json": path.join(outDir, "pattern_index.json"),
    "exemplar_library.json": path.join(outDir, "exemplar_library.json"),
    "review_snapshot.json": path.join(outDir, "review_snapshot.json"),
    "summary.json": path.join(outDir, "summary.json")
  };

  await writeJson(artifactPaths["token_registry.json"], {
    schema_version: 1,
    input: inputMeta,
    run_config: runConfig,
    signatures: tokenRegistry
  });
  await writeJsonl(artifactPaths["word_flows.skeleton.jsonl"], skeletonRows);
  await writeJsonl(artifactPaths["word_flows.one_liner.jsonl"], oneLinerRows);
  await writeJsonl(artifactPaths["word_flows.full.jsonl"], fullRows);
  await writeJson(artifactPaths["pattern_index.json"], patternIndex);
  await writeJson(artifactPaths["exemplar_library.json"], exemplars);

  const artifactRows = {
    "word_flows.skeleton.jsonl": countLines(skeletonRows),
    "word_flows.one_liner.jsonl": countLines(oneLinerRows),
    "word_flows.full.jsonl": countLines(fullRows)
  };

  const artifactChecksums = {};
  for (const [name, artifactPath] of Object.entries(artifactPaths)) {
    if (name === "summary.json" || name === "review_snapshot.json") {
      continue;
    }
    const [stat, sha256] = await Promise.all([fs.stat(artifactPath), sha256FromFile(artifactPath)]);
    artifactChecksums[name] = {
      path: workspaceRelativePath(artifactPath),
      bytes: stat.size,
      sha256
    };
    if (artifactRows[name] !== undefined) {
      artifactChecksums[name].rows = artifactRows[name];
    }
  }

  const semanticFingerprint = {
    word_flows_full_sha256: artifactChecksums["word_flows.full.jsonl"].sha256,
    token_registry_sha256: artifactChecksums["token_registry.json"].sha256
  };

  await writeJson(artifactPaths["review_snapshot.json"], {
    schema_version: 1,
    semantic_fingerprint: semanticFingerprint,
    token_signature_count: sortedSignatureKeys.length,
    word_count: wordsTotal,
    explicit_pattern_counts: Object.fromEntries(
      Object.entries(patternIndex.explicit_patterns).map(([key, value]) => [key, value.count])
    ),
    top_bigrams: patternIndex.frequent_ngrams.bigrams.slice(0, 20),
    top_trigrams: patternIndex.frequent_ngrams.trigrams.slice(0, 20),
    exemplar_preview: exemplars.exemplars.slice(0, 20)
  });
  const reviewStat = await fs.stat(artifactPaths["review_snapshot.json"]);
  const reviewSha256 = await sha256FromFile(artifactPaths["review_snapshot.json"]);
  artifactChecksums["review_snapshot.json"] = {
    path: workspaceRelativePath(artifactPaths["review_snapshot.json"]),
    bytes: reviewStat.size,
    sha256: reviewSha256
  };

  const summaryPayload = {
    schema_version: 1,
    input: inputMeta,
    output_dir: workspaceRelativePath(outDir),
    run_config: runConfig,
    stats: {
      verses_total: versesTotal,
      verses_sanitized: versesSanitized,
      verses_skipped: versesSkipped,
      words_total: wordsTotal,
      words_with_runtime_error: wordsErrored,
      unique_word_surfaces: analysisCache.size,
      distinct_grapheme_signatures: sortedSignatureKeys.length,
      cache_hits: cacheHits,
      cache_misses: cacheMisses
    },
    semantic_fingerprint: semanticFingerprint,
    artifact_checksums: artifactChecksums
  };
  await writeJson(artifactPaths["summary.json"], summaryPayload);

  const summaryStat = await fs.stat(artifactPaths["summary.json"]);
  const summarySha256 = await sha256FromFile(artifactPaths["summary.json"]);
  artifactChecksums["summary.json"] = {
    path: workspaceRelativePath(artifactPaths["summary.json"]),
    bytes: summaryStat.size,
    sha256: summarySha256
  };

  await writeJson(path.join(outDir, "manifest.json"), {
    schema_version: 1,
    input: inputMeta,
    output_dir: workspaceRelativePath(outDir),
    run_config: runConfig,
    semantic_fingerprint: summaryPayload.semantic_fingerprint,
    artifacts: artifactChecksums
  });

  console.log(
    [
      `done: words=${wordsTotal}`,
      `uniqueWords=${analysisCache.size}`,
      `signatures=${sortedSignatureKeys.length}`,
      `runtimeErrors=${wordsErrored}`,
      `outDir=${outDir}`
    ].join(" ")
  );
}

async function runExecute(argv) {
  const opts = parseExecuteArgs(argv);
  const inputPath = path.resolve(opts.input);
  const tokenRegistryPath = path.resolve(opts.tokenRegistry);
  const compiledBundlesPath = path.resolve(opts.compiledBundles);
  const traceOutPath = path.resolve(opts.traceOut);
  const flowsOutPath = path.resolve(opts.flowsOut);
  const reportOutPath = path.resolve(opts.reportOut);
  const verseTraceOutPath = path.resolve(opts.verseTraceOut);
  const verseReportOutPath = path.resolve(opts.verseReportOut);
  const verseMotifIndexOutPath = path.resolve(opts.verseMotifIndexOut);

  const [rawBuffer, tokenRegistryPayload, compiledPayload, semanticsDefsPayload] =
    await Promise.all([
      fs.readFile(inputPath),
      readJson(tokenRegistryPath),
      readJson(compiledBundlesPath),
      readJson(DEFAULT_SEMANTICS_DEFS_PATH).catch(() => null)
    ]);
  const raw = rawBuffer.toString("utf8");
  const data = JSON.parse(raw);

  const semanticVersion =
    opts.semanticVersion ||
    compiledPayload?.semantics?.semver ||
    semanticsDefsPayload?.semver ||
    "unknown";

  const tokenIdBySignature = buildTokenIdBySignature(tokenRegistryPayload);
  const compiledTokenIdSet = new Set(Object.keys(compiledPayload?.tokens ?? {}));

  if (tokenIdBySignature.size === 0) {
    throw new Error(`No tokens loaded from token registry at ${tokenRegistryPath}`);
  }
  if (compiledTokenIdSet.size === 0) {
    throw new Error(`No compiled bundles loaded from ${compiledBundlesPath}`);
  }

  const require = createRequire(import.meta.url);
  const { tokenize } = require(
    path.resolve(process.cwd(), "impl/reference/dist/compile/tokenizer")
  );
  const { runProgramWithTrace } = require(path.resolve(process.cwd(), "impl/reference/dist/vm/vm"));
  const { createInitialState } = require(
    path.resolve(process.cwd(), "impl/reference/dist/state/state")
  );
  const {
    canonicalizeWordTraceRecord,
    canonicalizeVerseTraceRecord,
    compareWordTraceRecords,
    compareVerseTraceRecords
  } = require(path.resolve(process.cwd(), "impl/reference/dist/trace/canonicalize"));

  const startNs = process.hrtime.bigint();
  const rows = [];
  const baselineRows = [];
  const verseRows = [];
  const flowLines = [];
  const skeletonCounts = new Map();
  const modeDiffEvents = [];

  const unknownSignatures = [];
  const missingBundles = [];
  const runtimeErrors = [];
  const safetyRailStats = {
    enabled: Boolean(opts.safetyRail),
    threshold: Number(opts.safetyRailThreshold),
    activated_verses: 0,
    clamped_words: 0,
    allowed_deltas: 0,
    blocked_deltas: 0
  };
  const { verses, stats } = collectExecutableVerses(data, opts);
  const versesTotal = stats.versesTotal;
  const versesSanitized = stats.versesSanitized;
  const versesSkipped = stats.versesSkipped;
  const wordsTotal = stats.wordsTotal;

  const isolatedFlowCache = new Map();
  const getIsolatedFlow = (surface) => {
    if (isolatedFlowCache.has(surface)) {
      return isolatedFlowCache.get(surface);
    }
    const flow = runIsolatedWordFlow({
      surface,
      runProgramWithTrace,
      createInitialState,
      allowRuntimeErrors: opts.allowRuntimeErrors
    });
    isolatedFlowCache.set(surface, flow);
    return flow;
  };

  for (const verseEntry of verses) {
    const wordRowsMeta = [];

    for (let wordIndex = 0; wordIndex < verseEntry.words.length; wordIndex += 1) {
      const surface = verseEntry.words[wordIndex];
      const ref = {
        book: verseEntry.ref.book,
        chapter: verseEntry.ref.chapter,
        verse: verseEntry.ref.verse,
        token_index: wordIndex + 1
      };
      const refKey = buildRefKey(ref);
      const tokenMeta = resolveWordTokenIds({
        surface,
        tokenize,
        tokenIdBySignature,
        compiledTokenIdSet
      });

      for (const tokenId of tokenMeta.missing_bundle_ids) {
        missingBundles.push({ ref_key: refKey, surface, token_id: tokenId });
      }
      if (tokenMeta.unknown_signatures.length > 0) {
        unknownSignatures.push({
          ref_key: refKey,
          surface,
          signatures: tokenMeta.unknown_signatures
        });
      }

      wordRowsMeta.push({
        ref,
        ref_key: refKey,
        surface,
        token_ids: tokenMeta.token_ids,
        unknown_signatures: tokenMeta.unknown_signatures
      });
    }

    const baselineExecutions = wordRowsMeta.map((meta) => {
      if (meta.unknown_signatures.length > 0) {
        return {
          flowRaw: ["ERROR.UNKNOWN_SIGNATURE"],
          flowCompact: ["ERROR.UNKNOWN_SIGNATURE"],
          traceEvents: [makeUnknownSignatureTraceEvent(meta.unknown_signatures[0] ?? "unknown")],
          runtimeErrorMessage: "",
          windowStart: 1
        };
      }
      return getIsolatedFlow(meta.surface);
    });

    let modeExecutions;
    if (opts.mode === "WORD") {
      modeExecutions = baselineExecutions.map((execution) => ({
        flowRaw: [...execution.flowRaw],
        flowCompact: [...execution.flowCompact],
        traceEvents: [...execution.traceEvents],
        runtimeErrorMessage: execution.runtimeErrorMessage,
        windowStart: execution.windowStart
      }));
    } else if (opts.mode === "VERSE") {
      modeExecutions = runVerseWordFlows({
        words: verseEntry.words,
        runProgramWithTrace,
        createInitialState,
        allowRuntimeErrors: opts.allowRuntimeErrors,
        verseRefKey: verseEntry.ref_key
      });
    } else {
      modeExecutions = runWindowWordFlows({
        words: verseEntry.words,
        windowSize: opts.windowSize ?? DEFAULT_WINDOW_SIZE,
        runProgramWithTrace,
        createInitialState,
        allowRuntimeErrors: opts.allowRuntimeErrors,
        verseRefKey: verseEntry.ref_key
      });
    }

    if (modeExecutions.length !== wordRowsMeta.length) {
      throw new Error(
        `Execution mode ${opts.modeLabel} emitted ${modeExecutions.length} rows for ${verseEntry.ref_key}, expected ${wordRowsMeta.length}`
      );
    }

    const provisionalDeltaCount = wordRowsMeta.reduce((sum, meta, index) => {
      if (meta.unknown_signatures.length > 0) {
        return sum;
      }
      return arraysEqual(baselineExecutions[index].flowCompact, modeExecutions[index].flowCompact)
        ? sum
        : sum + 1;
    }, 0);
    const provisionalDeltaRate =
      wordRowsMeta.length > 0 ? provisionalDeltaCount / wordRowsMeta.length : 0;
    const safetyRailActive =
      opts.mode !== "WORD" &&
      safetyRailStats.enabled &&
      provisionalDeltaRate > safetyRailStats.threshold;
    if (safetyRailActive) {
      safetyRailStats.activated_verses += 1;
    }

    const verseWordRows = [];
    const crossWordEvents = [];
    let totalEventsInVerse = 0;
    const boundaryByType = {};

    for (let wordIndex = 0; wordIndex < wordRowsMeta.length; wordIndex += 1) {
      const meta = wordRowsMeta[wordIndex];
      const baselineExecution = baselineExecutions[wordIndex];
      let execution = modeExecutions[wordIndex];

      if (meta.unknown_signatures.length > 0) {
        execution = {
          flowRaw: ["ERROR.UNKNOWN_SIGNATURE"],
          flowCompact: ["ERROR.UNKNOWN_SIGNATURE"],
          traceEvents: [makeUnknownSignatureTraceEvent(meta.unknown_signatures[0] ?? "unknown")],
          runtimeErrorMessage: "",
          windowStart: execution?.windowStart ?? baselineExecution.windowStart
        };
      }

      const changedFromBaseline = !arraysEqual(baselineExecution.flowCompact, execution.flowCompact);
      if (safetyRailActive && changedFromBaseline) {
        const deltaOps = skeletonDeltaOps(baselineExecution.flowCompact, execution.flowCompact);
        if (!isSafetyRailDeltaAllowed(deltaOps)) {
          safetyRailStats.clamped_words += 1;
          safetyRailStats.blocked_deltas += 1;
          execution = {
            flowRaw: [...baselineExecution.flowRaw],
            flowCompact: [...baselineExecution.flowCompact],
            traceEvents: [...baselineExecution.traceEvents],
            runtimeErrorMessage: baselineExecution.runtimeErrorMessage,
            windowStart: execution.windowStart,
            safetyRailClamped: true,
            safetyRailDeltaOps: deltaOps
          };
        } else {
          safetyRailStats.allowed_deltas += 1;
        }
      } else if (changedFromBaseline && opts.mode !== "WORD") {
        safetyRailStats.allowed_deltas += 1;
      }

      if (execution.runtimeErrorMessage) {
        runtimeErrors.push({
          ref_key: meta.ref_key,
          surface: meta.surface,
          message: execution.runtimeErrorMessage
        });
      }

      const skeleton = execution.flowCompact;
      const flow = compileFlowString(skeleton, " ⇢ ");
      const skeletonKey = skeleton.join(" -> ");
      skeletonCounts.set(skeletonKey, (skeletonCounts.get(skeletonKey) ?? 0) + 1);

      const rawWordRecord = {
        record_kind: "WORD_TRACE",
        trace_version: TRACE_VERSION,
        semantics_version: semanticVersion,
        render_version: TRACE_RENDER_VERSION,
        ref: meta.ref,
        ref_key: meta.ref_key,
        surface: meta.surface,
        token_ids: meta.token_ids,
        events: execution.traceEvents,
        skeleton,
        flow,
        mode: opts.mode
      };
      if (opts.mode === "WINDOW") {
        rawWordRecord.window_start = execution.windowStart ?? 1;
      }
      const row = canonicalizeWordTraceRecord(rawWordRecord);
      if (opts.debugRawEvents) {
        row.skeleton_raw = execution.flowRaw;
      }
      rows.push(row);
      flowLines.push(`${meta.ref_key}\t${meta.surface}\t${flow}`);

      baselineRows.push({
        ref_key: meta.ref_key,
        skeleton: baselineExecution.flowCompact
      });

      totalEventsInVerse += execution.traceEvents.length;
      const boundaryOps = extractBoundaryOps(skeleton);
      for (const op of boundaryOps) {
        boundaryByType[op] = (boundaryByType[op] ?? 0) + 1;
      }
      verseWordRows.push({
        ref_key: meta.ref_key,
        token_index: wordIndex + 1,
        skeleton,
        boundary_ops: boundaryOps
      });

      if (opts.mode !== "WORD" && !arraysEqual(baselineExecution.flowCompact, skeleton)) {
        const explanation = explainDeltaByMode({
          mode: opts.mode,
          tokenIndex: wordIndex + 1,
          windowStart: execution.windowStart ?? 1,
          boundaryOps
        });
        const deltaEvent = {
          ref_key: meta.ref_key,
          token_index: wordIndex + 1,
          baseline_skeleton: baselineExecution.flowCompact,
          observed_skeleton: skeleton,
          explanation
        };
        crossWordEvents.push(deltaEvent);
        modeDiffEvents.push({
          verse_ref_key: verseEntry.ref_key,
          ...deltaEvent
        });
      }
    }

    const verseEndBoundaryOps =
      verseWordRows.length > 0 ? verseWordRows[verseWordRows.length - 1].boundary_ops : [];
    const verseBoundaryResolution = buildVerseBoundaryResolution(verseWordRows, boundaryByType);
    const verseRecord = {
      record_kind: "VERSE_TRACE",
      trace_version: TRACE_VERSION,
      semantics_version: semanticVersion,
      render_version: TRACE_RENDER_VERSION,
      ref: verseEntry.ref,
      ref_key: verseEntry.ref_key,
      mode: opts.modeLabel,
      words_total: verseWordRows.length,
      total_events: totalEventsInVerse,
      boundary_events: {
        total: Object.values(boundaryByType).reduce((sum, count) => sum + Number(count), 0),
        by_type: sortCountObjectByKey(boundaryByType),
        verse_end: verseEndBoundaryOps,
        verse_boundary_operator: verseBoundaryResolution
      },
      cross_word_events: crossWordEvents,
      notable_motifs: buildVerseMotifs({
        verseWordRows,
        crossWordEvents,
        verseBoundaryResolution
      })
    };
    if (safetyRailActive) {
      verseRecord.safety_rail = {
        active: true,
        provisional_delta_count: provisionalDeltaCount,
        provisional_delta_rate: Number(provisionalDeltaRate.toFixed(6)),
        threshold: safetyRailStats.threshold
      };
    }
    if (opts.mode === "WINDOW") {
      verseRecord.window_size = opts.windowSize;
    }
    verseRows.push(canonicalizeVerseTraceRecord(verseRecord));
  }

  rows.sort(compareWordTraceRecords);
  verseRows.sort(compareVerseTraceRecords);

  const traceContent = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  const verseTraceContent = verseRows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  await Promise.all([
    fs.mkdir(path.dirname(traceOutPath), { recursive: true }),
    fs.mkdir(path.dirname(flowsOutPath), { recursive: true }),
    fs.mkdir(path.dirname(reportOutPath), { recursive: true }),
    fs.mkdir(path.dirname(verseTraceOutPath), { recursive: true }),
    fs.mkdir(path.dirname(verseReportOutPath), { recursive: true }),
    fs.mkdir(path.dirname(verseMotifIndexOutPath), { recursive: true })
  ]);
  await Promise.all([
    fs.writeFile(traceOutPath, traceContent, "utf8"),
    fs.writeFile(flowsOutPath, flowLines.join("\n") + "\n", "utf8"),
    fs.writeFile(verseTraceOutPath, verseTraceContent, "utf8")
  ]);

  const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
  const topSkeletons = Array.from(skeletonCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "en"))
    .slice(0, 20);
  const { traceSha256, verseTraceSha256, reportLines, verseReportLines } = buildExecuteReports({
    inputPath,
    tokenRegistryPath,
    compiledBundlesPath,
    traceOutPath,
    flowsOutPath,
    reportOutPath,
    verseTraceOutPath,
    verseReportOutPath,
    verseMotifIndexOutPath,
    semanticVersion,
    mode: opts.mode,
    modeLabel: opts.modeLabel,
    windowSize: opts.windowSize,
    safetyRailStats,
    wordsTotal,
    versesTotal,
    versesSanitized,
    versesSkipped,
    rows,
    baselineRows,
    modeDiffEvents,
    verseRows,
    uniqueSkeletons: skeletonCounts.size,
    topSkeletons,
    unknownSignatures,
    missingBundles,
    runtimeErrors,
    elapsedMs,
    traceContent,
    verseTraceContent,
    compileFlowString,
    arraysEqual
  });

  await fs.writeFile(reportOutPath, reportLines.join("\n") + "\n", "utf8");
  await fs.writeFile(verseReportOutPath, verseReportLines.join("\n") + "\n", "utf8");

  const verseMotifIndexPayload = buildVerseMotifIndex({
    modeLabel: opts.modeLabel,
    semanticVersion,
    verseRows,
    safetyRailSummary: safetyRailStats,
    verseTraceSha256
  });
  await writeJson(verseMotifIndexOutPath, verseMotifIndexPayload);

  const hasHardErrors = unknownSignatures.length > 0 || missingBundles.length > 0;
  if (hasHardErrors) {
    throw new Error(
      `execute failed: unknownSignatures=${unknownSignatures.length} missingBundles=${missingBundles.length}`
    );
  }

  console.log(
    [
      `execute: words=${rows.length}`,
      `mode=${opts.modeLabel}`,
      `uniqueSkeletons=${skeletonCounts.size}`,
      `runtimeErrors=${runtimeErrors.length}`,
      `traceOut=${traceOutPath}`,
      `flowsOut=${flowsOutPath}`,
      `verseTraceOut=${verseTraceOutPath}`,
      `reportOut=${reportOutPath}`,
      `verseReportOut=${verseReportOutPath}`,
      `verseMotifIndexOut=${verseMotifIndexOutPath}`
    ].join(" ")
  );
}

async function runDiff(argv) {
  const opts = parseDiffArgs(argv);
  const prevPath = resolveCorpusFilePath(opts.prev);
  const nextPath = resolveCorpusFilePath(opts.next);
  const outPath = opts.out
    ? path.resolve(opts.out)
    : path.join(path.dirname(nextPath), "diff.from-prev.json");

  const [prevRows, nextRows] = await Promise.all([readJsonl(prevPath), readJsonl(nextPath)]);
  const payload = buildDiffPayload(prevPath, nextPath, prevRows, nextRows);

  await writeJson(outPath, payload);
  console.log(`diff: changed=${payload.summary.changed_words} out=${outPath}`);
}

async function runPromote(argv) {
  const opts = parsePromoteArgs(argv);
  const diffPath = path.resolve(opts.diffPath);
  const diff = await readJson(diffPath);

  const nextPath = opts.next ? resolveCorpusFilePath(opts.next) : diff?.next ? diff.next : "";
  if (!nextPath) {
    throw new Error("Unable to resolve next corpus path. Pass --next.");
  }

  const nextRows = await readJsonl(nextPath);
  const nextMap = new Map(nextRows.map((row) => [row.ref_key, row]));

  const priorityGroups = [
    "flow_skeleton_changed",
    "event_stream_changed",
    "token_sequence_changed",
    "one_liner_changed",
    "surface_changed",
    "added",
    "removed"
  ];

  const picked = [];
  const seen = new Set();
  for (const group of priorityGroups) {
    for (const refKey of diff?.groups?.[group] ?? []) {
      if (seen.has(refKey)) {
        continue;
      }
      seen.add(refKey);
      picked.push(refKey);
      if (picked.length >= opts.limit) {
        break;
      }
    }
    if (picked.length >= opts.limit) {
      break;
    }
  }

  const cases = [];
  for (const refKey of picked) {
    const row = nextMap.get(refKey);
    if (!row) {
      continue;
    }
    const caseId = refKey.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    cases.push({
      id: caseId,
      ref: row.ref,
      ref_key: row.ref_key,
      surface: row.surface,
      tokens: row.tokens,
      events: row.events,
      flow_skeleton: row.flow_skeleton,
      one_liner: row.one_liner
    });
  }

  const outPath = path.resolve(opts.out);
  await writeJson(outPath, {
    schema_version: 1,
    source_diff: workspaceRelativePath(diffPath),
    source_corpus: workspaceRelativePath(nextPath),
    count: cases.length,
    cases
  });

  console.log(`promote: cases=${cases.length} out=${outPath}`);
}

async function runVerify(argv) {
  const opts = parseVerifyArgs(argv);
  const dir = path.resolve(opts.dir);
  const manifestPath = path.join(dir, "manifest.json");
  const manifest = await readJson(manifestPath);
  const artifacts = manifest?.artifacts ?? {};

  const failures = [];
  let checked = 0;

  for (const [name, meta] of Object.entries(artifacts)) {
    const recordPath = meta?.path;
    if (!recordPath || !meta?.sha256) {
      failures.push({ name, issue: "manifest entry missing path or sha256" });
      continue;
    }
    const artifactPath = path.isAbsolute(recordPath)
      ? recordPath
      : path.resolve(process.cwd(), recordPath);

    try {
      const [stat, sha256] = await Promise.all([
        fs.stat(artifactPath),
        sha256FromFile(artifactPath)
      ]);
      checked += 1;
      if (sha256 !== meta.sha256) {
        failures.push({ name, issue: "sha256 mismatch", expected: meta.sha256, actual: sha256 });
      }
      if (typeof meta.bytes === "number" && meta.bytes !== stat.size) {
        failures.push({
          name,
          issue: "byte-size mismatch",
          expected: meta.bytes,
          actual: stat.size
        });
      }
      if (typeof meta.rows === "number" && artifactPath.endsWith(".jsonl")) {
        const raw = await fs.readFile(artifactPath, "utf8");
        const rows = raw
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean).length;
        if (rows !== meta.rows) {
          failures.push({ name, issue: "row-count mismatch", expected: meta.rows, actual: rows });
        }
      }
    } catch (err) {
      failures.push({ name, issue: String(err?.message ?? err) });
    }
  }

  if (failures.length > 0) {
    console.error(
      JSON.stringify(
        {
          status: "failed",
          manifest: workspaceRelativePath(manifestPath),
          checked,
          failures
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.log(
    `verify: ok checked=${checked} manifest=${workspaceRelativePath(manifestPath)} semantic=${manifest?.semantic_fingerprint?.word_flows_full_sha256 ?? "n/a"}`
  );
}

async function runRegress(argv) {
  const opts = parseRegressArgs(argv);
  const diffOutPath = path.resolve(opts.diffOut);
  const goldensPath = path.resolve(opts.goldens);
  const regressionOutPath = path.resolve(opts.regressionOut);

  const [runA, runB] = await Promise.all([
    loadTraceRun(opts.runA, "A"),
    loadTraceRun(opts.runB, "B")
  ]);

  const [compileA, compileB] = await Promise.all([
    loadCompileContext(opts.compiledA, runA),
    loadCompileContext(opts.compiledB, runB)
  ]);

  const allKeys = Array.from(new Set([...runA.map.keys(), ...runB.map.keys()])).sort(sortRefLike);
  const addedKeys = [];
  const removedKeys = [];
  const renderingChanges = [];
  const skeletonChanges = [];
  const groupedDeltaMap = new Map();

  for (const key of allKeys) {
    const rowA = runA.map.get(key);
    const rowB = runB.map.get(key);
    if (!rowA && rowB) {
      addedKeys.push(key);
      continue;
    }
    if (rowA && !rowB) {
      removedKeys.push(key);
      continue;
    }
    if (!rowA || !rowB) {
      continue;
    }

    if (!arraysEqual(rowA.skeleton, rowB.skeleton)) {
      const delta = classifySkeletonDelta(rowA.skeleton, rowB.skeleton);
      const warningsA = wordWarningSummary(rowA, compileA);
      const warningsB = wordWarningSummary(rowB, compileB);
      const semanticReason =
        rowA.semantic_version === rowB.semantic_version
          ? `semantic_version unchanged (${rowA.semantic_version})`
          : `semantic_version ${rowA.semantic_version} -> ${rowB.semantic_version}`;
      const warningReason = warningDeltaText(warningsA, warningsB);

      const change = {
        key,
        row_a: rowA,
        row_b: rowB,
        delta,
        semantic_reason: semanticReason,
        warning_reason: warningReason
      };
      skeletonChanges.push(change);

      const group = groupedDeltaMap.get(delta.signature) ?? {
        signature: delta.signature,
        change_type: delta.change_type,
        summary: delta.summary,
        count: 0,
        sample_keys: []
      };
      group.count += 1;
      if (group.sample_keys.length < 20) {
        group.sample_keys.push(key);
      }
      groupedDeltaMap.set(delta.signature, group);
      continue;
    }

    if (rowA.flow !== rowB.flow) {
      renderingChanges.push({
        key,
        row_a: rowA,
        row_b: rowB
      });
    }
  }

  const groupedDeltas = Array.from(groupedDeltaMap.values()).sort(compareDeltaGroupEntries);
  const topGroupedDeltas = groupedDeltas.slice(0, 20);

  const truncate = (value, max = 120) => {
    const text = String(value);
    if (text.length <= max) {
      return text;
    }
    return `${text.slice(0, max - 3)}...`;
  };

  const diffLines = [
    "# Run-to-Run Diff Report",
    "",
    "## Header",
    `- run_a: ${workspaceRelativePath(runA.trace_path)}`,
    `- run_b: ${workspaceRelativePath(runB.trace_path)}`,
    `- trace_sha256_a: ${runA.trace_sha256}`,
    `- trace_sha256_b: ${runB.trace_sha256}`,
    `- semantic_versions_a: ${summarizeSemanticVersions(runA.semantic_versions)}`,
    `- semantic_versions_b: ${summarizeSemanticVersions(runB.semantic_versions)}`,
    `- compiled_bundle_a: ${compileA.path ? workspaceRelativePath(compileA.path) : "not found"}`,
    `- compiled_bundle_b: ${compileB.path ? workspaceRelativePath(compileB.path) : "not found"}`,
    `- registry_sha256_a: ${compileA.registry_sha256}`,
    `- registry_sha256_b: ${compileB.registry_sha256}`,
    `- compile_warnings_a: ${compileA.warning_count ?? "unknown"} (${formatWarningCounts(
      compileA.warning_by_code
    )})`,
    `- compile_warnings_b: ${compileB.warning_count ?? "unknown"} (${formatWarningCounts(
      compileB.warning_by_code
    )})`,
    "",
    "## Summary",
    `- total_words_a: ${runA.rows.length}`,
    `- total_words_b: ${runB.rows.length}`,
    `- stable_identity: PASS (duplicate keys rejected per-run)`,
    `- ingestion_changes: ${addedKeys.length + removedKeys.length}`,
    `- skeleton_changes: ${skeletonChanges.length}`,
    `- rendering_only_changes: ${renderingChanges.length}`
  ];

  if (compileA.load_error) {
    diffLines.push(`- compile_context_a_note: ${compileA.load_error}`);
  }
  if (compileB.load_error) {
    diffLines.push(`- compile_context_b_note: ${compileB.load_error}`);
  }

  diffLines.push("", "## Breaking Changes (Tokenization / Ingestion)");
  diffLines.push(`- added_keys_in_b: ${addedKeys.length}`);
  diffLines.push(`- removed_keys_from_a: ${removedKeys.length}`);

  if (addedKeys.length > 0) {
    diffLines.push("", "### Added Samples");
    for (const key of addedKeys.slice(0, 20)) {
      const row = runB.map.get(key);
      if (!row) {
        continue;
      }
      diffLines.push(`- ${key} | ${prettyRef(row)} | ${row.surface} | ${row.flow}`);
    }
  }

  if (removedKeys.length > 0) {
    diffLines.push("", "### Removed Samples");
    for (const key of removedKeys.slice(0, 20)) {
      const row = runA.map.get(key);
      if (!row) {
        continue;
      }
      diffLines.push(`- ${key} | ${prettyRef(row)} | ${row.surface} | ${row.flow}`);
    }
  }

  diffLines.push("", "## Top Skeleton Delta Groups");
  if (topGroupedDeltas.length === 0) {
    diffLines.push("- none");
  } else {
    diffLines.push("| rank | count | change_type | signature | sample_summary |");
    diffLines.push("| ---: | ---: | --- | --- | --- |");
    for (let index = 0; index < topGroupedDeltas.length; index += 1) {
      const entry = topGroupedDeltas[index];
      diffLines.push(
        `| ${index + 1} | ${entry.count} | ${markdownSafe(entry.change_type)} | ${markdownSafe(
          truncate(entry.signature, 100)
        )} | ${markdownSafe(truncate(entry.summary, 100))} |`
      );
    }
  }

  diffLines.push("", "## Rendering-Only Changes");
  if (renderingChanges.length === 0) {
    diffLines.push("- none");
  } else {
    for (const change of renderingChanges.slice(0, 20)) {
      diffLines.push(`- ${change.key} | ${prettyRef(change.row_b)} | ${change.row_b.surface}`);
      diffLines.push(`  - skeleton: ${(change.row_b.skeleton ?? []).join(" -> ") || "(empty)"}`);
      diffLines.push(`  - flow_a: ${change.row_a.flow}`);
      diffLines.push(`  - flow_b: ${change.row_b.flow}`);
    }
  }

  const interesting = [];
  const seenInteresting = new Set();
  const addInteresting = (entry) => {
    const id = `${entry.kind}:${entry.key}`;
    if (seenInteresting.has(id)) {
      return;
    }
    seenInteresting.add(id);
    interesting.push(entry);
  };

  for (const group of topGroupedDeltas.slice(0, 12)) {
    const sampleKey = group.sample_keys[0];
    const sample = skeletonChanges.find((change) => change.key === sampleKey);
    if (!sample) {
      continue;
    }
    addInteresting({
      kind: "skeleton_delta",
      key: sample.key,
      summary: sample.delta.summary,
      semantic_reason: sample.semantic_reason,
      warning_reason: sample.warning_reason,
      row_a: sample.row_a,
      row_b: sample.row_b
    });
  }

  for (const key of addedKeys.slice(0, 4)) {
    const row = runB.map.get(key);
    if (!row) {
      continue;
    }
    addInteresting({
      kind: "added",
      key,
      summary: "New key present in run B only",
      semantic_reason: `semantic_version ${row.semantic_version}`,
      warning_reason: "compile warning delta unavailable for added key",
      row_a: null,
      row_b: row
    });
  }

  for (const key of removedKeys.slice(0, 4)) {
    const row = runA.map.get(key);
    if (!row) {
      continue;
    }
    addInteresting({
      kind: "removed",
      key,
      summary: "Key removed from run B",
      semantic_reason: `semantic_version ${row.semantic_version}`,
      warning_reason: "compile warning delta unavailable for removed key",
      row_a: row,
      row_b: null
    });
  }

  for (const change of renderingChanges.slice(0, 4)) {
    addInteresting({
      kind: "rendering_only",
      key: change.key,
      summary: "Flow text changed, skeleton unchanged",
      semantic_reason:
        change.row_a.semantic_version === change.row_b.semantic_version
          ? `semantic_version unchanged (${change.row_b.semantic_version})`
          : `semantic_version ${change.row_a.semantic_version} -> ${change.row_b.semantic_version}`,
      warning_reason: warningDeltaText(
        wordWarningSummary(change.row_a, compileA),
        wordWarningSummary(change.row_b, compileB)
      ),
      row_a: change.row_a,
      row_b: change.row_b
    });
  }

  diffLines.push("", "## Most Interesting Samples");
  if (interesting.length === 0) {
    diffLines.push("- none");
  } else {
    for (const sample of interesting.slice(0, 20)) {
      const rowForRef = sample.row_b ?? sample.row_a ?? { key: sample.key };
      diffLines.push(`- [${sample.kind}] ${sample.key} | ${prettyRef(rowForRef)}`);
      diffLines.push(`  - summary: ${sample.summary}`);
      diffLines.push(`  - why: ${sample.semantic_reason}; ${sample.warning_reason}`);
      if (sample.row_a) {
        diffLines.push(`  - run_a: ${sample.row_a.surface} :: ${sample.row_a.flow}`);
      }
      if (sample.row_b) {
        diffLines.push(`  - run_b: ${sample.row_b.surface} :: ${sample.row_b.flow}`);
      }
    }
  }

  await fs.mkdir(path.dirname(diffOutPath), { recursive: true });
  await fs.writeFile(diffOutPath, diffLines.join("\n") + "\n", "utf8");

  const existingGoldens = await loadGoldens(goldensPath);
  let goldenCases = existingGoldens?.cases ?? [];
  let goldenMode = "reused";
  if (!existingGoldens || opts.updateGoldens) {
    goldenCases = buildCuratedGoldens({
      runRows: runB.rows,
      runMap: runB.map,
      groupedDeltas: topGroupedDeltas,
      changedSkeletonRows: skeletonChanges,
      goldenLimit: opts.goldenLimit
    });
    goldenMode = existingGoldens ? "updated" : "created";
    await writeJson(goldensPath, {
      schema_version: 1,
      source_run_b: workspaceRelativePath(runB.trace_path),
      semantic_versions_b: runB.semantic_versions,
      count: goldenCases.length,
      cases: goldenCases
    });
  }

  const regressionFailures = [];
  const regressionPasses = [];
  for (const golden of goldenCases) {
    const actual = runB.map.get(golden.key);
    const refText = actual ? prettyRef(actual) : prettyRef(golden);
    if (!actual) {
      regressionFailures.push({
        key: golden.key,
        surface: golden.surface,
        ref: refText,
        reason: "missing key in run B",
        expected_skeleton: golden.expected_skeleton,
        actual_skeleton: null,
        delta_summary: ""
      });
      continue;
    }

    if (!arraysEqual(golden.expected_skeleton, actual.skeleton)) {
      const delta = classifySkeletonDelta(golden.expected_skeleton, actual.skeleton);
      regressionFailures.push({
        key: golden.key,
        surface: actual.surface,
        ref: refText,
        reason: "skeleton mismatch",
        expected_skeleton: golden.expected_skeleton,
        actual_skeleton: actual.skeleton,
        delta_summary: delta.summary
      });
      continue;
    }

    regressionPasses.push(golden.key);
  }

  const regressionLines = buildRegressionReport({
    runB,
    compileB,
    goldensPath,
    regressionFailures,
    regressionPasses
  });
  await fs.mkdir(path.dirname(regressionOutPath), { recursive: true });
  await fs.writeFile(regressionOutPath, regressionLines.join("\n") + "\n", "utf8");

  console.log(
    `regress: delta=${skeletonChanges.length} rendering=${renderingChanges.length} goldens=${goldenCases.length} goldensMode=${goldenMode} diff=${workspaceRelativePath(
      diffOutPath
    )} regression=${workspaceRelativePath(regressionOutPath)}`
  );

  if (regressionFailures.length > 0) {
    throw new Error(
      `Regression failed: ${regressionFailures.length} golden case(s) mismatched. See ${workspaceRelativePath(
        regressionOutPath
      )}`
    );
  }
}

async function main() {
  const [command, ...argv] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(command ? 0 : 1);
  }

  if (command === "run-all") {
    await runAll(argv);
    return;
  }
  if (command === "execute") {
    await runExecute(argv);
    return;
  }
  if (command === "diff") {
    await runDiff(argv);
    return;
  }
  if (command === "promote") {
    await runPromote(argv);
    return;
  }
  if (command === "verify") {
    await runVerify(argv);
    return;
  }
  if (command === "regress") {
    await runRegress(argv);
    return;
  }

  throw new Error(`Unknown command '${command}'`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
