# Post-Change Review: Unary ו

This note tracks the downstream definitions that should be re-reviewed after `ו`
was reduced to unary minimal continuation.

Base invariant for every review below:

- Plain `ו` only advances the spine: allocate one successor, add one `cont`,
  move focus to the successor.
- Plain `ו` does not create `carry`.
- Plain `ו` does not create `supp`.
- Plain `ו` does not perform grouping, partitioning, or binary joining.

## Review checklist

| Target                                                             | Why it may be affected                                                                                                              | Invariant that must still hold                                                                                                                                                                                  |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `נ / ן / ז` family alignment                                       | These letters were often explained relative to `ו`, so an older connective reading of `ו` can silently distort the family story.    | The forward shape stays aligned: `ו = cont`; `נ = cont + carry`; `ן = cont + supp` with focus advanced; `ז = cont + supp` with focus staying at the source and the exported committed-port structure preserved. |
| `ח`                                                                | `ח` is described as `ו + ז` under a roof. If `ו` is still read as a connector, the left side of the enclosure will be misdescribed. | Any `ו + ז` explanation must read as pure continuation plus a resolved port/gate, not as an intrinsic join performed by `ו`.                                                                                    |
| `ע`                                                                | `ע` uses persistence/watch-handle language that can accidentally smuggle carry into `ו` itself.                                     | Persistence must come from the watch registration / `נ`-like carried thread, not from `ו` carrying anything by itself. Base `ו` remains carryless.                                                              |
| Milui or composite docs using `ו`                                  | Older lore may treat `ו` as a conjunction/connective inside expansions such as `וו`, `ויו`, or `ואו`.                               | Milui must remain compositional: repeated `ו` means repeated continuation, and inserted letters contribute only their ordinary semantics.                                                                       |
| Any doc or composite that still calls `ו` a conjunction/connective | These are the most likely half-migrated descriptions after the semantic reduction.                                                  | If a two-sided join or transport story remains, it must live in the inserted letter or higher-layer composition, never in plain `ו`.                                                                            |

## Likely surfaces to inspect

- `letters/נ.md`
- `letters/ן.md`
- `letters/ז.md`
- `letters/ח.md`
- `letters/ע.md`
- `letters/ו.md`
- `README.md`
- `spec/60-VM.md`

Search terms that usually catch stale prose:

- `ו`
- `vav`
- `waw`
- `conjunction`
- `connective`
- `grouping`
- `transport`
- `וו`
- `ויו`
- `ואו`

## Runtime anchors

If prose is ambiguous, check the behavior against the current witnesses:

- `tests/letters/04_letters/continuation-family.behavior.test.ts`
- `tests/core/07_golden/continuation_family/`
