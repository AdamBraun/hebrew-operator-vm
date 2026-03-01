# IR Schemas

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

Implementation hooks:

- validator + invariants: `src/layers/layout/schema.ts`
- writer utility: `writeLayoutIRJsonl(...)`
- reader utility: `readLayoutIRJsonl(...)`
