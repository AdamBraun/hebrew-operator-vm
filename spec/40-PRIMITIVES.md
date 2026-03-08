# Primitives

All letters and modifiers factor through **two primitives** only:

- `Y` (unary): seed / pin / handle initiation.
- `V` (binary): extension / channel / connection.

## Factorization contract

For each letter `ℓ`, there exists a normal-form factorization:

```
f_ℓ = Δ_ℓ ∘ V^{v(ℓ)} ∘ Y^{y(ℓ)}
```

- `Δ_ℓ` is a letter-specific placement/specification map that distributes primitive invocations across Select/Bound/Seal.
- `y(ℓ), v(ℓ) ∈ ℕ`, with default `{0,1}` unless `Δ_ℓ` declares higher multiplicity.
- This is a **normal form**, not a temporal claim: it does **not** require `Y` to run before `V` at runtime.

Every letter’s topology may contain the Y/V substrate structurally; the explicit letters י and ו are the degenerate cases where one shared primitive is itself the whole operator.

At the abstract topology level, every letter contains the continuation primitive.

The explicit letter י is the case where that primitive alone is the entire letter-level operation: allocate a pin, emit cont(anchor, pin), export the pin as selectable, and keep focus unchanged.

This note is structural, not a claim that every runtime letter execution must separately materialize an extra standalone י-node.

## Guarantees

- No letter or modifier introduces a new primitive beyond `{Y,V}`.
- Every modifier effect is a transformation of phase behavior or envelope traits.
