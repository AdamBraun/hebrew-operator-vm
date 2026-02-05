# Space (\square) — Time-step / boundary

Status: spec synced with `spec/60-VM.md`. Implementation may differ.

## Definition (from spec/60-VM)

Whitespace tokens execute the **space operator** and are also injected implicitly at the beginning and end of input.

Space behavior:

1. `τ := τ + 1`
2. Resolve **all** pending `OStack_word` obligations using boundary defaults.
3. Export the word result into the phrase accumulator: `A := A ⊕ [ seal_word(state) ]`
4. Reset word-local execution scope:
   - `OStack_word := []`
   - `F := Ω`
   - `R := ⊥`
   - `K := [F, R]`
5. Commit any buffered event batch to the event log.
6. Optional GC: delete handles not reachable from roots `{Ω, F} ∪ K ∪ W ∪ {R}`.

End-of-input behaves exactly like `□` (commit the final word into `A`).

## Signature

- Arity: req 0, opt 0.
- Operand kinds: none.
- Selection precedence: not applicable (VM operator).

## Tests

- `/tests/core/README.md#space`
