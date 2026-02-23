# Phase B Global Identity Graph Plan

## Status

Design plan for future implementation. This document is normative for Phase B scope and interfaces, but Phase B runtime code is not yet implemented.

## 1) Objectives

Phase B extends Phase A (`spec/phase-a-verse-cleanup.md`) by adding a persistent global identity layer that survives verse boundaries.

Required objectives:

- Build a persistent graph over the entire Torah without processing everything in one batch.
- Ensure stable identity across verses (no "new Moses each verse" when the mention should resolve to the same canonical entity).
- Keep the interpreter deterministic and bounded-memory.
- Preserve Phase A verse isolation: Phase B MUST NOT keep verse-local VM handles alive across verses.

### Non-Goals (Initial Phase B)

To prevent scope creep, Phase B v0 will not do the following:

- Full semantic coreference for difficult cases (metaphor, implicit referents, long-distance discourse beyond rolling context).
- Deep ontology design (event typing, temporal logic, theological taxonomy).
- Retroactive global re-write of prior edges after later evidence appears.
- Probabilistic/ML-based resolver behavior.
- Cross-language identity linking (Hebrew to English alias reconciliation beyond explicit registry keys).
- Real-time interpreter coupling; graph build remains a separate post-processing pipeline.

## 2) System Decomposition (Two-Plane Model)

Phase B uses two planes with strict boundaries.

### Plane A: Verse VM (Ephemeral)

- Source: current interpreter/runtime.
- Unit of work: one verse snapshot at a time.
- Lifespan: one verse execution.
- Artifacts: `VerseSnapshot` (`ref`, `cleaned`, `tau_end`, `state_dump`, metrics).
- Handle policy: verse-local handles (for example `ל:*`, `ש:*`, `ת:*`) are allowed in snapshots but MUST NOT be reused as global identities.

### Plane B: Global Identity Graph (Persistent)

- Source: consumes Phase A verse snapshots.
- Unit of work: stream of verse snapshots in canonical ref order.
- Lifespan: entire corpus run (and resumable across runs).
- Artifacts:
  - canonical entities (`EntityId`)
  - append-only relation edges
  - persistent registry (`normalized_key -> EntityId`)
  - small discourse state checkpoint
- Memory policy: only rolling discourse context is retained in memory; full graph is persisted incrementally.

### Cross-Plane Contract

- Plane A outputs immutable verse snapshots.
- Plane B reads snapshots and writes global graph storage.
- Plane B MUST treat `state_dump.handles` IDs as non-portable local evidence only.
- Provenance for every global relation MUST include a pointer back to the source verse snapshot.

## 3) Core Data Structures (Schemas)

All schemas below are normative for Phase B v0.

### 3.1 `EntityId`

Format:

```text
E:<entity_type>:<slug>
```

Where:

- `<entity_type>` is one of: `person`, `deity`, `place`, `nation`, `group`, `object`, `unknown`.
- `<slug>` is uppercase ASCII `[A-Z0-9_]+`.

Examples:

- `E:person:MOSHE`
- `E:deity:YHWH`
- `E:place:ERETZ`

Deterministic rule:

- For v0, `slug` is derived from normalized mention key and type.
- If first-seen mention creates the entity, the derived `EntityId` MUST be stable across reruns.

### 3.2 `Mention`

```ts
type RoleHypothesis = "subject" | "object" | "addressee" | "possessor" | "speaker" | "other";

type MentionKind = "proper_name" | "pronoun" | "title" | "nominal";

type ProvenancePointer = {
  ref_key: string; // ex: "Genesis/1/1"
  tau_end: number; // VerseSnapshot.tau_end
  snapshot_hash: string; // sha256 of canonical snapshot projection
};

type Mention = {
  mention_id: string; // deterministic: M:<ref_key>:<start>:<end>:<normalized_key>
  ref_key: string;
  token_span: { start: number; end: number }; // inclusive, 0-based word/token positions
  surface: string; // exact surface substring
  normalized_key: string; // canonical lookup key
  mention_kind: MentionKind;
  role_hypothesis: RoleHypothesis;
  entity_type_hint: "person" | "deity" | "place" | "nation" | "group" | "object" | "unknown";
  confidence: number; // [0, 1]
  provenance: ProvenancePointer;
};
```

### 3.3 `Relation`

```ts
type Relation = {
  edge_id: string; // deterministic hash of canonical relation payload
  predicate: string; // uppercase snake case, ex: "SPEAKS_TO"
  subject: string; // EntityId
  object: string; // EntityId
  confidence: number; // [0, 1]
  provenance: ProvenancePointer;
  evidence_mentions: {
    subject_mention_id?: string;
    object_mention_id?: string;
  };
};
```

Notes:

- `subject` and `object` MUST be canonical `EntityId`s at commit time.
- Provenance pointer is required for every edge.
- `edge_id` MUST be deterministic and collision-resistant (sha256 over canonical JSON payload).

### 3.4 `DiscourseState` (Rolling Context)

```ts
type DiscourseState = {
  lastSubject?: string; // EntityId
  lastObject?: string; // EntityId
  lastAddressee?: string; // EntityId
  focusStack: string[]; // EntityId stack, max length = 8 in v0
  lastRefProcessed?: string; // checkpoint ref
};
```

## 4) Projection Pipeline

Phase B pipeline is strict and deterministic:

```text
project -> resolve -> commit
```

### 4.1 Projection Function

```ts
projectVerse(verseSnapshot) -> { mentions, relations, debug }
```

Contract:

- Input: one Phase A `VerseSnapshot`.
- Output:
  - `mentions`: unresolved mentions (surface-level records).
  - `relations`: relation hypotheses with mention references (not yet canonicalized to entity IDs unless already resolved in-process).
  - `debug`: deterministic diagnostics (rule hits, dropped candidates, normalization traces).

Deterministic requirements:

- Use canonical tokenization for `verseSnapshot.cleaned`.
- Sort mentions by `(token_span.start, token_span.end, normalized_key)`.
- Sort relation hypotheses by `(predicate, subject_mention_id, object_mention_id)`.
- No wall-clock/random data in outputs.

### 4.2 Resolver Function

```ts
resolveMention(mention, registry, discourse) -> EntityId
```

v0 deterministic resolution order:

1. If `mention_kind === "pronoun"`:
   - consult discourse slot by role:
     - `subject` -> `lastSubject`
     - `object` -> `lastObject`
     - `addressee` -> `lastAddressee`
   - if found, return that entity.
2. Exact registry lookup by `normalized_key`:
   - if found, return mapped entity.
3. Create deterministic new `EntityId` from `entity_type_hint + normalized_key`.
4. Insert into registry (`normalized_key -> EntityId`) for non-pronoun mentions.
5. Return created entity.

Pronoun fallback:

- If step (1) fails and no registry rule applies, allocate deterministic unresolved entity:
  - `E:unknown:UNRESOLVED_<REF>_<START>_<END>`
- Unresolved pronoun entities are not registered as global key aliases in v0.

### 4.3 Commit Stage

Per verse, commit in one transaction:

1. Project mentions/relations from snapshot.
2. Resolve mentions to `EntityId`.
3. Materialize canonical relations (`subject`, `object` are `EntityId`).
4. Upsert any new entities and registry keys.
5. Append edges to global edge store (dedupe by `edge_id` unique index).
6. Update discourse state from resolved mentions/relations.
7. Advance checkpoint (`lastRefProcessed`).

Failure policy:

- On commit failure, rollback verse transaction.
- Builder MAY retry the same verse; output must remain idempotent due to deterministic IDs + unique constraints.

## 5) Persistence Strategy

Phase B storage uses:

- indexed entity/registry tables
- append-only edge storage
- tiny discourse checkpoint

### 5.1 Recommended SQLite Layout

File: `outputs/global-graph/latest/global_graph.sqlite`

```sql
CREATE TABLE IF NOT EXISTS entities (
  entity_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  canonical_key TEXT NOT NULL,
  display_label TEXT,
  first_seen_ref TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_type_key
  ON entities(entity_type, canonical_key);

CREATE TABLE IF NOT EXISTS entity_registry (
  normalized_key TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  first_seen_ref TEXT NOT NULL,
  last_seen_ref TEXT NOT NULL,
  FOREIGN KEY(entity_id) REFERENCES entities(entity_id)
);

CREATE INDEX IF NOT EXISTS idx_registry_entity_id
  ON entity_registry(entity_id);

CREATE TABLE IF NOT EXISTS global_edges (
  edge_seq INTEGER PRIMARY KEY AUTOINCREMENT,
  edge_id TEXT NOT NULL UNIQUE,
  predicate TEXT NOT NULL,
  subject_entity_id TEXT NOT NULL,
  object_entity_id TEXT NOT NULL,
  confidence REAL NOT NULL,
  ref_key TEXT NOT NULL,
  tau_end INTEGER NOT NULL,
  snapshot_hash TEXT NOT NULL,
  subject_mention_id TEXT,
  object_mention_id TEXT,
  FOREIGN KEY(subject_entity_id) REFERENCES entities(entity_id),
  FOREIGN KEY(object_entity_id) REFERENCES entities(entity_id)
);

CREATE INDEX IF NOT EXISTS idx_edges_subject
  ON global_edges(subject_entity_id);

CREATE INDEX IF NOT EXISTS idx_edges_object
  ON global_edges(object_entity_id);

CREATE INDEX IF NOT EXISTS idx_edges_ref
  ON global_edges(ref_key);

CREATE TABLE IF NOT EXISTS discourse_checkpoint (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload_json TEXT NOT NULL
);
```

### 5.2 JSONL Edge Option (Equivalent Append-Only Strategy)

Optional mirror/export file:

- `outputs/global-graph/latest/global_edges.jsonl`

Rules:

- one canonical relation row per line.
- append-only writes in canonical processing order.
- duplicates prevented by `edge_id` index in sqlite or by external dedupe pass.

### 5.3 Registry Normalization

`normalized_key` is produced by deterministic normalization pipeline:

1. trim + collapse whitespace
2. remove punctuation except joiners needed by lexical policy
3. optional transliteration/lexeme canonicalization
4. uppercase ASCII key

Normalization version MUST be tracked in builder metadata so reprocessing is reproducible.

### 5.4 Discourse State Persistence

- Persist discourse state after each successful verse commit.
- `focusStack` MUST be bounded (`max=8` in v0).
- On resume, load discourse checkpoint and continue from `lastRefProcessed + 1`.

## 6) Ambiguity Handling Roadmap

### v0 (Initial)

- Deterministic surface-key identity:
  - same `normalized_key` -> same `EntityId` (for non-pronouns).
- Pronouns resolved only from rolling discourse slots (`lastSubject`, `lastObject`, `lastAddressee`).
- If unresolved, emit deterministic `E:unknown:UNRESOLVED_*`.

### v1+ (Planned)

- Multi-candidate disambiguation for duplicate names.
- Scoped identity strategies (book, era, genealogy, narrative segment).
- Alias tables (`normalized_key -> multiple candidate entity IDs`) with deterministic tie-break ranking.
- Backfill/reconciliation workflows that add corrective edges rather than mutating old edges.

## 7) API Boundaries

### Interpreter Boundary (Phase A output)

- Interpreter remains responsible for verse execution + verse snapshots.
- No global identity logic in VM runtime.
- Required handoff artifact: `VerseSnapshot` rows (in-memory callbacks or persisted JSONL stream).

### Graph Builder Boundary (Phase B module/CLI)

- New standalone module/CLI consumes snapshots incrementally.
- Suggested CLI shape:
  - `phase-b build --snapshots <path> --out <dir> [--resume] [--from-ref ... --to-ref ...]`
- Builder owns:
  - projection (`projectVerse`)
  - resolution (`resolveMention`)
  - persistent graph commit
  - checkpointing and resume logic

Contract invariants:

- Builder does not mutate interpreter internals.
- Interpreter does not depend on graph builder runtime.

## 8) Test Plan and Invariants

### 8.1 Identity Stability Tests

- Same normalized surface across multiple verses resolves to same `EntityId`.
- Re-running the same snapshot stream from empty store yields byte-identical entity/edge outputs.
- Entity creation order is deterministic for identical input ordering.

### 8.2 Pronoun Resolution Tests

- `he/she/they`-class mentions resolve to discourse slots when available.
- Slot updates occur only from committed relations/roles.
- Unresolved pronouns produce deterministic `E:unknown:UNRESOLVED_*` IDs.

### 8.3 Stream Determinism (Chunking) Tests

Given identical verse order:

- one-pass full run == chunked run (for example chunk size 1 verse, 10 verses, per-book batches).
- resume-from-checkpoint run == uninterrupted run.
- resulting `entities`, `entity_registry`, and `global_edges` are identical (canonicalized compare).

### 8.4 Provenance and Storage Invariants

Required invariants:

1. Every edge has a valid provenance pointer (`ref_key`, `tau_end`, `snapshot_hash`).
2. Every edge subject/object exists in `entities`.
3. `entity_registry.normalized_key` maps to exactly one `EntityId` in v0.
4. `global_edges` is append-only (no updates/deletes in normal operation).
5. `focusStack.length <= 8` at all checkpoints.
6. No persisted record stores verse-local VM handle IDs as canonical entity IDs.

### 8.5 Goldens

- Add deterministic goldens for:
  - small curated verse streams
  - ambiguous-name fixtures (future v1)
  - pronoun-heavy fixtures
- Golden compare must include entity table, registry table, and edge stream canonical projection.

## Implementation Tasks

- [ ] 1. Implement Entity Registry (persistent store + normalization)
- [ ] 2. Implement Discourse State (rolling focus)
- [ ] 3. Implement Verse Projection (mentions + relations extraction)
- [ ] 4. Implement Mention Resolution (registry + discourse)
- [ ] 5. Implement Global Graph Store (edges + node table + provenance pointers)
- [ ] 6. Implement Streaming Builder CLI (process snapshots incrementally)
- [ ] 7. Implement Phase B test suite + goldens
