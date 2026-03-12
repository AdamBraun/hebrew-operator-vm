# Hold Family Topology: כ, ל, מ, ם

This note restates the current hold-family proposal in graph terms.

It uses the existing edge vocabulary:

- `cont(source, target)` = forward continuation
- `carry(source, target)` = inherited context on that continuation
- `supp(target, source)` = the target is resolved/stabilized against the source

It also uses one existing topological device when needed:

- a boundary/enclosure relation that distinguishes `inside` from `outside`

No new edge label is introduced here.

## Base patterns

Let `F0` be the current focus before the letter runs.

A direct supported hold, now used by `כ`, is:

```text
allocate H
add cont(F0, H)
add supp(H, F0)
```

A direct supported overstep hold, now used by `ל`, is:

```text
allocate H
add cont(F0, H)
add supp(H, F0)
add cont(H, X)
```

A carry-backed resolved hold, still used by `מ`, is:

```text
allocate H
add cont(F0, H)
add carry(F0, H)
add supp(H, F0)
```

`H` is the held node. Topologically, both forms are resolved successors of `F0`: the line advances to `H` and is stabilized there. The difference is whether the hold also enters the carry ledger.

## Letter definitions

### כ

Allocate:

- `H` = held node

Edges added:

- `cont(F0, H)`
- `supp(H, F0)`

Focus ends:

- `F := H`

Topological shape:

- `כ` is exactly the direct supported hold and nothing more.
- The thread terminates locally at the held node.
- There is no second continuation site beyond the hold.

### ל

Allocate:

- `H` = held node
- `X` = exterior continuation site

Edges added:

- `cont(F0, H)`
- `supp(H, F0)`
- `cont(H, X)`

Edges not added in the current candidate:

- no `carry(H, X)`
- no `supp(X, H)`

Focus ends:

- `F := X`

Topological shape:

- `ל` is a direct supported hold with one additional forward ray leaving the hold.
- `X` is beyond the hold, not another resolved version of it.
- The held node remains behind the focus as the immediately previous resolved site.

Why bare `cont(H, X)` is enough:

- The meaning of `ל` is “continue past the hold,” not “inherit the hold into a new resolved node.”
- Adding `carry(H, X)` would make `X` a carried projection of the hold.
- Adding `supp(X, H)` would make `X` a second resolved node.
- Neither stronger claim is required by the current proposal.

### מ

Allocate:

- `H` = held node
- `I` = interior continuation site
- optionally `B` if the profile materializes boundaries as first-class handles; otherwise record the boundary relation without a new node

Edges added:

- `cont(F0, H)`
- `carry(F0, H)`
- `supp(H, F0)`
- `cont(H, I)`

Edges not added in the open form:

- no `carry(H, I)`
- no `supp(I, H)`

Additional topological structure:

- record that `I` is **inside** the enclosure anchored by `H`
- record that `H` is the corresponding **outside** anchor for that same enclosure
- the enclosure remains open

Focus ends:

- `F := I`

Topological shape:

- `מ` still differs from `ל` by enclosure placement, but it now also keeps `carry(F0, H)` while `ל` does not.
- So the difference is not only placement:
  `X` in `ל` is outside the hold and carryless, while `I` in `מ` is inside an open enclosure and still inherits the source witness through the hold.

### ם

Precondition:

- there is a nearest still-open interior `(H, I)` from a prior `מ`

Allocate:

- `S` = sealed continuation/export of the interior

Edges added:

- `cont(I, S)`
- `carry(I, S)`
- `supp(S, I)`

Additional topological update:

- close the open enclosure associated with `(H, I)`
- make `S` the selectable sealed representative of that interior

Focus ends:

- `F := S`

Topological shape:

- `מ` leaves the interior line open at `I`.
- `ם` resolves that open interior into `S`.
- So `I` is an interior cursor, while `S` is the sealed interior result.

## Topological differences at a glance

### Held node in כ

- A resolved successor with no onward continuation.
- Endpoint shape: `F0 -> H`, with stabilization on `H`.

### Exterior continuation in ל

- A plain forward successor of the resolved hold.
- Ray shape: `F0 -> H -> X`, with `X` outside the hold.
- Current candidate needs only the bare `cont(H, X)` beyond the hold.

### Interior continuation in מ

- Also a plain forward successor of the resolved hold.
- Path shape: `F0 -> H -> I`, but `I` lies inside an open enclosure.
- The difference from `ל` is no longer only topological placement: `מ` also keeps the hold carry that `ל` omits.

### Sealed continuation in ם

- A resolved successor of the open interior.
- Closing shape: `F0 -> H -> I -> S`, with `S` stabilized and the enclosure closed.
- `S` is no longer an open interior cursor.

## Sufficiency of the current model

`cont/carry/supp` are sufficient to express:

- the resolved hold itself (`כ`)
- the minimal “continue beyond the hold” form (`ל`)
- the sealing step that turns an open interior into a resolved result (`ם`)

`cont/carry/supp` plus boundary state now distinguish `ל` from `מ`: even before boundary inspection, `מ` retains a hold carry that `ל` no longer emits.

So the current model does **not** need a new edge type, but it **does** need one existing enclosure-level distinction:

- either a first-class boundary relation
- or an equivalent inside/outside containment record

That is the minimum extra structure required to make `מ` genuinely different from `ל`.
