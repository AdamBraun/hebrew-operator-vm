# Phase A Verse Cleanup Contract

## Status

Normative for Phase A multi-verse execution.

This contract defines required behavior at **end-of-verse (sof-pasuk)** so per-verse artifacts are stable and no verse-local runtime state leaks into the next verse.

## End-of-Verse Trigger

A verse cleanup cycle MUST run when the interpreter reaches verse end:

- explicit sof-pasuk boundary (currently equivalent to boundary `mode=cut` with `rank>=3`), or
- implicit verse end supplied by the caller (for input that omits explicit punctuation).

## Two-Phase End-of-Verse Semantics

Cleanup is a strict two-phase sequence:

1. `Snapshot phase` (export)
2. `Reset phase` (prepare next verse)

`Reset phase` MUST run only after `Snapshot phase` succeeds.
If snapshot/export fails, execution MUST stop and MUST NOT continue to the next verse.

### 1) Snapshot Phase (Export Contract)

At sof-pasuk, the runtime MUST serialize a **verse artifact** that includes:

- verse identity (`book/chapter/verse` key),
- per-verse trace/events for that verse,
- per-verse VM graph snapshot: `handles`, `links`, `boundaries`, `rules`, `cont`,
- required metadata/version envelope used by existing trace contracts.

Notes:

- The dumped verse graph MAY contain verse-local handles such as `ל:*`, `ש:*`, `ת:*`, etc.
- Exported content MUST reflect state **before** reset.

Canonicalization requirements for stable artifacts:

- sort object keys deterministically before serialization,
- canonical-sort arrays that have set semantics:
  - `handles` by `id`,
  - `links` by `(from, to, label)`,
  - `boundaries` by `(id, inside, outside, anchor)`,
  - `rules` by `(priority, id, target)`,
  - `cont` by edge string.

### 2) Reset Phase (Runtime Baseline Contract)

Immediately after successful export, runtime MUST clear verse-local state and return to a known baseline for the next verse.

## Verse-Local Runtime State (MUST Reset)

The following are verse-local in Phase A and MUST NOT leak across verses:

- Handles created by verse execution (IDs shaped like `X:n:m`).
- Graph edges/relations:
  - `links`
  - `boundaries`
  - `rules`
  - `cont`
- Accumulators:
  - `A`
  - `phraseWordValues`
  - `H_phrase`
  - `H_committed`
  - `CNodes`
  - `PendingJoin`
- Obligations/frames:
  - `OStack_word`
  - `E`

To preserve per-verse determinism, the allocator epoch MUST also reset (logical time/counters used to build `X:n:m` IDs).

## State That Persists Across Verses (Phase A)

Only these persist:

- bootstrap handles:
  - `Ω` (`OMEGA_ID`)
  - `⊥` (`BOT_ID`)
- static config/registries loaded from disk (outside verse-local handle graph state).

No other handle, edge, frame, or accumulator may persist across verse boundaries in Phase A.

## Baseline Runtime State (Required After Reset)

Minimum required post-reset baseline:

| Field                                               | Required value                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| `vm.tau`                                            | `0`                                                                         |
| `vm.Omega`                                          | `Ω`                                                                         |
| `vm.F`                                              | `Ω`                                                                         |
| `vm.R`                                              | `⊥`                                                                         |
| `vm.K`                                              | `[Ω, ⊥]`                                                                    |
| `vm.W`                                              | `[]`                                                                        |
| `vm.E`                                              | `[]`                                                                        |
| `vm.OStack_word`                                    | `[]`                                                                        |
| `vm.A`                                              | `[]`                                                                        |
| `vm.H`                                              | `[]`                                                                        |
| `vm.phraseWordValues`                               | `[]`                                                                        |
| `vm.H_phrase`                                       | `[]`                                                                        |
| `vm.H_committed`                                    | `[]`                                                                        |
| `vm.PendingJoin`                                    | unset (`undefined`/`null`)                                                  |
| `vm.CNodes`                                         | root-only baseline (or equivalent empty baseline defined by implementation) |
| `vm.CStack`                                         | root-only baseline stack                                                    |
| `vm.LeftContextBarrier`                             | `null`                                                                      |
| `vm.wordHasContent`                                 | `false`                                                                     |
| `vm.wordLastSealedArtifact`                         | unset                                                                       |
| `vm.wordEntryFocus`                                 | `Ω`                                                                         |
| `vm.route_mode`, `vm.route_arity`                   | unset                                                                       |
| `vm.metaCounter` (or equivalent allocator counters) | empty/unset                                                                 |
| `state.handles`                                     | exactly `{Ω, ⊥}`                                                            |
| `state.links`                                       | `[]`                                                                        |
| `state.boundaries`                                  | `[]`                                                                        |
| `state.rules`                                       | `[]`                                                                        |
| `state.cont`                                        | empty set                                                                   |

## Stable Verse Graphs: Determinism Guarantees

Phase A MUST guarantee:

1. Running verse `N` alone vs as verse `N` in a multi-verse stream yields identical verse-`N` artifact.
2. Preferred equality target is byte-for-byte artifact equality.
3. If byte-for-byte is not practical, canonicalized equality MUST hold (same canonical JSON projection).
4. Verse `N` artifact MUST NOT reference non-bootstrap handles created in any other verse.
5. Next verse MUST start from the baseline state table above (`Omega=Ω`, `F=Ω`, `R=⊥`, etc.).

## Example (Genesis 1:1)

At end of Genesis 1:1, snapshot/export may include verse-local handles such as:

- `ל:...`
- `ש:...`
- `ת:...`

This is valid in the **dumped verse artifact**.

Immediately after export, reset MUST run so runtime becomes baseline:

- `state.handles = {Ω, ⊥}`
- `links = []`, `boundaries = []`, `rules = []`, `cont = ∅`
- `A = []`, `phraseWordValues = []`, `H_phrase = []`, `H_committed = []`
- `OStack_word = []`, `E = []`
- `Omega=Ω`, `F=Ω`, `R=⊥`, `K=[Ω,⊥]`, allocator counters reset

Therefore Genesis 1:2 begins from a clean baseline, with no residual `ל/ש/ת` graph state from Genesis 1:1.
