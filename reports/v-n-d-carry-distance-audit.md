# ו-נ-ד Carry Distance Audit

- date: 2026-03-12
- scope: Test 3 falsification check for `ו-נ-ד`
- question: can `ד` resolve a carry opened two steps earlier by `נ`?

## Conclusion

Again the answer splits by scope.

1. Immediate local composition, before any trailing boundary logic:
   - the earlier carry stays unresolved
   - this matches the exact-source hypothesis
2. Full runtime execution of the word `ונד`, after the implicit trailing hard boundary:
   - the earlier carry becomes resolved
   - the resolving support is not local `supp(h, F2)` alone; it is an extra boundary-added
     `supp(h, F1)`

So the off-by-one is real in local composition and it does compound with distance. The current VM
only neutralizes it later through hard-boundary carry closure.

## Audit Setup

Local setup under audit:

1. Start with focus `F`.
2. Apply `ו` on `F`.
   - emits `cont(F, F1)`
   - focus becomes `F1`
3. Apply `נ` on `F1`.
   - emits `cont(F1, F2)`
   - emits `carry(F1, F2)`
   - focus becomes `F2`
4. Apply `ד` on `F2`.
   - emits `head_of(h, F2)`
   - emits `cont(F2, h)`
   - emits `carry(F2, h)`
   - emits `supp(h, F2)`
   - focus becomes `h`

Carry under audit:

- `carry(F1, F2)`

Local support made available by `ד`:

- `supp(h, F2)`

Under the exact-source resolver, `supp(h, F2)` resolves the carry whose source is `F2`, namely
`carry(F2, h)`. It does not resolve the earlier carry whose source is `F1`.

## Code Evidence

Relevant implementation:

- `src/reference/state/eff.ts:256-294`
- `src/reference/letters/vav.ts`
- `src/reference/letters/nun.ts`
- `src/reference/letters/dalet.ts`
- `src/reference/vm/space.ts:105-136`
- `src/reference/vm/vm.ts:647-650`

Key facts:

- `ו` contributes only `cont(source, child)`.
- `נ` contributes `cont(source, child)` and `carry(source, child)`.
- `ד` contributes `head_of(h, source)`, `cont(source, h)`, `carry(source, h)`, and `supp(h, source)`.
- the resolver checks only for `supp(_, source)` with the exact carry source.
- full word execution appends an implicit trailing hard boundary.
- that hard boundary scans the current chunk lineage and adds `supp(terminalNodeId, source)` for
  each earlier unresolved carry source it finds.

## Existing Test Coverage

The repository already constrains the mechanisms that determine this outcome:

- `tests/core/02_vm/carry-resolution.test.ts`
  - exact-source support resolves
  - off-target support does not resolve
- `tests/core/02_vm/carry-gradient.test.ts`
  - unresolved carries remain unresolved until exact support exists
  - hard boundaries can add that support for earlier unresolved carries
- `tests/core/02_vm/resolution-axis-symmetry.test.ts`
  - resolved versus unresolved unary pairs are modeled uniformly through `carry` plus optional
    `supp`

Executed on 2026-03-12:

```sh
npm test -- tests/core/02_vm/carry-resolution.test.ts \
  tests/core/02_vm/carry-gradient.test.ts \
  tests/core/02_vm/resolution-axis-symmetry.test.ts
```

Result: 3 test files passed, 16 tests passed.

## Direct Reproduction A: Local `ו` Then `נ` Then `ד`

A manual unary-step reproduction was executed without applying a trailing boundary.

Observed graph:

```text
cont:
- Ω->ו:0:1
- ו:0:1->נ:0:1
- נ:0:1->ד:0:1

carry:
- ו:0:1->נ:0:1
- נ:0:1->ד:0:1

supp:
- ד:0:1->נ:0:1

head_of:
- ד:0:1->נ:0:1
```

Direct resolution query for the earlier carry:

```text
resolveCarry(state, ו:0:1, נ:0:1, { focusNodeId: ד:0:1 })
=> { status: "unresolved", closer: null }
```

Interpretation:

- `ד` resolves only its own local carry from `נ:0:1` to `ד:0:1`
- `ד` does not resolve the earlier `נ` carry from `ו:0:1` to `נ:0:1`

This is the direct answer to the test as stated.

## Direct Reproduction B: Full Runtime Word `ונד`

A full word run of `runProgramWithDeepTrace("ונד", createInitialState(), ...)` was also executed.

At `ד` token exit, before the final boundary:

```text
focus:
- ד:1:1

carry:
- ו:1:1->נ:1:1
- נ:1:1->ד:1:1

supp:
- ד:1:1->נ:1:1

head_of:
- ד:1:1->נ:1:1
```

After full word execution completes, final state includes:

```text
supp:
- ד:1:1->נ:1:1
- ד:1:1->ו:1:1
```

The extra `supp(ד:1:1, ו:1:1)` is added by the implicit trailing hard boundary, not by the local
`ד` operator itself.

Resolution query on the completed word state:

```text
resolveCarry(state, ו:1:1, נ:1:1, { focusNodeId: ד:1:1 })
=> { status: "resolved", closer: "ד:1:1" }
```

## Falsification Outcome

If the test is interpreted as a local-composition claim, the hypothesis holds:

- `ד`'s local support targets its own parent, not the earlier carry source
- the carry opened two steps earlier remains unresolved at token-exit scope

If the test is interpreted as a full word-runtime claim, the hypothesis fails:

- the completed word `ונד` ends with the earlier carry resolved
- but only because the implicit trailing hard boundary adds a second support edge to the earlier
  source

## Architectural Ramification

This confirms that the off-by-one is not accidental in local composition. Distance does not fix it.

What changes with distance is only what the trailing hard boundary has to repair:

1. local unary support still resolves only the carry whose source is the immediate parent
2. earlier carries remain open, even when the later letter is locally resolved
3. the hard boundary can collapse those earlier carries by adding support from the terminal node
   back to each unresolved earlier source in the lineage

So if the intended invariant is "a locally resolved letter can also discharge older upstream carries
without help," the current implementation does not satisfy it. It satisfies only "older upstream
carries can be closed later by hard-boundary closure at word end."
