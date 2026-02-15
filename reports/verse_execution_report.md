# Verse Execution Report

## Summary
- input: data/torah.json
- trace_version: 1.0.0
- semantics_version: 1.1.0
- render_version: 1.1.0
- execution_mode: WORD
- safety_rail_enabled: true
- safety_rail_threshold: 0.35
- words_total: 80856
- verses_total: 5846
- changed_words_vs_word_mode: 0
- verses_with_cross_word_events: 0
- trace_sha256: 2b00b9882588950a7a71107620b531f903e7632d707dd8d0f16fdb03b1b44df0
- verse_trace_sha256: 3a6af8f620b3f09f613f4d484f53355768d34d76698a1455cd1a980360f024e3

## Quality Gates
- word_mode_equivalence: FAIL (823/80856)
- determinism: PASS (checksum basis captured)
- explainability: PASS (WORD baseline mode)
- safety_rail: N/A

## Boundary Operators
- 18098 x RESH.BOUNDARY_CLOSE
- 11891 x SPACE.MEM_AUTO_CLOSE
- 9336 x SPACE.SUPPORT_DISCHARGE
- 7020 x DALET.BOUNDARY_CLOSE

## Verse Boundary Operator
- 5668 x confirm_stable_closure
- 178 x discharge_or_close_pending

## Motif Expansions
- 46345 x VERSE_BOUNDARY_RESOLUTION
- 8530 x SUPPORT_DEBT_DISCHARGE_CROSS_WORD
- 127 x SUPPORT_RESOLVED_AT_VERSE_BOUNDARY
- 117 x FINALIZE_AT_VERSE_EDGE
- 71 x MEM_RESOLVED_AT_VERSE_BOUNDARY

## Cross-Word Samples
- none

## Outputs
- traces: corpus/word_traces.jsonl
- verse_traces: corpus/verse_traces.jsonl
- execution_report: reports/execution_report.md
- verse_report: reports/verse_execution_report.md
- verse_motif_index: index/verse_motif_index.json
