# Vav / Yod Axis Hypothesis

## Hypothesis

The VM distinguishes the primitive pair as follows:

- `ו`: pure vertical topology, expressed as focus movement
- `י`: pure lateral topology, expressed as cursor-bearing exported structure

Support criterion:

- `ו` should show focus movement without exported side access.
- `י` should show exported side access without focus movement.

Weakening criterion:

- `ו` creates exported side access, or
- `י` advances focus, or
- both letters behave as the same class of action.

## Method

Runtime used:

- current rebuilt `dist/` from `src/reference`

Commands:

```bash
npm run pasuk-trace -- --text='ו' --no-show-post-reset --no-print-report --out-json=.tmp/axis/vav.snap.json --out-report=.tmp/axis/vav.snap.txt
npm run pasuk-trace -- --text='י' --no-show-post-reset --no-print-report --out-json=.tmp/axis/yod.snap.json --out-report=.tmp/axis/yod.snap.txt
```

Notes:

- The runtime traces isolated letters directly.
- Each one-letter input is wrapped as `□ letter □`, so the operative letter step is token index `1`.
- Conclusions below refer to the post-letter snapshot at `deep_trace[1].phases[token_exit].snapshot`, not the later trailing-boundary reset.

Raw artifacts:

- `.tmp/axis/vav.snap.json`
- `.tmp/axis/vav.snap.txt`
- `.tmp/axis/yod.snap.json`
- `.tmp/axis/yod.snap.txt`

## Results

### `ו`

Observed operative step:

- selected operand(s): `["C:1:1"]`
- `F` changed: yes, `C:1:1 -> ו:1:1`
- handle/export created: handle `ו:1:1` created; no exported side handle
- `carry` edge created: no
- new selectable non-`F` target after step: no

Observed post-letter state:

- `vm.F = "ו:1:1"`
- `vm.K = ["Ω", "⊥", "ו:1:1"]`
- `cont = ["C:1:1->ו:1:1"]`
- `carry = []`

Interpretation:

- `ו` adds forward continuation.
- `ו` advances focus to the new node.
- `ו` does not create independent side access.

### `י`

Observed operative step:

- selected operand(s): `["C:1:1"]`
- `F` changed: no, remained `C:1:1`
- handle/export created: handle `י:1:1` created and exported as `pin`
- `carry` edge created: no
- new selectable non-`F` target after step: yes, `י:1:1`

Observed post-letter state:

- `vm.F = "C:1:1"`
- `vm.K = ["Ω", "⊥", "י:1:1"]`
- `cont = ["C:1:1->י:1:1"]`
- `carry = []`
- pin metadata on `י:1:1`: `pinOf = "C:1:1"`, `selectable_pin = 1`

Interpretation:

- `י` does not advance focus.
- `י` exports a side structure.
- The exported pin is independently selectable.

## Independent Selectability Check

Using the post-letter snapshots:

- current-focus selection after `ו` returns `["ו:1:1"]`
- generic unary operand selection after `ו` also returns `["ו:1:1"]`
- current-focus selection after `י` returns `["C:1:1"]`
- generic unary operand selection after `י` returns `["י:1:1"]`

This shows that `י` publishes a selectable target distinct from `F`, while `ו` does not.

## Step Table

| Token | Selected operand(s) | `F` changed | Handle/export created          | `carry` created | New selectable non-`F` target |
| ----- | ------------------- | ----------- | ------------------------------ | --------------- | ----------------------------- |
| `ו`   | `["C:1:1"]`         | yes         | handle `ו:1:1`; no side export | no              | no                            |
| `י`   | `["C:1:1"]`         | no          | handle `י:1:1`; exported pin   | no              | yes                           |

## Conclusion

The hypothesis is supported.

- `ו` behaves as focus movement without exported side access.
- `י` behaves as exported side access without focus movement.

Important nuance:

- both letters emit `cont`, not `carry`
- the axis distinction is not "continuation vs no continuation"
- the distinction is where the spawned node lands:
  - `ו`: spawned node becomes `F`
  - `י`: spawned node remains off-focus and is exported/selectable independently

## Source Anchors

Implementation points that match the traces:

- `ו` spawns a continuation node and returns it as the sealed handle: `src/reference/letters/vav.ts`
- `י` spawns a continuation node, records a `pin` event, exports that handle, and sets `advance_focus: false`: `src/reference/letters/yod.ts`
- register commit pushes the export to `K` and only advances `F` when `advance_focus !== false`: `src/reference/vm/vm.ts`
- generic operand selection consumes `K` before falling back to `F`: `src/reference/vm/select.ts`
