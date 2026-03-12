# Falsification Memo: Can ל Exist Without Hidden Metadata?

## Question

Can the current candidate for `ל` be implemented as a real graph shape, or does it collapse into a relabeled copy of another letter unless hidden metadata is added?

## Candidate under test

Let `F0` be the inbound focus.

Resolved hold (`כ` candidate):

```text
allocate H
add cont(F0, H)
add carry(F0, H)
add supp(H, F0)
F := H
```

Lamed candidate:

```text
allocate H
add cont(F0, H)
add carry(F0, H)
add supp(H, F0)
allocate X
add cont(H, X)
F := X
```

Final nun (`ן`, topology only):

```text
allocate N
add cont(F0, N)
add supp(N, F0)
F := N
```

The reference runtime now gives `ן` a directly supported successor: it emits `cont` plus `supp` on a single child and then hardens policy afterward; the policy step is not a new graph relation ([src/reference/state/relations.ts](/Users/adambraun/projects/letters/src/reference/state/relations.ts#L48), [src/reference/letters/finalNun.ts](/Users/adambraun/projects/letters/src/reference/letters/finalNun.ts#L21), [src/reference/state/policies.ts](/Users/adambraun/projects/letters/src/reference/state/policies.ts#L54)).

## Result

### 1. Is ל mechanically distinct from כ?

Yes, but only if `ל` allocates a second node `X` and adds a real continuation edge `cont(H, X)`.

With that edge, the two graphs differ:

- `כ`: one new node, one resolved site, focus on that resolved site
- `ל`: one resolved site plus one further continuation site, focus on the further site

Without `X` and `cont(H, X)`, `ל` collapses back into `כ` plus a register-only focus rewrite. That would be hidden metadata, not topology.

### 2. Is ל mechanically distinct from ן?

Yes, topologically.

`ן` ends on a node that is itself the resolved child of `F0`:

```text
F0 -> N
supp(N, F0)
```

`ל` ends one step past the resolved hold:

```text
F0 -> H -> X
carry(F0, H)
supp(H, F0)
```

So `ן` has one successor node and that node is resolved. `ל` has an intermediate resolved node `H` plus a second successor `X` that is not itself resolved by the current candidate.

Ignoring policy metadata, `כ` and `ן` are graph-identical under the present proposal. `ל` is not graph-identical to either one because it has the extra successor `X`.

### 3. Does the distinction rely only on focus position, or are additional edges required?

It does **not** rely only on focus position. A real extra edge is required.

The minimal acceptable difference is:

```text
allocate X
add cont(H, X)
F := X
```

No additional `carry(H, X)` or `supp(X, H)` edge is required.

Those stronger edges would change the shape:

- `carry(H, X)` would make `X` inherit from the hold
- `supp(X, H)` would make `X` another resolved node

The current lamed proposal needs neither. Its claim is only that execution continues beyond the resolved hold.

The `eff()` code makes this testable. `eff(nodeId)` walks backward through `cont` predecessors, then gathers witness contributions from incoming `carry` edges on the visited nodes ([src/reference/state/eff.ts](/Users/adambraun/projects/letters/src/reference/state/eff.ts#L223), [src/reference/state/eff.ts](/Users/adambraun/projects/letters/src/reference/state/eff.ts#L323)). Therefore:

- from focus `X`, `eff()` can still visit `H` if and only if `cont(H, X)` exists
- once `H` is visited, the existing `carry(F0, H)` remains visible through the ordinary graph walk

So the backward visibility claim does not need hidden metadata, but it **does** need the explicit continuation edge from `H` to `X`.

### 4. Is the proposal acceptable without new metadata?

Yes, with one condition: `ל` must be encoded as the explicit two-step graph above.

That version needs:

- no `repr(F)`
- no `heart(F)`
- no interface label
- no upper-port tag
- no `kind=representative`

It is recoverable from plain graph structure plus focus.

But the proposal is only minimally sufficient. It is acceptable as a letter-level graph pattern, not as a new irreducible graph relation. Mechanically it factors as:

```text
ל = כ followed by bare continuation
```

Equivalently, at the topology level it is `resolved hold + cont`.

That means:

- `ל` survives falsification as a metadata-free operator shape
- `ל` does **not** survive as a fundamentally new edge type or novel node kind

## Bottom line

`ל` is mechanically distinct from `כ` and from `ן` if and only if it leaves behind a first-class resolved hold `H` and then advances to a separate successor `X` by an explicit `cont(H, X)` edge.

That is enough for `eff()` visibility and enough to avoid hidden metadata.

If the proposal is weakened to “same as `כ`, but focus is now elsewhere,” it fails. That version is too thin because the graph no longer records what makes `ל` different.

If the proposal keeps the explicit `H -> X` continuation, it is acceptable, but only as a very thin composite topology rather than as a new primitive relation.
