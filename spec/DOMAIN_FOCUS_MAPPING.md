# Domain/Focus Mapping

## Purpose
Make domain mutation (`D`) explicit and rare, while keeping focus evolution (`F`) local and frequent through Seal.

## Audit Notes
- Search for legacy pointer writes: `rg -n "vm\\.Omega\\s*=" impl/reference/src tests spec` returned no runtime assignments.
- Runtime Seal rule remains centralized in [`impl/reference/src/vm/vm.ts`](/Users/adambraun/projects/letters/impl/reference/src/vm/vm.ts): after every letter Seal, the VM commits `F := sealed_handle`.

## Domain Write Whitelist
- `ב` MAY write `D`, and now does so only when `reframeDomain=1` (word-entry carrier case) in [`impl/reference/src/letters/bet.ts`](/Users/adambraun/projects/letters/impl/reference/src/letters/bet.ts).
- No other letter operator writes `D`.
- Non-operator lifecycle code may still reset/repair `D` (for example verse reset/GC), which is outside letter semantics.

## Operator Mapping
`Reads/Writes` below are operator-level effects in normal execution; Seal-register commit of `F` is runtime-global.

| Operator | Reads `D`? | Writes `D`? | Reads `F`? | Writes `F`? | Word-boundary sensitivity? |
|---|---|---|---|---|---|
| `א` | No | No | Yes | Yes (Seal commit) | Yes, uses word-entry focus baseline. |
| `ב` | Yes (`D_frame`) | **Yes (conditional)** | Yes | Yes (Seal commit) | Yes, reframe decision is word-entry-sensitive. |
| `ג` | No (direct) | No | Yes | Yes (Seal commit) | No direct boundary behavior. |
| `ד` | Yes (outside fallback) | No | Yes | Yes (Seal commit) | No direct boundary behavior. |
| `ה` | No | No | Yes | Yes (Seal commit) | Mild mode sensitivity (`breath` often word-final), not boundary-gated. |
| `ו` | No (direct) | No | Yes | Yes (Seal commit) | No direct boundary behavior. |
| `ז` | No | No | Yes | Yes (Seal commit) | No direct boundary behavior. |
| `ח` | Yes (outside fallback) | No | Yes | Yes (Seal commit) | No direct boundary behavior. |
| `ט` | No (direct) | No | Yes | Yes (Seal commit) | No direct boundary behavior. |
| `י` | No | No | Yes | Yes (Seal commit) | No direct boundary behavior. |
| `כ` | No (direct) | No | Yes | Yes (Seal commit) | No direct boundary behavior. |
| `ך` | No (direct) | No | Yes | Yes (Seal commit) | No direct boundary behavior. |
| `ל` | Yes (domain input fallback) | No | Yes | Yes (Seal commit) | No direct boundary behavior. |
| `מ` | No | No | Yes | Yes (Seal commit) | Yes, opens `MEM_ZONE` obligation resolved later (`ם`/`□`). |
| `ם` | No | No | Yes | Yes (Seal commit) | Yes, consumes/synthesizes mem-zone close in word scope. |
| `נ` | No | No | Yes | Yes (Seal commit) | Yes, opens `SUPPORT` obligation resolved by `ס` or `□`. |
| `ן` | No | No | Yes | Yes (Seal commit) | Yes, support-stack interaction is word-scoped. |
| `ס` | No | No | Yes | Yes (Seal commit) | Yes, may discharge pending support before boundary fall. |
| `ע` | No (direct) | No | Yes | Yes (Seal commit) | No direct boundary behavior. |
| `פ` | Yes (target fallback) | No | Yes | Yes (Seal commit) | No direct boundary behavior. |
| `ף` | Yes (target fallback) | No | Yes | Yes (Seal commit) | No direct boundary behavior. |
| `צ` | No (direct) | No | Yes | Yes (Seal commit) | No direct boundary behavior. |
| `ץ` | No (direct) | No | Yes | Yes (Seal commit) | No direct boundary behavior. |
| `ק` | No (direct) | No | Yes | Yes (Seal commit) | No direct boundary behavior. |
| `ר` | Yes (outside fallback) | No | Yes | Yes (Seal commit) | No direct boundary behavior. |
| `ש` | No | No | Yes | Yes (Seal commit) | No direct boundary behavior. |
| `שׁ` | No | No | Yes | Yes (Seal commit) | Same as `ש`. |
| `שׂ` (composite) | No (direct) | No | Yes | Yes (Seal commit) | Same boundary sensitivity as read-rail `ס`. |
| `ת` | Yes (outside fallback) | No | Yes | Yes (Seal commit) | Indirect: marks `wordLastSealedArtifact` consumed at boundary export. |
| `□` (space) | Yes (`F := D` reset path) | No | Yes | Yes (boundary reset) | Yes, it is the boundary operator. |

## Implementation Alignment
- `ב` now tags whether it opened a domain-carrier boundary (`domainCarrier`) and only then reframes `D`.
- `ל`, `מ`, `ם`, `י`, `כ`, `ד`, `ר` keep `D` stable; focus still evolves through Seal.

## Tests Added
- [`tests/core/02_vm/vm.domain-focus-mapping.test.ts`](/Users/adambraun/projects/letters/tests/core/02_vm/vm.domain-focus-mapping.test.ts)
  - Asserts `D` stability for non-reframing letters (`ל`, `מ`, `ם`, `י`, `כ`, `ד`, `ר`).
  - Asserts `ב` reframes at word-entry carrier baseline.
  - Asserts repeated `ב` deepening does not reframe `D` again within the same word.
