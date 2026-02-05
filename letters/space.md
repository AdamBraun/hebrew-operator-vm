# □ — Space (boundary operator)

Status: implemented in reference interpreter (VM-level operator).

## Signature

- Arity: req 0, opt 0.
- Operand kinds: none.
- Selection precedence: not applicable (VM operator).

## Select

No selection; operates on VM registers and `OStack_word`.

## Bound

No bound phase; behavior is defined directly in `spec/60-VM.md`.

## Seal

Increments `τ`, resolves all pending word obligations by boundary defaults, exports the word result into phrase accumulator `A`, resets word-local execution scope, commits event batch, and optionally runs GC. See `spec/60-VM.md` for full ordering and `seal_word` rules.

## Obligations

Resolves all pending word-scoped obligations.

## Macro form

Not a letter; `□` is a runtime boundary step. End-of-input behaves exactly like `□`.

## Note (future)

Maqaf (`־`) is a future tied-words separator that will prevent the `□`-commit and join words. It is not implemented yet.

## Tests

- `/tests/core/README.md#space`
