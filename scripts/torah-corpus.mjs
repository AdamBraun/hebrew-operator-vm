#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const DEFAULT_INPUT = path.resolve(process.cwd(), "data", "torah.json");
const DEFAULT_OUT_DIR = path.resolve(process.cwd(), "outputs", "torah-corpus", "latest");
const DEFAULT_PROMOTE_OUT = path.resolve(
  process.cwd(),
  "tests",
  "core",
  "07_golden",
  "torah_flow_promoted.json"
);
const DEFAULT_TRACE_OUT = path.resolve(process.cwd(), "corpus", "word_traces.jsonl");
const DEFAULT_FLOWS_OUT = path.resolve(process.cwd(), "corpus", "word_flows.txt");
const DEFAULT_EXECUTION_REPORT_OUT = path.resolve(
  process.cwd(),
  "reports",
  "execution_report.md"
);
const DEFAULT_TOKEN_REGISTRY_PATH = path.resolve(process.cwd(), "data", "tokens.registry.json");
const DEFAULT_COMPILED_BUNDLES_PATH = path.resolve(process.cwd(), "data", "tokens.compiled.json");
const DEFAULT_SEMANTICS_DEFS_PATH = path.resolve(process.cwd(), "registry", "token-semantics.json");
const SPACE_TOKEN = "□";

const FINAL_MAP = {
  "ך": "כ",
  "ם": "מ",
  "ן": "נ",
  "ף": "פ",
  "ץ": "צ"
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

function printHelp() {
  console.log("Usage:");
  console.log(
    "  node scripts/torah-corpus.mjs execute [--input=path] [--trace-out=path] [--flows-out=path] [--report-out=path]"
  );
  console.log(
    "  node scripts/torah-corpus.mjs execute [--token-registry=path] [--compiled-bundles=path] [--semantic-version=value] [--debug-raw-events]"
  );
  console.log(
    "  node scripts/torah-corpus.mjs run-all [--input=path] [--out-dir=path] [--lang=he|en|both]"
  );
  console.log(
    "  node scripts/torah-corpus.mjs run-all [--normalize-finals] [--allow-runtime-errors]"
  );
  console.log("  node scripts/torah-corpus.mjs diff --prev=dir-or-file --next=dir-or-file [--out=path]");
  console.log(
    "  node scripts/torah-corpus.mjs promote --diff=path [--next=dir-or-file] [--out=path] [--limit=N]"
  );
  console.log("  node scripts/torah-corpus.mjs verify [--dir=path]");
  console.log("");
  console.log("Defaults:");
  console.log(`  --input=${DEFAULT_INPUT}`);
  console.log(`  --out-dir=${DEFAULT_OUT_DIR}`);
  console.log(`  --trace-out=${DEFAULT_TRACE_OUT}`);
  console.log(`  --flows-out=${DEFAULT_FLOWS_OUT}`);
  console.log(`  --report-out=${DEFAULT_EXECUTION_REPORT_OUT}`);
  console.log(`  --token-registry=${DEFAULT_TOKEN_REGISTRY_PATH}`);
  console.log(`  --compiled-bundles=${DEFAULT_COMPILED_BUNDLES_PATH}`);
  console.log("  --lang=he");
  console.log("  normalize-finals=false");
  console.log("  allow-runtime-errors=false");
}

function readOptionValue(argv, index, optionName) {
  const arg = argv[index];
  const prefix = `${optionName}=`;
  if (arg.startsWith(prefix)) {
    return { value: arg.slice(prefix.length), nextIndex: index };
  }
  if (arg === optionName) {
    if (index + 1 >= argv.length) {
      throw new Error(`Missing value for ${optionName}`);
    }
    return { value: argv[index + 1], nextIndex: index + 1 };
  }
  return null;
}

function parseCommonRunArgs(argv) {
  const opts = {
    input: DEFAULT_INPUT,
    outDir: DEFAULT_OUT_DIR,
    lang: "he",
    normalizeFinals: false,
    allowRuntimeErrors: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    const inputOpt = readOptionValue(argv, index, "--input");
    if (inputOpt) {
      opts.input = inputOpt.value;
      index = inputOpt.nextIndex;
      continue;
    }
    const outDirOpt = readOptionValue(argv, index, "--out-dir");
    if (outDirOpt) {
      opts.outDir = outDirOpt.value;
      index = outDirOpt.nextIndex;
      continue;
    }
    const langOpt = readOptionValue(argv, index, "--lang");
    if (langOpt) {
      opts.lang = langOpt.value;
      index = langOpt.nextIndex;
      continue;
    }
    if (arg === "--normalize-finals") {
      opts.normalizeFinals = true;
      continue;
    }
    if (arg === "--no-normalize-finals") {
      opts.normalizeFinals = false;
      continue;
    }
    if (arg === "--allow-runtime-errors") {
      opts.allowRuntimeErrors = true;
      continue;
    }
  }

  if (!["he", "en", "both"].includes(opts.lang)) {
    throw new Error(`Invalid --lang value: ${opts.lang}`);
  }

  return opts;
}

function parseExecuteArgs(argv) {
  const runOpts = parseCommonRunArgs(argv);
  const opts = {
    ...runOpts,
    traceOut: DEFAULT_TRACE_OUT,
    flowsOut: DEFAULT_FLOWS_OUT,
    reportOut: DEFAULT_EXECUTION_REPORT_OUT,
    tokenRegistry: DEFAULT_TOKEN_REGISTRY_PATH,
    compiledBundles: DEFAULT_COMPILED_BUNDLES_PATH,
    semanticVersion: "",
    debugRawEvents: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    const traceOutOpt = readOptionValue(argv, index, "--trace-out");
    if (traceOutOpt) {
      opts.traceOut = traceOutOpt.value;
      index = traceOutOpt.nextIndex;
      continue;
    }
    const flowsOutOpt = readOptionValue(argv, index, "--flows-out");
    if (flowsOutOpt) {
      opts.flowsOut = flowsOutOpt.value;
      index = flowsOutOpt.nextIndex;
      continue;
    }
    const reportOutOpt = readOptionValue(argv, index, "--report-out");
    if (reportOutOpt) {
      opts.reportOut = reportOutOpt.value;
      index = reportOutOpt.nextIndex;
      continue;
    }
    const tokenRegistryOpt = readOptionValue(argv, index, "--token-registry");
    if (tokenRegistryOpt) {
      opts.tokenRegistry = tokenRegistryOpt.value;
      index = tokenRegistryOpt.nextIndex;
      continue;
    }
    const compiledBundlesOpt = readOptionValue(argv, index, "--compiled-bundles");
    if (compiledBundlesOpt) {
      opts.compiledBundles = compiledBundlesOpt.value;
      index = compiledBundlesOpt.nextIndex;
      continue;
    }
    const semanticVersionOpt = readOptionValue(argv, index, "--semantic-version");
    if (semanticVersionOpt) {
      opts.semanticVersion = semanticVersionOpt.value;
      index = semanticVersionOpt.nextIndex;
      continue;
    }
    if (arg === "--debug-raw-events") {
      opts.debugRawEvents = true;
      continue;
    }
  }

  return opts;
}

function parseDiffArgs(argv) {
  const opts = {
    prev: "",
    next: "",
    out: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    const prevOpt = readOptionValue(argv, index, "--prev");
    if (prevOpt) {
      opts.prev = prevOpt.value;
      index = prevOpt.nextIndex;
      continue;
    }
    const nextOpt = readOptionValue(argv, index, "--next");
    if (nextOpt) {
      opts.next = nextOpt.value;
      index = nextOpt.nextIndex;
      continue;
    }
    const outOpt = readOptionValue(argv, index, "--out");
    if (outOpt) {
      opts.out = outOpt.value;
      index = outOpt.nextIndex;
      continue;
    }
  }

  if (!opts.prev || !opts.next) {
    throw new Error("diff requires --prev and --next");
  }
  return opts;
}

function parsePromoteArgs(argv) {
  const opts = {
    diffPath: "",
    next: "",
    out: DEFAULT_PROMOTE_OUT,
    limit: 40
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    const diffOpt = readOptionValue(argv, index, "--diff");
    if (diffOpt) {
      opts.diffPath = diffOpt.value;
      index = diffOpt.nextIndex;
      continue;
    }
    const nextOpt = readOptionValue(argv, index, "--next");
    if (nextOpt) {
      opts.next = nextOpt.value;
      index = nextOpt.nextIndex;
      continue;
    }
    const outOpt = readOptionValue(argv, index, "--out");
    if (outOpt) {
      opts.out = outOpt.value;
      index = outOpt.nextIndex;
      continue;
    }
    const limitOpt = readOptionValue(argv, index, "--limit");
    if (limitOpt) {
      opts.limit = Number(limitOpt.value);
      index = limitOpt.nextIndex;
      continue;
    }
  }

  if (!opts.diffPath) {
    throw new Error("promote requires --diff");
  }
  if (!Number.isFinite(opts.limit) || opts.limit <= 0) {
    throw new Error(`Invalid --limit: ${opts.limit}`);
  }
  return opts;
}

function parseVerifyArgs(argv) {
  const opts = {
    dir: DEFAULT_OUT_DIR
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    const dirOpt = readOptionValue(argv, index, "--dir");
    if (dirOpt) {
      opts.dir = dirOpt.value;
      index = dirOpt.nextIndex;
      continue;
    }
  }

  return opts;
}

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

function tokenRegistrySignature(token) {
  const raw = String(token.raw ?? token.letter ?? "").normalize("NFD");
  const chars = [...raw];
  const base = chars[0] ?? tokenBaseLetter(token);
  const markCodepoints = chars
    .slice(1)
    .map((mark) => mark.codePointAt(0))
    .filter((codepoint) => codepoint !== undefined)
    .sort((left, right) => left - right);
  return encodeRegistrySignature(base, markCodepoints);
}

function buildTokenIdBySignature(registryPayload) {
  const map = new Map();
  for (const [tokenIdRaw, descriptor] of Object.entries(registryPayload?.tokens ?? {})) {
    const tokenId = Number(tokenIdRaw);
    if (!Number.isFinite(tokenId)) {
      continue;
    }
    const signature =
      descriptor?.signature ??
      encodeRegistrySignature(
        descriptor?.base,
        Array.isArray(descriptor?.marks)
          ? descriptor.marks
              .map((mark) => Number.parseInt(String(mark).replace(/^U\+/u, ""), 16))
              .filter((codepoint) => Number.isFinite(codepoint))
          : []
      );
    map.set(signature, tokenId);
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

function mapRawEventToFlow(event, traceEntry) {
  switch (event.type) {
    case "align":
      return { op_family: "TSADI.ALIGN", params_summary: summarizeEvent(event.type, event, traceEntry) };
    case "align_final":
      return {
        op_family: "FINAL_TSADI.ALIGN_FINAL",
        params_summary: summarizeEvent(event.type, event, traceEntry)
      };
    case "finalize":
      return { op_family: "TAV.FINALIZE", params_summary: summarizeEvent(event.type, event, traceEntry) };
    case "bestow":
      return { op_family: "GIMEL.BESTOW", params_summary: summarizeEvent(event.type, event, traceEntry) };
    case "declare":
      return { op_family: "HE.DECLARE", params_summary: summarizeEvent(event.type, event, traceEntry) };
    case "declare_breath":
      return {
        op_family: "HE.DECLARE_BREATH",
        params_summary: summarizeEvent(event.type, event, traceEntry)
      };
    case "declare_pin":
      return { op_family: "HE.DECLARE_PIN", params_summary: summarizeEvent(event.type, event, traceEntry) };
    case "declare_alias":
      return {
        op_family: "HE.DECLARE_ALIAS",
        params_summary: summarizeEvent(event.type, event, traceEntry)
      };
    case "alias":
      return { op_family: "ALEPH.ALIAS", params_summary: summarizeEvent(event.type, event, traceEntry) };
    case "support":
      return {
        op_family: "SAMEKH.SUPPORT_DISCHARGE",
        params_summary: summarizeEvent(event.type, event, traceEntry)
      };
    case "fall":
      return {
        op_family: "SPACE.SUPPORT_DISCHARGE",
        params_summary: summarizeEvent(event.type, event, traceEntry)
      };
    case "boundary_auto_close":
      return {
        op_family: "SPACE.BOUNDARY_AUTO_CLOSE",
        params_summary: summarizeEvent(event.type, event, traceEntry)
      };
    case "boundary_close":
      return {
        op_family:
          traceEntry.read_op === "ד" ? "DALET.BOUNDARY_CLOSE" : "RESH.BOUNDARY_CLOSE",
        params_summary: summarizeEvent(event.type, event, traceEntry)
      };
    case "utter":
      return { op_family: "PE.UTTER", params_summary: summarizeEvent(event.type, event, traceEntry) };
    case "utter_close":
      return {
        op_family: "FINAL_PE.UTTER_CLOSE",
        params_summary: summarizeEvent(event.type, event, traceEntry)
      };
    case "compartment":
      return {
        op_family: "HET.COMPARTMENT",
        params_summary: summarizeEvent(event.type, event, traceEntry)
      };
    case "endpoint":
      return {
        op_family: "LAMED.ENDPOINT",
        params_summary: summarizeEvent(event.type, event, traceEntry)
      };
    case "covert":
      return { op_family: "TET.COVERT", params_summary: summarizeEvent(event.type, event, traceEntry) };
    case "gate":
      return { op_family: "ZAYIN.GATE", params_summary: summarizeEvent(event.type, event, traceEntry) };
    case "approx":
      return { op_family: "QOF.APPROX", params_summary: summarizeEvent(event.type, event, traceEntry) };
    case "shin":
      return { op_family: "SHIN.FORK", params_summary: summarizeEvent(event.type, event, traceEntry) };
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

function extractWordFlow(trace) {
  const events = [];
  const flow_skeleton = [];
  const flow_compact = [];

  let prevOStackLength = 0;

  const addFlow = (op_family, params_summary, source) => {
    events.push({ type: op_family, source, params_summary });
    flow_skeleton.push([op_family, params_summary]);
    flow_compact.push(op_family);
  };

  for (const traceEntry of trace) {
    const delta = traceEntry.OStackLength - prevOStackLength;
    prevOStackLength = traceEntry.OStackLength;

    if (traceEntry.read_op === "מ" && delta > 0) {
      addFlow("MEM.OPEN", "open mem zone debt", "derived");
    }
    if (traceEntry.read_op === "ם") {
      addFlow("FINAL_MEM.CLOSE", delta < 0 ? "close existing mem zone" : "close/synthesize mem zone", "derived");
    }
    if (traceEntry.read_op === "נ" && delta > 0) {
      addFlow("NUN.SUPPORT_DEBT", "open support debt", "derived");
    }
    if (traceEntry.read_op === "ן") {
      addFlow("FINAL_NUN.SUPPORT_DEBT", "open support debt", "derived");
      addFlow("FINAL_NUN.SUPPORT_DISCHARGE", "immediate same-word discharge", "derived");
    }

    for (const event of traceEntry.events ?? []) {
      if (!IMPORTANT_EVENT_TYPES.has(event.type)) {
        continue;
      }
      const mapped = mapRawEventToFlow(event, traceEntry);
      if (!mapped) {
        continue;
      }
      addFlow(mapped.op_family, mapped.params_summary, "vm_event");
    }

    if (traceEntry.token === SPACE_TOKEN && delta < 0) {
      const supportFalls = (traceEntry.events ?? []).filter((event) => event.type === "fall").length;
      const boundaryAuto = (traceEntry.events ?? []).filter(
        (event) => event.type === "boundary_auto_close"
      ).length;
      const memAutoClose = Math.max(0, -delta - supportFalls - boundaryAuto);
      for (let i = 0; i < memAutoClose; i += 1) {
        addFlow("SPACE.MEM_AUTO_CLOSE", "auto-close mem zone at boundary", "derived");
      }
    }
  }

  return { events, flow_skeleton, flow_compact, one_liner: compileOneLiner(flow_compact) };
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
      .sort((left, right) => right.count - left.count || left.pattern.join().localeCompare(right.pattern.join()))
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

function toPortablePath(p) {
  return String(p).split(path.sep).join("/");
}

function workspaceRelativePath(absPath) {
  const resolved = path.resolve(absPath);
  const rel = path.relative(process.cwd(), resolved);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
    return toPortablePath(rel);
  }
  return toPortablePath(resolved);
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
  const { tokenize } = require(path.resolve(process.cwd(), "impl/reference/dist/compile/tokenizer"));
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
          opts.lang === "en"
            ? verse.en
            : opts.lang === "both"
              ? verse.he ?? verse.en
              : verse.he;
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
  const tokenIdBySignature = new Map(
    sortedSignatureKeys.map((key, index) => [key, index + 1])
  );

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

  const [rawBuffer, tokenRegistryPayload, compiledPayload, semanticsDefsPayload] = await Promise.all([
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
  const { tokenize } = require(path.resolve(process.cwd(), "impl/reference/dist/compile/tokenizer"));
  const { runProgramWithTrace } = require(path.resolve(process.cwd(), "impl/reference/dist/vm/vm"));
  const { createInitialState } = require(
    path.resolve(process.cwd(), "impl/reference/dist/state/state")
  );

  const startNs = process.hrtime.bigint();
  const rows = [];
  const flowLines = [];
  const skeletonCounts = new Map();

  const unknownSignatures = [];
  const missingBundles = [];
  const runtimeErrors = [];

  let versesTotal = 0;
  let versesSanitized = 0;
  let versesSkipped = 0;
  let wordsTotal = 0;

  for (const book of data.books ?? []) {
    for (const chapter of book.chapters ?? []) {
      for (const verse of chapter.verses ?? []) {
        versesTotal += 1;
        const rawText =
          opts.lang === "en"
            ? verse.en
            : opts.lang === "both"
              ? verse.he ?? verse.en
              : verse.he;
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

          const ref = {
            book: book.name,
            chapter: chapter.n,
            verse: verse.n,
            token_index: wordIndex + 1
          };
          const refKey = buildRefKey(ref);

          const tokens = tokenize(surface).filter((token) => token.letter !== SPACE_TOKEN);
          const token_ids = [];
          const localUnknownSignatures = [];

          for (const token of tokens) {
            const signature = tokenRegistrySignature(token);
            const tokenId = tokenIdBySignature.get(signature);
            if (tokenId === undefined) {
              localUnknownSignatures.push(signature);
              continue;
            }
            token_ids.push(tokenId);
            if (!compiledTokenIdSet.has(String(tokenId))) {
              missingBundles.push({ ref_key: refKey, surface, token_id: tokenId });
            }
          }

          let flowCompact = [];
          let flowRaw = [];
          let runtimeErrorMessage = "";
          if (localUnknownSignatures.length === 0) {
            try {
              const { trace } = runProgramWithTrace(surface, createInitialState());
              const flow = extractWordFlow(trace);
              flowRaw = flow.flow_compact;
              flowCompact = dedupeConsecutive(flow.flow_compact);
            } catch (err) {
              if (!opts.allowRuntimeErrors || err?.name !== "RuntimeError") {
                throw err;
              }
              runtimeErrorMessage = String(err?.message ?? "RuntimeError");
              runtimeErrors.push({ ref_key: refKey, surface, message: runtimeErrorMessage });
              flowRaw = ["ERROR.RUNTIME"];
              flowCompact = ["ERROR.RUNTIME"];
            }
          } else {
            unknownSignatures.push({ ref_key: refKey, surface, signatures: localUnknownSignatures });
            flowRaw = ["ERROR.UNKNOWN_SIGNATURE"];
            flowCompact = ["ERROR.UNKNOWN_SIGNATURE"];
          }

          const flow = compileFlowString(flowCompact, " ⇢ ");
          const skeletonKey = flowCompact.join(" -> ");
          skeletonCounts.set(skeletonKey, (skeletonCounts.get(skeletonKey) ?? 0) + 1);

          const row = {
            ref,
            ref_key: refKey,
            surface,
            token_ids,
            skeleton: flowCompact,
            flow,
            semantic_version: semanticVersion
          };
          if (opts.debugRawEvents) {
            row.skeleton_raw = flowRaw;
          }
          rows.push(row);
          flowLines.push(`${refKey}\t${surface}\t${flow}`);
        }
      }
    }
  }

  const traceContent = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  await Promise.all([
    fs.mkdir(path.dirname(traceOutPath), { recursive: true }),
    fs.mkdir(path.dirname(flowsOutPath), { recursive: true }),
    fs.mkdir(path.dirname(reportOutPath), { recursive: true })
  ]);
  await Promise.all([
    fs.writeFile(traceOutPath, traceContent, "utf8"),
    fs.writeFile(flowsOutPath, flowLines.join("\n") + "\n", "utf8")
  ]);

  const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
  const topSkeletons = Array.from(skeletonCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "en"))
    .slice(0, 20);

  const traceSha256 = sha256FromBuffer(Buffer.from(traceContent, "utf8"));
  const flowDeterminismFailures = rows.filter(
    (row) => row.flow !== compileFlowString(row.skeleton, " ⇢ ")
  ).length;

  const reportLines = [
    "# Corpus Execution Report",
    "",
    "## Summary",
    `- input: ${workspaceRelativePath(inputPath)}`,
    `- token_registry: ${workspaceRelativePath(tokenRegistryPath)}`,
    `- compiled_bundles: ${workspaceRelativePath(compiledBundlesPath)}`,
    `- semantic_version: ${semanticVersion}`,
    `- words_total: ${wordsTotal}`,
    `- words_emitted: ${rows.length}`,
    `- verses_total: ${versesTotal}`,
    `- verses_sanitized: ${versesSanitized}`,
    `- verses_skipped: ${versesSkipped}`,
    `- unique_skeletons: ${skeletonCounts.size}`,
    `- trace_sha256: ${traceSha256}`,
    `- elapsed_ms: ${elapsedMs.toFixed(2)}`,
    `- words_per_second: ${(elapsedMs > 0 ? (rows.length * 1000) / elapsedMs : 0).toFixed(2)}`,
    "",
    "## Quality Gates",
    `- coverage: ${rows.length === wordsTotal ? "PASS" : "FAIL"} (${rows.length}/${wordsTotal})`,
    `- determinism_basis: trace checksum captured (${traceSha256})`,
    `- flow_derivation: ${flowDeterminismFailures === 0 ? "PASS" : "FAIL"} (${flowDeterminismFailures} mismatches)`,
    "",
    "## Errors",
    `- unknown_signatures: ${unknownSignatures.length}`,
    `- missing_compiled_bundles: ${missingBundles.length}`,
    `- runtime_errors: ${runtimeErrors.length}`,
    "",
    "## Top Skeletons",
    ...topSkeletons.map(([skeleton, count]) => `- ${count} x ${skeleton || "(empty)"}`),
    "",
    "## Outputs",
    `- traces: ${workspaceRelativePath(traceOutPath)}`,
    `- flows: ${workspaceRelativePath(flowsOutPath)}`,
    `- report: ${workspaceRelativePath(reportOutPath)}`
  ];

  if (unknownSignatures.length > 0) {
    reportLines.push("", "### Unknown Signature Samples");
    for (const sample of unknownSignatures.slice(0, 20)) {
      reportLines.push(`- ${sample.ref_key}: ${sample.signatures.join(", ")}`);
    }
  }

  if (missingBundles.length > 0) {
    reportLines.push("", "### Missing Bundle Samples");
    for (const sample of missingBundles.slice(0, 20)) {
      reportLines.push(`- ${sample.ref_key}: token_id=${sample.token_id}`);
    }
  }

  if (runtimeErrors.length > 0) {
    reportLines.push("", "### Runtime Error Samples");
    for (const sample of runtimeErrors.slice(0, 20)) {
      reportLines.push(`- ${sample.ref_key}: ${sample.message}`);
    }
  }

  await fs.writeFile(reportOutPath, reportLines.join("\n") + "\n", "utf8");

  const hasHardErrors = unknownSignatures.length > 0 || missingBundles.length > 0;
  if (hasHardErrors) {
    throw new Error(
      `execute failed: unknownSignatures=${unknownSignatures.length} missingBundles=${missingBundles.length}`
    );
  }

  console.log(
    [
      `execute: words=${rows.length}`,
      `uniqueSkeletons=${skeletonCounts.size}`,
      `runtimeErrors=${runtimeErrors.length}`,
      `traceOut=${traceOutPath}`,
      `flowsOut=${flowsOutPath}`,
      `reportOut=${reportOutPath}`
    ].join(" ")
  );
}

function normalizeComparableRow(row) {
  return {
    ref_key: row.ref_key,
    surface: row.surface,
    tokens: row.tokens,
    events: row.events,
    flow_skeleton: row.flow_skeleton,
    one_liner: row.one_liner
  };
}

async function runDiff(argv) {
  const opts = parseDiffArgs(argv);
  const prevPath = resolveCorpusFilePath(opts.prev);
  const nextPath = resolveCorpusFilePath(opts.next);
  const outPath = opts.out
    ? path.resolve(opts.out)
    : path.join(path.dirname(nextPath), "diff.from-prev.json");

  const [prevRows, nextRows] = await Promise.all([readJsonl(prevPath), readJsonl(nextPath)]);
  const prevMap = new Map(prevRows.map((row) => [row.ref_key, normalizeComparableRow(row)]));
  const nextMap = new Map(nextRows.map((row) => [row.ref_key, normalizeComparableRow(row)]));
  const keys = Array.from(new Set([...prevMap.keys(), ...nextMap.keys()])).sort((left, right) =>
    left.localeCompare(right, "en")
  );

  const groups = {
    added: [],
    removed: [],
    token_sequence_changed: [],
    event_stream_changed: [],
    flow_skeleton_changed: [],
    one_liner_changed: [],
    surface_changed: []
  };

  const changedWords = [];

  for (const key of keys) {
    const prev = prevMap.get(key);
    const next = nextMap.get(key);
    if (!prev && next) {
      groups.added.push(key);
      changedWords.push({ ref_key: key, why: ["added"] });
      continue;
    }
    if (prev && !next) {
      groups.removed.push(key);
      changedWords.push({ ref_key: key, why: ["removed"] });
      continue;
    }
    if (!prev || !next) {
      continue;
    }

    const why = [];
    if (JSON.stringify(prev.surface) !== JSON.stringify(next.surface)) {
      groups.surface_changed.push(key);
      why.push("surface_changed");
    }
    if (JSON.stringify(prev.tokens) !== JSON.stringify(next.tokens)) {
      groups.token_sequence_changed.push(key);
      why.push("token_sequence_changed");
    }
    if (JSON.stringify(prev.events) !== JSON.stringify(next.events)) {
      groups.event_stream_changed.push(key);
      why.push("event_stream_changed");
    }
    if (JSON.stringify(prev.flow_skeleton) !== JSON.stringify(next.flow_skeleton)) {
      groups.flow_skeleton_changed.push(key);
      why.push("flow_skeleton_changed");
    }
    if (JSON.stringify(prev.one_liner) !== JSON.stringify(next.one_liner)) {
      groups.one_liner_changed.push(key);
      why.push("one_liner_changed");
    }
    if (why.length > 0) {
      changedWords.push({ ref_key: key, why });
    }
  }

  const payload = {
    schema_version: 1,
    prev: workspaceRelativePath(prevPath),
    next: workspaceRelativePath(nextPath),
    summary: {
      total_prev: prevRows.length,
      total_next: nextRows.length,
      changed_words: changedWords.length,
      by_reason: Object.fromEntries(
        Object.entries(groups).map(([key, refs]) => [key, refs.length])
      )
    },
    groups,
    changed_words: changedWords
  };

  await writeJson(outPath, payload);
  console.log(`diff: changed=${changedWords.length} out=${outPath}`);
}

async function runPromote(argv) {
  const opts = parsePromoteArgs(argv);
  const diffPath = path.resolve(opts.diffPath);
  const diff = await readJson(diffPath);

  const nextPath = opts.next
    ? resolveCorpusFilePath(opts.next)
    : diff?.next
      ? diff.next
      : "";
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
      const [stat, sha256] = await Promise.all([fs.stat(artifactPath), sha256FromFile(artifactPath)]);
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

  throw new Error(`Unknown command '${command}'`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
