# Inside vs Outside in the Hold Family

This note makes the `ל` / `מ` distinction precise in VM graph terms.

It assumes the existing state model:

- continuation edges: `cont(source, target)`
- inherited-context edges: `carry(source, target)`
- resolution edges: `supp(target, source)`
- boundary relation: `BoundaryRecord { id, inside, outside, anchor }`

The boundary relation already exists in the VM state ([src/reference/state/state.ts](/Users/adambraun/projects/letters/src/reference/state/state.ts#L42)) and is populated by `addBoundary(...)` ([src/reference/state/relations.ts](/Users/adambraun/projects/letters/src/reference/state/relations.ts#L159)).

## 1. What counts as `inside`

A node `x` counts as **inside relative to anchor `a`** iff the state contains an enclosure record whose interior side is `x` and whose exterior side is `a`:

```text
exists B such that BoundaryRecord(B).inside = x
and BoundaryRecord(B).outside = a
```

If the profile materializes boundary handles, the same fact may also appear on the boundary handle metadata:

```text
handle(B).kind = boundary
handle(B).meta.inside = x
handle(B).meta.outside = a
```

That is the minimum positive criterion for interiority. A node is not inside merely because it is a successor of `a` on the `cont` chain.

## 2. What counts as `outside`

A node `x` counts as **outside relative to anchor `a`** in the minimal hold-family sense iff:

```text
cont(a, x)
```

and there is no boundary record that places `x` on the interior side of an enclosure rooted at `a`:

```text
not exists B such that BoundaryRecord(B).inside = x
and BoundaryRecord(B).outside = a
```

So in the current minimal proposal, exterior continuation is ordinary continuation that has not been designated as interior by any enclosure relation.

This is enough for `ל`.

## 3. Why `inside` requires extra enclosure structure

Using only `cont` and `supp`, these two graphs can still look identical in shape:

```text
F0 -> h -> o
F0 -> h -> i
```

Nothing in `cont`, `carry`, or `supp` marks one successor of `h` as interior and the other as exterior.

Therefore `inside` cannot be recovered from continuation topology alone. It requires one additional positive fact:

```text
BoundaryRecord(B).inside = i
BoundaryRecord(B).outside = h
```

Without that record, `i` is just another continuation successor and `מ` collapses to the same graph shape as `ל`.

## 4. Is `outside` just the absence of enclosure edges?

For the current hold-family proposal: yes.

The minimal exterior case is:

```text
cont(h, o)
```

with no matching enclosure record:

```text
not exists B with inside = o and outside = h
```

So `outside` does not need extra positive structure in order to distinguish `ל` from `מ`.

Important limit:

- this is only the minimal claim needed for the present family
- it does not define a rich exterior-topology system
- if the VM later needs multiple distinct exterior faces, ports, or boundary-specific outside regions, then outside will need its own positive structure

But for the current question, bare continuation plus absence of an interior boundary record is sufficient.

## 5. Minimum graph difference between `מ` and `ל`

Both letters share the same forward hold path:

```text
allocate h
add cont(F0, h)
add supp(h, F0)
```

Both also allocate one successor of the hold:

```text
allocate s
add cont(h, s)
```

The minimum difference is:

### `ל`

```text
s = o
no BoundaryRecord with inside = o and outside = h
F := o
```

### `מ`

```text
s = i
allocate or record boundary B
BoundaryRecord(B).inside = i
BoundaryRecord(B).outside = h
F := i
```

If `מ` also tracks openness, that is an additional state fact layered on top of the same enclosure relation:

```text
OpenInterior(h, i)   // obligation / pending close
```

But openness is not what makes `i` interior. The boundary relation is.

## Final statement

For this VM, “inside” is a positive enclosure fact:

```text
inside(x, a) := exists boundary B with B.inside = x and B.outside = a
```

“Outside” in the minimal `ל` proposal is ordinary continuation from the hold that lacks that enclosure fact:

```text
outside(x, a) := cont(a, x) and not inside(x, a)
```

So the minimum graph difference between `מ` and `ל` is not a different continuation edge. It is the presence or absence of one boundary/enclosure relation rooted at the held node.
