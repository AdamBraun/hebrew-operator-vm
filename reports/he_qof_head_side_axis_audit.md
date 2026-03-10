# He / Qof Head-Side Axis Audit

## Hypothesis

Added side structure on a headed form behaves as a cursor-bearing adjunct rather than ordinary forward spine.

Support criterion:

- the side or leg structure changes addressability or backed access
- it does not behave as mere forward continuation

Weakening criterion:

- the extra stroke has no mechanical effect
- the effect is indistinguishable from plain spine extension

## Method

Runtime used:

- current rebuilt `dist/` from `src/reference`

Commands:

```bash
npm run pasuk-trace -- --text='ה' --no-show-post-reset --no-print-report --out-json=.tmp/axis/he.snap.json --out-report=.tmp/axis/he.snap.txt
npm run pasuk-trace -- --text='ק' --no-show-post-reset --no-print-report --out-json=.tmp/axis/qof.snap.json --out-report=.tmp/axis/qof.snap.txt
```

Notes:

- The runtime traces isolated letters directly.
- Each one-letter input is wrapped as `□ letter □`, so the operative letter step is token index `1`.
- Conclusions below refer to the post-letter snapshot at `deep_trace[1].phases[token_exit].snapshot`, not the trailing boundary reset.
- In the isolated-word baseline case, both letters select `Ω` as the source rather than the word baseline handle `C:1:1`.

Raw artifacts:

- `.tmp/axis/he.snap.json`
- `.tmp/axis/he.snap.txt`
- `.tmp/axis/qof.snap.json`
- `.tmp/axis/qof.snap.txt`

## Results

### `ה`

Observed operative step:

- head allocation: yes, `ה:1:1`
- adjunct or leg allocation: yes, `ה:1:2`
- export or accessibility relation on adjunct:
  - `sub(ה:1:1, ה:1:2)`
  - `adjuncts["ה:1:1"] = ["ה:1:2"]`
  - event payload includes `exported_adjuncts = ["ה:1:2"]`
- adjunct separately selectable from head: yes
- `F` lands on: head `ה:1:1`

Observed graph state after the letter step:

- `head_of = ["ה:1:1->Ω"]`
- `carry = ["Ω->ה:1:1", "ה:1:1->ה:1:2"]`
- `cont = ["Ω->ה:1:1", "ה:1:1->ה:1:2"]`
- `supp = ["ה:1:1->Ω", "ה:1:2->ה:1:1"]`
- `sub = ["ה:1:1->ה:1:2"]`
- `adjuncts = { "ה:1:1": ["ה:1:2"] }`

Observed handle metadata:

- head `ה:1:1`: `backed_head = 1`, `detached_leg = "ה:1:2"`
- adjunct `ה:1:2`: `detached_leg = 1`, `handle_label = "detached_adjunct_leg"`

Interpretation:

- the side leg is not passive ornament
- it is exported as an adjunct and can be selected separately from the head
- `F` still lands on the head, not on the adjunct

### `ק`

Observed operative step:

- head allocation: yes, `ק:1:1`
- adjunct or leg allocation: yes, `ק:1:2`
- export or accessibility relation on adjunct:
  - `sub(ק:1:1, ק:1:2)`
  - `adjuncts["ק:1:1"] = ["ק:1:2"]`
  - event payload includes `exported_adjuncts = ["ק:1:2"]`
- adjunct separately selectable from head: yes
- `F` lands on: head `ק:1:1`

Observed graph state after the letter step:

- `head_of = ["ק:1:1->Ω"]`
- `carry = ["Ω->ק:1:1", "ק:1:1->ק:1:2"]`
- `cont = ["Ω->ק:1:1", "ק:1:1->ק:1:2"]`
- `supp = []`
- `sub = ["ק:1:1->ק:1:2"]`
- `adjuncts = { "ק:1:1": ["ק:1:2"] }`

Observed handle metadata:

- head `ק:1:1`: `bare_head = 1`, `detached_leg = "ק:1:2"`
- adjunct `ק:1:2`: `detached_leg = 1`, `handle_label = "detached_adjunct_leg"`

Interpretation:

- the lower extension is likewise exported as a separately addressable adjunct
- it is not mere passive spine growth
- `F` still lands on the head, not on the adjunct

## Independent Access Check

Using the post-letter snapshots:

- current-focus selection after `ה` returns `["ה:1:1"]`
- exported-adjunct selection after `ה` returns `["ה:1:2"]`
- current-focus selection after `ק` returns `["ק:1:1"]`
- exported-adjunct selection after `ק` returns `["ק:1:2"]`

This shows that in both letters the side structure is separately addressable from the head.

## Comparison

Shared structure:

- head allocation
- detached leg allocation
- head-focused commit (`F` lands on head)
- explicit adjunct export through `sub(...)` plus the adjunct registry
- separate adjunct selectability

Substantive delta:

- `ה` is resolved or backed:
  - `supp(ה:1:1, Ω)`
  - `supp(ה:1:2, ה:1:1)`
- `ק` is unresolved:
  - no `supp` edges

So the extra lower extension does not change whether side access exists. It changes backing state.

## Step Table

| Token | Head allocation | Adjunct allocation | Exported adjunct | Adjunct separately selectable | `F` lands on |
| ----- | --------------- | ------------------ | ---------------- | ----------------------------- | ------------ |
| `ה`   | yes, `ה:1:1`    | yes, `ה:1:2`       | yes              | yes                           | head         |
| `ק`   | yes, `ק:1:1`    | yes, `ק:1:2`       | yes              | yes                           | head         |

## Conclusion

The hypothesis is supported.

- the side structure in this family changes addressability
- it is exported as a selectable adjunct rather than behaving as plain forward continuation
- the `ה` versus `ק` difference is backing or resolution, not whether side access exists

The extra stroke therefore has a real mechanical effect, and that effect is not indistinguishable from plain spine extension.

## Source Anchors

Implementation points that match the traces:

- `ה` constructs a resolved head-plus-leg form and exports the leg as an adjunct: `src/reference/letters/he.ts`
- `ק` constructs an unresolved head-plus-leg form and exports the leg as an adjunct: `src/reference/letters/qof.ts`
- `exposeHeadWithLeg(...)` allocates the head and leg, links them, and registers the leg as an exported adjunct: `src/reference/letters/headAdjunct.ts`
- exported adjunct selection is handled separately from current-focus selection: `src/reference/vm/select.ts`
