// scripts/render/pasukGraph.mjs
// ESM library: VM(trace) -> Graphviz DOT
// Contract: render only from VM output (handles/links/boundaries/meta).

function looksLikeVm(value) {
  if (!value || typeof value !== "object") return false;
  return (
    Array.isArray(value.handles) || Array.isArray(value.links) || Array.isArray(value.boundaries)
  );
}

function pickVm(root) {
  if (!root || typeof root !== "object") return null;

  // common direct layouts
  if (looksLikeVm(root)) return root;
  if (looksLikeVm(root.vm)) return root.vm;
  if (looksLikeVm(root.trace?.vm)) return root.trace.vm;
  if (looksLikeVm(root.final_state)) return root.final_state;
  if (looksLikeVm(root.trace?.final_state)) return root.trace.final_state;

  // if a nested VM object exists but arrays are elsewhere
  if (root.vm && typeof root.vm === "object" && looksLikeVm(root)) return root;
  if (
    root.final_state?.vm &&
    typeof root.final_state.vm === "object" &&
    looksLikeVm(root.final_state)
  ) {
    return root.final_state;
  }

  return null;
}

function vmMeta(vm, ...keys) {
  for (const key of keys) {
    if (vm && vm[key] !== undefined && vm[key] !== null) return vm[key];
    if (vm?.vm && vm.vm[key] !== undefined && vm.vm[key] !== null) return vm.vm[key];
  }
  return "";
}

function escapeLabel(s) {
  const str = String(s ?? "");
  // DOT labels: escape backslashes and quotes; normalize newlines
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n");
}

function dotLabel(raw) {
  return `"${escapeLabel(raw)}"`;
}

function dotId(raw) {
  // safest: always quote IDs
  return JSON.stringify(String(raw ?? ""));
}

function dotBareId(s) {
  const id = String(s ?? "");
  // Emit unquoted IDs when safe; otherwise fall back to quoted JSON string.
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(id) ? id : dotId(id);
}

const HEBREW_TO_LATIN = {
  א: "A",
  ב: "B",
  ג: "G",
  ד: "D",
  ה: "H",
  ו: "V",
  ז: "Z",
  ח: "Ch",
  ט: "T",
  י: "Y",
  כ: "K",
  ך: "Kf",
  ל: "L",
  מ: "M",
  ם: "Mf",
  נ: "N",
  ן: "Nf",
  ס: "S",
  ע: "E",
  פ: "P",
  ף: "Pf",
  צ: "Ts",
  ץ: "Tsf",
  ק: "Q",
  ר: "R",
  ש: "Sh",
  ת: "Th"
};

function prettyIdFromHandleId(rawId) {
  const id = String(rawId ?? "");
  if (id === "Ω") return "Omega";
  if (id === "⊥") return "Trans";

  // Pattern: <glyph>:<a>:<b> (e.g. ב:1:2)
  const match = id.match(/^(.):(\d+):(\d+)$/u);
  if (match) {
    const [, glyph, a, b] = match;
    const latin = HEBREW_TO_LATIN[glyph] ?? "H";
    return `${latin}${a}${b}`; // B12, R83, Th55, etc.
  }

  // Fallback: make a safe-ish identifier
  return `H_${id.replace(/[^A-Za-z0-9_]+/g, "_")}`;
}

function buildIdMap(handleIds, opts) {
  const map = new Map(); // handleId -> nodeId

  if (!opts?.prettyIds) {
    for (const handleId of handleIds) {
      map.set(String(handleId), String(handleId));
    }
    return map;
  }

  const used = new Map(); // nodeId -> count
  for (const hid of handleIds) {
    const base = prettyIdFromHandleId(hid);
    const safe = base.replace(/[^A-Za-z0-9_]+/g, "_");
    const key = safe || "N";

    const count = (used.get(key) ?? 0) + 1;
    used.set(key, count);

    map.set(String(hid), count === 1 ? key : `${key}_${count}`);
  }
  return map;
}

function attrs(obj) {
  // obj: {key: value} -> key=value pairs, values already quoted if needed
  return Object.entries(obj)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
}

function normalizeHandles(vm) {
  const handles = Array.isArray(vm?.handles) ? vm.handles : [];
  return handles
    .filter((handle) => handle && handle.id !== undefined && handle.id !== null)
    .map((handle) => ({
      id: String(handle.id),
      kind: handle.kind ? String(handle.kind) : "",
      meta: handle.meta && typeof handle.meta === "object" ? handle.meta : {},
      raw: handle
    }));
}

function normalizeLinks(vm) {
  const links = Array.isArray(vm?.links) ? vm.links : [];
  return links
    .filter((link) => link && link.from != null && link.to != null)
    .map((link) => ({
      from: String(link.from),
      to: String(link.to),
      label: link.label ?? link.kind ?? link.type ?? "",
      meta: link.meta && typeof link.meta === "object" ? link.meta : {},
      raw: link
    }));
}

function normalizeBoundaries(vm) {
  const boundaries = Array.isArray(vm?.boundaries) ? vm.boundaries : [];
  return boundaries
    .filter(
      (boundary) =>
        boundary &&
        (boundary.id != null ||
          boundary.boundaryId != null ||
          boundary.inside != null ||
          boundary.outside != null)
    )
    .map((boundary, index) => ({
      id: String(boundary.id ?? boundary.boundaryId ?? `b${index}`),
      inside: boundary.inside != null ? String(boundary.inside) : null,
      outside: boundary.outside != null ? String(boundary.outside) : null,
      members: Array.isArray(boundary.members)
        ? boundary.members.map(String)
        : Array.isArray(boundary.memberIds)
          ? boundary.memberIds.map(String)
          : Array.isArray(boundary.contains)
            ? boundary.contains.map(String)
            : null,
      meta: boundary.meta && typeof boundary.meta === "object" ? boundary.meta : {},
      raw: boundary
    }));
}

function parseCsvList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter((item) => item.length > 0);
  }
  const raw = String(value ?? "");
  if (!raw.trim()) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function asFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseHandleTau(handleId) {
  const id = String(handleId ?? "");
  // Handle ids follow "<glyph>:<tau>:<ordinal>" (e.g. ב:15:1).
  const match = id.match(/^[^:]+:(\d+):\d+$/u);
  if (!match) return null;
  const tau = Number(match[1]);
  return Number.isFinite(tau) ? tau : null;
}

function collectTausFromWordEntry(entry) {
  const out = [];
  const pushTau = (value) => {
    const tau = asFiniteNumber(value);
    if (tau == null) return;
    out.push(Number(tau));
  };

  pushTau(entry?.tau);
  pushTau(entry?.tauBefore);
  pushTau(entry?.tauAfter);

  const phases = Array.isArray(entry?.phases) ? entry.phases : [];
  for (const phase of phases) {
    pushTau(phase?.tau);
    const steps = Array.isArray(phase?.steps) ? phase.steps : [];
    for (const step of steps) {
      pushTau(step?.tau);
      const events = Array.isArray(step?.events) ? step.events : [];
      for (const event of events) pushTau(event?.tau);
    }
  }

  return out;
}

function normalizeWordSections(rawSections) {
  if (!Array.isArray(rawSections)) return [];

  return rawSections
    .map((rawSection, sectionIndex) => {
      const opEntries = Array.isArray(rawSection?.op_entries) ? rawSection.op_entries : [];
      const tauSet = new Set();
      for (const entry of opEntries) {
        for (const tau of collectTausFromWordEntry(entry)) {
          tauSet.add(Number(tau));
        }
      }

      const wordIndexRaw =
        rawSection?.word_index ?? rawSection?.wordIndex ?? rawSection?.index ?? sectionIndex + 1;
      const wordIndexParsed = asFiniteNumber(wordIndexRaw);
      const wordIndex = wordIndexParsed == null ? sectionIndex + 1 : Number(wordIndexParsed);
      const surfaceRaw =
        rawSection?.surface ?? rawSection?.word ?? rawSection?.word_text ?? rawSection?.label;
      const surface = String(surfaceRaw ?? "").trim();

      return {
        sectionIndex,
        wordIndex,
        surface,
        taus: Array.from(tauSet.values()).sort((a, b) => a - b)
      };
    })
    .filter((section) => section.surface.length > 0 || section.taus.length > 0);
}

function buildTauToWordSectionMap(sections) {
  const map = new Map();
  for (const section of sections) {
    for (const tau of section.taus) {
      if (!map.has(tau)) map.set(tau, section.sectionIndex);
    }
  }
  return map;
}

function inferBoundaryMembership(boundaries, handles) {
  // returns: Map(boundaryId -> Set(handleId))
  const map = new Map();

  // 1) explicit members on boundary
  for (const boundary of boundaries) {
    if (boundary.members && boundary.members.length) {
      map.set(boundary.id, new Set(boundary.members));
    }
  }

  // 2) infer from handle.meta (if present)
  // try common keys: boundaryId, scopeId, boundary, scope_path (array)
  for (const handle of handles) {
    const meta = handle.meta || {};
    const candidates = [];

    if (meta.boundaryId != null) candidates.push(String(meta.boundaryId));
    if (meta.scopeId != null) candidates.push(String(meta.scopeId));
    if (meta.boundary != null) candidates.push(String(meta.boundary));

    if (Array.isArray(meta.scope_path)) {
      for (const scopeItem of meta.scope_path) candidates.push(String(scopeItem));
    }

    for (const boundaryId of candidates) {
      if (!map.has(boundaryId)) map.set(boundaryId, new Set());
      map.get(boundaryId).add(handle.id);
    }
  }

  return map;
}

// ====== Visual mapping (VM kinds -> shapes/styles) ======

function nodeShapeFor(handle) {
  // only VM output kinds/meta
  if (handle.id === "Ω") return "doublecircle";
  if (handle.id === "⊥") return "circle";

  if (handle.kind === "rule") return "hexagon";
  if (handle.kind === "artifact" || handle.kind === "finalize") return "octagon";

  // Parent shin-like node: render as record with true ports.
  if (
    handle.kind === "structured" &&
    handle.meta?.spine &&
    handle.meta?.left &&
    handle.meta?.right
  ) {
    return "record";
  }
  // Leaf shin parts remain simple nodes.
  if (handle.kind === "structured" && handle.meta?.role) return "ellipse";
  if (
    handle.kind === "structured" &&
    (handle.meta?.label === "vav" || handle.meta?.role === "lifeline")
  ) {
    return "parallelogram";
  }

  // for rounded nodes, use box + style rounded (not a shape)
  if (handle.kind === "scope") return "box";

  if (handle.kind === "boundary") return "box";

  return "ellipse";
}

function nodeStyleFor(handle) {
  const styles = ["filled"];

  // rounded applies to box-ish nodes only; safe to include for scopes
  if (handle.kind === "scope") styles.push("rounded");

  // boundary "hard" might become bold
  if (handle.kind === "boundary" && (handle.meta?.hard || handle.meta?.framed_lock)) {
    styles.push("bold");
  }

  // special emphasis
  if (handle.id === "Ω") styles.push("bold");

  return styles.join(",");
}

function nodeColorsFor(handle, theme) {
  // keep it simple: theme controls base, then kinds override lightly
  const base = {
    fillcolor: theme.node,
    fontcolor: theme.text,
    color: theme.border
  };

  if (handle.kind === "rule" && handle.meta?.public) {
    base.fillcolor = theme.rulePublicFill;
    base.color = theme.rulePublicBorder;
  }

  if (handle.kind === "boundary") {
    base.fillcolor = theme.boundaryFill;
    base.color = theme.boundaryBorder;
  }

  if (handle.kind === "artifact" || handle.kind === "finalize") {
    base.fillcolor = theme.finalizeFill;
    base.color = theme.finalizeBorder;
  }

  if (handle.kind === "structured") {
    base.fillcolor = theme.structuredFill;
    base.color = theme.structuredBorder;
  }

  if (handle.id === "Ω") {
    base.fillcolor = theme.omegaFill;
    base.color = theme.omegaBorder;
  }

  if (handle.id === "⊥") {
    base.fillcolor = theme.bottomFill;
    base.color = theme.bottomBorder;
  }

  return base;
}

function buildNodeLabel(handle, mode) {
  if (mode === "summary") return String(handle.id);

  if (mode === "compact") {
    const kind = handle.kind ? `\n${handle.kind}` : "";
    return `${handle.id}${kind}`;
  }

  // full
  const bits = [];
  if (handle.kind) bits.push(handle.kind);

  const metaFlags = [
    ["public", handle.meta?.public],
    ["atomic", handle.meta?.atomic],
    ["stabilized", handle.meta?.stabilized],
    ["convergent", handle.meta?.convergent],
    ["gated", handle.meta?.gated],
    ["hard", handle.meta?.hard]
  ]
    .filter(([, value]) => !!value)
    .map(([key]) => key);

  if (metaFlags.length) bits.push(metaFlags.join(","));

  const tail = bits.length ? `\n${bits.join(" | ")}` : "";
  return `${handle.id}${tail}`;
}

// ====== Themes ======

export const THEMES = {
  light: {
    // Scroll/parchment palette (blend of Palette A/C + restrained accents).
    bg: "#F7EED6",
    node: "#F2E6C8",
    text: "#1C1B16",
    border: "#9B7A4F",
    edge: "#3A352B",

    boundaryFill: "#E6D2A9",
    boundaryBorder: "#9B7A4F",

    structuredFill: "#FAF2DA",
    structuredBorder: "#A88455",

    rulePublicFill: "#E7D3A6",
    rulePublicBorder: "#B08D57",

    finalizeFill: "#EAD7AF",
    finalizeBorder: "#7B1E16",

    omegaFill: "#B08D57",
    omegaBorder: "#8C6A3D",

    bottomFill: "#D7C08F",
    bottomBorder: "#5A3C22",

    wordFill: "#E6D2A9",
    wordBorder: "#9B7A4F"
  },

  dark: {
    bg: "#121212",
    node: "#1e1e1e",
    text: "#e0e0e0",
    border: "#666666",
    edge: "#9e9e9e",

    boundaryFill: "#0d2233",
    boundaryBorder: "#4fc3f7",

    structuredFill: "#261a2d",
    structuredBorder: "#ce93d8",

    rulePublicFill: "#102516",
    rulePublicBorder: "#81c784",

    finalizeFill: "#2a0f1d",
    finalizeBorder: "#f48fb1",

    omegaFill: "#3a3300",
    omegaBorder: "#ffee58",

    bottomFill: "#2a0f0f",
    bottomBorder: "#ef5350",

    wordFill: "#2b1432",
    wordBorder: "#8e44ad"
  },

  kabbalah: {
    bg: "#0a0a0a",
    node: "#140020",
    text: "#ffcc00",
    border: "#6b4e00",
    edge: "#caa000",

    boundaryFill: "#0e1a2a",
    boundaryBorder: "#64b5f6",

    structuredFill: "#240032",
    structuredBorder: "#ce93d8",

    rulePublicFill: "#05220f",
    rulePublicBorder: "#81c784",

    finalizeFill: "#2a0016",
    finalizeBorder: "#f48fb1",

    omegaFill: "#2b2200",
    omegaBorder: "#ffeb3b",

    bottomFill: "#2a0a0a",
    bottomBorder: "#ef5350",

    wordFill: "#2b1432",
    wordBorder: "#8e44ad"
  }
};

export function renderDotFromTraceJson(rootJson, opts = {}) {
  const vm = pickVm(rootJson);
  if (!vm) {
    const keys =
      rootJson && typeof rootJson === "object" ? Object.keys(rootJson).slice(0, 20).join(", ") : "";
    throw new Error(`Could not locate VM object in JSON. Top-level keys: ${keys}`);
  }

  const ref = rootJson.ref ?? rootJson.reference ?? rootJson.pasukRef ?? rootJson.ref_key ?? "";
  const cleaned = rootJson.cleaned ?? rootJson.cleaned_text ?? "";
  const words = cleaned ? String(cleaned).trim().split(/\s+/).filter(Boolean) : [];
  const wordSections =
    rootJson.word_sections ??
    rootJson.wordSections ??
    rootJson.trace?.word_sections ??
    rootJson.trace?.wordSections ??
    [];
  const domain = vmMeta(vm, "D", "domain", "Omega", "omega");
  const tau = vmMeta(vm, "tau", "τ");
  const graphSafeRef = String(ref || "Pasuk")
    .replace(/\//g, "_")
    .replace(/[^A-Za-z0-9_]+/g, "_");
  const layout = opts.layout || "plain";
  const graphName = opts.graphName || (layout === "boot" ? `${graphSafeRef}_Boot` : graphSafeRef);

  return renderVmDot(vm, {
    ...opts,
    graphName,
    meta: { ref, cleaned, tau, domain, words, wordSections },
    // In boot mode, we prefer legend node over global graph label.
    label:
      opts.label ??
      (layout === "boot"
        ? ""
        : `Hebrew Operator VM - ${ref || "Pasuk"}${cleaned ? ` | ${cleaned}` : ""}${tau !== "" ? ` | tau=${tau}` : ""}${domain !== "" ? ` | D=${domain}` : ""}`)
  });
}

function boundaryClusterName(boundaryId, index) {
  const safe = String(boundaryId ?? "")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `cluster_${safe || "boundary"}_${index}`;
}

function computeDegrees(args) {
  const { handles, links, boundaries, countBoundaryEdges = true } = args;
  const degree = new Map(handles.map((handle) => [handle.id, 0]));
  const bump = (id) => {
    if (!degree.has(id)) return;
    degree.set(id, (degree.get(id) ?? 0) + 1);
  };

  for (const link of links) {
    bump(link.from);
    bump(link.to);
  }

  if (countBoundaryEdges) {
    for (const boundary of boundaries) {
      bump(boundary.id);
      if (boundary.inside) bump(boundary.inside);
      if (boundary.outside) bump(boundary.outside);
    }
  }

  return degree;
}

function pruneOrphanHandles(args) {
  const { handles, links, boundaries, keepIds, keepKinds, countBoundaryEdges = true } = args;

  const keepIdSet = new Set((keepIds ?? []).map((id) => String(id)));
  const keepKindSet = new Set((keepKinds ?? []).map((kind) => String(kind)));
  const degree = computeDegrees({ handles, links, boundaries, countBoundaryEdges });

  return handles.filter((handle) => {
    if (keepIdSet.has(handle.id)) return true;
    if (keepKindSet.has(handle.kind)) return true;
    return (degree.get(handle.id) ?? 0) > 0;
  });
}

function branchPortFor(targetHandle) {
  const role = String(targetHandle?.meta?.role ?? "");
  if (role === "left") return "l";
  if (role === "right") return "r";
  if (role === "spine") return "sp";
  return null;
}

export function renderVmDot(vm, opts = {}) {
  const {
    theme = "light",
    mode = "full", // full | compact | summary
    boundary = "auto", // auto | cluster | node | both
    layout = "plain", // plain | boot
    prettyIds = false,
    legend = layout === "boot",
    graphName = "PasukGraph",
    rankdir = "TB",
    splines = "ortho",
    // Boot layout defaults to sample spacing:
    nodesep = layout === "boot" ? 0.5 : 0.6,
    ranksep = layout === "boot" ? 0.9 : 1.0,
    label = "",
    meta = {}, // {ref, cleaned, tau, domain, words, wordSections}
    wordsMode = layout === "boot" ? "cluster" : "off", // off | cluster | label
    shinMode = layout === "boot" ? "collapse" : "expand", // expand | collapse
    shinPortEdges = false,
    wordFill = null,
    wordBorder = null,
    prune = "orphans", // orphans | none
    pruneKeepKinds = "",
    pruneKeepIds = "",
    pruneCountBoundaryEdges = true
  } = opts;

  const t = THEMES[theme] ?? THEMES.light;
  const resolvedWordFill = wordFill ?? t.wordFill ?? "#f3e5f5";
  const resolvedWordBorder = wordBorder ?? t.wordBorder ?? "#6a1b9a";

  const handles = normalizeHandles(vm);
  const links = normalizeLinks(vm);
  const boundaries = normalizeBoundaries(vm);
  const shinLeafToParent = new Map(); // leafId -> { parentId, port }
  for (const handle of handles) {
    if (handle.kind !== "structured") continue;
    const parent = handle.meta?.parent;
    const role = String(handle.meta?.role ?? "");
    if (!parent || !role) continue;
    const port = branchPortFor(handle); // role -> sp/l/r
    shinLeafToParent.set(handle.id, { parentId: String(parent), port });
  }

  // Filter nodes in "summary" mode first.
  const handleKeepByMode = (handle) => {
    if (mode !== "summary") return true;
    if (handle.id === "Ω" || handle.id === "⊥") return true;
    return ["boundary", "rule", "artifact", "finalize", "scope"].includes(handle.kind);
  };

  let keptHandles = handles.filter(handleKeepByMode);

  if (prune === "orphans") {
    keptHandles = pruneOrphanHandles({
      handles: keptHandles,
      links,
      boundaries,
      keepIds: ["Ω", "⊥", ...parseCsvList(pruneKeepIds)],
      keepKinds: parseCsvList(pruneKeepKinds),
      countBoundaryEdges: Boolean(pruneCountBoundaryEdges)
    });
  }

  if (shinMode === "collapse") {
    keptHandles = keptHandles.filter((handle) => !shinLeafToParent.has(handle.id));
  }

  const idSet = new Set(handles.map((handle) => handle.id));
  const keptIdSet = new Set(keptHandles.map((handle) => handle.id));
  const idMap = buildIdMap(Array.from(new Set(keptHandles.map((handle) => handle.id))), {
    prettyIds
  });

  function nodeIdFor(handleId) {
    const hid = String(handleId ?? "");
    return idMap.get(hid) ?? (prettyIds ? prettyIdFromHandleId(hid) : hid);
  }

  function nodeRef(handleId) {
    return dotBareId(nodeIdFor(handleId));
  }

  function edgeRef(handleId, port) {
    const base = nodeRef(handleId);
    return port ? `${base}:${port}` : base;
  }

  function resolveEndpoint(handleId) {
    const id = String(handleId ?? "");
    if (shinMode !== "collapse") return { id, port: null };
    const hit = shinLeafToParent.get(id);
    if (!hit) return { id, port: null };
    return { id: hit.parentId, port: hit.port };
  }

  const wordSections = normalizeWordSections(meta.wordSections);
  const tauToWordSection = buildTauToWordSectionMap(wordSections);
  const hasWordSectionOwnership = wordSections.length > 0 && tauToWordSection.size > 0;
  const wordNumberToSectionIndex = new Map();
  for (const section of wordSections) {
    if (!wordNumberToSectionIndex.has(section.wordIndex)) {
      wordNumberToSectionIndex.set(section.wordIndex, section.sectionIndex);
    }
  }

  function parseWordIndexFromMeta(handle) {
    const m = handle.meta || {};
    const wi = m.wordIndex ?? m.word_index ?? m.word ?? m.wi ?? null;
    return asFiniteNumber(wi);
  }

  function inferLegacyWordIndexFromHandle(handle) {
    // 1) explicit metadata wins
    const wi = parseWordIndexFromMeta(handle);
    if (wi != null) return Number(wi);

    // 2) fallback: parse from handle.id like "ה:8:3"
    const tau = parseHandleTau(handle.id);
    return tau == null ? null : Number(tau);
  }

  function buildVmIndexToWordTextMap(handlesForMap) {
    const words = Array.isArray(meta.words) ? meta.words : [];
    if (!words.length) return new Map();

    const idxSet = new Set();
    for (const handle of handlesForMap) {
      const wi = inferLegacyWordIndexFromHandle(handle);
      if (wi != null && Number.isFinite(wi)) idxSet.add(Number(wi));
    }

    const vmIdx = Array.from(idxSet).sort((a, b) => a - b);
    const map = new Map(); // vmIndex -> cleaned word

    // compress gaps: vmIdx[k] maps to words[k] (0-based)
    for (let k = 0; k < vmIdx.length && k < words.length; k++) {
      map.set(vmIdx[k], words[k]);
    }

    return map;
  }

  const vmIndexToWordText = buildVmIndexToWordTextMap(keptHandles);

  function inferWordClusterIndex(handle) {
    if (hasWordSectionOwnership) {
      const tau = parseHandleTau(handle.id);
      if (tau != null && tauToWordSection.has(tau)) {
        return tauToWordSection.get(tau);
      }

      const metaWordIndex = parseWordIndexFromMeta(handle);
      if (metaWordIndex != null) {
        // Support either 1-based or 0-based metadata conventions.
        if (wordNumberToSectionIndex.has(metaWordIndex)) {
          return wordNumberToSectionIndex.get(metaWordIndex);
        }
        const oneBased = Number(metaWordIndex) + 1;
        if (wordNumberToSectionIndex.has(oneBased)) {
          return wordNumberToSectionIndex.get(oneBased);
        }
      }

      return null;
    }

    return inferLegacyWordIndexFromHandle(handle);
  }

  function inferWordText(clusterIndex) {
    if (clusterIndex == null) return null;
    if (hasWordSectionOwnership) {
      const section = wordSections[Number(clusterIndex)];
      if (!section) return null;
      if (section.surface) return section.surface;
      return `WORD ${section.wordIndex}`;
    }

    const wi = Number(clusterIndex);

    // gap-aware mapping (preferred)
    const mapped = vmIndexToWordText.get(wi);
    if (mapped) return mapped;

    // fallback (old behavior)
    const list = Array.isArray(meta.words) ? meta.words : [];
    if (list[wi - 1]) return list[wi - 1];
    return null;
  }

  // boundary membership inference (for clusters)
  const membershipMap = inferBoundaryMembership(boundaries, handles);

  // decide boundary rendering strategy
  let boundaryMode = boundary;
  if (boundaryMode === "auto") {
    const anyHasMembers =
      boundaries.some((entry) => entry.members && entry.members.length) ||
      Array.from(membershipMap.values()).some((set) => set && set.size > 0);
    boundaryMode = anyHasMembers ? "cluster" : "node";
  }

  let dot = "";
  dot += `digraph ${graphName} {\n`;
  dot += `  rankdir=${rankdir}; splines=${splines}; nodesep=${nodesep}; ranksep=${ranksep};\n`;
  dot += `  bgcolor=${dotId(t.bg)};\n`;
  dot += `  fontname=${dotId("Helvetica")};\n`;
  dot += `  node [fontname=${dotId("Helvetica")}];\n`;
  dot += `  edge [fontname=${dotId("Helvetica")}, color=${dotId(t.edge)}];\n\n`;
  const useXLabel = String(splines) === "ortho";
  const edgeLabelAttrs = (text) => {
    if (!text) return {};
    const payload = dotLabel(text);
    return useXLabel ? { xlabel: payload } : { label: payload };
  };

  if (label) {
    dot += `  label=${dotLabel(label)};\n`;
    dot += "  labelloc=t;\n";
    dot += "  fontsize=16;\n\n";
  }

  if (legend) {
    const refLine = meta.ref ? String(meta.ref) : String(graphName);
    const tauLine = meta.tau !== "" ? `τ=${meta.tau}` : "";
    const domainLine = meta.domain !== "" ? `D=${meta.domain}` : "";
    const tail = [tauLine, domainLine].filter(Boolean).join(" | ");
    dot += `  legend [${attrs({
      label: dotLabel(`${refLine}\nHebrew Calculus VM - Final State\n${tail}`),
      shape: "plaintext",
      fillcolor: dotId(t.node),
      fontcolor: dotId(t.text),
      fontsize: 14
    })}];\n\n`;
  }

  // Nodes
  for (const handle of keptHandles) {
    const gid = nodeRef(handle.id);
    const shape = nodeShapeFor(handle);
    const style = nodeStyleFor(handle);
    const colors = nodeColorsFor(handle, t);
    const nodeLabel =
      shape === "record"
        ? // record labels are a bit special; still fine as a quoted string
          dotLabel(handle.meta?.recordLabel ?? "{<sp>spine|<l>left|<r>right}")
        : dotLabel(buildNodeLabel(handle, mode));

    dot += `  ${gid} [${attrs({
      label: nodeLabel,
      shape: shape,
      style: dotId(style),
      fillcolor: dotId(colors.fillcolor),
      fontcolor: dotId(colors.fontcolor),
      color: dotId(colors.color)
    })}];\n`;
  }

  dot += "\n";

  if (wordsMode === "cluster") {
    // word cluster index -> array of node ids (already mapped through nodeRef)
    const buckets = new Map();

    for (const handle of keptHandles) {
      const clusterIndex = inferWordClusterIndex(handle);
      if (clusterIndex == null) continue;
      const key = String(clusterIndex);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(nodeRef(handle.id));
    }

    // Emit clusters in numeric order.
    const keys = Array.from(buckets.keys()).sort((a, b) => Number(a) - Number(b));
    let clusterN = 0;

    for (const key of keys) {
      const clusterIndex = Number(key);
      const nodes = buckets.get(key);
      if (!nodes || nodes.length === 0) continue;

      const wordText = inferWordText(clusterIndex);
      const clusterLabel = wordText ? `${wordText}` : `VM idx ${clusterIndex}`;

      dot += `  subgraph cluster_word_${clusterN++} {\n`;
      dot += `    label=${dotLabel(clusterLabel)};\n`;
      dot += `    style=${dotId("filled")};\n`;
      dot += `    fillcolor=${dotId(resolvedWordFill)};\n`;
      dot += `    color=${dotId(resolvedWordBorder)};\n`;
      for (const nodeRefId of nodes) dot += `    ${nodeRefId};\n`;
      dot += "  }\n\n";
    }
  }

  if (
    layout === "boot" &&
    meta.domain &&
    keptIdSet.has(String(meta.domain)) &&
    String(meta.domain) !== "Ω"
  ) {
    dot += `  ${nodeRef("Ω")} -> ${nodeRef(meta.domain)} [${attrs({
      ...edgeLabelAttrs("domain"),
      color: dotId(t.omegaBorder),
      penwidth: 4,
      fontsize: 10
    })}];\n\n`;
  }

  if (layout === "boot" && shinPortEdges) {
    for (const handle of keptHandles) {
      const isRecord =
        nodeShapeFor(handle) === "record" ||
        (handle.kind === "structured" &&
          handle.meta?.spine &&
          handle.meta?.left &&
          handle.meta?.right);
      if (!isRecord) continue;
      const me = nodeRef(handle.id);
      dot += `  ${me}:sp -> ${me}:l [${attrs({
        ...edgeLabelAttrs("branch"),
        color: dotId(t.structuredBorder),
        constraint: "false",
        weight: 0,
        minlen: 0
      })}];\n`;
      dot += `  ${me}:sp -> ${me}:r [${attrs({
        ...edgeLabelAttrs("branch"),
        color: dotId(t.structuredBorder),
        constraint: "false",
        weight: 0,
        minlen: 0
      })}];\n`;
    }
    dot += "\n";
  }

  // Boundary rendering
  if (boundaryMode === "cluster" || boundaryMode === "both") {
    let clusterIndex = 0;
    for (const boundaryEntry of boundaries) {
      const members = membershipMap.get(boundaryEntry.id);
      if (!members || members.size === 0) continue;

      // keep only members that exist as nodes (and are kept in this mode)
      const memberIds = Array.from(members).filter((id) => idSet.has(id));
      const memberKept = memberIds.filter((id) => keptIdSet.has(id));
      if (memberKept.length === 0) continue;

      const clusterName = boundaryClusterName(boundaryEntry.id, clusterIndex);
      clusterIndex += 1;
      dot += `  subgraph ${clusterName} {\n`;
      dot += `    label=${dotLabel(`Boundary ${boundaryEntry.id}`)};\n`;
      dot += `    style=${dotId("filled")};\n`;
      dot += `    fillcolor=${dotId(t.boundaryFill)};\n`;
      dot += `    color=${dotId(t.boundaryBorder)};\n`;

      for (const memberId of memberKept) {
        dot += `    ${nodeRef(memberId)};\n`;
      }
      dot += "  }\n";
    }
    dot += "\n";
  }

  if (boundaryMode === "node" || boundaryMode === "both") {
    // Represent each boundary as an explicit node, then connect inside/outside when possible.
    for (const boundaryEntry of boundaries) {
      const boundaryId = dotId(`□${boundaryEntry.id}`);
      dot += `  ${boundaryId} [${attrs({
        label: dotLabel(`□ ${boundaryEntry.id}`),
        shape: "box",
        style: dotId("dashed,filled,rounded"),
        fillcolor: dotId(t.boundaryFill),
        fontcolor: dotId(t.text),
        color: dotId(t.boundaryBorder)
      })}];\n`;

      // Connect if inside/outside are present and exist
      if (
        boundaryEntry.inside &&
        idSet.has(boundaryEntry.inside) &&
        keptIdSet.has(boundaryEntry.inside)
      ) {
        dot += `  ${nodeRef(boundaryEntry.inside)} -> ${boundaryId} [${attrs({
          ...edgeLabelAttrs("inside"),
          style: dotId("dashed")
        })}];\n`;
      }
      if (
        boundaryEntry.outside &&
        idSet.has(boundaryEntry.outside) &&
        keptIdSet.has(boundaryEntry.outside)
      ) {
        dot += `  ${boundaryId} -> ${nodeRef(boundaryEntry.outside)} [${attrs({
          ...edgeLabelAttrs("outside"),
          style: dotId("dashed")
        })}];\n`;
      }
    }
    dot += "\n";
  }

  // Edges (links)
  for (const link of links) {
    if (shinMode === "collapse" && String(link.label) === "branch") continue;

    const src = resolveEndpoint(link.from);
    const dst = resolveEndpoint(link.to);

    if (!keptIdSet.has(src.id) || !keptIdSet.has(dst.id)) continue;

    const edgeFrom = edgeRef(src.id, src.port);
    const edgeTo = edgeRef(dst.id, dst.port);

    if (src.id === dst.id && (src.port ?? "") === (dst.port ?? "")) continue;

    dot += `  ${edgeFrom} -> ${edgeTo} [${attrs({
      ...edgeLabelAttrs(link.label ? String(link.label) : "")
    })}];\n`;
  }

  if (legend) {
    dot += `  legend -> ${nodeRef("Ω")} [style=invis];\n`;
  }

  dot += "}\n";
  return dot;
}
