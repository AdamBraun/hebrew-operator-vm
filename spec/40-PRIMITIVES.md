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

## Guarantees

- No letter or modifier introduces a new primitive beyond `{Y,V}`.
- Every modifier effect is a transformation of phase behavior or envelope traits.
