# Letters Layer Contract

## Role

Letters is an orthogonal analyzer over `Spine.jsonl` that emits deterministic per-letter operator identities (`LettersIR`), keyed by stable grapheme anchors (`gid`).

## Scope

Allowed inputs:

- spine grapheme records (`kind: "g"`) with `gid`, `ref_key`, `g_index`, `base_letter`
- spine gap records (`kind: "gap"`) with `raw.whitespace` for optional word segmentation

Allowed outputs (`letters.ir.jsonl`):

- one `letter_ir` row per Hebrew letter grapheme
- `gid`, `ref_key`, `g_index`
- `letter`, `op_kind`
- optional `word: { id, index_in_word }` derived from whitespace only
- optional letter-local `features`
- traceability source (`source.spine_digest`)

## Boundaries

Letters emits no boundary semantics and performs no boundary interpretation.

- no `cut(rank)` or glue behavior
- no `tau` or barrier transitions
- no layout boundary resolution

## Responsibilities

- identify base letter operators (`op_kind`) from normalized Hebrew base letters (including finals)
- optionally derive word segmentation using only `gap.raw.whitespace`
- emit stable anchors and operator ids suitable for wrapper stitching

## Non-Responsibilities

Letters MUST NOT do any of the following:

- niqqud interpretation
- ta'amim interpretation
- layout setuma/petucha/book-break logic
- cut/glue/tau/barrier handling
- GC or carry-state/runtime state mutation
- verse semantics or phrase semantics

## Obligations

Obligations: none (by design).

- Letters extraction emits a pure operator inventory only.
- It MUST NOT emit an `obligations` field in `LettersIR`.
- Runtime/semantic obligations are created later by wrapper execution of letter operators, not by this layer.
- Any hint that requires boundary/cantillation/layout resolution is forbidden in this layer.

## Invariants

1. One output row per Hebrew-letter grapheme in spine order.
2. `gid`, `ref_key`, and `g_index` stay aligned to spine anchors.
3. No dependency on niqqud, ta'amim, cantillation, or layout datasets.
4. Word segmentation is whitespace-derived only; maqaf semantics are ignored here.

## Examples

Minimal row:

```json
{
  "kind": "letter_ir",
  "gid": "Genesis/1/1#g:0",
  "ref_key": "Genesis/1/1",
  "g_index": 0,
  "letter": "א",
  "op_kind": "א",
  "source": {
    "spine_digest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
}
```

With optional word segmentation:

```json
{
  "kind": "letter_ir",
  "gid": "Genesis/1/1#g:3",
  "ref_key": "Genesis/1/1",
  "g_index": 3,
  "letter": "ך",
  "op_kind": "ך",
  "word": {
    "id": "Genesis/1/1#w:1",
    "index_in_word": 0
  },
  "features": {
    "isFinal": true,
    "hebrewBlock": true,
    "isLetter": true
  },
  "source": {
    "spine_digest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
}
```
