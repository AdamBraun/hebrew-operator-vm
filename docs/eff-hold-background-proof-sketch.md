# Proof Sketch: Is `eff()` Enough To Keep ל's Hold Available?

## Claim under test

For the proposed `ל` graph

```text
F0 -> h -> o
F := o
```

does the existing `eff()` mechanism already make the prior hold `h` available to later letters as contextual background, even though `h` is no longer the focus?

This note answers that question using only the current `eff()` contract in [src/reference/state/eff.ts](/Users/adambraun/projects/letters/src/reference/state/eff.ts#L223).

## 1. Restatement of `eff()` behavior

Let `start = nodeId`.

`eff(state, start)` does four things:

1. Collect all nodes reachable by walking backward through `cont` predecessors from `start`, stopping at chunk boundaries.
2. For each visited node `t`, inspect every incoming `carry(s, t)`.
3. For each such carry, decide whether it is resolved by searching forward from `t` along `cont` successors until either:
   - some node `c` on that forward path satisfies `supp(c, s)`, in which case the carry is `resolved`, or
   - the search hits the focus node or a chunk boundary without such a `supp`, in which case it is `unresolved`.
4. Merge the witness bundle stored on the carry source `s`:
   - nearer visited targets win over farther ones,
   - `resolved` beats `unresolved` at equal distance,
   - later creation order breaks remaining ties.

Formally, if `W(s)` is the witness bundle attached to source node `s`, then:

```text
eff(start) = ranked-merge of W(s)
for all carries s -> t
where t lies on the backward cont cone of start
```

Two consequences matter here:

- `eff()` returns witness bundles from carry **sources**.
- `eff()` does **not** return the visited nodes themselves.

So backward visibility of a node in `cont` is weaker than direct access to that node as a handle.

## 2. What `eff(h)` sees in כ after the direct-support change

Use the current `כ` candidate:

```text
cont(F0, h)
supp(h, F0)
F := h
```

Let `W(x)` mean the witness bundle attached to node `x`.

Backward `cont` walk from `h` visits:

```text
{ h (distance 0), F0 (distance 1), ...earlier predecessors of F0... }
```

Incoming carries on visited nodes:

- at `h`: none
- at `F0`: any earlier carries into `F0`

So `eff(h)` includes no immediate witness contribution from `F0`, because `כ` no longer opens `carry(F0, h)`. It can still include earlier upstream witness bundles only if some separate carry already lands on a visited predecessor.

What is proved:

- the predecessor node remains backward-visible by `cont`

What is not separately proved:

- that the source witness bundle `W(F0)` is available at `h` through `eff()`
- that `h` itself appears in the result as a selectable object

So current `כ` is no longer evidence for carry-mediated hold visibility. `ל` now has to be analyzed as a direct-supported overstep.

## 3. What `eff(o)` sees in ל

Use the current `ל` candidate:

```text
cont(F0, h)
supp(h, F0)
cont(h, o)
F := o
```

There is intentionally no:

```text
carry(h, o)
supp(o, h)
```

Backward `cont` walk from `o` visits:

```text
{ o (distance 0), h (distance 1), F0 (distance 2), ... }
```

Incoming carries on visited nodes:

- at `o`: none, under the current candidate
- at `F0`: any earlier carries into `F0`

So `eff(o)` includes no immediate witness contribution from `F0`, because `ל` no longer opens `carry(F0, h)`. It can still include earlier upstream witness bundles only if some separate carry already lands on a visited predecessor.

Crucial limitation:

- `eff(o)` does **not** include `W(h)` unless there is some incoming carry with source `h` to a visited node
- under the current `ל` candidate there is no `carry(h, o)`, so `h` contributes no source bundle of its own

Therefore the exact proven statement is narrower:

- from `o`, later letters can still walk back to `h` by `cont`
- but `eff(o)` no longer carries `W(F0)` through `h` under the current `ל`

## 4. What `eff(i)` sees in מ

Use the current `מ` candidate from the topology note:

```text
cont(F0, h)
carry(F0, h)
supp(h, F0)
cont(h, i)
F := i
```

with the additional non-`eff` fact that `i` is inside an open enclosure relative to `h`.

Backward `cont` walk from `i` visits:

```text
{ i (distance 0), h (distance 1), F0 (distance 2), ... }
```

Incoming carries on visited nodes:

- at `i`: none, under the current candidate
- at `h`: `carry(F0, h)`
- at `F0`: any earlier carries into `F0`

So `eff(i)` includes:

- `W(F0)` ranked at distance `1`, `resolved`
- plus earlier upstream witness bundles, unlike current `eff(o)` for `ל`

Important consequence:

- under the current contract, `eff(i)` and `eff(o)` are no longer the same, because `מ` keeps `carry(F0, h)` and `ל` does not
- `eff()` still does not inspect interior/exterior enclosure topology directly, except for chunk-boundary stopping rules

## 5. Conclusion

### What is proved

No, `eff()` is no longer sufficient to make the pre-`o` hold contextual in the narrow carry/witness sense for current `ל`.

Reason:

- `o` stays connected to `h` by backward `cont`
- `eff(o)` visits `h`
- but there is no incoming `carry(F0, h)` for `eff(o)` to merge

So later letters operating at `o` do not inherit the source witness through `ל` unless some other carry is already present in the backward cone.

### What is not proved

Backward visibility alone does **not** prove any of the following:

- that `h` itself is returned by `eff()`
- that later letters can directly select `h` as an operand
- that hold-local state stored on `h` is visible, unless that state is exported through some carry-source witness bundle
- that the difference between `ל` and `מ` is explained by topology alone rather than by `מ`'s extra hold carry

### Final verdict

`ל` still makes the hold non-focal, but only in the topological sense:

- focal workspace: `o`
- backward structure still reachable by `cont`: the held node `h`

If the intended claim is only that the resolved hold stays on the backward continuation chain, the claim is proved.

If the intended claim is that `eff()` carries inherited witness context through current `ל`, the claim is disproved.
