/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars */
// @ts-nocheck

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

export {
  SPACE_TOKEN,
  sanitizeText,
  uniqPreserveOrder,
  sortByOrder,
  mapTochKinds,
  tokenBaseLetter,
  deriveSignatureNotes,
  makeSignature,
  signatureKey,
  toCodepoint,
  encodeRegistrySignature,
  parseCodepointString,
  markCodepointsFromDescriptor,
  baseLetterFromDescriptor,
  normalizeMarkCodepointsForRuntime,
  tokenRegistrySignature,
  buildTokenIdBySignature,
  dedupeConsecutive,
  summarizeEvent,
  asHandleId,
  mapRawEventToFlow,
  compileFlowString,
  compileOneLiner,
  makeRuntimeErrorTraceEvent,
  makeUnknownSignatureTraceEvent,
  extractWordFlow,
  isBoundaryFlowOp,
  extractBoundaryOps,
  splitTraceIntoWordSegments,
  collectExecutableVerses,
  BOUNDARY_FLOW_OPS,
  SUPPORT_DEBT_OPS,
  SUPPORT_DISCHARGE_OPS,
  SAFETY_RAIL_ALLOWLIST
};
