# CI Guardrails Baseline Report

- mode: fail
- generated_at_utc: 2026-03-08T16:42:48.228Z
- touched_source: working_tree
- touched_files: 5
- thresholds.max_bytes: 30000
- thresholds.max_complexity_score: 220
- files_scanned: 114
- legacy_allowlisted_violations: 10
- touched_legacy_violations: 0
- new_violations: 0
- blocking_violations: 0

## File Metrics

| file                                                  | touched | bytes | complexity_score | bytes_status       | complexity_status  |
| ----------------------------------------------------- | ------- | ----: | ---------------: | ------------------ | ------------------ |
| src/reference/scripts/pasukTraceCorpus/runtime.ts     | no      | 81631 |              323 | legacy_allowlisted | legacy_allowlisted |
| src/reference/scripts/uiBundle/runtime.ts             | no      | 64400 |              200 | legacy_allowlisted | pass               |
| src/reference/scripts/torahCorpus/execute.ts          | no      | 60826 |              193 | legacy_allowlisted | pass               |
| src/reference/scripts/phraseTree/runtime.ts           | no      | 41607 |              166 | legacy_allowlisted | pass               |
| scripts/exemplar-library.mjs                          | no      | 41222 |              168 | legacy_allowlisted | pass               |
| scripts/render/pasukGraph.mjs                         | no      | 36860 |              252 | legacy_allowlisted | legacy_allowlisted |
| scripts/pattern-index.mjs                             | no      | 34252 |              174 | legacy_allowlisted | pass               |
| src/reference/scripts/pasukTrace/runtime.ts           | no      | 33930 |              159 | legacy_allowlisted | pass               |
| src/reference/scripts/normalizeTorah/runtime.ts       | no      | 33508 |               99 | legacy_allowlisted | pass               |
| src/reference/scripts/torahCorpus/runtimeCommands.ts  | no      | 32735 |               58 | legacy_allowlisted | pass               |
| src/reference/vm/vm.ts                                | no      | 29456 |               86 | pass               | pass               |
| src/reference/scripts/torahCorpus/runtimePart1.ts     | no      | 28169 |              114 | pass               | pass               |
| src/reference/scripts/extractTokenRegistry/runtime.ts | no      | 22563 |               62 | pass               | pass               |
| src/reference/scripts/torahCorpus/regress.ts          | no      | 21485 |               77 | pass               | pass               |
| scripts/compile-token-operators.mjs                   | no      | 21373 |               90 | pass               | pass               |
| src/reference/scripts/torahCorpus/runtimePart2.ts     | no      | 19395 |               98 | pass               | pass               |
| src/reference/scripts/teamimRegistry/runtime.ts       | no      | 19111 |               62 | pass               | pass               |
| src/reference/scripts/torahCorpus/args.ts             | no      | 18194 |               83 | pass               | pass               |
| scripts/src-artifacts/recompute.mjs                   | no      | 17160 |               82 | pass               | pass               |
| src/reference/scripts/torahCorpus/runtimePart3.ts     | no      | 15727 |               85 | pass               | pass               |
| src/reference/trace/canonicalize.ts                   | no      | 14303 |               59 | pass               | pass               |
| src/reference/vm/space.ts                             | no      | 14081 |               49 | pass               | pass               |
| scripts/artifacts/verify-pasuk-corpus.mjs             | no      | 12604 |               77 | pass               | pass               |
| src/reference/scripts/torahCorpus/executeReports.ts   | no      | 12005 |               30 | pass               | pass               |
| src/reference/trace/types.ts                          | no      | 11256 |                6 | pass               | pass               |
| src/reference/render/atomic.ts                        | no      |  9988 |               37 | pass               | pass               |
| src/reference/vm/gc.ts                                | no      |  9806 |               97 | pass               | pass               |
| src/reference/scripts/renderAtomic/runtime.ts         | no      |  9791 |               50 | pass               | pass               |
| src/reference/state/eff.ts                            | no      |  9576 |               53 | pass               | pass               |
| scripts/src-artifacts/verify-lfs-outputs.mjs          | no      |  9131 |               46 | pass               | pass               |
| src/reference/vm/select.ts                            | no      |  8657 |               57 | pass               | pass               |
| src/reference/runtime/finalizeVerse.ts                | no      |  8106 |               29 | pass               | pass               |
| src/reference/dispatch/dispatcher.ts                  | no      |  7685 |               31 | pass               | pass               |
| src/reference/render/lexicon.ts                       | no      |  7499 |               37 | pass               | pass               |
| scripts/validate-split-index.mjs                      | no      |  7460 |               51 | pass               | pass               |
| scripts/artifacts/verify.mjs                          | no      |  7456 |               38 | pass               | pass               |
| src/reference/state/relations.ts                      | no      |  7339 |               68 | pass               | pass               |
| scripts/artifacts/lib.mjs                             | no      |  7297 |               20 | pass               | pass               |
| src/reference/compile/tokenizer.ts                    | no      |  7258 |               39 | pass               | pass               |
| src/reference/scripts/downloadTorah/runtime.ts        | no      |  7020 |               30 | pass               | pass               |
| src/reference/runtime/validateBaseline.ts             | no      |  6886 |               38 | pass               | pass               |
| src/reference/state/state.ts                          | no      |  6153 |                6 | pass               | pass               |
| src/reference/state/invariants.ts                     | no      |  6092 |               65 | pass               | pass               |
| scripts/artifacts/repair.mjs                          | no      |  5807 |               27 | pass               | pass               |
| scripts/src-artifacts/verify-push.mjs                 | no      |  5425 |               18 | pass               | pass               |
| src/reference/compile/tropes.ts                       | no      |  5407 |               32 | pass               | pass               |
| src/reference/scripts/iterateTorah/runtime.ts         | no      |  5140 |               28 | pass               | pass               |
| scripts/src-artifacts/config.mjs                      | no      |  4749 |               17 | pass               | pass               |
| scripts/pasuk-trace-corpus.mjs                        | no      |  4333 |               20 | pass               | pass               |
| src/reference/vm/constructs/fork.ts                   | no      |  4082 |                3 | pass               | pass               |
| scripts/split-index.mjs                               | no      |  4081 |               23 | pass               | pass               |
| src/reference/vm/constructs/attach-three.ts           | no      |  3921 |                3 | pass               | pass               |
| src/reference/scripts/shared/hebrewSanitizer.ts       | no      |  3886 |               21 | pass               | pass               |
| src/reference/scripts/torahCorpus/diff.ts             | no      |  3532 |               15 | pass               | pass               |
| scripts/smoke-nav-integrity.mjs                       | no      |  3413 |               19 | pass               | pass               |
| src/reference/trace/hash.ts                           | no      |  3317 |               15 | pass               | pass               |
| src/reference/state/eventLinks.ts                     | no      |  3291 |               32 | pass               | pass               |
| src/reference/letters/samekh.ts                       | no      |  3260 |               16 | pass               | pass               |
| src/reference/letters/headAdjunct.ts                  | no      |  2934 |               15 | pass               | pass               |
| src/reference/letters/finalMem.ts                     | no      |  2878 |                2 | pass               | pass               |
| src/reference/letters/he.ts                           | no      |  2875 |               11 | pass               | pass               |
| src/reference/letters/qof.ts                          | no      |  2772 |               11 | pass               | pass               |
| src/reference/letters/dalet.ts                        | no      |  2665 |               11 | pass               | pass               |
| src/reference/letters/resh.ts                         | no      |  2619 |               11 | pass               | pass               |
| src/reference/state/policies.ts                       | no      |  2571 |                7 | pass               | pass               |
| src/reference/compile/diacritics.ts                   | no      |  2567 |                9 | pass               | pass               |
| src/reference/letters/bet.ts                          | no      |  2523 |                9 | pass               | pass               |
| scripts/artifacts/verify-deep.mjs                     | no      |  2412 |               10 | pass               | pass               |
| src/reference/index.ts                                | no      |  2390 |               11 | pass               | pass               |
| scripts/artifacts/config.mjs                          | no      |  2359 |                2 | pass               | pass               |
| src/reference/dispatch/types.ts                       | no      |  2305 |                1 | pass               | pass               |
| scripts/render-pasuk-graph.mjs                        | no      |  2296 |               17 | pass               | pass               |
| src/reference/scripts/torahCorpus/report.ts           | no      |  2241 |               10 | pass               | pass               |
| src/reference/letters/aleph.ts                        | no      |  2166 |                6 | pass               | pass               |
| src/reference/letters/tav.ts                          | no      |  2140 |                1 | pass               | pass               |
| src/reference/letters/mem.ts                          | no      |  1949 |                1 | pass               | pass               |
| src/reference/letters/finalPe.ts                      | no      |  1938 |                4 | pass               | pass               |
| src/reference/letters/het.ts                          | no      |  1886 |                1 | pass               | pass               |
| src/reference/compile/types.ts                        | no      |  1838 |                1 | pass               | pass               |
| src/reference/vm/domainTransition.ts                  | no      |  1793 |               10 | pass               | pass               |
| src/reference/letters/tet.ts                          | no      |  1673 |                2 | pass               | pass               |
| src/reference/letters/registry.ts                     | no      |  1584 |                1 | pass               | pass               |
| src/reference/letters/pe.ts                           | no      |  1501 |                1 | pass               | pass               |
| src/reference/letters/ayin.ts                         | no      |  1499 |                1 | pass               | pass               |
| src/reference/letters/lamed.ts                        | no      |  1498 |                1 | pass               | pass               |
| src/reference/letters/finalTsadi.ts                   | no      |  1378 |                1 | pass               | pass               |
| src/reference/letters/tsadi.ts                        | no      |  1337 |                1 | pass               | pass               |
| src/reference/compile/validate.ts                     | no      |  1286 |                8 | pass               | pass               |
| src/reference/letters/zayin.ts                        | no      |  1259 |                1 | pass               | pass               |
| src/reference/letters/gimel.ts                        | no      |  1253 |                1 | pass               | pass               |
| src/reference/letters/finalNun.ts                     | no      |  1245 |                1 | pass               | pass               |
| src/reference/letters/finalKaf.ts                     | no      |  1239 |                1 | pass               | pass               |
| src/reference/state/handles.ts                        | no      |  1209 |                1 | pass               | pass               |
| src/reference/letters/kaf.ts                          | no      |  1192 |                1 | pass               | pass               |
| src/reference/letters/nun.ts                          | no      |  1100 |                1 | pass               | pass               |
| src/reference/letters/vav.ts                          | no      |  1060 |                1 | pass               | pass               |
| src/reference/letters/yod.ts                          | no      |  1022 |                1 | pass               | pass               |
| src/reference/letters/types.ts                        | no      |   991 |                1 | pass               | pass               |
| src/reference/letters/shin.ts                         | no      |   963 |                1 | pass               | pass               |
| scripts/artifacts/needs-update.mjs                    | no      |   930 |                6 | pass               | pass               |
| scripts/extract-token-registry.mjs                    | no      |   911 |                7 | pass               | pass               |
| scripts/normalize-torah.mjs                           | no      |   867 |                7 | pass               | pass               |
| scripts/teamim-registry.mjs                           | no      |   867 |                7 | pass               | pass               |
| scripts/download-torah.mjs                            | no      |   860 |                7 | pass               | pass               |
| scripts/torah-corpus.mjs                              | no      |   854 |                7 | pass               | pass               |
| scripts/iterate-torah.mjs                             | no      |   853 |                7 | pass               | pass               |
| scripts/pasuk-trace.mjs                               | no      |   839 |                7 | pass               | pass               |
| scripts/phrase-tree.mjs                               | no      |   839 |                7 | pass               | pass               |
| scripts/ui-bundle.mjs                                 | no      |   825 |                7 | pass               | pass               |
| src/reference/letters/stub.ts                         | no      |   816 |                1 | pass               | pass               |
| src/reference/version.ts                              | no      |   553 |                1 | pass               | pass               |
| src/reference/letters/finals.ts                       | no      |   390 |                1 | pass               | pass               |
| src/reference/vm/ids.ts                               | no      |   338 |                2 | pass               | pass               |
| src/reference/vm/errors.ts                            | no      |   133 |                1 | pass               | pass               |
