# Ayin Trace Validation

Method:

- Previous implementation: batch traces captured from the pre-rebuild `dist/` runtime, where `ע` was still the watch-based operator.
- Current implementation: rebuilt `dist/` from current `src/reference`, then re-ran the same `pasuk-trace` commands.
- Raw artifacts:
  - `.tmp/ayin-trace-compare/old/*.json`
  - `.tmp/ayin-trace-compare/new/*.json`

Compared words:

- `עין`
- `עני`
- `סע`
- `עון`
- `ענוה`

Supplemental control:

- `עס`

## Global semantic delta

Old `ע` behavior:

- allocated a single `watch` handle
- exported it through `W`
- emitted no `cont`, `carry`, or `supp` edges of its own

New `ע` behavior:

- allocates a continuation successor `F+`
- emits `cont(origin, F+)` and `carry(origin, F+)`
- allocates an alias handle to the origin and pushes that export to `K`
- leaves `W` empty

Net effect:

- every word containing `ע` now acquires an explicit unresolved carry unless that carry is later closed by `ס` or by `□hard`
- later letters no longer operate on a watch handle; they operate on the continuation successor produced by `ע`

## Word findings

### `עין`

Current trace is clean and matches the intended three-step reading:

- `ע` exports the origin and opens unresolved carry from the baseline node to `ע:1:1`
- `י` pins off `ע:1:1`
- `ן` commits its own local carry on top of the pinned node

Difference from old output:

- old trace had no `ע`-origin carry at all
- old trace kept `ע` as `watch` in `W`
- new trace replaces that with `ע:1:1` as scope successor plus `ע:1:2` as origin alias export in `K`

### `עני`

Current trace shows the intended exposed state:

- `ע` opens unresolved carry from the baseline to `ע:1:1`
- `נ` adds a second unresolved continuation/carry from `ע:1:1` to `נ:1:1`
- `י` pins from the exposed `נ` state

Difference from old output:

- old trace had only the `נ` carry (`ע:1:1 -> נ:1:1`)
- new trace has two-stage exposure: baseline `-> ע:1:1` and `ע:1:1 -> נ:1:1`

### `סע`

Literal `סע` does not realize the intended `ס`-after-`ע` closure pattern, because `ס` executes before `ע`.

Observed current trace:

- `ס` runs first and finds no unresolved carry
- `ע` then opens carry from the baseline to `ע:1:1`
- `□hard` closes that carry at word boundary, yielding `supp(ע:1:1, baseline)`

Difference from old output:

- old `סע` produced no carry at all, because old `ע` only created a watch handle
- new `סע` ends with a boundary-closed `ע` carry

Supplemental control `עס`:

- `ע` opens the carry
- following `ס` resolves it immediately with `supp(ע:1:1, baseline)`
- this is the mechanical `ס`/`ע` pairing the new semantics support

### `עון`

Current trace confirms persistence of `ע`'s carry through the word:

- `ע` opens baseline `-> ע:1:1`
- `ו` extends continuation without resolving that carry
- `ן` resolves only its own local carry (`ו:1:1 -> ן:1:1`)
- `□hard` finally closes the still-open `ע` carry, adding `supp(ן:1:1, baseline)`

Difference from old output:

- old trace had no `ע` carry to persist
- new trace carries `ע`'s unresolved origin all the way to the terminal node

### `ענוה`

Current longer-word trace shows stacked interactions:

- `ע` opens baseline `-> ע:1:1`
- `נ` adds unresolved `ע:1:1 -> נ:1:1`
- `ו` extends the chain
- `ה` resolves its own head/leg structure and also closes earlier unresolved carries reachable from the current focus

Observed final `supp` set in current trace:

- `ה:1:1 -> ו:1:1`
- `ה:1:1 -> C:1:1`
- `ה:1:1 -> ע:1:1`
- `ה:1:2 -> ה:1:1`

Difference from old output:

- old trace lacked the baseline `-> ע` carry, so `ה` could not close it
- new trace adds both the extra unresolved carry and the corresponding downstream resolution

## Conclusion

The new `ע` semantics are visible in traces immediately:

- `ע` no longer behaves as a passive persistent watcher
- it now contributes real continuation topology and unresolved carry state
- downstream letters and hard boundaries can resolve that state in mechanically traceable ways

The main user-facing implication is that words containing `ע` now participate in the same carry-resolution machinery as the `נ` family, with the one extra feature that `ע` exports the origin handle while advancing focus.
