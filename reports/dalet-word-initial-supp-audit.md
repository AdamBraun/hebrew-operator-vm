# Dalet Word-Initial Supp Audit

- date: 2026-03-12
- scope: Test 5 falsification check for word-initial `ד`
- question: is word-initial `ד`'s `supp` structurally present but functionally dormant when no prior
  carries exist?

## Conclusion

No. In the current reference runtime, word-initial `ד` does not produce a dormant `supp`.

Instead, it emits both:

- `carry(W₀, h)`
- `supp(h, W₀)`

That means the support edge immediately resolves the carry created by the same operator. The support
is active, not dormant.

Separately, a manually constructed stray `supp` edge with no matching carry does not crash the
runtime. It is simply ignored by carry-resolution and `eff()`.

## Audit Setup

Hypothesis under test:

1. Word begins with focus `W₀`.
2. Apply `ד` on `W₀`.
3. Suppose only `head_of(h, W₀)`, `cont(W₀, h)`, and `supp(h, W₀)` are present.
4. Since no carry exists, `supp(h, W₀)` would be dormant.

Current implementation reality:

1. Word begins with focus `W₀`.
2. Apply `ד` on `W₀`.
3. Runtime emits:
   - `head_of(h, W₀)`
   - `cont(W₀, h)`
   - `carry(W₀, h)`
   - `supp(h, W₀)`
4. The newly emitted `supp(h, W₀)` resolves the newly emitted `carry(W₀, h)`.

So the premise "carry ledger is empty" is false for the shipped model.

## Code Evidence

Relevant implementation:

- `src/reference/letters/dalet.ts`
- `letters/ד.md`
- `src/reference/state/relations.ts:63-77`
- `src/reference/state/eff.ts:323-354`

Key facts:

- `ד` explicitly calls `addCarry(S, whole, headId)` and `addSupp(S, headId, whole)`.
- `addCarry` materializes both `cont(source, target)` and `carry(source, target)`.
- `addSupp` only inserts the `supp` back-edge.
- `eff()` iterates incoming carries, not standalone `supp` edges.

That last point matters for the dormant-supp safety question: a `supp` edge with no matching carry
does not participate in `eff()` at all.

## Existing Test Coverage

The repository already locks in the actual semantics of word-initial `ד`:

- `tests/letters/04_letters/dalet.behavior.test.ts`
  - at word start, `ד` emits `head_of`, `cont`, `carry`, and `supp`
  - its carry is resolved at token exit
- `tests/core/02_vm/edge-types.test.ts`
  - `ד` differs from `ר` by exactly one extra `supp` edge
  - both still emit the same `carry`
- `tests/core/02_vm/eff.dalet-resh.integration.test.ts`
  - `ד` is resolved where `ר` is unresolved

Executed on 2026-03-12:

```sh
npm test -- tests/letters/04_letters/dalet.behavior.test.ts \
  tests/core/02_vm/edge-types.test.ts \
  tests/core/02_vm/eff.dalet-resh.integration.test.ts
```

Result: 3 test files passed, 8 tests passed.

## Direct Reproduction A: Actual Word-Initial `ד`

A direct run of `runProgramWithDeepTrace("ד", createInitialState(), ...)` was executed with an
ambient witness on `Ω`.

Observed token-exit state:

```text
focus:
- ד:1:1

head_of:
- ד:1:1->Ω

cont:
- Ω->ד:1:1

carry:
- Ω->ד:1:1

supp:
- ד:1:1->Ω

boundaries:
- none
```

Resolution query:

```text
resolveCarry(state, Ω, ד:1:1, { focusNodeId: ד:1:1 })
=> { status: "resolved", closer: "ד:1:1" }
```

`eff()` query:

```text
eff(state, ד:1:1, { focusNodeId: ד:1:1 })
=> { ambient: 1 }
```

Interpretation:

- word-initial `ד` has a non-empty carry ledger
- its `supp` is not dormant
- the graph is well-formed and produces no errors

## Direct Reproduction B: Artificial Stray `supp` With No Carry

To answer the crash-safety falsification target directly, a manual state was also constructed with:

- `cont(Ω, h)`
- `supp(h, Ω)`
- no carry edge at all

Observed state:

```text
cont:
- Ω->h

carry:
- none

supp:
- h->Ω
```

Queries:

```text
eff(state, h, { focusNodeId: h })
=> {}

resolveCarry(state, Ω, h, { focusNodeId: h })
=> { status: "unresolved", closer: null }
```

Interpretation:

- dormant support does not crash the runtime
- `eff()` ignores it because there is no incoming carry to evaluate
- carry resolution also ignores it because there is no `carry(source, target)` record

## Falsification Outcome

The proposed word-initial `ד` scenario is falsified by the current implementation:

- the carry ledger is not empty
- `supp(h, W₀)` is not dormant
- word-initial `ד` is a self-resolving carry-support pair

The crash-safety concern is nevertheless answered:

- standalone dormant `supp` edges do not appear to cause errors, crashes, or unexpected state in
  the tested manual probe

## Architectural Ramification

This test reveals two distinct facts:

1. the shipped semantics of `ד` are stronger than the proposed setup
   - `ד` is not merely anchored to `W₀`
   - it actively creates and resolves its own carry
2. the resolution machinery does not require every `supp` to have a matching `carry`
   - unmatched `supp` is tolerated
   - it is simply inert because the resolution and `eff()` pipelines are carry-driven

So the genuine finding is:

- word-initial `ד` is not a dormant-support case in the current model
- dormant support, when injected manually, is already safely tolerated by the resolution machinery
