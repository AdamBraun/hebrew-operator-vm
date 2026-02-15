/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars */
// @ts-nocheck
import { tokenize } from "../../compile/tokenizer";
import { createInitialState } from "../../state/state";
import {
  canonicalizeVerseTraceRecord,
  canonicalizeWordTraceRecord,
  compareVerseTraceRecords,
  compareWordTraceRecords
} from "../../trace/canonicalize";
import { runProgramWithTrace } from "../../vm/vm";
import { VERSION_CONTRACT } from "../../version";
import {
  DEFAULT_COMPILED_BUNDLES_PATH,
  DEFAULT_GOLDENS_OUT,
  DEFAULT_INPUT,
  DEFAULT_SEMANTICS_DEFS_PATH,
  DEFAULT_TOKEN_REGISTRY_PATH,
  DEFAULT_WINDOW_SIZE,
  parseCommonRunArgs,
  parseDiffArgs,
  parseExecuteArgs,
  parsePromoteArgs,
  parseRegressArgs,
  parseVerifyArgs,
  printHelp
} from "./args";
import { buildDiffPayload } from "./diff";
import {
  accumulateWordExecutionArtifacts,
  applyWordExecutionPolicy,
  assertExecuteTokenSources,
  assertModeExecutionLength,
  buildBaselineExecutions,
  buildExecuteCompletion,
  buildExecuteReports,
  buildExecuteWritePlan,
  buildWordPhaseRows,
  buildWordPhraseRoleLookup,
  buildVerseMotifIndex,
  buildVerseTraceRecord,
  buildVerseWordRowsMeta,
  buildWordExecutionArtifacts,
  computeSafetyRailActivation,
  finalizeExecuteOutputs,
  resolveExecutePaths,
  resolveSemanticVersion,
  selectModeExecutions
} from "./execute";
import {
  buildCuratedGoldens,
  buildRegressionReport,
  buildRegressDiffLines,
  compareRegressRuns,
  evaluateGoldenCases
} from "./regress";
import { workspaceRelativePath } from "./report";
import {
  SPACE_TOKEN,
  compileFlowString,
  compileOneLiner,
  deriveSignatureNotes,
  encodeRegistrySignature,
  extractWordFlow,
  extractBoundaryOps,
  makeSignature,
  mapTochKinds,
  buildTokenIdBySignature,
  collectExecutableVerses,
  makeUnknownSignatureTraceEvent,
  sanitizeText,
  signatureKey,
  sortByOrder,
  toCodepoint
} from "./runtimePart1";
import {
  buildExemplarLibrary,
  buildPatternIndex,
  buildRefKey,
  buildVerseBoundaryResolution,
  buildVerseMotifs,
  readJson,
  readJsonl,
  pathExists,
  isSafetyRailDeltaAllowed,
  resolveCorpusFilePath,
  resolveWordTokenIds,
  runIsolatedWordFlow,
  runVerseWordFlows,
  runWindowWordFlows,
  countLines,
  explainDeltaByMode,
  sha256FromBuffer,
  sha256FromFile,
  skeletonDeltaOps,
  writeJsonl,
  writeJson
} from "./runtimePart2";
import {
  arraysEqual,
  classifySkeletonDelta,
  loadGoldens,
  loadCompileContext,
  loadTraceRun,
  normalizeGoldenCase,
  sortCountObjectByKey,
  sortRefLike,
  warningDeltaText,
  wordWarningSummary
} from "./runtimePart3";
import fs from "node:fs/promises";
import path from "node:path";

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

  const phraseRolesPath = path.resolve(process.cwd(), "corpus", "word_phrase_roles.jsonl");
  let phraseRoleLookup = new Map();
  if (await pathExists(phraseRolesPath)) {
    const phraseRoleRows = await readJsonl(phraseRolesPath);
    phraseRoleLookup = buildWordPhraseRoleLookup(phraseRoleRows);
  }

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
  const wordPhaseRows = buildWordPhaseRows({
    rows: fullRows,
    phraseRoleLookup,
    compileFlowString
  });
  const phraseAnnotatedWords = wordPhaseRows.filter(
    (row) => typeof row.phrase_role === "string" && row.phrase_role.length > 0
  ).length;

  const patternIndex = buildPatternIndex(fullRows);
  const exemplars = buildExemplarLibrary(fullRows);
  const versionContract = {
    trace_version: VERSION_CONTRACT.trace_version,
    semantics_version: VERSION_CONTRACT.semantics_version,
    render_version: VERSION_CONTRACT.render_version
  };

  await fs.mkdir(outDir, { recursive: true });
  const artifactPaths = {
    "token_registry.json": path.join(outDir, "token_registry.json"),
    "word_flows.skeleton.jsonl": path.join(outDir, "word_flows.skeleton.jsonl"),
    "word_flows.one_liner.jsonl": path.join(outDir, "word_flows.one_liner.jsonl"),
    "word_flows.full.jsonl": path.join(outDir, "word_flows.full.jsonl"),
    "word_phases.jsonl": path.join(outDir, "word_phases.jsonl"),
    "pattern_index.json": path.join(outDir, "pattern_index.json"),
    "exemplar_library.json": path.join(outDir, "exemplar_library.json"),
    "review_snapshot.json": path.join(outDir, "review_snapshot.json"),
    "summary.json": path.join(outDir, "summary.json")
  };

  await writeJson(artifactPaths["token_registry.json"], {
    schema_version: 1,
    input: inputMeta,
    run_config: runConfig,
    version_contract: versionContract,
    signatures: tokenRegistry
  });
  await writeJsonl(artifactPaths["word_flows.skeleton.jsonl"], skeletonRows);
  await writeJsonl(artifactPaths["word_flows.one_liner.jsonl"], oneLinerRows);
  await writeJsonl(artifactPaths["word_flows.full.jsonl"], fullRows);
  await writeJsonl(artifactPaths["word_phases.jsonl"], wordPhaseRows);
  await writeJson(artifactPaths["pattern_index.json"], patternIndex);
  await writeJson(artifactPaths["exemplar_library.json"], exemplars);

  const artifactRows = {
    "word_flows.skeleton.jsonl": countLines(skeletonRows),
    "word_flows.one_liner.jsonl": countLines(oneLinerRows),
    "word_flows.full.jsonl": countLines(fullRows),
    "word_phases.jsonl": countLines(wordPhaseRows)
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
  const semanticsIdentity = {
    version: versionContract.semantics_version,
    ...semanticFingerprint
  };

  await writeJson(artifactPaths["review_snapshot.json"], {
    schema_version: 1,
    version_contract: versionContract,
    semantic_fingerprint: semanticFingerprint,
    semantics_identity: semanticsIdentity,
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
    version_contract: versionContract,
    stats: {
      verses_total: versesTotal,
      verses_sanitized: versesSanitized,
      verses_skipped: versesSkipped,
      words_total: wordsTotal,
      words_with_phrase_role: phraseAnnotatedWords,
      words_without_phrase_role: Math.max(0, wordsTotal - phraseAnnotatedWords),
      words_with_runtime_error: wordsErrored,
      unique_word_surfaces: analysisCache.size,
      distinct_grapheme_signatures: sortedSignatureKeys.length,
      cache_hits: cacheHits,
      cache_misses: cacheMisses
    },
    semantic_fingerprint: semanticFingerprint,
    semantics_identity: semanticsIdentity,
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
    version_contract: versionContract,
    semantic_fingerprint: summaryPayload.semantic_fingerprint,
    semantics_identity: summaryPayload.semantics_identity,
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
  const {
    inputPath,
    tokenRegistryPath,
    compiledBundlesPath,
    traceOutPath,
    flowsOutPath,
    reportOutPath,
    verseTraceOutPath,
    verseReportOutPath,
    verseMotifIndexOutPath
  } = resolveExecutePaths(opts);

  const [rawBuffer, tokenRegistryPayload, compiledPayload, semanticsDefsPayload] =
    await Promise.all([
      fs.readFile(inputPath),
      readJson(tokenRegistryPath),
      readJson(compiledBundlesPath),
      readJson(DEFAULT_SEMANTICS_DEFS_PATH).catch(() => null)
    ]);
  const raw = rawBuffer.toString("utf8");
  const data = JSON.parse(raw);

  const semanticVersion = resolveSemanticVersion(
    opts.semanticVersion,
    compiledPayload,
    semanticsDefsPayload
  );

  const tokenIdBySignature = buildTokenIdBySignature(tokenRegistryPayload);
  const compiledTokenIdSet = new Set(Object.keys(compiledPayload?.tokens ?? {}));

  assertExecuteTokenSources({
    tokenIdBySignatureSize: tokenIdBySignature.size,
    compiledTokenCount: compiledTokenIdSet.size,
    tokenRegistryPath,
    compiledBundlesPath
  });

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
    const {
      wordRowsMeta,
      missingBundles: verseMissingBundles,
      unknownSignatures: verseUnknownSignatures
    } = buildVerseWordRowsMeta({
      verseEntry,
      tokenize,
      tokenIdBySignature,
      compiledTokenIdSet,
      buildRefKey,
      resolveWordTokenIds
    });
    missingBundles.push(...verseMissingBundles);
    unknownSignatures.push(...verseUnknownSignatures);

    const baselineExecutions = buildBaselineExecutions({
      wordRowsMeta,
      getIsolatedFlow,
      makeUnknownSignatureTraceEvent
    });

    const modeExecutions = selectModeExecutions({
      mode: opts.mode,
      baselineExecutions,
      words: verseEntry.words,
      windowSize: opts.windowSize,
      defaultWindowSize: DEFAULT_WINDOW_SIZE,
      runVerseWordFlows,
      runWindowWordFlows,
      runProgramWithTrace,
      createInitialState,
      allowRuntimeErrors: opts.allowRuntimeErrors,
      verseRefKey: verseEntry.ref_key
    });

    assertModeExecutionLength({
      modeLabel: opts.modeLabel,
      verseRefKey: verseEntry.ref_key,
      emitted: modeExecutions.length,
      expected: wordRowsMeta.length
    });

    const { provisionalDeltaCount, provisionalDeltaRate, safetyRailActive } =
      computeSafetyRailActivation({
        mode: opts.mode,
        safetyRailEnabled: safetyRailStats.enabled,
        safetyRailThreshold: safetyRailStats.threshold,
        wordRowsMeta,
        baselineExecutions,
        modeExecutions,
        arraysEqual
      });
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
      const modeExecution = modeExecutions[wordIndex];
      const { execution, allowedDeltaIncrement, blockedDeltaIncrement, clampedWordIncrement } =
        applyWordExecutionPolicy({
          metaUnknownSignatures: meta.unknown_signatures,
          baselineExecution,
          modeExecution,
          mode: opts.mode,
          safetyRailActive,
          arraysEqual,
          skeletonDeltaOps,
          isSafetyRailDeltaAllowed,
          makeUnknownSignatureTraceEvent
        });
      safetyRailStats.allowed_deltas += allowedDeltaIncrement;
      safetyRailStats.blocked_deltas += blockedDeltaIncrement;
      safetyRailStats.clamped_words += clampedWordIncrement;

      const artifacts = buildWordExecutionArtifacts({
        traceVersion: VERSION_CONTRACT.trace_version,
        traceRenderVersion: VERSION_CONTRACT.render_version,
        semanticVersion,
        mode: opts.mode,
        debugRawEvents: opts.debugRawEvents,
        meta,
        wordIndex,
        baselineExecution,
        execution,
        compileFlowString,
        extractBoundaryOps,
        explainDeltaByMode,
        arraysEqual,
        canonicalizeWordTraceRecord
      });

      totalEventsInVerse = accumulateWordExecutionArtifacts({
        artifacts,
        verseRefKey: verseEntry.ref_key,
        rows,
        flowLines,
        baselineRows,
        runtimeErrors,
        skeletonCounts,
        boundaryByType,
        verseWordRows,
        crossWordEvents,
        modeDiffEvents,
        totalEventsInVerse
      });
    }

    const verseRecord = buildVerseTraceRecord({
      traceVersion: VERSION_CONTRACT.trace_version,
      traceRenderVersion: VERSION_CONTRACT.render_version,
      semanticVersion,
      verseRef: verseEntry.ref,
      verseRefKey: verseEntry.ref_key,
      modeLabel: opts.modeLabel,
      mode: opts.mode,
      windowSize: opts.windowSize,
      safetyRailActive,
      provisionalDeltaCount,
      provisionalDeltaRate,
      safetyRailThreshold: safetyRailStats.threshold,
      verseWordRows,
      crossWordEvents,
      totalEventsInVerse,
      boundaryByType,
      sortCountObjectByKey,
      buildVerseBoundaryResolution,
      buildVerseMotifs
    });
    verseRows.push(canonicalizeVerseTraceRecord(verseRecord));
  }

  const {
    sortedRows,
    sortedVerseRows,
    traceContent,
    verseTraceContent,
    topSkeletons,
    uniqueSkeletons
  } = finalizeExecuteOutputs({
    rows,
    verseRows,
    compareWordTraceRecords,
    compareVerseTraceRecords,
    skeletonCounts
  });

  const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
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
    traceVersion: VERSION_CONTRACT.trace_version,
    semanticVersion,
    renderVersion: VERSION_CONTRACT.render_version,
    mode: opts.mode,
    modeLabel: opts.modeLabel,
    windowSize: opts.windowSize,
    safetyRailStats,
    wordsTotal,
    versesTotal,
    versesSanitized,
    versesSkipped,
    rows: sortedRows,
    baselineRows,
    modeDiffEvents,
    verseRows: sortedVerseRows,
    uniqueSkeletons,
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

  const verseMotifIndexPayload = buildVerseMotifIndex({
    modeLabel: opts.modeLabel,
    traceVersion: VERSION_CONTRACT.trace_version,
    renderVersion: VERSION_CONTRACT.render_version,
    semanticVersion,
    verseRows: sortedVerseRows,
    safetyRailSummary: safetyRailStats,
    verseTraceSha256
  });
  const executeWritePlan = buildExecuteWritePlan({
    traceOutPath,
    flowsOutPath,
    reportOutPath,
    verseTraceOutPath,
    verseReportOutPath,
    verseMotifIndexOutPath,
    traceContent,
    flowLines,
    verseTraceContent,
    reportLines,
    verseReportLines,
    verseMotifIndexPayload
  });
  await Promise.all(
    executeWritePlan.directoryPaths.map((directoryPath) =>
      fs.mkdir(directoryPath, { recursive: true })
    )
  );
  await Promise.all(
    executeWritePlan.textWrites.map((write) => fs.writeFile(write.path, write.content, "utf8"))
  );
  await Promise.all(
    executeWritePlan.jsonWrites.map((write) => writeJson(write.path, write.payload))
  );

  const executeCompletion = buildExecuteCompletion({
    wordsEmitted: sortedRows.length,
    modeLabel: opts.modeLabel,
    uniqueSkeletons,
    runtimeErrors: runtimeErrors.length,
    traceOutPath,
    flowsOutPath,
    verseTraceOutPath,
    reportOutPath,
    verseReportOutPath,
    verseMotifIndexOutPath,
    unknownSignatures: unknownSignatures.length,
    missingBundles: missingBundles.length
  });
  if (executeCompletion.hardErrorMessage) {
    throw new Error(executeCompletion.hardErrorMessage);
  }
  console.log(executeCompletion.consoleLine);
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

  const { addedKeys, removedKeys, renderingChanges, skeletonChanges, topGroupedDeltas } =
    compareRegressRuns({
      runA,
      runB,
      compileA,
      compileB,
      sortRefLike,
      arraysEqual,
      classifySkeletonDelta,
      wordWarningSummary,
      warningDeltaText
    });
  const diffLines = buildRegressDiffLines({
    runA,
    runB,
    compileA,
    compileB,
    addedKeys,
    removedKeys,
    skeletonChanges,
    renderingChanges,
    topGroupedDeltas
  });

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
      semantics_versions_b: runB.semantics_versions,
      count: goldenCases.length,
      cases: goldenCases
    });
  }

  const { regressionFailures, regressionPasses } = evaluateGoldenCases({
    goldenCases,
    runBMap: runB.map,
    arraysEqual,
    classifySkeletonDelta
  });

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

export async function runTorahCorpusCli(rawArgv: string[]) {
  const [command, ...argv] = rawArgv;
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

export async function main(rawArgv: string[] = process.argv.slice(2)) {
  await runTorahCorpusCli(rawArgv);
}
