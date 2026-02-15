# Word Phases (Phrase-Aware Renderer)

## Status

Normative for phrase-aware word-phase renderer output:

- `outputs/**/word_phases.jsonl`

This artifact is renderer-layer output. It MUST NOT change canonical machine truth in `WORD_TRACE`.

## Inputs

- Canonical word rows (typically from `word_flows.full.jsonl` / execution rows).
- Phrase-role annotations from `corpus/word_phrase_roles.jsonl` (`phrase_tree.v1` lane).

Phrase annotations are read-only inputs. They are merged by `ref_key + token_index`.

## Output Row Shape

Each row MUST include:

- `ref`
- `ref_key`
- `surface`
- `token_ids`
- `skeleton`
- `one_liner`
- `phrase_role` (nullable)
- `phrase_path`
- `clause_id` (nullable)
- `subclause_id` (nullable)
- `phrase_version` (nullable)
- `phrase_group` (nullable, renderer grouping hint)
- `phase_render`

`phase_render` MUST contain the standard section lines:

- `Phrase role: ...`
- `Clause: ...`

## Phrase Grouping

Optional phrase-aware grouping is allowed as renderer metadata only.
Current deterministic mapping:

- `HEAD` or `SPLIT` -> `HEAD`
- `JOIN` -> `CONTINUATION`
- `TAIL` -> `ATTACHMENT`

Grouping MUST NOT alter `skeleton`, `events`, or semantic hash basis.

## Determinism

- Same inputs MUST produce byte-identical `word_phases.jsonl`.
- Missing phrase-role rows MUST resolve to nullable phrase fields and `UNASSIGNED` render labels.
- Renderer-only phrase text changes require a `render_version` bump.
