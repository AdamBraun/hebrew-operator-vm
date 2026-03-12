# נ-ן Adjacent Carry Audit

- date: 2026-03-12
- scope: Test 2 falsification check for adjacent `נ` then `ן`
- question: does adjacent `ן` resolve the earlier `נ` carry?

## Conclusion

Two different answers are true, depending on where the check is taken.

1. Immediate adjacent composition, before any word-final boundary logic:
   - `carry(F, F1)` remains unresolved.
   - This matches the exact-source hypothesis.
2. Full runtime execution of the word `נן`, after the implicit trailing hard boundary:
   - the earlier carry becomes resolved.
   - the resolving support is not `ן`'s local `supp(F2, F1)` alone; it is an extra boundary-added
     `supp(F2, F)`.

So the current system does not implement local adjacent completion of `נ` by `ן`. It implements
boundary-assisted completion at word end.

## Audit Setup

Local adjacency setup under audit:

1. Start with focus `F`.
2. Apply `נ` on `F`.
   - emits `cont(F, F1)`
   - emits `carry(F, F1)`
   - focus becomes `F1`
3. Apply `ן` on `F1`.
   - emits `cont(F1, F2)`
   - emits `carry(F1, F2)`
   - emits `supp(F2, F1)`
   - focus becomes `F2`

Target carry:

- `carry(F, F1)`

Local support made available by adjacent `ן`:

- `supp(F2, F1)`

Under the resolver's exact-source rule, this local support does not match the earlier carry source
`F`, so the earlier carry stays unresolved.

## Code Evidence

Relevant implementation:

- `src/reference/state/eff.ts:256-294`
- `src/reference/letters/continuation_primitives.ts:51-72`
- `src/reference/letters/nun.ts`
- `src/reference/letters/finalNun.ts`
- `src/reference/vm/space.ts:105-136`
- `src/reference/vm/vm.ts:647-650`

Key facts:

- `נ` is built from `spawnCarryContinuationNode`, which emits `cont(source, child)` and
  `carry(source, child)`.
- `ן` is built from `spawnResolvedCarryNode`, which emits `cont(source, child)`,
  `carry(source, child)`, and `supp(child, source)`.
- the resolver only discharges `carry(source, target)` when some reachable node has
  `supp(_, source)` for that exact `source`.
- full word execution always appends an implicit trailing hard boundary, and hard boundaries close
  still-open carries by adding `supp(terminalNodeId, source)` for earlier unresolved sources in the
  current chunk lineage.

## Existing Test Coverage

The repository already constrains the rule shape that matters here:

- `tests/core/02_vm/carry-resolution.test.ts`
  - exact-source support resolves
  - off-chain or wrong-target support does not resolve
- `tests/core/02_vm/carry-gradient.test.ts`
  - `נ` alone is unresolved
  - `ן` alone is resolved
  - `נ` then hard boundary resolves through boundary-added support
- `tests/core/02_vm/resolution-axis-symmetry.test.ts`
  - the `נ`/`ן` pair mirrors the unresolved/resolved distinction used elsewhere

Executed on 2026-03-12:

```sh
npm test -- tests/core/02_vm/carry-resolution.test.ts \
  tests/core/02_vm/carry-gradient.test.ts \
  tests/core/02_vm/resolution-axis-symmetry.test.ts
```

Result: 3 test files passed, 16 tests passed.

## Direct Reproduction A: Adjacent `נ` Then `ן` Before Boundary

A manual unary-step reproduction was executed without applying a trailing boundary.

Observed graph:

```text
cont:
- Ω->נ:0:1
- נ:0:1->ן:0:1

carry:
- Ω->נ:0:1
- נ:0:1->ן:0:1

supp:
- ן:0:1->נ:0:1
```

Direct resolution queries:

```text
resolveCarry(state, Ω, נ:0:1, { focusNodeId: ן:0:1 })
=> { status: "unresolved", closer: null }

resolveCarry(state, נ:0:1, ן:0:1, { focusNodeId: ן:0:1 })
=> { status: "resolved", closer: "ן:0:1" }
```

Interpretation:

- adjacent `ן` resolves its own carry from `נ:0:1` to `ן:0:1`
- adjacent `ן` does not resolve the earlier `נ` carry from `Ω` to `נ:0:1`

This is the pure local answer to the test as stated.

## Direct Reproduction B: Full Runtime Word `נן`

A full word run of `runProgramWithDeepTrace("נן", createInitialState(), ...)` was also executed.

At `ן` token exit, before the final boundary:

```text
focus:
- ן:1:1

carry:
- C:1:1->נ:1:1
- נ:1:1->ן:1:1

supp:
- ן:1:1->נ:1:1
```

After full word execution completes, final state includes:

```text
supp:
- ן:1:1->נ:1:1
- ן:1:1->C:1:1
```

The extra `supp(ן:1:1, C:1:1)` is added by the implicit trailing hard boundary, not by the local
`ן` operator alone.

Resolution query on the completed word state:

```text
resolveCarry(state, C:1:1, נ:1:1, { focusNodeId: ן:1:1 })
=> { status: "resolved", closer: "ן:1:1" }
```

## Falsification Outcome

If the test is interpreted as a local adjacency claim, the hypothesis holds:

- adjacent `נ-ן` alone does not resolve the earlier `נ` carry
- the off-by-one issue is real at token-exit scope

If the test is interpreted as a full word-runtime claim, the hypothesis fails:

- the completed word `נן` ends with the earlier carry resolved
- but only because the VM's implicit trailing hard boundary adds a second support edge targeting the
  earlier source

## Architectural Ramification

The current continuation family is not locally complementary in the strong sense proposed by the
test.

What the runtime currently provides is weaker and more specific:

1. `ן` locally resolves only the carry whose source is its immediate parent.
2. earlier unresolved carries survive adjacent composition unchanged.
3. a hard word boundary can later collapse those earlier carries by adding support from the terminal
   node back to each earlier unresolved source in the chunk lineage.

So if the intended architecture is "adjacent final form completes the preceding unresolved form by
itself," the current implementation does not satisfy that invariant. It satisfies only
"adjacent final form plus word-final hard-boundary closure completes the earlier carry."
