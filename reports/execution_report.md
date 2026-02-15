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
- words_total: 80856
- words_emitted: 80856
- verses_total: 5846
- verses_sanitized: 5846
- verses_skipped: 0
- verses_emitted: 5846
- unique_skeletons: 4295
- trace_sha256: 18a2fa338f22883f0571cf70989f966a1757c95dc842e9c8367dbc095caacd06
- verse_trace_sha256: 4a120fba328ecf7065ee739dede0b26cc7af1e791a65ba2d6902de8945cda134
- elapsed_ms: 2149.04
- words_per_second: 37624.19

## Quality Gates
- coverage: PASS (80856/80856)
- determinism_basis: trace checksum captured (18a2fa338f22883f0571cf70989f966a1757c95dc842e9c8367dbc095caacd06)
- flow_derivation: PASS (0 mismatches)
- word_mode_equivalence: FAIL (823/80856)
- explainability: PASS (WORD baseline mode)
- safety_rail: N/A

## Errors
- unknown_signatures: 0
- missing_compiled_bundles: 0
- runtime_errors: 0

## Top Skeletons
- 4219 x LAMED.ENDPOINT
- 3964 x ALEPH.ALIAS -> TAV.FINALIZE
- 2207 x (empty)
- 2013 x HE.DECLARE -> HE.DECLARE_BREATH
- 1920 x ALEPH.ALIAS -> SHIN.FORK -> RESH.BOUNDARY_CLOSE
- 1915 x ALEPH.ALIAS -> LAMED.ENDPOINT
- 1360 x LAMED.ENDPOINT -> ALEPH.ALIAS
- 1171 x NUN.SUPPORT_DEBT -> SPACE.SUPPORT_DISCHARGE
- 1107 x RESH.BOUNDARY_CLOSE
- 1019 x DALET.BOUNDARY_CLOSE
- 948 x ALEPH.ALIAS
- 892 x ALEPH.ALIAS -> MEM.OPEN -> RESH.BOUNDARY_CLOSE -> SPACE.MEM_AUTO_CLOSE
- 733 x FINAL_NUN.SUPPORT_DEBT -> FINAL_NUN.SUPPORT_DISCHARGE
- 716 x HE.DECLARE -> ALEPH.ALIAS
- 648 x TAV.FINALIZE
- 636 x MEM.OPEN -> SHIN.FORK -> HE.DECLARE_BREATH -> SPACE.MEM_AUTO_CLOSE
- 598 x FINAL_MEM.CLOSE
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
