# IR Schemas

## NiqqudIR (`niqqud.ir.jsonl`)

Niqqud layer output is JSON Lines where each line is one `NiqqudIRRow` keyed by grapheme `gid`.

Canonical contract:

- [NiqqudIR Schema](./ir/NIQQUD_IR.md)

Implementation hooks:

- validator + invariants: `src/layers/niqqud/schema.ts`
- writer utility: `writeNiqqudIRJsonl(...)`
- reader utility: `readNiqqudIRJsonl(...)`

## LettersIR (`letters.ir.jsonl`)

Letters layer output is JSON Lines where each line is one `LettersIRRecord` keyed by grapheme `gid`.

Record schema:

```json
{
  "kind": "letter_ir",
  "gid": "Genesis/1/1#g:3",
  "ref_key": "Genesis/1/1",
  "g_index": 3,
  "letter": "ך",
  "op_kind": "כ.final",
  "features": {
    "final_form": true
  },
  "word": {
    "id": "Genesis/1/1#w:0",
    "index_in_word": 3
  },
  "flags": {
    "ignored": false
  },
  "source": {
    "spine_digest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
}
```

Field contract:

- `kind: "letter_ir"` (literal tag).
- `gid: string` (`<ref_key>#g:<g_index>`, stable anchor from spine).
- `ref_key: string`.
- `g_index: number` (non-negative integer; must match `gid`).
- `letter: string` (normalized Hebrew base letter for the grapheme).
- `op_kind: string` (operator id; may be the letter itself or a normalized family id such as `כ.final`).
- `features?: object` (letter-local only; derivable without other layers).
- `word?: { id: string; index_in_word: number }` (derived only from raw whitespace gaps).
- `flags?: { ignored?: boolean; reason?: string }`.
- `source.spine_digest: string` (lowercase sha256 hex).

Output invariants:

1. One `LettersIRRecord` per letter grapheme in spine (`kind:"g"` with Hebrew `base_letter`).
2. File order is exactly spine grapheme order (stable streaming join by `(ref_key, g_index)`).
3. No dependence on niqqud/ta'amim interpretation or layout datasets.
4. No boundary semantics (`τ`, cut/glue, GC, or VM state mutation) in this layer.
5. `gid`, `ref_key`, and `g_index` must agree for every row.
6. `gid` values are unique within the file.

Implementation hooks:

- validator + invariants: `src/layers/letters/schema.ts`
- writer utility: `writeLettersIRJsonl(...)`
- reader utility: `readLettersIRJsonl(...)`

## LayoutIR (`layout.ir.jsonl`)

Layout layer output is JSON Lines where each line is one `LayoutIRRecord` keyed by `gapid`.

Record schema:

```json
{
  "gapid": "Genesis/1/1#gap:3",
  "ref_key": "Genesis/1/1",
  "gap_index": 3,
  "layout_event": {
    "type": "SPACE",
    "strength": "weak",
    "source": "spine_whitespace",
    "meta": {
      "dataset_id": "torah_layout_breaks.v1"
    }
  }
}
```

Field contract:

- `gapid: string` (`<ref_key>#gap:<gap_index>`, stable anchor)
- `ref_key: string`
- `gap_index: number` (non-negative integer)
- `layout_event.type: "SPACE" | "SETUMA" | "PETUCHA" | "BOOK_BREAK"`
- `layout_event.strength: "weak" | "mid" | "strong" | "max"`
- `layout_event.source: "spine_whitespace" | "dataset"`
- `layout_event.meta?: object`

Strength mapping (normative):

- `SPACE -> weak`
- `SETUMA -> mid`
- `PETUCHA -> strong`
- `BOOK_BREAK -> max`

Source mapping (normative):

- `SPACE -> spine_whitespace`
- `SETUMA -> dataset`
- `PETUCHA -> dataset`
- `BOOK_BREAK -> dataset`

Output invariants:

1. Deterministic ordering: ascending by `(ref_key order, gap_index)`; ties are ordered by stable event type order.
2. At most one record per `(gapid, type)`.
3. If multiple layout events exist at one gap (for example `SPACE` and `SETUMA`), emit separate records.
4. `gapid` must match the row (`gapid = <ref_key>#gap:<gap_index>`).
5. Rows must only reference existing spine gaps for the target spine build.
6. Collision policy for dataset events at one `gapid`:
   - `SETUMA + PETUCHA` is invalid and must fail extraction.
   - `BOOK_BREAK` mixed with `SETUMA` or `PETUCHA` is invalid and must fail extraction.

Implementation hooks:

- validator + invariants: `src/layers/layout/schema.ts`
- writer utility: `writeLayoutIRJsonl(...)`
- reader utility: `readLayoutIRJsonl(...)`
