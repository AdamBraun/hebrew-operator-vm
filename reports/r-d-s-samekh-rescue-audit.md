# ר-ד-ס Samekh Rescue Audit

- date: 2026-03-12
- scope: Test 4 falsification check for `ר-ד-ס`
- question: does `ס` rescue the earlier `ר` carry after `ד` fails to resolve it?

## Conclusion

Yes.

Under the current reference runtime:

1. `ר` opens `carry(X, h_r)`.
2. adjacent `ד` does not resolve that carry, because its local support is only `supp(h_d, h_r)`.
3. `ס` at focus `h_d` walks backward along the `cont` lineage, finds the nearest unresolved carry
   source, and adds `supp(h_d, X)`.
4. that new support resolves the earlier carry `carry(X, h_r)`.

So the test hypothesis holds: the `ר` carry becomes resolved only after `ס` intervenes.

## Audit Setup

Local setup under audit:

1. Start with construct `X`, focus = `X`.
2. Apply `ר` on `X`.
   - emits `head_of(h_r, X)`
   - emits `carry(X, h_r)`
   - focus becomes `h_r`
3. Apply `ד` on `h_r`.
   - emits `head_of(h_d, h_r)`
   - emits `carry(h_r, h_d)`
   - emits `supp(h_d, h_r)`
   - focus becomes `h_d`
4. Apply `ס` on `h_d`.
   - walks backward from `h_d`
   - sees `carry(h_r, h_d)` already resolved by `supp(h_d, h_r)`
   - then sees `carry(X, h_r)` still unresolved
   - emits `supp(h_d, X)`
   - keeps focus at `h_d`

Carry under audit:

- `carry(X, h_r)`

Support ledger after `ס`:

- `supp(h_d, h_r)` from `ד`
- `supp(h_d, X)` from `ס`

Under the resolver's exact-source rule, `supp(h_d, X)` is the edge that discharges
`carry(X, h_r)`.

## Code Evidence

Relevant implementation:

- `src/reference/state/eff.ts:256-294`
- `src/reference/letters/resh.ts`
- `src/reference/letters/dalet.ts`
- `src/reference/letters/samekh.ts:17-120`
- `letters/ס.md`

Key facts:

- `ר` emits `head_of(h_r, X)` and `carry(X, h_r)`, with no support.
- `ד` emits `head_of(h_d, h_r)`, `carry(h_r, h_d)`, and `supp(h_d, h_r)`.
- the resolver discharges a carry only when some reachable node has `supp(_, source)` for the
  exact carry source.
- `ס` selects the current focus, walks backward through `cont`, inspects incoming carries at each
  visited node, and chooses the nearest unresolved source.
- if such a source exists, `ס` emits `supp(focus, source)` and keeps focus unchanged.

## Existing Test Coverage

The repository already constrains the rescue behavior that matters here:

- `tests/letters/04_letters/samekh.behavior.test.ts`
  - `ס` adds `supp(F, s)` for the nearest unresolved carry source
  - it skips already-resolved chains
  - repeated `ס` invocations can close earlier carries after nearer ones are resolved
- `tests/core/02_vm/carry-gradient.test.ts`
  - `נ` then `ס` resolves the current unresolved carry
  - two unresolved carries are closed nearest-first
- `tests/core/02_vm/carry-resolution.test.ts`
  - exact-source support is the actual resolution rule

Executed on 2026-03-12:

```sh
npm test -- tests/letters/04_letters/samekh.behavior.test.ts \
  tests/core/02_vm/carry-gradient.test.ts \
  tests/core/02_vm/carry-resolution.test.ts
```

Result: 3 test files passed, 19 tests passed.

## Direct Reproduction A: Local `ר` Then `ד`

A manual unary-step reproduction was executed without `ס`.

Observed graph:

```text
cont:
- Ω->ר:0:1
- ר:0:1->ד:0:1

carry:
- Ω->ר:0:1
- ר:0:1->ד:0:1

supp:
- ד:0:1->ר:0:1

head_of:
- ר:0:1->Ω
- ד:0:1->ר:0:1
```

Resolution status at this point:

```text
resolveCarry(state, Ω, ר:0:1, { focusNodeId: ד:0:1 })
=> { status: "unresolved", closer: null }

resolveCarry(state, ר:0:1, ד:0:1, { focusNodeId: ד:0:1 })
=> { status: "resolved", closer: "ד:0:1" }
```

Interpretation:

- `ד` resolves only its own local carry from `ר:0:1` to `ד:0:1`
- the earlier `ר` carry from `Ω` to `ר:0:1` remains unresolved

## Direct Reproduction B: Local `ר` Then `ד` Then `ס`

The same local reproduction was then extended with `ס`.

Observed graph after `ס`:

```text
cont:
- Ω->ר:0:1
- ר:0:1->ד:0:1

carry:
- Ω->ר:0:1
- ר:0:1->ד:0:1

supp:
- ד:0:1->ר:0:1
- ד:0:1->Ω

head_of:
- ר:0:1->Ω
- ד:0:1->ר:0:1
```

Resolution status after `ס`:

```text
resolveCarry(state, Ω, ר:0:1, { focusNodeId: ד:0:1 })
=> { status: "resolved", closer: "ד:0:1" }

resolveCarry(state, ר:0:1, ד:0:1, { focusNodeId: ד:0:1 })
=> { status: "resolved", closer: "ד:0:1" }
```

Interpretation:

- `ס` leaves focus at `ד:0:1`
- `ס` adds `supp(ד:0:1, Ω)`
- that new support rescues the earlier unresolved `ר` carry

## Direct Reproduction C: Full Runtime Word `רדס`

A full word run of `runProgramWithDeepTrace("רדס", createInitialState(), ...)` was also executed.

At `ס` token exit:

```text
focus:
- ד:1:1

carry:
- Ω->ר:1:1
- ר:1:1->ד:1:1

supp:
- ד:1:1->ר:1:1
- ד:1:1->Ω

head_of:
- ד:1:1->ר:1:1
- ר:1:1->Ω
```

Final state support set matches the `ס` token-exit support set:

```text
supp:
- ד:1:1->ר:1:1
- ד:1:1->Ω
```

So in this case the rescue is already complete at `ס` token exit. No extra trailing hard-boundary
support is needed to close the earlier carry.

## Falsification Outcome

The falsification target holds:

- adjacent `ר-ד` does not complete the earlier `ר` carry
- `ס` repairs that failure by adding exact-source support for the older unresolved carry

So `ס` is indeed structurally load-bearing for this kind of in-word rescue.

## Architectural Ramification

This does not mean `ס` is required for all carry resolution.

The current runtime has three distinct closure modes:

1. local self-resolution by resolved letters such as `ד` or `ן`
   - these resolve only carries whose source is their immediate parent
2. explicit in-word rescue by `ס`
   - this closes the nearest unresolved upstream carry by exact-source support
3. hard-boundary closure
   - this can add terminal support for older unresolved sources at word end

The genuine finding from this test is narrower and important:

- when adjacent local pairing fails to resolve an older upstream carry, `ס` is the first explicit
  in-word mechanism that repairs it
- in the current flipped model, `ס` is therefore more fundamental than a mere optional companion;
  it is the generic nearest-unresolved carry rescue operator
