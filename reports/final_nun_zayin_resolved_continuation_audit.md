# Final Nun / Zayin Resolved-Continuation Audit

## Hypothesis

`ז` is best understood as lateralized resolved continuation:

- it shares the resolved continuation material of `ן`
- but its accessible point is exported while focus does not inherit the new endpoint

Support criterion:

- `ן` and `ז` share resolved continuation material
- `ז` exports side access and keeps focus fixed

Weakening criterion:

- `ז` does not export a selectable access-point
- `ז` is mechanically indistinguishable from `ן`

## Method

Runtime used:

- current rebuilt `dist/` from `src/reference`

Commands:

```bash
npm run pasuk-trace -- --text='ן' --no-show-post-reset --no-print-report --out-json=.tmp/axis/final-nun.snap.json --out-report=.tmp/axis/final-nun.snap.txt
npm run pasuk-trace -- --text='ז' --no-show-post-reset --no-print-report --out-json=.tmp/axis/zayin.snap.json --out-report=.tmp/axis/zayin.snap.txt
```

Notes:

- The runtime traces isolated letters directly.
- Each one-letter input is wrapped as `□ letter □`, so the operative letter step is token index `1`.
- Conclusions below refer to the post-letter snapshot at `deep_trace[1].phases[token_exit].snapshot`, not the trailing boundary reset.
- The immediate pre-letter focus is the word baseline handle `C:1:1`.

Raw artifacts:

- `.tmp/axis/final-nun.snap.json`
- `.tmp/axis/final-nun.snap.txt`
- `.tmp/axis/zayin.snap.json`
- `.tmp/axis/zayin.snap.txt`

## Results

### `ן`

Observed operative step:

- created graph edges:
  - `cont(C:1:1, ן:1:1)`
  - `carry(C:1:1, ן:1:1)`
  - `supp(ן:1:1, C:1:1)`
- `supp` present: yes
- export / port created: no separate export
- `F` changes: yes, `C:1:1 -> ן:1:1`

Observed post-letter state:

- `vm.F = "ן:1:1"`
- `vm.K = ["Ω", "⊥", "ן:1:1"]`
- `cont = ["C:1:1->ן:1:1"]`
- `carry = ["C:1:1->ן:1:1"]`
- `supp = ["ן:1:1->C:1:1"]`

Interpretation:

- `ן` realizes a resolved continuation endpoint
- the resolved node becomes focus
- no lateralized access-point is published beyond the focused endpoint itself

### `ז`

Observed operative step:

- created graph edges:
  - `cont(C:1:1, ז:1:1)`
  - `carry(C:1:1, ז:1:1)`
  - `supp(ז:1:1, C:1:1)`
- `supp` present: yes
- export / port created: yes, resolved port `ז:1:1`
- `F` changes: no, remains `C:1:1`

Observed post-letter state:

- `vm.F = "C:1:1"`
- `vm.K = ["Ω", "⊥", "ז:1:1", "ז:1:1"]`
- `cont = ["C:1:1->ז:1:1"]`
- `carry = ["C:1:1->ז:1:1"]`
- `supp = ["ז:1:1->C:1:1"]`
- resolved-port metadata on `ז:1:1`: `portOf = "C:1:1"`, `handle_label = "resolved_port"`

Interpretation:

- `ז` realizes the same resolved continuation material as `ן`
- the resolved point is exported instead of inherited as focus
- focus stays on the prior node while access is lateralized through the exported port

## Independent Access Check

Using the post-letter snapshots:

- current-focus selection after `ן` returns `["ן:1:1"]`
- generic unary operand selection after `ן` also returns `["ן:1:1"]`
- current-focus selection after `ז` returns `["C:1:1"]`
- generic unary operand selection after `ז` returns `["ז:1:1"]`

This shows:

- `ן` exposes only the focused resolved endpoint
- `ז` exposes a selectable resolved access-point distinct from current `F`

## Step Table

| Token | Created graph edges                                 | `supp` present | Export / port created                  | `F` changes |
| ----- | --------------------------------------------------- | -------------- | -------------------------------------- | ----------- |
| `ן`   | `cont`, `carry`, `supp` between `C:1:1` and `ן:1:1` | yes            | no separate export                     | yes         |
| `ז`   | `cont`, `carry`, `supp` between `C:1:1` and `ז:1:1` | yes            | yes, `ז:1:1` exported as resolved port | no          |

## Conclusion

The hypothesis is supported.

- `ן` and `ז` share the same resolved continuation substrate
- `ז` differs in accessibility, not in the underlying material graph
- `ז` exports the resolved point and keeps focus fixed

Important nuance:

- `ז` publishes the same handle twice into `K` in the observed trace
- once during `bound`
- once again through normal register commit via `export_handle`

That duplication does not change the semantic split relevant here:

- `ן`: resolved endpoint becomes `F`
- `ז`: resolved endpoint is available through export while `F` remains at the prior focus

## Source Anchors

Implementation points that match the traces:

- `ן` uses `spawnResolvedCarryNode(...)` and returns the resolved node as the sealed handle: `src/reference/letters/finalNun.ts`
- `ז` uses the same resolved-carry primitive, marks the node as a port, exports it, and sets `advance_focus: false`: `src/reference/letters/zayin.ts`
- `spawnResolvedCarryNode(...)` adds `cont`, `carry`, and `supp`: `src/reference/letters/continuation_primitives.ts`
- register commit pushes `export_handle ?? sealed` into `K` and advances `F` only when `advance_focus !== false`: `src/reference/vm/vm.ts`
- generic operand selection consumes `K` before falling back to `F`: `src/reference/vm/select.ts`
