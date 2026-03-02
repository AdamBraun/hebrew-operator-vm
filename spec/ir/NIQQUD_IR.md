# NiqqudIR Schema (`niqqud.ir.jsonl`)

## Version

- `NIQQUD_IR_VERSION = 1`

Each JSONL line is one `NiqqudIRRow` keyed by grapheme anchor `gid`.

## Canonical Row Shape

```json
{
  "kind": "niqqud",
  "version": 1,
  "gid": "Genesis/1/1#g:3",
  "ref_key": "Genesis/1/1",
  "g_index": 3,
  "raw": {
    "niqqud": ["ִ", "ׁ"]
  },
  "mods": {
    "classes": ["HIRIQ", "SHIN_DOT_RIGHT"],
    "features": {
      "hasDagesh": false,
      "vowelClass": "i"
    },
    "tierHints": {
      "toch": true,
      "sof": true
    }
  },
  "unhandled": [],
  "flags": {
    "empty": false,
    "ambiguous": false,
    "normalized_from": []
  }
}
```

## Field Contract

- `kind: "niqqud"` literal row tag.
- `version: number` must equal `NIQQUD_IR_VERSION`.
- `gid: string` grapheme anchor join key (`<ref_key>#g:<g_index>`).
- `ref_key: string` reference key.
- `g_index: number` non-negative integer; must match `gid`.
- `raw.niqqud: string[]` exact raw niqqud marks from Spine for trace/debug/reprocessing.
- `mods: NiqqudMods` normalized modifier payload.
- `unhandled: string[]` raw niqqud marks not recognized by current mapping.
- `flags?: { empty, ambiguous, normalized_from? }` forward-compat metadata.

## `NiqqudMods` Contract

- Class vocabulary and raw mark mapping are defined in [NIQQUD_CLASSES.md](./NIQQUD_CLASSES.md).
- `classes: string[]` stable mark classes (implementation vocabulary).
- `features: Record<string, number | boolean | string>` low-level stable features.
- `tierHints?: { rosh?: boolean; toch?: boolean; sof?: boolean }` optional tier hints.

## Invariants

1. One row per `gid` in spine grapheme stream order.
2. `gid`, `ref_key`, and `g_index` must be mutually consistent.
3. `raw.niqqud` must preserve raw marks as received from Spine.
4. `unhandled` must contain unknown/unmapped niqqud marks; unknown marks are not dropped.
5. `flags.empty=true` iff no niqqud marks are present.
6. `flags.ambiguous=true` iff mapping produced mutually exclusive class signals.

## Orthogonality Constraints

NiqqudIR MUST NOT:

- encode letter-dependent execution semantics,
- encode boundary/cut/glue/tau actions,
- depend on LettersIR/CantillationIR/LayoutIR outputs.

NiqqudIR MAY:

- carry interpretation-light classification hints via `mods.classes`, `mods.features`, and optional `mods.tierHints`,
- preserve canonicalization provenance in `flags.normalized_from`.

## Non-Fatal Quality Outputs

Niqqud extraction may emit sidecar quality artifacts in the same output directory:

- `warnings.jsonl` (one warning per line):
  - `{ "gid", "ref_key", "g_index", "type", "detail" }`
  - warning `type` values:
    - `MALFORMED_MARKS`
    - `UNHANDLED_MARK`
    - `AMBIGUOUS_COMBO`
- `niqqud.stats.json`:
  - `totalGraphemes`
  - `graphemesWithNiqqud`
  - `perClassFrequency`
  - `unhandledFrequency`
  - `ambiguityCount`

Warnings are non-fatal and must not mutate NiqqudIR row semantics beyond `unhandled[]` and `flags.ambiguous`.
