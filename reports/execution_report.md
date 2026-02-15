# Corpus Execution Report

## Summary
- input: data/torah.json
- token_registry: data/tokens.registry.json
- compiled_bundles: data/tokens.compiled.json
- trace_version: 1.1.0
- semantics_version: 1.1.0
- render_version: 1.1.0
- execution_mode: WORD
- safety_rail_enabled: true
- safety_rail_threshold: 0.35
- words_total: 80134
- words_emitted: 80134
- verses_total: 5846
- verses_sanitized: 5846
- verses_skipped: 0
- verses_emitted: 5846
- unique_skeletons: 4316
- trace_sha256: 9d598a1982f69187cd78062f7c5da33a15a97cd1f0979d59ca78d8cba3bfb7dc
- verse_trace_sha256: a4bda16c4c87016b4472ecfbcabaf27697c112c8aca827a0b926309927a1627e
- elapsed_ms: 2275.97
- words_per_second: 35208.67

## Quality Gates
- coverage: PASS (80134/80134)
- determinism_basis: trace checksum captured (9d598a1982f69187cd78062f7c5da33a15a97cd1f0979d59ca78d8cba3bfb7dc)
- flow_derivation: PASS (0 mismatches)
- word_mode_equivalence: FAIL (785/80134)
- explainability: PASS (WORD baseline mode)
- safety_rail: N/A

## Errors
- unknown_signatures: 0
- missing_compiled_bundles: 0
- runtime_errors: 0

## Top Skeletons
- 4217 x LAMED.ENDPOINT
- 3964 x ALEPH.ALIAS -> TAV.FINALIZE
- 2013 x HE.DECLARE -> HE.DECLARE_BREATH
- 1920 x ALEPH.ALIAS -> SHIN.FORK -> RESH.BOUNDARY_CLOSE
- 1915 x ALEPH.ALIAS -> LAMED.ENDPOINT
- 1819 x (empty)
- 1360 x LAMED.ENDPOINT -> ALEPH.ALIAS
- 1170 x NUN.SUPPORT_DEBT -> SPACE.SUPPORT_DISCHARGE
- 1104 x RESH.BOUNDARY_CLOSE
- 1018 x DALET.BOUNDARY_CLOSE
- 946 x ALEPH.ALIAS
- 892 x ALEPH.ALIAS -> MEM.OPEN -> RESH.BOUNDARY_CLOSE -> SPACE.MEM_AUTO_CLOSE
- 730 x FINAL_NUN.SUPPORT_DEBT -> FINAL_NUN.SUPPORT_DISCHARGE
- 716 x HE.DECLARE -> ALEPH.ALIAS
- 648 x TAV.FINALIZE
- 636 x MEM.OPEN -> SHIN.FORK -> HE.DECLARE_BREATH -> SPACE.MEM_AUTO_CLOSE
- 597 x FINAL_MEM.CLOSE
- 579 x RESH.BOUNDARY_CLOSE -> ALEPH.ALIAS -> LAMED.ENDPOINT
- 561 x DALET.BOUNDARY_CLOSE -> RESH.BOUNDARY_CLOSE
- 545 x HE.DECLARE -> FINAL_MEM.CLOSE

## Outputs
- traces: corpus/word_traces.jsonl
- flows: corpus/word_flows.txt
- verse_traces: corpus/verse_traces.jsonl
- report: reports/execution_report.md
- verse_report: reports/verse_execution_report.md
- verse_motif_index: index/verse_motif_index.json
