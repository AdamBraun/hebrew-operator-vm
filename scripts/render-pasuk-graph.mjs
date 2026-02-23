#!/usr/bin/env node
// scripts/render-pasuk-graph.mjs
import fs from "node:fs";
import { execSync } from "node:child_process";
import { renderDotFromTraceJson } from "./render/pasukGraph.mjs";

function getArg(name) {
  const hit = process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
}

function hasFlag(name) {
  return process.argv.slice(2).includes(`--${name}`);
}

const input = getArg("input") || process.argv.slice(2).find((arg) => !arg.startsWith("--"));
if (!input || !fs.existsSync(input)) {
  console.error(
    "Usage: node scripts/render-pasuk-graph.mjs --input=pasuk_trace_*.json [--out-dot=*.dot] [--theme=light|dark|kabbalah] [--mode=full|compact|summary] [--boundary=auto|cluster|node|both] [--prune=orphans|none] [--prune-keep-kinds=kind1,kind2] [--prune-keep-ids=id1,id2] [--layout=plain|boot] [--pretty-ids] [--legend] [--words=off|cluster|label] [--render] [--format=png|svg]"
  );
  process.exit(1);
}

const outDot =
  getArg("out-dot") ||
  (input.endsWith(".json") ? input.replace(/\.json$/i, ".dot") : `${input}.dot`);

const theme = getArg("theme") || "light";
const mode = getArg("mode") || "full";
const boundary = getArg("boundary") || "auto";
const prune = getArg("prune") || "orphans";
const pruneKeepKinds = getArg("prune-keep-kinds") || "";
const pruneKeepIds = getArg("prune-keep-ids") || "";
const layout = getArg("layout") || "plain";
const prettyIds = hasFlag("pretty-ids");
const legend = hasFlag("legend") || layout === "boot";
const words = getArg("words") || "cluster";

const format = getArg("format") || "png";
const doRender = hasFlag("render");

const raw = JSON.parse(fs.readFileSync(input, "utf8"));
const dot = renderDotFromTraceJson(raw, {
  theme,
  mode,
  boundary,
  prune,
  pruneKeepKinds,
  pruneKeepIds,
  layout,
  prettyIds,
  legend,
  wordsMode: words
});

fs.writeFileSync(outDot, dot, "utf8");
console.log(`DOT generated: ${outDot}`);

if (doRender) {
  const outImg = outDot.replace(/\.dot$/i, `.${format}`);
  try {
    execSync(`dot -T${format} ${outDot} -o ${outImg}`, { stdio: "inherit" });
    console.log(`Rendered: ${outImg}`);
  } catch {
    console.error('Graphviz "dot" failed. Is graphviz installed and "dot" on PATH?');
    process.exit(2);
  }
}
