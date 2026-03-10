import { matchesPathSpec } from "../artifacts/lib.mjs";

export const LAYERS = Object.freeze([
  "spine",
  "letters",
  "niqqud",
  "cantillation",
  "layout",
  "metadata",
  "stitch"
]);

const SPINE_DESCENDANTS = Object.freeze(["letters", "niqqud", "cantillation", "layout", "stitch"]);

export const LAYER_DEPENDENCIES = Object.freeze({
  spine: SPINE_DESCENDANTS,
  letters: Object.freeze(["stitch"]),
  niqqud: Object.freeze(["stitch"]),
  cantillation: Object.freeze(["stitch"]),
  layout: Object.freeze(["stitch"]),
  metadata: Object.freeze(["stitch"]),
  stitch: Object.freeze([])
});

export const DIRECT_LAYER_RULES = Object.freeze([
  { spec: "src/spine", layers: Object.freeze(["spine"]) },
  { spec: "src/cli/build-spine.ts", layers: Object.freeze(["spine"]) },
  { spec: "src/layers/letters", layers: Object.freeze(["letters"]) },
  { spec: "src/layers/niqqud", layers: Object.freeze(["niqqud"]) },
  { spec: "src/layers/cantillation", layers: Object.freeze(["cantillation"]) },
  { spec: "src/layers/layout", layers: Object.freeze(["layout"]) },
  { spec: "src/layers/metadata", layers: Object.freeze(["metadata"]) },
  { spec: "src/wrapper", layers: Object.freeze(["stitch"]) },
  {
    spec: "src/cli/build-layer.ts",
    layers: Object.freeze(["letters", "cantillation", "layout"])
  },
  { spec: "src/cli/build-layer-niqqud.ts", layers: Object.freeze(["niqqud"]) },
  { spec: "src/cli/build-layer-metadata.ts", layers: Object.freeze(["metadata"]) },
  { spec: "src/cli/stitch-program.ts", layers: Object.freeze(["stitch"]) },
  { spec: "src/ir", layers: Object.freeze([...LAYERS]) },
  { spec: "data/torah.json", layers: Object.freeze(["spine", "metadata"]) },
  {
    spec: "src/layers/layout/datasets/torah_layout_breaks.v1.json",
    layers: Object.freeze(["layout"])
  },
  {
    spec: "src/layers/metadata/datasets/torah_1y_plan.v1.json",
    layers: Object.freeze(["metadata"])
  }
]);

export const CANONICAL_PATHS = Object.freeze({
  torahJson: "data/torah.json",
  layoutDataset: "src/layers/layout/datasets/torah_layout_breaks.v1.json",
  metadataDataset: "src/layers/metadata/datasets/torah_1y_plan.v1.json",
  latestDir: "outputs/runs/latest",
  spineJsonlPath: "outputs/runs/latest/spine.jsonl",
  lettersIrPath: "outputs/runs/latest/letters.ir.jsonl",
  niqqudIrPath: "outputs/runs/latest/niqqud.ir.jsonl",
  cantillationIrPath: "outputs/runs/latest/cantillation.ir.jsonl",
  layoutIrPath: "outputs/runs/latest/layout.ir.jsonl",
  metadataPlanJsonlPath: "outputs/runs/latest/metadata.plan.jsonl"
});

export const LAYER_REQUIRED_TRACKED_ARTIFACTS = Object.freeze({
  spine: Object.freeze([CANONICAL_PATHS.spineJsonlPath]),
  letters: Object.freeze([CANONICAL_PATHS.lettersIrPath]),
  niqqud: Object.freeze([CANONICAL_PATHS.niqqudIrPath]),
  cantillation: Object.freeze([CANONICAL_PATHS.cantillationIrPath]),
  layout: Object.freeze([CANONICAL_PATHS.layoutIrPath]),
  metadata: Object.freeze([CANONICAL_PATHS.metadataPlanJsonlPath]),
  stitch: Object.freeze([])
});

export const TRACKED_ARTIFACT_SCOPES = Object.freeze([CANONICAL_PATHS.latestDir]);

export const SOURCE_RELEVANT_PATHS = Object.freeze(
  Array.from(new Set(DIRECT_LAYER_RULES.map((rule) => rule.spec))).sort((left, right) =>
    left.localeCompare(right, "en")
  )
);

export function selectDirectLayers(changedFiles) {
  const out = new Set();
  for (const filePath of changedFiles ?? []) {
    for (const rule of DIRECT_LAYER_RULES) {
      if (!matchesPathSpec(filePath, rule.spec)) {
        continue;
      }
      for (const layer of rule.layers) {
        out.add(layer);
      }
    }
  }
  return out;
}

export function expandImpactedLayers(directLayers) {
  const out = new Set();
  const queue = [...directLayers];
  while (queue.length > 0) {
    const layer = queue.shift();
    if (!layer || out.has(layer)) {
      continue;
    }
    out.add(layer);
    const dependencies = LAYER_DEPENDENCIES[layer] ?? [];
    for (const dependency of dependencies) {
      if (!out.has(dependency)) {
        queue.push(dependency);
      }
    }
  }
  return out;
}

export function forceLayerRebuild(layer, directLayers) {
  if (directLayers.has(layer)) {
    return true;
  }
  if (directLayers.has("spine") && SPINE_DESCENDANTS.includes(layer)) {
    return true;
  }
  if (layer === "stitch" && directLayers.size > 0) {
    return true;
  }
  return false;
}

export function requiredTrackedArtifactsForLayers(layers) {
  const out = new Set();
  for (const layer of layers) {
    const required = LAYER_REQUIRED_TRACKED_ARTIFACTS[layer] ?? [];
    for (const filePath of required) {
      out.add(filePath);
    }
  }
  return [...out].sort((left, right) => left.localeCompare(right, "en"));
}
