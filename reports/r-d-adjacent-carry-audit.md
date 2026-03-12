# ר-ד Adjacent Carry Audit

- date: 2026-03-12
- scope: Test 1 falsification check for adjacent `ר` then `ד`
- question: does `supp(h_d, h_r)` resolve `carry(X, h_r)`?

## Conclusion

No. In the current reference runtime, `carry(X, h_r)` remains unresolved.

The resolver requires an exact source match: a carry `carry(source, target)` resolves only when the
forward `cont*` walk from `target` reaches some node `c` with `supp(c, source)`. Since adjacent
`ד` emits `supp(h_d, h_r)` rather than `supp(h_d, X)`, it can resolve only carries whose source is
`h_r`. It does not resolve the earlier carry whose source is `X`.

## Audit Setup

Tested configuration:

1. Start with construct `X`, focus = `X`.
2. Apply `ר` on `X`.
   - emits `head_of(h_r, X)`
   - emits `carry(X, h_r)`
   - focus becomes `h_r`
3. Apply `ד` on `h_r`.
   - emits `head_of(h_d, h_r)`
   - emits `carry(h_r, h_d)`
   - emits `supp(h_d, h_r)`
   - focus becomes `h_d` at token exit

Resolution target under audit:

- carry under test: `carry(X, h_r)`
- available support on the chain: `supp(h_d, h_r)`

## Code Evidence

The carry resolver checks `supp(current, source)` while traversing forward from `target`. There is
no widening step from `source` to a parent, antecedent, or `head_of` predecessor.

Relevant implementation:

- `src/reference/state/eff.ts:256-294`
- `src/reference/letters/resh.ts:27-38`
- `src/reference/letters/dalet.ts:27-38`

Key facts from those files:

- `ר` emits `head_of(h_r, X)` and `carry(X, h_r)`, with no `supp`.
- `ד` emits `head_of(h_d, h_r)`, `carry(h_r, h_d)`, and `supp(h_d, h_r)`.
- resolution succeeds only if some reachable node has `supp(_, source)` for the exact carry source.

## Existing Test Coverage

The repository already encodes the exact-source rule:

- `tests/core/02_vm/carry-resolution.test.ts`
  - proves resolution when a reachable node has `supp(c, source)`
  - proves non-resolution when support is off-chain
- `tests/core/02_vm/eff.dalet-resh.integration.test.ts`
  - proves `ד` is resolved and `ר` is unresolved when each is applied directly to `Ω`
- `tests/core/02_vm/resolution-axis-symmetry.test.ts`
  - proves the `ר`/`ד` distinction is exactly the same `carry` plus optional `supp` distinction

Executed on 2026-03-12:

```sh
npm test -- tests/core/02_vm/carry-resolution.test.ts \
  tests/core/02_vm/eff.dalet-resh.integration.test.ts \
  tests/core/02_vm/resolution-axis-symmetry.test.ts
```

Result: 3 test files passed, 9 tests passed.

## Direct Reproduction: `רד`

A direct runtime reproduction was executed against the built reference runtime for the word `רד`.

Observed graph at `ד` token exit:

```text
head_of:
- ד:1:1->ר:1:1
- ר:1:1->Ω

carry:
- Ω->ר:1:1
- ר:1:1->ד:1:1

supp:
- ד:1:1->ר:1:1
```

Direct resolution query:

```text
resolveCarry(state, "Ω", "ר:1:1", { focusNodeId: "ד:1:1" })
=> { status: "unresolved", closer: null }
```

Interpretation:

- the audited carry is `carry(Ω, ר:1:1)`
- the only reachable support is `supp(ד:1:1, ר:1:1)`
- because the support target is `ר:1:1` rather than `Ω`, the audited carry does not resolve

## Falsification Outcome

The falsification target does not trigger. The current system does not use a broader-than-exact
source match for carry resolution.

That means the present implementation commits to this behavior:

- `supp(h_d, h_r)` resolves `carry(h_r, h_d)`
- `supp(h_d, h_r)` does not resolve `carry(X, h_r)`

## Ramification

If adjacent `ר-ד` is intended to be a canonical complementary pair that completes `ר`'s earlier
carry, the current model does not implement that semantics. Achieving that behavior would require
one of these changes:

1. Broaden the resolution rule beyond exact source match.
2. Change `ד` so that in this composition it emits support for `X` rather than only for `h_r`.
3. Introduce an additional rule that maps head-backed support through `head_of`.
