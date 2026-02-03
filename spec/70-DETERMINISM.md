# Determinism

Determinism is a core invariant.

## Required guarantees

For any program `P` and initial state `S0`:

- **Same input + same initial state** MUST yield the same:
  - handle IDs
  - event log
  - serialized final state

## ID generation

- Handle IDs MUST be generated through a single deterministic allocator.
- IDs MUST NOT depend on wall-clock time, randomness, or iteration order.

## Canonical ordering

All operations that could vary by iteration order MUST use canonical ordering:

- Sort keys before serialization.
- Resolve merge/tie-breaks using stable, explicit ordering rules.
- Avoid reliance on insertion order for semantic behavior.

## Replay

A serialized state MUST replay deterministically under the same program and registry.
