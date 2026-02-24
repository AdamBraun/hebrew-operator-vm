export const INTERPRETER_INPUT_PATHS = Object.freeze([
  "impl/reference/src/compile",
  "impl/reference/src/state",
  "impl/reference/src/trace",
  "impl/reference/src/vm",
  "impl/reference/src/version.ts",
  "impl/reference/src/scripts/torahCorpus",
  "impl/reference/src/scripts/pasukTraceCorpus",
  "scripts/torah-corpus.mjs",
  "scripts/pasuk-trace.mjs",
  "scripts/pasuk-trace-corpus.mjs",
  "registry",
  "normalization",
  "packages/glyphs",
  "packages/trace-model",
  "data/torah.json"
]);

export const DOT_RENDERER_INPUT_PATHS = Object.freeze([
  "scripts/render-pasuk-graph.mjs",
  "scripts/render/pasukGraph.mjs"
]);

export const ENGINE_INPUT_PATHS = Object.freeze([
  ...INTERPRETER_INPUT_PATHS,
  ...DOT_RENDERER_INPUT_PATHS
]);

export const PASUK_CORPUS_CANONICAL_ARGS = Object.freeze([
  "--input=data/torah.json",
  "--out-dir=outputs/pasuk-trace-corpus/latest",
  "--lang=he",
  "--keep-teamim",
  "--no-snapshots",
  "--layout=boot",
  "--pretty-ids",
  "--boundary=cluster"
]);

export const PASUK_CORPUS_VERIFY_ARGS = Object.freeze([
  ...PASUK_CORPUS_CANONICAL_ARGS,
  "--skip-existing",
  "--verify-existing"
]);

export const REPAIR_FULL_COMMAND_HINT = "npm run artifacts:repair -- --full";

export const ARTIFACT_SETS = Object.freeze([
  {
    id: "torah-corpus-latest",
    manifestPath: "outputs/torah-corpus/latest/manifest.json",
    artifactRootPath: "outputs/torah-corpus/latest",
    impactPaths: INTERPRETER_INPUT_PATHS,
    repairCommand: [
      "npm",
      "run",
      "torah-corpus",
      "--",
      "--input=data/torah.json",
      "--out-dir=outputs/torah-corpus/latest",
      "--lang=he"
    ],
    required: false,
    requiresDotRendererHash: false
  },
  {
    id: "pasuk-trace-corpus-latest",
    manifestPath: "outputs/pasuk-trace-corpus/latest/manifest.json",
    artifactRootPath: "outputs/pasuk-trace-corpus/latest",
    impactPaths: [...INTERPRETER_INPUT_PATHS, ...DOT_RENDERER_INPUT_PATHS],
    repairCommand: ["npm", "run", "pasuk-trace-corpus", "--", ...PASUK_CORPUS_CANONICAL_ARGS],
    required: true,
    requiresDotRendererHash: true
  }
]);

export const REQUIRED_ARTIFACT_PATHS = Object.freeze(
  ARTIFACT_SETS.filter((set) => set.required !== false)
    .map((set) => set.artifactRootPath)
    .filter((value) => typeof value === "string" && value.length > 0)
);

export const REPAIR_COMMAND_HINT = REPAIR_FULL_COMMAND_HINT;
