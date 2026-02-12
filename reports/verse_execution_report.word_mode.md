# Verse Execution Report

## Summary
- input: data/torah.json
- semantic_version: 1.0.0
- execution_mode: WORD
- safety_rail_enabled: true
- safety_rail_threshold: 0.35
- words_total: 80856
- verses_total: 5846
- changed_words_vs_word_mode: 0
- verses_with_cross_word_events: 0
- trace_sha256: 055ed803ff422cb93bb4a667a6ca31e5bcd018be74da60e606a6b707815ea354
- verse_trace_sha256: 9adff5bb9878f38cf16c178ede1e990e2448bf89d928d66a83cece4c2eb92a22

## Quality Gates
- word_mode_equivalence: PASS (80856/80856)
- determinism: PASS (checksum basis captured)
- explainability: PASS (WORD baseline mode)
- safety_rail: N/A

## Boundary Operators
- 18098 x RESH.BOUNDARY_CLOSE
- 11891 x SPACE.MEM_AUTO_CLOSE
- 9343 x SPACE.SUPPORT_DISCHARGE
- 7020 x DALET.BOUNDARY_CLOSE

## Verse Boundary Operator
- 5668 x confirm_stable_closure
- 178 x discharge_or_close_pending

## Motif Expansions
- 46352 x VERSE_BOUNDARY_RESOLUTION
- 8530 x SUPPORT_DEBT_DISCHARGE_CROSS_WORD
- 127 x SUPPORT_RESOLVED_AT_VERSE_BOUNDARY
- 117 x FINALIZE_AT_VERSE_EDGE
- 71 x MEM_RESOLVED_AT_VERSE_BOUNDARY

## Cross-Word Samples
- none

## Outputs
- traces: corpus/word_traces.word_mode.jsonl
- verse_traces: corpus/verse_traces.word_mode.jsonl
- execution_report: reports/execution_report.word_mode.md
- verse_report: reports/verse_execution_report.word_mode.md
- verse_motif_index: index/verse_motif_index.word_mode.json
