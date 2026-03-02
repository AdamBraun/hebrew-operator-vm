# Metadata Consumption Contract (Wrapper)

## Purpose

This document defines how the wrapper consumes `MetadataPlan` without changing semantics.

Metadata consumption is operational packaging only.

## Allowed Uses (Normative)

Wrapper consumption of `MetadataPlan` is limited to:

1. scheduling checkpoint snapshots (state serialization) at checkpoint `ordinal` boundaries,
2. deriving deterministic output folders for parasha/aliyah packaging,
3. building navigation indexes for lookup/UI.

## Forbidden Uses (Normative)

Metadata consumption MUST NOT:

1. trigger `cut`/`glue`,
2. flush any workspace,
3. force GC,
4. mutate VM/runtime state,
5. alter opcode ordering or emitted semantic operations.

Engineering note:

- semantics-preserving GC is not defined by default; treat as forbidden unless explicitly versioned in a future contract.

## Runtime Modes

Wrapper metadata mode:

- `on` (default): consume provided `MetadataPlan`.
- `off`: disable metadata-driven checkpoint/folder/nav features.

When mode is `off`, wrapper execution semantics must remain identical to mode `on` for the same semantic layer inputs.

Only metadata-derived outputs may differ (for example checkpoint counts, metadata digests, packaging/navigation sidecars).

## Determinism

For a fixed `MetadataPlan` and fixed corpus traversal order:

- snapshot schedule is deterministic,
- folder mapping is deterministic,
- navigation indices are deterministic.

Wrapper metadata consumption must be pure/read-only with respect to VM state.

## Reference Interface

Implementation reference lives at:

- `src/wrapper/checkpoints/metadata.ts`
