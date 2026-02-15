# Boundary Accounting (Verse + Phrase)

## Status

Normative for verse boundary accounting in `corpus/verse_traces.jsonl`.

This spec extends boundary accounting beyond word-edge operators so phrase structure is explicit in verse traces.

## Inputs

- Word-level boundary operators (`WORD_END`/word-edge boundary ops, `VERSE_END` handling).
- Phrase trees from `corpus/verse_phrase_trees.jsonl` (`phrase_tree.v1` lane).

## Boundary Event Families

Verse boundary accounting MUST include:

- Word/space boundary operators already present in word traces.
- `PHRASE_BREAK` events emitted from phrase-tree split nodes.
- Verse-end boundary resolution (`VERSE.BOUNDARY_RESOLUTION`).

## PHRASE_BREAK Emission Rule

For each verse phrase tree:

1. Traverse the tree.
2. Select nodes with `node_type = "SPLIT"` (disjunctive boundary points).
3. Emit exactly one verse-level `PHRASE_BREAK` event per selected node.

Node-to-emission mapping is explicit: each event carries `phrase_node_id`, and each split node id MUST map to one emitted event.

## PHRASE_BREAK Payload Contract

`boundary_events.phrase_breaks[]` entries use:

- `kind = "PHRASE_BREAK"`
- `phrase_node_id` (split-node id from phrase tree)
- `split_word_index` (node split point)
- `word_span.start` / `word_span.end` (node span)
- `evidence.verse_ref_key`
- `evidence.phrase_version`

These fields are the evidence pointer set for phrase boundaries.

## Verse Trace Accounting

- `boundary_events.by_type.PHRASE_BREAK` MUST equal `boundary_events.phrase_breaks.length`.
- `boundary_events.total` MUST include `PHRASE_BREAK` counts.
- `boundary_events.verse_end` remains the verse-edge operator list; `PHRASE_BREAK` is not required in `verse_end`.

## Determinism

`PHRASE_BREAK` events MUST be stable across re-runs for the same inputs.

Canonical ordering for phrase breaks:

1. `split_word_index` ascending
2. `word_span.start` ascending
3. `word_span.end` ascending
4. `phrase_node_id` ascending

## Fallback Behavior

If no phrase tree row is available (or the verse cannot be safely matched to phrase input), emit:

- `boundary_events.phrase_breaks = []`
- no `PHRASE_BREAK` count in `by_type`

This keeps traces deterministic while avoiding implicit/guessed phrase boundaries.
