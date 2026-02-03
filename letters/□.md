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

Increments `τ`, resolves all pending word obligations by boundary defaults, commits event batch, applies deterministic stack discipline, and optionally runs GC.

## Obligations

Resolves all pending word-scoped obligations.

## Macro form

Not a letter; `□` is a runtime boundary step.

## Tests

- `/tests/core/README.md#space`
