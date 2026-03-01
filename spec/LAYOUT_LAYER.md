# Layout Layer Contract (Authoritative)

## Purpose / Role

Layout is an **orthogonal analyzer** whose role is to **pick signal**:
scroll-visible segmentation events expressed as IR.

It does not normalize text, execute semantics, or interpret cantillation logic.

## Inputs

Layout consumes exactly:

- `Spine.jsonl` from normalization (gap records only).
- A versioned external layout dataset (scroll segmentation signal).

Layout MUST NOT consume or depend on:

- `LettersIR`
- `NiqqudIR`
- `CantillationIR`
- VM/runtime semantic state

## Output

Layout emits `LayoutIR` keyed by `gapid`.

Minimum record shape (JSONL):

```json
{
  "gapid": "Genesis/1/1#gap:3",
  "ref_key": "Genesis/1/1",
  "layout_event": {
    "type": "SPACE",
    "source": "spine"
  }
}
```

Allowed `layout_event.type` values:

- `SPACE`
- `SETUMA`
- `PETUCHA`
- `BOOK_BREAK`

## Boundaries Produced

Layout is the only layer allowed to produce these boundary classes:

1. `SPACE` from raw whitespace in Spine gap rows (`gap.raw.whitespace = true`).
2. `SETUMA` from layout dataset signal.
3. `PETUCHA` from layout dataset signal.
4. `BOOK_BREAK` from layout dataset signal.

No other boundary families are in scope for this layer.

## Non-Goals

Layout MUST NOT do any of the following:

- assign `cut(rank)` or any τ-based boundary semantics,
- run verse/chapter logic,
- interpret cantillation marks, tropes, maqaf, or sof-pasuq,
- mutate semantic heap/VM state,
- perform letter/niqqud semantic interpretation.

## Obligations

Layout MUST satisfy all of the following:

1. Stable anchor usage: output is anchored by `gapid` only.
2. Deterministic ordering:
   - stable ref ordering,
   - stable `gap_index` ordering within each ref,
   - stable event ordering for multi-event same-gap cases.
3. Dataset versioning and digesting:
   - include dataset identity (`dataset_version`),
   - include dataset content digest (`dataset_sha256`) in layer manifest/digest basis,
   - any dataset content change must invalidate `layoutDigest`.
4. Purity with respect to Spine:
   - `SPACE` derives only from `gap.raw.whitespace`,
   - no layout class may be inferred from punctuation in `gap.raw.chars`.

## Forbidden Operations

The following are contract violations:

- reading letter-level anchors (`gid`) as layout anchors,
- emitting `CUT`, `CONJ`, `SOF_PASUK`, or rank metadata,
- importing or joining `LettersIR`, `NiqqudIR`, or `CantillationIR`,
- writing/mutating semantic heap state,
- inferring `SETUMA` / `PETUCHA` / `BOOK_BREAK` from whitespace alone without dataset evidence,
- inferring any layout class from punctuation/diacritics.

## Composition

Layout output is compositional input to the wrapper only.
The wrapper consumes `LayoutIR` and applies hygiene/flush policy later.
Layout itself does not apply those policies.
