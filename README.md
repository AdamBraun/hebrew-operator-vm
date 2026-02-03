# Hebrew Operator VM (v0)

Implements a deterministic VM for the Hebrew operator calculus defined in the
normative spec under `spec/`.

Reference interpreter source: `impl/reference/src/`.

## Quickstart

```bash
npm install
npm run build
```

## Determinism & obligations

- **Determinism:** handle IDs are allocated as `<letter>:<tau>:<counter>`; the
  same input and initial state always yield identical IDs and event logs.
- **Obligations:** letters can push `SUPPORT` or `MEM_ZONE` obligations onto
  `OStack_word`, plus a `BOUNDARY` obligation from `ב` closed by `ד`.
  Discharging letters pop the top obligation.
- **Whitespace → `□`:** any whitespace in input is tokenized as `□`, so spaces
  are semantic word boundaries.
- **Space boundary (`□`):** on a space token (or end-of-input), `tau` increments
  and any remaining obligations are resolved: `SUPPORT` falls (logging a `fall`
  event and restoring focus), and `MEM_ZONE` closes silently.

## Spaces Are Operators

Whitespace is not just formatting: it compiles to the `□` operator. This means
space inserts a **boundary** that can discharge obligations before the next
letter runs.

Examples:

- `"נ ס"` inserts `□` between letters, so the `SUPPORT` from `נ` falls **before** `ס`.
- `"נס"` keeps them in the same word, so `ס` can discharge the support.

## Spec & registry

- Spec overview: `spec/00-OVERVIEW.md`
- Machine truth: `registry/`

## Notes

See `impl/reference/STATUS.md` for what is implemented versus stubbed.
