# Nun / Ayin Anchor-Cursor Audit

## Hypothesis

The VM distinguishes:

- latent retained anchor, expressed as `carry` without explicit export
- realized cursor-like access, expressed as retained anchor plus exported origin access independent of current `F`

Support criterion:

- `נ` creates retained origin without explicit export
- `ע` creates retained origin plus explicit export

Weakening criterion:

- `נ` and `ע` differ only cosmetically in trace
- `ע` does not expose an independently addressable origin

## Method

Runtime used:

- current rebuilt `dist/` from `src/reference`

Commands:

```bash
npm run pasuk-trace -- --text='נ' --no-show-post-reset --no-print-report --out-json=.tmp/axis/nun.snap.json --out-report=.tmp/axis/nun.snap.txt
npm run pasuk-trace -- --text='ע' --no-show-post-reset --no-print-report --out-json=.tmp/axis/ayin.snap.json --out-report=.tmp/axis/ayin.snap.txt
```

Notes:

- The runtime traces isolated letters directly.
- Each one-letter input is wrapped as `□ letter □`, so the operative letter step is token index `1`.
- Conclusions below refer to the post-letter snapshot at `deep_trace[1].phases[token_exit].snapshot`, not the trailing boundary reset.
- The immediate origin before the letter runs is the word baseline handle `C:1:1`.

Raw artifacts:

- `.tmp/axis/nun.snap.json`
- `.tmp/axis/nun.snap.txt`
- `.tmp/axis/ayin.snap.json`
- `.tmp/axis/ayin.snap.txt`

## Results

### `נ`

Observed operative step:

- origin before the letter runs: `C:1:1`
- destination after the letter runs: `נ:1:1`
- `carry(origin, destination)` created: yes, `carry(C:1:1, נ:1:1)`
- exported handle / alias / watch created: no
- `F` advances: yes, `C:1:1 -> נ:1:1`

Observed post-letter state:

- `vm.F = "נ:1:1"`
- `vm.K = ["Ω", "⊥", "נ:1:1"]`
- `cont = ["C:1:1->נ:1:1"]`
- `carry = ["C:1:1->נ:1:1"]`

Interpretation:

- `נ` retains the prior origin through `carry`
- `נ` advances focus to the successor
- `נ` does not create a separately exported origin handle

### `ע`

Observed operative step:

- origin before the letter runs: `C:1:1`
- destination after the letter runs: `ע:1:1`
- `carry(origin, destination)` created: yes, `carry(C:1:1, ע:1:1)`
- exported handle / alias / watch created: yes, alias handle `ע:1:2`
- `F` advances: yes, `C:1:1 -> ע:1:1`

Observed post-letter state:

- `vm.F = "ע:1:1"`
- `vm.K = ["Ω", "⊥", "ע:1:2"]`
- `cont = ["C:1:1->ע:1:1"]`
- `carry = ["C:1:1->ע:1:1"]`
- exported alias metadata on `ע:1:2`: `target = "C:1:1"`, `export_origin = true`

Interpretation:

- `ע` retains the prior origin through `carry`
- `ע` also creates explicit exported access to that origin
- the export is distinct from the advanced focus

## Independent Addressability Check

Using the post-letter snapshots:

- current-focus selection after `נ` returns `["נ:1:1"]`
- generic unary operand selection after `נ` also returns `["נ:1:1"]`
- current-focus selection after `ע` returns `["ע:1:1"]`
- generic unary operand selection after `ע` returns `["ע:1:2"]`

This shows:

- `נ` exposes only the realized successor now in `F`
- `ע` exposes an independently addressable alias handle to the retained origin

## Step Table

| Token | Origin before run | Destination after run | `carry(origin, destination)` | Explicit exported handle     | `F` advances |
| ----- | ----------------- | --------------------- | ---------------------------- | ---------------------------- | ------------ |
| `נ`   | `C:1:1`           | `נ:1:1`               | yes                          | no                           | yes          |
| `ע`   | `C:1:1`           | `ע:1:1`               | yes                          | yes, `ע:1:2` alias to origin | yes          |

## Conclusion

The hypothesis is supported.

- `נ` creates retained origin without explicit export
- `ע` creates retained origin plus explicit exported origin access

The difference is not cosmetic:

- both letters create the same retention substrate: `carry(origin, successor)`
- only `ע` publishes an independently addressable handle to the prior origin

## Source Anchors

Implementation points that match the traces:

- `נ` uses `spawnCarryContinuationNode(...)` and returns only the successor as the sealed handle: `src/reference/letters/nun.ts`
- `ע` adds `carry(origin, child)`, creates an alias handle targeting the origin, and exports that alias: `src/reference/letters/ayin.ts`
- `spawnCarryContinuationNode(...)` adds both `cont` and `carry`: `src/reference/letters/continuation_primitives.ts`
- register commit publishes `export_handle ?? sealed` to `K` while advancing `F` to the sealed successor unless told otherwise: `src/reference/vm/vm.ts`
- generic operand selection consumes `K` before falling back to `F`: `src/reference/vm/select.ts`
