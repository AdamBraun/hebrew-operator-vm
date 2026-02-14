# CI Guardrails Baseline Report

- mode: fail
- generated_at_utc: 2026-02-14T22:19:36.240Z
- touched_source: working_tree
- touched_files: 28
- thresholds.max_bytes: 30000
- thresholds.max_complexity_score: 220
- files_scanned: 79
- legacy_allowlisted_violations: 2
- touched_legacy_violations: 0
- new_violations: 1
- blocking_violations: 1

## File Metrics

| file | touched | bytes | complexity_score | bytes_status | complexity_status |
|---|---|---:|---:|---|---|
| scripts/exemplar-library.mjs | no | 41157 | 168 | legacy_allowlisted | pass |
| scripts/pattern-index.mjs | no | 34252 | 174 | legacy_allowlisted | pass |
| impl/reference/src/scripts/torahCorpus/runtimeCommands.ts | yes | 30468 | 55 | new_violation | pass |
| impl/reference/src/scripts/torahCorpus/runtimePart1.ts | no | 28394 | 122 | pass | pass |
| impl/reference/src/scripts/torahCorpus/execute.ts | no | 27743 | 55 | pass | pass |
| impl/reference/src/scripts/extractTokenRegistry/runtime.ts | no | 22563 | 62 | pass | pass |
| impl/reference/src/scripts/torahCorpus/regress.ts | no | 21536 | 78 | pass | pass |
| scripts/compile-token-operators.mjs | no | 21457 | 92 | pass | pass |
| impl/reference/src/scripts/normalizeTorah/runtime.ts | no | 20918 | 66 | pass | pass |
| impl/reference/src/scripts/torahCorpus/runtimePart2.ts | no | 18990 | 97 | pass | pass |
| impl/reference/src/scripts/torahCorpus/args.ts | no | 17845 | 81 | pass | pass |
| impl/reference/src/scripts/torahCorpus/runtimePart3.ts | yes | 15727 | 85 | pass | pass |
| impl/reference/src/trace/canonicalize.ts | no | 12681 | 53 | pass | pass |
| impl/reference/src/scripts/torahCorpus/executeReports.ts | no | 12005 | 30 | pass | pass |
| impl/reference/src/trace/types.ts | no | 10443 | 6 | pass | pass |
| impl/reference/src/render/atomic.ts | no | 9811 | 37 | pass | pass |
| impl/reference/src/scripts/renderAtomic/runtime.ts | no | 9792 | 50 | pass | pass |
| impl/reference/src/vm/vm.ts | no | 9109 | 58 | pass | pass |
| impl/reference/src/dispatch/dispatcher.ts | no | 7425 | 43 | pass | pass |
| impl/reference/src/render/lexicon.ts | no | 7280 | 35 | pass | pass |
| impl/reference/src/scripts/downloadTorah/runtime.ts | no | 7020 | 30 | pass | pass |
| impl/reference/src/scripts/iterateTorah/runtime.ts | no | 6205 | 35 | pass | pass |
| impl/reference/src/compile/tokenizer.ts | no | 3539 | 25 | pass | pass |
| impl/reference/src/vm/select.ts | no | 3533 | 26 | pass | pass |
| impl/reference/src/scripts/torahCorpus/diff.ts | no | 3532 | 15 | pass | pass |
| impl/reference/src/trace/hash.ts | no | 3317 | 15 | pass | pass |
| impl/reference/src/letters/he.ts | no | 2907 | 5 | pass | pass |
| impl/reference/src/state/state.ts | no | 2832 | 5 | pass | pass |
| impl/reference/src/index.ts | no | 2394 | 11 | pass | pass |
| impl/reference/src/vm/space.ts | no | 2359 | 11 | pass | pass |
| impl/reference/src/dispatch/types.ts | no | 2305 | 1 | pass | pass |
| impl/reference/src/letters/shin.ts | no | 2265 | 2 | pass | pass |
| impl/reference/src/scripts/torahCorpus/report.ts | no | 2241 | 10 | pass | pass |
| impl/reference/src/letters/tav.ts | no | 2129 | 1 | pass | pass |
| impl/reference/src/letters/aleph.ts | no | 2063 | 6 | pass | pass |
| impl/reference/src/compile/diacritics.ts | no | 2037 | 9 | pass | pass |
| impl/reference/src/letters/lamed.ts | no | 1965 | 1 | pass | pass |
| impl/reference/src/state/policies.ts | no | 1931 | 6 | pass | pass |
| impl/reference/src/letters/finalPe.ts | no | 1913 | 4 | pass | pass |
| impl/reference/src/letters/het.ts | no | 1875 | 1 | pass | pass |
| impl/reference/src/letters/bet.ts | no | 1839 | 6 | pass | pass |
| impl/reference/src/state/invariants.ts | no | 1789 | 16 | pass | pass |
| impl/reference/src/letters/finalMem.ts | no | 1769 | 4 | pass | pass |
| impl/reference/src/letters/registry.ts | no | 1757 | 1 | pass | pass |
| impl/reference/src/letters/finalNun.ts | no | 1569 | 4 | pass | pass |
| impl/reference/src/letters/resh.ts | no | 1540 | 1 | pass | pass |
| impl/reference/src/letters/dalet.ts | no | 1530 | 1 | pass | pass |
| impl/reference/src/letters/pe.ts | no | 1505 | 1 | pass | pass |
| impl/reference/src/letters/samekh.ts | no | 1435 | 6 | pass | pass |
| impl/reference/src/letters/vav.ts | no | 1422 | 1 | pass | pass |
| impl/reference/src/letters/finalTsadi.ts | no | 1378 | 1 | pass | pass |
| impl/reference/src/letters/finalKaf.ts | no | 1358 | 1 | pass | pass |
| impl/reference/src/letters/tsadi.ts | no | 1337 | 1 | pass | pass |
| impl/reference/src/letters/kaf.ts | no | 1299 | 1 | pass | pass |
| impl/reference/src/letters/qof.ts | no | 1261 | 1 | pass | pass |
| impl/reference/src/letters/gimel.ts | no | 1253 | 1 | pass | pass |
| impl/reference/src/state/handles.ts | no | 1239 | 1 | pass | pass |
| impl/reference/src/letters/tet.ts | no | 1238 | 1 | pass | pass |
| impl/reference/src/letters/nun.ts | no | 1226 | 1 | pass | pass |
| impl/reference/src/letters/zayin.ts | no | 1172 | 1 | pass | pass |
| impl/reference/src/letters/mem.ts | no | 1169 | 1 | pass | pass |
| impl/reference/src/state/relations.ts | no | 1094 | 8 | pass | pass |
| impl/reference/src/letters/ayin.ts | no | 1065 | 2 | pass | pass |
| impl/reference/src/compile/types.ts | no | 1031 | 1 | pass | pass |
| impl/reference/src/letters/yod.ts | no | 993 | 1 | pass | pass |
| impl/reference/src/letters/types.ts | no | 905 | 1 | pass | pass |
| scripts/extract-token-registry.mjs | no | 882 | 7 | pass | pass |
| scripts/normalize-torah.mjs | no | 838 | 7 | pass | pass |
| scripts/torah-corpus.mjs | no | 837 | 7 | pass | pass |
| scripts/download-torah.mjs | no | 831 | 7 | pass | pass |
| scripts/iterate-torah.mjs | no | 824 | 7 | pass | pass |
| impl/reference/src/letters/stub.ts | no | 816 | 1 | pass | pass |
| impl/reference/src/version.ts | no | 553 | 1 | pass | pass |
| impl/reference/src/compile/validate.ts | no | 390 | 4 | pass | pass |
| impl/reference/src/letters/finals.ts | no | 390 | 1 | pass | pass |
| impl/reference/src/vm/ids.ts | no | 338 | 2 | pass | pass |
| impl/reference/src/vm/errors.ts | no | 133 | 1 | pass | pass |
| impl/reference/src/vm/gc.ts | no | 110 | 1 | pass | pass |
| impl/reference/src/state/eff.ts | no | 92 | 1 | pass | pass |
