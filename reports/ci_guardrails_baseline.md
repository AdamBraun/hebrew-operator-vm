# CI Guardrails Baseline Report

- mode: warn
- generated_at_utc: 2026-02-12T20:07:27.720Z
- thresholds.max_bytes: 30000
- thresholds.max_complexity_score: 220
- files_scanned: 71
- legacy_allowlisted_violations: 2
- new_violations: 0

## File Metrics

| file | bytes | complexity_score | bytes_status | complexity_status |
|---|---:|---:|---|---|
| scripts/exemplar-library.mjs | 41157 | 168 | legacy_allowlisted | pass |
| scripts/pattern-index.mjs | 34252 | 174 | legacy_allowlisted | pass |
| impl/reference/src/scripts/torahCorpus/runtimeCommands.ts | 29578 | 55 | pass | pass |
| impl/reference/src/scripts/torahCorpus/runtimePart1.ts | 28395 | 122 | pass | pass |
| impl/reference/src/scripts/torahCorpus/execute.ts | 27098 | 51 | pass | pass |
| impl/reference/src/scripts/torahCorpus/regress.ts | 21508 | 78 | pass | pass |
| scripts/compile-token-operators.mjs | 20062 | 90 | pass | pass |
| scripts/extract-token-registry.mjs | 19733 | 61 | pass | pass |
| impl/reference/src/scripts/torahCorpus/runtimePart2.ts | 18967 | 97 | pass | pass |
| scripts/normalize-torah.mjs | 17870 | 64 | pass | pass |
| impl/reference/src/scripts/torahCorpus/args.ts | 17845 | 81 | pass | pass |
| impl/reference/src/scripts/torahCorpus/runtimePart3.ts | 15666 | 85 | pass | pass |
| impl/reference/src/trace/canonicalize.ts | 12681 | 53 | pass | pass |
| impl/reference/src/scripts/torahCorpus/executeReports.ts | 11766 | 30 | pass | pass |
| impl/reference/src/trace/types.ts | 10437 | 6 | pass | pass |
| impl/reference/src/vm/vm.ts | 9029 | 57 | pass | pass |
| impl/reference/src/dispatch/dispatcher.ts | 7345 | 42 | pass | pass |
| scripts/download-torah.mjs | 5440 | 29 | pass | pass |
| scripts/iterate-torah.mjs | 5094 | 29 | pass | pass |
| impl/reference/src/compile/tokenizer.ts | 3539 | 25 | pass | pass |
| impl/reference/src/vm/select.ts | 3533 | 26 | pass | pass |
| impl/reference/src/scripts/torahCorpus/diff.ts | 3532 | 15 | pass | pass |
| impl/reference/src/trace/hash.ts | 3317 | 15 | pass | pass |
| impl/reference/src/letters/he.ts | 2907 | 5 | pass | pass |
| impl/reference/src/state/state.ts | 2716 | 5 | pass | pass |
| impl/reference/src/index.ts | 2394 | 11 | pass | pass |
| impl/reference/src/vm/space.ts | 2319 | 11 | pass | pass |
| impl/reference/src/dispatch/types.ts | 2305 | 1 | pass | pass |
| impl/reference/src/letters/shin.ts | 2265 | 2 | pass | pass |
| impl/reference/src/scripts/torahCorpus/report.ts | 2241 | 10 | pass | pass |
| impl/reference/src/letters/tav.ts | 2129 | 1 | pass | pass |
| impl/reference/src/compile/diacritics.ts | 2037 | 9 | pass | pass |
| impl/reference/src/letters/lamed.ts | 1965 | 1 | pass | pass |
| impl/reference/src/state/policies.ts | 1931 | 6 | pass | pass |
| impl/reference/src/letters/finalPe.ts | 1913 | 4 | pass | pass |
| impl/reference/src/letters/het.ts | 1875 | 1 | pass | pass |
| impl/reference/src/letters/finalMem.ts | 1769 | 4 | pass | pass |
| impl/reference/src/letters/registry.ts | 1757 | 1 | pass | pass |
| impl/reference/src/state/invariants.ts | 1715 | 15 | pass | pass |
| impl/reference/src/letters/finalNun.ts | 1569 | 4 | pass | pass |
| impl/reference/src/letters/resh.ts | 1540 | 1 | pass | pass |
| impl/reference/src/letters/dalet.ts | 1530 | 1 | pass | pass |
| impl/reference/src/letters/pe.ts | 1505 | 1 | pass | pass |
| impl/reference/src/letters/samekh.ts | 1435 | 6 | pass | pass |
| impl/reference/src/letters/vav.ts | 1422 | 1 | pass | pass |
| impl/reference/src/letters/finalTsadi.ts | 1378 | 1 | pass | pass |
| impl/reference/src/letters/finalKaf.ts | 1358 | 1 | pass | pass |
| impl/reference/src/letters/bet.ts | 1348 | 1 | pass | pass |
| impl/reference/src/letters/tsadi.ts | 1337 | 1 | pass | pass |
| impl/reference/src/letters/kaf.ts | 1299 | 1 | pass | pass |
| impl/reference/src/letters/aleph.ts | 1266 | 1 | pass | pass |
| impl/reference/src/letters/qof.ts | 1261 | 1 | pass | pass |
| impl/reference/src/letters/gimel.ts | 1253 | 1 | pass | pass |
| impl/reference/src/state/handles.ts | 1239 | 1 | pass | pass |
| impl/reference/src/letters/tet.ts | 1238 | 1 | pass | pass |
| impl/reference/src/letters/nun.ts | 1226 | 1 | pass | pass |
| impl/reference/src/letters/zayin.ts | 1172 | 1 | pass | pass |
| impl/reference/src/letters/mem.ts | 1169 | 1 | pass | pass |
| impl/reference/src/state/relations.ts | 1094 | 8 | pass | pass |
| impl/reference/src/letters/ayin.ts | 1065 | 2 | pass | pass |
| impl/reference/src/compile/types.ts | 1031 | 1 | pass | pass |
| impl/reference/src/letters/yod.ts | 993 | 1 | pass | pass |
| impl/reference/src/letters/types.ts | 905 | 1 | pass | pass |
| scripts/torah-corpus.mjs | 837 | 7 | pass | pass |
| impl/reference/src/letters/stub.ts | 816 | 1 | pass | pass |
| impl/reference/src/compile/validate.ts | 390 | 4 | pass | pass |
| impl/reference/src/letters/finals.ts | 390 | 1 | pass | pass |
| impl/reference/src/vm/ids.ts | 338 | 2 | pass | pass |
| impl/reference/src/vm/errors.ts | 133 | 1 | pass | pass |
| impl/reference/src/vm/gc.ts | 110 | 1 | pass | pass |
| impl/reference/src/state/eff.ts | 92 | 1 | pass | pass |
