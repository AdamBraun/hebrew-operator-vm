# Layer Contracts

This document is the source-aligned contract for orthogonal layers under `src/`.

## Scope

- This contract governs `src/spine/**`, `src/layers/**`, `src/wrapper/**`, `src/ir/**`, and `src/cli/**`.
- If prose and implementation disagree, implementation behavior in `src/` is runtime authority and this document must be updated in the same change.
- Historical term mapping is frozen: "Normalization layer" means the Spine layer (`src/spine/**` plus `src/cli/build-spine.ts`).

## Source-Aligned Topology

| Layer                          | Source surface                                                                        | Inputs                                                                   | Outputs                                                         | Non-goal boundary                                           |
| ------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------- |
| Spine (Normalization)          | `src/spine/**`, `src/cli/build-spine.ts`                                              | Raw corpus text + normalization options                                  | `spine.jsonl`, `manifest.json`, `spineDigest`                   | No semantic selection (no layout/cantillation/VM semantics) |
| Letters                        | `src/layers/letters/**`, `src/cli/build-layer.ts --layer letters`                     | Spine grapheme/gap stream                                                | `letters.ir.jsonl`, layer manifest, digest                      | No niqqud/cantillation/layout semantics                     |
| Niqqud                         | `src/layers/niqqud/**`, `src/cli/build-layer-niqqud.ts`                               | Spine grapheme stream (`marks_raw.niqqud`)                               | `niqqud.ir.jsonl`, manifest, quality artifacts                  | No gap semantics and no peer-layer joins                    |
| Cantillation                   | `src/layers/cantillation/**`, `src/cli/build-layer.ts --layer cantillation`           | Spine grapheme+gap stream (`marks_raw.teamim`, gap punctuation evidence) | `cantillation.ir.jsonl`, manifest, optional stats               | No layout selection and no runtime semantics                |
| Layout                         | `src/layers/layout/**`, `src/cli/build-layer.ts --layer layout`                       | Spine gaps + layout dataset                                              | `layout.ir.jsonl`, manifest, digest                             | No trope/niqqud/VM interpretation                           |
| Metadata                       | `src/layers/metadata/**`, `src/cli/build-layer-metadata.ts`                           | Plan dataset + canonical Torah ref order                                 | `MetadataPlan.json`, manifest, digest                           | No anchor-level runtime semantics                           |
| Stitcher / Wrapper composition | `src/wrapper/stitch/**`, `src/wrapper/program_schema.ts`, `src/cli/stitch-program.ts` | Spine + all orthogonal IRs + MetadataPlan                                | `ProgramIR.jsonl`, `program.manifest.json`, `program.meta.json` | No new semantic inference beyond deterministic join rules   |
| IR contracts                   | `src/ir/**` and layer `schema.ts` modules                                             | N/A                                                                      | Shared types, identifiers, schema constants                     | No extraction/orchestration logic                           |

## Dependency Guardrails

| Producer module              | Allowed dependency families                                              |
| ---------------------------- | ------------------------------------------------------------------------ |
| `src/spine/**`               | `src/spine/**`, `src/ir/**`, `node:*`                                    |
| `src/layers/letters/**`      | `src/layers/letters/**`, `src/spine/**`, `src/ir/**`, `node:*`           |
| `src/layers/niqqud/**`       | `src/layers/niqqud/**`, `src/spine/**`, `src/ir/**`, `node:*`            |
| `src/layers/cantillation/**` | `src/layers/cantillation/**`, `src/spine/**`, `src/ir/**`, `node:*`      |
| `src/layers/layout/**`       | `src/layers/layout/**`, `src/spine/**`, `src/ir/**`, `node:*`            |
| `src/layers/metadata/**`     | `src/layers/metadata/**`, `src/ir/**`, `node:*`                          |
| `src/wrapper/**`             | `src/wrapper/**`, `src/spine/**`, `src/layers/**`, `src/ir/**`, `node:*` |

Cross-layer joins are forbidden inside `src/layers/*`; they are allowed only in wrapper stitching.

## Decision Register

### LAY-001: Directory boundaries are architecture boundaries

Decision: Layer ownership is mapped 1:1 to `src/` directories listed in this document.
Rationale: Prevents implicit coupling and keeps orthogonality auditable.
Enforcement: Directory layout in `src/`; contract checks in `src/wrapper/stitch/contractChecks.ts`.
Consequence: Moving logic across layer directories is an architectural change and must be documented.

### LAY-002: Spine is the anchor authority

Decision: `gid` and `gapid` are created only by the Spine layer.
Rationale: A single anchor authority is required for deterministic joins.
Enforcement: `src/spine/build.ts`, `src/spine/schema.ts`, `src/wrapper/stitch/spinePlan.ts`.
Consequence: Downstream layers reference anchors only; they do not mint or reindex anchors.

### LAY-003: Orthogonal analyzers live only under `src/layers/*`

Decision: Letters, Niqqud, Cantillation, Layout, and Metadata are independent analyzers.
Rationale: Orthogonality allows isolated cache invalidation and independent testing.
Enforcement: Dedicated build CLIs and manifests for each layer.
Consequence: Layer digest changes should be explainable by that layer's inputs/config/code only.

### LAY-004: Letters emits operator inventory only

Decision: Letters produces `letter_ir` rows keyed by `gid` with optional whitespace-based word segmentation.
Rationale: Keep letter identity extraction independent from mark and boundary semantics.
Enforcement: `src/layers/letters/extract.ts`, `src/layers/letters/schema.ts`.
Consequence: Letters must not read NiqqudIR, CantillationIR, or LayoutIR.

### LAY-005: Niqqud is grapheme-local and gap-agnostic

Decision: Niqqud reads only grapheme niqqud marks and emits grapheme-local modifier payloads.
Rationale: Modifier classification must remain independent of boundaries and peer-layer signals.
Enforcement: `src/layers/niqqud/spine_view.ts`, `src/layers/niqqud/mods.ts`, `src/layers/niqqud/schema.ts`.
Consequence: No `gapid` output and no cross-layer dependency in niqqud extraction.

### LAY-006: Cantillation emits anchor-scoped events, not full semantics

Decision: Cantillation outputs `cant_event` anchored to `gid` or `gap`.
Rationale: Preserve trope/punctuation evidence without forcing runtime policy at extraction time.
Enforcement: `src/layers/cantillation/extract.ts`, `src/layers/cantillation/schema.ts`.
Consequence: Derived runtime behavior remains wrapper/runtime policy, not layer extraction policy.

### LAY-007: Layout is the sole producer of layout event classes

Decision: `SPACE`, `SETUMA`, `PETUCHA`, and `BOOK_BREAK` are emitted only by LayoutIR.
Rationale: Prevents layout signal drift across layers.
Enforcement: `src/layers/layout/extract.ts`, `src/layers/layout/schema.ts`, wrapper contamination checks.
Consequence: Spine records preserve raw evidence only; they do not classify layout events.

### LAY-008: Metadata is RefKey-scoped, never anchor-scoped

Decision: Metadata checkpoints are keyed by `RefKey` and attached later to plan indices.
Rationale: Metadata serves packaging/navigation and must not depend on grapheme/gap anchors.
Enforcement: `src/layers/metadata/buildMetadataPlan.ts`, `src/ir/metadata_ir.ts`, `src/wrapper/stitch/metadataAttach.ts`.
Consequence: Metadata remains stable even when non-RefKey anchor internals evolve.

### LAY-009: Wrapper stitching is the only composition point

Decision: Cross-layer joins happen only in wrapper stitching.
Rationale: A single join location centralizes validation, ordering, and contamination checks.
Enforcement: `src/wrapper/stitch/stitch.ts`, `src/wrapper/stitch/loaders.ts`, `src/wrapper/program_schema.ts`.
Consequence: `src/layers/*` must stay join-free and can be reasoned about independently.

### LAY-010: Deterministic ordering is mandatory per layer and at stitch

Decision: Every layer stream and stitched stream must be in canonical deterministic order.
Rationale: Byte-stable outputs are required for cache reuse, reproducibility, and diffability.
Enforcement: schema comparators and strict-order checks across `src/layers/*/schema.ts` and `src/wrapper/stitch/stitch.ts`.
Consequence: Non-canonical order is a contract failure, not a warning.

### LAY-011: Contamination checks are explicit and fail-fast

Decision: Stitch-time guardrails reject tokens/keys that indicate semantic bleed between layers.
Rationale: Orthogonality cannot rely on convention alone.
Enforcement: `src/wrapper/stitch/contractChecks.ts`.
Consequence: Violations block program build and require source-layer correction.

### LAY-012: Layer manifests include orthogonal digest bases

Decision: Each layer manifest/digest includes only its allowed input digests, config digests, and code fingerprints.
Rationale: Correct cache invalidation depends on orthogonal digest inputs.
Enforcement: `src/ir/layer_manifest_core.ts` and per-layer hash/emit modules.
Consequence: Digest basis expansion or contraction is a contract-level change.

### LAY-013: CLI surface mirrors layer split

Decision: Build commands are split by layer (`build-spine`, `build-layer`, `build-layer-niqqud`, `build-layer-metadata`, `stitch-program`).
Rationale: Operational interfaces should reflect architecture boundaries.
Enforcement: `src/cli/*.ts`.
Consequence: Adding/removing layer CLIs requires spec updates and migration notes.

### LAY-014: Runtime state is out of scope for all orthogonal layers

Decision: VM/runtime state belongs to execution layers, not extraction/stitching layers.
Rationale: Keeps data products pure and replayable.
Enforcement: Program runtime-state contamination guard in `src/wrapper/stitch/contractChecks.ts`.
Consequence: Any new runtime fields in layer IR is a contract violation unless explicitly versioned and approved.

### LAY-015: Every architectural decision change must be documented here

Decision: Any change to boundaries, authority, or digest basis must update this decision register.
Rationale: Architecture drift is usually documentation drift first.
Enforcement: Code review requirement; this file is normative.
Consequence: Boundary-changing PRs are incomplete without decision entries and affected-doc links.

## Detailed Contracts

- [Spine (Normalization) Layer Contract](./NORMALIZATION_LAYER.md)
- [Letters Layer Contract](./LAYERS/LETTERS.md)
- [Niqqud Layer Contract](./LAYERS/NIQQUD_LAYER.md)
- [Cantillation Layer Contract](./LAYER_CANTILLATION.md)
- [Layout Layer Contract](./LAYOUT_LAYER.md)
- [Layout Obligations](./LAYOUT_OBLIGATIONS.md)
- [Metadata Layer Contract](./METADATA_LAYER.md)
- [Metadata Plan IR Contract](./METADATA_PLAN_IR.md)
- [Stitcher Contract](./STITCHER_CONTRACT.md)
- [Wrapper Stitching Contract](./WRAPPER_STITCHING.md)
