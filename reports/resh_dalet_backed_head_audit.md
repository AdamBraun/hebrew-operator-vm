# Resh / Dalet Backed-Head Audit

## Hypothesis

Top-right augmentation correlates with head stabilization or backing rather than ordinary continuation.

Support criterion:

- both `ר` and `ד` expose a head
- `ד` adds stabilization or backing relative to `ר`

Weakening criterion:

- `ד` introduces unrelated machinery not readable as backed head
- `ר` already behaves as fully backed

## Method

Runtime used:

- current rebuilt `dist/` from `src/reference`

Commands:

```bash
npm run pasuk-trace -- --text='ר' --no-show-post-reset --no-print-report --out-json=.tmp/axis/resh.snap.json --out-report=.tmp/axis/resh.snap.txt
npm run pasuk-trace -- --text='ד' --no-show-post-reset --no-print-report --out-json=.tmp/axis/dalet.snap.json --out-report=.tmp/axis/dalet.snap.txt
```

Notes:

- The runtime traces isolated letters directly.
- Each one-letter input is wrapped as `□ letter □`, so the operative letter step is token index `1`.
- Conclusions below refer to the post-letter snapshot at `deep_trace[1].phases[token_exit].snapshot`, not the trailing boundary reset.
- In the isolated-word baseline case, both letters select `Ω` as the source rather than the word baseline handle `C:1:1`.

Raw artifacts:

- `.tmp/axis/resh.snap.json`
- `.tmp/axis/resh.snap.txt`
- `.tmp/axis/dalet.snap.json`
- `.tmp/axis/dalet.snap.txt`

## Results

### `ר`

Observed operative step:

- head object allocated: yes, `ר:1:1`
- `head_of(head, source)` added: yes, `head_of(ר:1:1, Ω)`
- `carry(source, head)` added: yes, `carry(Ω, ר:1:1)`
- `supp(head, source)` added: no
- `F` becomes the head: yes, `F = ר:1:1`

Observed exact edge state after the letter step:

- `head_of = ["ר:1:1->Ω"]`
- `carry = ["Ω->ר:1:1"]`
- `cont = ["Ω->ר:1:1"]`
- `supp = []`

Observed head metadata:

- `exposedBy = "ר"`
- `headOf = "Ω"`
- `bare_head = 1`

Interpretation:

- `ר` exposes a head and links it back to the source
- `ר` is not yet backed or stabilized

### `ד`

Observed operative step:

- head object allocated: yes, `ד:1:1`
- `head_of(head, source)` added: yes, `head_of(ד:1:1, Ω)`
- `carry(source, head)` added: yes, `carry(Ω, ד:1:1)`
- `supp(head, source)` added: yes, `supp(ד:1:1, Ω)`
- `F` becomes the head: yes, `F = ד:1:1`

Observed exact edge state after the letter step:

- `head_of = ["ד:1:1->Ω"]`
- `carry = ["Ω->ד:1:1"]`
- `cont = ["Ω->ד:1:1"]`
- `supp = ["ד:1:1->Ω"]`

Observed head metadata:

- `exposedBy = "ד"`
- `headOf = "Ω"`
- `backed_head = 1`

Interpretation:

- `ד` exposes the same basic head structure as `ר`
- `ד` adds backing or stabilization through `supp(head, source)`

## Comparison

Shared structure:

- head allocation
- `head_of(head, source)`
- `carry(source, head)`
- implied `cont(source, head)` via `addCarry`
- focus advancement onto the head

Substantive delta:

- `ר`: bare head, no `supp`
- `ד`: backed head, with `supp(head, source)`

No unrelated machinery appears in the isolated-letter trace.

The event labels and metadata match the same split:

- `ר`: `head_expose`, `bare_head = 1`
- `ד`: `head_backed`, `backed_head = 1`

## Step Table

| Token | Head allocated | `head_of(head, source)` | `carry(source, head)` | `supp(head, source)` | `F` becomes head |
| ----- | -------------- | ----------------------- | --------------------- | -------------------- | ---------------- |
| `ר`   | yes, `ר:1:1`   | yes                     | yes                   | no                   | yes              |
| `ד`   | yes, `ד:1:1`   | yes                     | yes                   | yes                  | yes              |

## Conclusion

The hypothesis is supported.

- both letters expose a head
- `ד` adds backing or stabilization relative to `ר`
- the only substantive added relation in `ד` is `supp(head, source)`

This means the top-right augmentation tracks a backed head rather than ordinary continuation.

## Source Anchors

Implementation points that match the traces:

- `ר` allocates a head, adds `head_of`, adds `carry`, and emits `head_expose`: `src/reference/letters/resh.ts`
- `ד` allocates a head, adds `head_of`, adds `carry`, adds `supp`, and emits `head_backed`: `src/reference/letters/dalet.ts`
- `addCarry(...)` adds both `cont` and `carry`: `src/reference/state/relations.ts`
- register commit advances `F` to the sealed handle unless told otherwise: `src/reference/vm/vm.ts`
