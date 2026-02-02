# Hebrew Operator VM (v0)

Implements a deterministic VM for the Hebrew operator calculus described in
`docs/mission-statement.md`.

## Quickstart

```bash
npm install
npm run build
```

## Determinism & obligations

* **Determinism:** handle IDs are allocated as `<letter>:<tau>:<counter>`; the
  same input and initial state always yield identical IDs and event logs.
* **Obligations:** letters can push `SUPPORT` or `MEM_ZONE` obligations onto
  `OStack_word`, plus a `BOUNDARY` obligation from `ב` closed by `ד`.
  Discharging letters pop the top obligation.
* **Whitespace → `□`:** any whitespace in input is tokenized as `□`, so spaces
  are semantic word boundaries.
* **Space boundary (`□`):** on a space token (or end-of-input), `tau` increments
  and any remaining obligations are resolved: `SUPPORT` falls (logging a `fall`
  event and restoring focus), and `MEM_ZONE` closes silently.

## Notes

See `docs/semantics-notes.md` for what is implemented versus stubbed.
