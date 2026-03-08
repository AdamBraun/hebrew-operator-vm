Golden test fixtures live in `tests/core/07_golden/cases/*.json`.

Continuation-family witness packs live in `tests/core/07_golden/continuation_family/*/`
with separate `trace.json`, `graph.json`, and `state.json` artifacts for the
smallest `ו/נ/ן/ז` cases.

Run `npm test` to ensure the serialized state matches the fixtures.
