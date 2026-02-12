#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import versionContractUtils from "./lib/version-contract.cjs";

const { readVersionContractFromFile } = versionContractUtils;

const DEFAULT_REGISTRY = path.resolve(process.cwd(), "data", "tokens.registry.json");
const DEFAULT_OUT = path.resolve(process.cwd(), "data", "tokens.compiled.json");
const DEFAULT_REPORT = path.resolve(process.cwd(), "reports", "compile_report.md");
const DEFAULT_DEFS = path.resolve(process.cwd(), "registry", "token-semantics.json");
const DEFAULT_TOP = 50;

const RUNTIME_SOF_KIND = {
  SHVA: "shva",
  HIRIQ: "hiriq",
  TSERE: "tzere",
  SEGOL: "segol",
  PATACH: "patach",
  KAMATZ: "kamatz",
  KUBUTZ: "kubutz"
};

function printHelp() {
  console.log("Usage:");
  console.log(
    "  node scripts/compile-token-operators.mjs [run] [--registry=path] [--out=path] [--report=path] [--defs=path] [--top=N]"
  );
  console.log(
    "  node scripts/compile-token-operators.mjs verify [--registry=path] [--out=path] [--report=path] [--defs=path] [--top=N]"
  );
  console.log("");
  console.log("Defaults:");
  console.log(`  --registry=${DEFAULT_REGISTRY}`);
  console.log(`  --out=${DEFAULT_OUT}`);
  console.log(`  --report=${DEFAULT_REPORT}`);
  console.log(`  --defs=${DEFAULT_DEFS}`);
  console.log(`  --top=${DEFAULT_TOP}`);
}

function parseArgs(argv) {
  const args = [...argv];
  let command = "run";
  if (args.length > 0 && !args[0].startsWith("-")) {
    command = args.shift();
  }

  if (!["run", "verify"].includes(command)) {
    throw new Error(`Unknown command '${command}'`);
  }

  const opts = {
    registry: DEFAULT_REGISTRY,
    out: DEFAULT_OUT,
    report: DEFAULT_REPORT,
    defs: DEFAULT_DEFS,
    top: DEFAULT_TOP
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg.startsWith("--registry=")) {
      opts.registry = arg.slice("--registry=".length);
      continue;
    }
    if (arg.startsWith("--out=")) {
      opts.out = arg.slice("--out=".length);
      continue;
    }
    if (arg.startsWith("--report=")) {
      opts.report = arg.slice("--report=".length);
      continue;
    }
    if (arg.startsWith("--defs=")) {
      opts.defs = arg.slice("--defs=".length);
      continue;
    }
    if (arg.startsWith("--top=")) {
      const top = Number(arg.slice("--top=".length));
      if (!Number.isInteger(top) || top <= 0) {
        throw new Error(`Invalid --top value '${arg.slice("--top=".length)}'`);
      }
      opts.top = top;
      continue;
    }
    throw new Error(`Unknown argument '${arg}'`);
  }

  return { command, opts };
}

function sha256Hex(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function compareKeys(left, right) {
  const integerPattern = /^\d+$/;
  const leftIsInteger = integerPattern.test(left);
  const rightIsInteger = integerPattern.test(right);
  if (leftIsInteger && rightIsInteger) {
    return Number(left) - Number(right);
  }
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function sortObjectKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sortObjectKeysDeep(entry));
  }
  if (value && typeof value === "object") {
    const ordered = {};
    for (const key of Object.keys(value).sort(compareKeys)) {
      ordered[key] = sortObjectKeysDeep(value[key]);
    }
    return ordered;
  }
  return value;
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
  const rank = new Map(order.map((value, index) => [value, index]));
  return [...values].sort((left, right) => {
    const leftRank = rank.has(left) ? rank.get(left) : Number.MAX_SAFE_INTEGER;
    const rightRank = rank.has(right) ? rank.get(right) : Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.localeCompare(right, "en");
  });
}

function toRangeBounds(rangeLabel) {
  const [startLabel, endLabel] = String(rangeLabel).split("-");
  if (!startLabel || !endLabel) {
    return null;
  }
  const start = Number.parseInt(startLabel.replace(/^U\+/u, ""), 16);
  const end = Number.parseInt(endLabel.replace(/^U\+/u, ""), 16);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  return { start, end };
}

function markToCodepoint(mark) {
  const hex = String(mark).replace(/^U\+/u, "");
  const codepoint = Number.parseInt(hex, 16);
  return Number.isFinite(codepoint) ? codepoint : null;
}

function isOrthographicNoiseMark(mark, defs) {
  if (defs.modifier_extraction.orthographic_noise_marks.includes(mark)) {
    return true;
  }
  const codepoint = markToCodepoint(mark);
  if (codepoint === null) {
    return false;
  }
  for (const label of defs.modifier_extraction.orthographic_noise_ranges ?? []) {
    const bounds = toRangeBounds(label);
    if (!bounds) {
      continue;
    }
    if (codepoint >= bounds.start && codepoint <= bounds.end) {
      return true;
    }
  }
  return false;
}

function buildWarning(code, message) {
  return { code, message };
}

function buildError(tokenId, code, message) {
  return { token_id: tokenId, code, message };
}

function runtimeKindForModifier(modifier) {
  if (RUNTIME_SOF_KIND[modifier]) {
    return RUNTIME_SOF_KIND[modifier];
  }
  throw new Error(`Missing runtime sof kind mapping for '${modifier}'`);
}

function compileTokenDescriptor(tokenId, descriptor, defs) {
  const warnings = [];
  const errors = [];
  const base = descriptor.base;
  const marks = Array.isArray(descriptor.marks) ? [...descriptor.marks] : [];

  const operatorDefs = defs.operator_families ?? {};
  const baseDef = operatorDefs[base];
  if (!baseDef) {
    errors.push(buildError(tokenId, "UNKNOWN_BASE_LETTER", `No operator definition for base '${base}'`));
  }

  const roshEntries = [];
  const tochEntries = [];
  const sofEntries = [];
  const ignoredMarks = [];

  const markMap = defs.modifier_extraction.mark_to_modifier ?? {};
  for (const mark of marks) {
    const mapping = markMap[mark];
    if (!mapping) {
      if (isOrthographicNoiseMark(mark, defs)) {
        ignoredMarks.push(mark);
        continue;
      }
      errors.push(
        buildError(
          tokenId,
          "UNKNOWN_MARK",
          `Mark '${mark}' is not declared in token semantics extraction table`
        )
      );
      continue;
    }

    const target =
      mapping.tier === "rosh" ? roshEntries : mapping.tier === "toch" ? tochEntries : sofEntries;
    for (const modifier of mapping.modifiers ?? []) {
      target.push({
        modifier,
        mark,
        hataf: Boolean(mapping.hataf),
        source_label: mapping.source_label ?? null
      });
    }
  }

  const ignoredUnique = uniqPreserveOrder(ignoredMarks);
  for (const mark of ignoredUnique) {
    warnings.push(
      buildWarning(
        "ORTHOGRAPHIC_MARK_IGNORED",
        `Ignoring orthographic mark '${mark}' for token ${tokenId}`
      )
    );
  }

  const rules = defs.runtime_rules;
  const hasDageshMark = marks.includes(rules.dagesh_mark);
  const hasShinDotRight = marks.includes(rules.shin_dot_right_mark);
  const hasShinDotLeft = marks.includes(rules.shin_dot_left_mark);

  if (hasShinDotLeft && hasShinDotRight) {
    errors.push(
      buildError(tokenId, "ILLEGAL_SHIN_DOT_COMBO", "Token cannot include both shin and sin dots")
    );
  }
  if ((hasShinDotLeft || hasShinDotRight) && base !== rules.shin_host) {
    errors.push(
      buildError(
        tokenId,
        "ILLEGAL_SHIN_DOT_HOST",
        `Shin/sin dot marks require base '${rules.shin_host}', found '${base}'`
      )
    );
  }

  const shurukBlocking = new Set(rules.shuruk_blocking_marks ?? []);
  let dotKind = "none";
  if (hasDageshMark) {
    if (base === rules.mappiq_host) {
      dotKind = "mappiq";
    } else if (
      base === rules.shuruk_host &&
      !marks.some((mark) => mark !== rules.dagesh_mark && shurukBlocking.has(mark))
    ) {
      dotKind = "shuruk";
    } else {
      dotKind = "dagesh";
    }
  }

  let insideDotKind = "none";
  if (hasShinDotRight) {
    insideDotKind = "shin_dot_right";
  } else if (hasShinDotLeft) {
    insideDotKind = "shin_dot_left";
  } else if (dotKind !== "none") {
    insideDotKind = dotKind;
  }

  const tochModifiersRaw = tochEntries.map((entry) => entry.modifier);
  const tochRemapped = [...tochModifiersRaw];
  if (dotKind === "mappiq") {
    const idx = tochRemapped.indexOf("DAGESH");
    if (idx >= 0) {
      tochRemapped[idx] = "MAPIQ";
    } else {
      tochRemapped.push("MAPIQ");
    }
  } else if (dotKind === "shuruk") {
    const idx = tochRemapped.indexOf("DAGESH");
    if (idx >= 0) {
      tochRemapped[idx] = "SHURUK";
    } else {
      tochRemapped.push("SHURUK");
    }
  }

  const roshOrder = defs.modifier_extraction.rosh_order ?? [];
  const tochOrder = defs.modifier_extraction.toch_order ?? [];
  const sofOrder = defs.modifier_extraction.sof_order ?? [];

  const roshModifiers = sortByOrder(uniqPreserveOrder(roshEntries.map((entry) => entry.modifier)), roshOrder);
  const tochModifiers = sortByOrder(uniqPreserveOrder(tochRemapped), tochOrder);
  const sofModifiers = sortByOrder(uniqPreserveOrder(sofEntries.map((entry) => entry.modifier)), sofOrder);

  if (roshModifiers.length > 1) {
    warnings.push(
      buildWarning(
        "MULTIPLE_ROSH_MODIFIERS",
        `Token ${tokenId} compiled with multiple rosh modifiers (${roshModifiers.join(", ")})`
      )
    );
  }
  if (sofModifiers.length > 2) {
    warnings.push(
      buildWarning(
        "MULTIPLE_SOF_MODIFIERS",
        `Token ${tokenId} compiled with ${sofModifiers.length} sof modifiers`
      )
    );
  }

  const allModifiers = uniqPreserveOrder([...roshModifiers, ...tochModifiers, ...sofModifiers]);
  const modifierBehavior = defs.modifier_behaviors ?? {};
  const modifierExecutionPlan = allModifiers.flatMap(
    (modifier) => modifierBehavior[modifier]?.execution_plan ?? [`UNSPECIFIED_MODIFIER:${modifier}`]
  );

  let tokenLetter = base;
  if (base === rules.shin_host && insideDotKind === "shin_dot_right") {
    tokenLetter = "שׁ";
  } else if (base === rules.shin_host && insideDotKind === "shin_dot_left") {
    tokenLetter = "שׂ";
  }

  let selectedDef = baseDef;
  const compositeDefs = Object.values(defs.composites ?? {});
  for (const composite of compositeDefs) {
    if (composite.base === base && composite.trigger_modifier === "SHIN_DOT_LEFT") {
      if (insideDotKind === "shin_dot_left") {
        selectedDef = composite;
      }
    }
  }

  if (!selectedDef) {
    errors.push(
      buildError(tokenId, "MISSING_OPERATOR_DEF", `Unable to resolve operator definition for token ${tokenId}`)
    );
  }

  const forcedLetterMode =
    dotKind === "mappiq" ? "pinned" : dotKind === "shuruk" ? "seeded" : null;

  const modes = [];
  if (forcedLetterMode === "pinned") {
    modes.push("HEH_PINNED");
  }
  if (forcedLetterMode === "seeded") {
    modes.push("VAV_SEEDED");
  }
  if (insideDotKind === "shin_dot_left") {
    modes.push("SIN_COMPOSITE");
  }

  const eventContract = uniqPreserveOrder([
    ...(selectedDef?.event_types ?? []),
    ...allModifiers.flatMap((modifier) => modifierBehavior[modifier]?.event_types ?? [])
  ]);

  const executionPlan = uniqPreserveOrder(
    [
      "SELECT",
      ...(roshModifiers.length > 0 ? ["APPLY_ROSH"] : []),
      "BOUND",
      ...(selectedDef?.base_execution_plan ?? []),
      ...(tochModifiers.length > 0 ? ["APPLY_TOCH"] : []),
      "SEAL",
      ...(sofModifiers.length > 0 ? ["APPLY_SOF"] : []),
      ...modifierExecutionPlan,
      selectedDef?.shape_effect_scope === "routing" ? "SHAPE_ROUTING" : null,
      dotKind === "dagesh" ? "HARDEN_HANDLE" : null,
      dotKind === "shuruk" ? "SEED_CARRIER" : null,
      "VM_COMMIT"
    ].filter(Boolean)
  );

  const runtimeSofEntries = [...sofEntries]
    .sort((left, right) => {
      const leftRank = sofOrder.indexOf(left.modifier);
      const rightRank = sofOrder.indexOf(right.modifier);
      const l = leftRank >= 0 ? leftRank : Number.MAX_SAFE_INTEGER;
      const r = rightRank >= 0 ? rightRank : Number.MAX_SAFE_INTEGER;
      if (l !== r) {
        return l - r;
      }
      if (left.mark !== right.mark) {
        return left.mark.localeCompare(right.mark, "en");
      }
      return left.modifier.localeCompare(right.modifier, "en");
    })
    .map((entry) => ({
      kind: runtimeKindForModifier(entry.modifier),
      mark: entry.mark,
      modifier: entry.modifier,
      hataf: Boolean(entry.hataf)
    }));

  const bundle = {
    token_id: tokenId,
    signature: descriptor.signature,
    base,
    count: descriptor.count ?? 0,
    op_family: selectedDef?.op_family ?? "UNKNOWN",
    modifiers: allModifiers,
    raw_marks: marks,
    derived: {
      rosh: roshModifiers,
      toch: tochModifiers,
      sof: sofModifiers,
      dot_kind: dotKind,
      inside_dot_kind: insideDotKind,
      modes,
      ignored_marks: ignoredUnique
    },
    execution_plan: executionPlan,
    event_contract: eventContract,
    warnings,
    runtime: {
      token_letter: tokenLetter,
      read_letter: selectedDef?.read_letter ?? base,
      shape_letter: selectedDef?.shape_letter ?? null,
      shape_effect_scope: selectedDef?.shape_effect_scope ?? null,
      rosh_branch:
        insideDotKind === "shin_dot_right"
          ? "right"
          : insideDotKind === "shin_dot_left"
            ? "left"
            : null,
      letter_mode_forced: forcedLetterMode,
      has_shuruk: dotKind === "shuruk",
      should_harden: dotKind === "dagesh",
      sof_modifiers: runtimeSofEntries
    }
  };

  return { bundle, warnings, errors };
}

function increment(map, key, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function compileRegistry(registry, defs, options) {
  const versionContract = options.versionContract;
  const tokenRows = registry.tokens ?? {};
  const tokenIds = Object.keys(tokenRows).sort(compareKeys);

  const tokens = {};
  const globalErrors = [];
  const warningCounts = new Map();

  for (const key of tokenIds) {
    const tokenId = Number(key);
    const descriptor = tokenRows[key];
    const { bundle, warnings, errors } = compileTokenDescriptor(tokenId, descriptor, defs);
    tokens[key] = bundle;

    for (const warning of warnings) {
      increment(warningCounts, warning.code);
    }
    globalErrors.push(...errors);
  }

  if (globalErrors.length > 0) {
    const lines = globalErrors
      .slice(0, 25)
      .map((entry) => `Token ${entry.token_id} [${entry.code}] ${entry.message}`);
    const overflow = globalErrors.length > 25 ? `\n... ${globalErrors.length - 25} more` : "";
    throw new Error(`Compile failed with ${globalErrors.length} error(s):\n${lines.join("\n")}${overflow}`);
  }

  const warningSummary = Object.fromEntries(
    Array.from(warningCounts.entries()).sort((a, b) => a[0].localeCompare(b[0], "en"))
  );

  const normalizedOut = {
    schema_version: 1,
    version_contract: {
      trace_version: versionContract.trace_version,
      semantics_version: versionContract.semantics_version,
      render_version: versionContract.render_version
    },
    source: {
      registry_path: path.resolve(options.registry),
      registry_sha256: registry.input?.sha256 ?? null
    },
    semantics: {
      definitions_path: path.resolve(options.defs),
      schema_version: defs.schema_version ?? null,
      semver: versionContract.semantics_version,
      definitions_declared_semver: defs.semver ?? null,
      definitions_sha256: sha256Hex(JSON.stringify(sortObjectKeysDeep(defs)))
    },
    compile_policy: {
      illegal_combinations: "error",
      unknown_marks: "error",
      orthographic_noise: "warn_and_ignore"
    },
    stats: {
      tokens_total: tokenIds.length,
      warning_count: Array.from(warningCounts.values()).reduce((sum, count) => sum + count, 0),
      warning_by_code: warningSummary
    },
    tokens
  };

  return sortObjectKeysDeep(normalizedOut);
}

function toPortablePath(value) {
  return String(value).split(path.sep).join("/");
}

function buildReport(compiled, registry, options, compiledSha256) {
  const lines = [];
  lines.push("# Token Compile Report");
  lines.push("");
  lines.push(`- registry: ${toPortablePath(path.resolve(options.registry))}`);
  lines.push(`- definitions: ${toPortablePath(path.resolve(options.defs))}`);
  lines.push(`- output: ${toPortablePath(path.resolve(options.out))}`);
  lines.push(`- semver: ${compiled.semantics.semver}`);
  lines.push(`- trace_version: ${compiled.version_contract.trace_version}`);
  lines.push(`- render_version: ${compiled.version_contract.render_version}`);
  lines.push(`- definitions sha256: ${compiled.semantics.definitions_sha256}`);
  lines.push(`- compiled sha256: ${compiledSha256}`);
  lines.push(`- tokens compiled: ${compiled.stats.tokens_total}`);
  lines.push(`- warnings: ${compiled.stats.warning_count}`);
  lines.push("");

  lines.push("## Warning Summary");
  lines.push("");
  const warningEntries = Object.entries(compiled.stats.warning_by_code ?? {});
  if (warningEntries.length === 0) {
    lines.push("- none");
  } else {
    for (const [code, count] of warningEntries) {
      lines.push(`- ${code}: ${count}`);
    }
  }
  lines.push("");

  lines.push(`## Top ${options.top} Token Spot-Check`);
  lines.push("");
  lines.push("| token_id | count | signature | op_family | modifiers | warnings |");
  lines.push("| --- | ---: | --- | --- | --- | ---: |");

  const topRows = Object.values(registry.tokens ?? {})
    .slice()
    .sort((left, right) => {
      const byCount = Number(right.count ?? 0) - Number(left.count ?? 0);
      if (byCount !== 0) {
        return byCount;
      }
      return Number(left.token_id ?? 0) - Number(right.token_id ?? 0);
    })
    .slice(0, options.top);

  for (const row of topRows) {
    const tokenId = String(row.token_id);
    const compiledRow = compiled.tokens[tokenId];
    const modifiers = compiledRow?.modifiers?.join(", ") || "-";
    const warningCount = compiledRow?.warnings?.length ?? 0;
    lines.push(
      `| ${tokenId} | ${row.count ?? 0} | ${row.signature} | ${compiledRow?.op_family ?? "UNKNOWN"} | ${modifiers} | ${warningCount} |`
    );
  }
  lines.push("");

  lines.push("## Notes");
  lines.push("");
  lines.push("- Version contract is sourced from impl/reference/src/version.ts.");
  lines.push("- Compilation is deterministic over registry + semantics definition table.");
  lines.push("- Runtime dispatch uses precompiled runtime fields and avoids Unicode mark parsing.");
  lines.push(
    "- Illegal combinations are strict errors (compile stops); orthographic marks are ignored with warnings."
  );
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function readJson(pathName) {
  const raw = await fs.readFile(pathName, "utf8");
  return JSON.parse(raw);
}

function assertSemanticsVersionAlignment(defs, versionContract, defsPath) {
  const defsSemver = typeof defs?.semver === "string" ? defs.semver.trim() : "";
  const contractSemver = versionContract.semantics_version;
  if (!defsSemver) {
    throw new Error(`Missing semver in semantic definitions at ${toPortablePath(defsPath)}`);
  }
  if (defsSemver !== contractSemver) {
    throw new Error(
      `Semantics version mismatch: registry/token-semantics.json declares ${defsSemver} but impl/reference/src/version.ts declares ${contractSemver}`
    );
  }
}

async function run(command, opts) {
  const registryPath = path.resolve(opts.registry);
  const outPath = path.resolve(opts.out);
  const reportPath = path.resolve(opts.report);
  const defsPath = path.resolve(opts.defs);

  const [registry, defs, versionContract] = await Promise.all([
    readJson(registryPath),
    readJson(defsPath),
    readVersionContractFromFile()
  ]);
  assertSemanticsVersionAlignment(defs, versionContract, defsPath);
  const compiled = compileRegistry(registry, defs, { ...opts, versionContract });
  const compiledText = `${JSON.stringify(compiled, null, 2)}\n`;
  const compiledSha256 = sha256Hex(compiledText);
  const reportText = buildReport(compiled, registry, opts, compiledSha256);

  if (command === "verify") {
    const existingCompiled = await fs.readFile(outPath, "utf8");
    const existingReport = await fs.readFile(reportPath, "utf8");
    if (existingCompiled !== compiledText) {
      throw new Error("verify failed: compiled output mismatch");
    }
    if (existingReport !== reportText) {
      throw new Error("verify failed: report output mismatch");
    }
    console.log("verify: ok");
    return;
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(outPath, compiledText, "utf8");
  await fs.writeFile(reportPath, reportText, "utf8");

  console.log(
    `done: tokens=${compiled.stats.tokens_total} warnings=${compiled.stats.warning_count} sha256=${compiledSha256}`
  );
}

async function main() {
  const { command, opts } = parseArgs(process.argv.slice(2));
  await run(command, opts);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
