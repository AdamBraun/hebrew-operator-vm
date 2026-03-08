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

## 2. What `eff(h)` sees in כ

Use the current `כ` candidate:

```text
cont(F0, h)
carry(F0, h)
supp(h, F0)
F := h
```

Let `W(x)` mean the witness bundle attached to node `x`.

Backward `cont` walk from `h` visits:

```text
{ h (distance 0), F0 (distance 1), ...earlier predecessors of F0... }
```

Incoming carries on visited nodes:

- at `h`: `carry(F0, h)`
- at `F0`: any earlier carries into `F0`

Resolution of `carry(F0, h)`:

- the forward search starts at `h`
- `supp(h, F0)` holds immediately
- therefore `carry(F0, h)` is `resolved`

So `eff(h)` includes:

- `W(F0)` ranked at distance `0`, `resolved`
- plus any earlier upstream witness bundles that land on earlier backward-visited nodes

What is proved:

- the predecessor context of the hold is available at the hold

What is not separately proved:

- that `h` itself appears in the result as a selectable object

`eff(h)` does not return `h`; it returns witness material flowing into visited nodes.

## 3. What `eff(o)` sees in ל

Use the current `ל` candidate:

```text
cont(F0, h)
carry(F0, h)
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
- at `h`: `carry(F0, h)`
- at `F0`: any earlier carries into `F0`

Resolution of `carry(F0, h)` from focus `o`:

- the forward search starts at `h`
- `supp(h, F0)` already holds at the first visited node
- therefore the carry is still `resolved`

So `eff(o)` includes:

- `W(F0)` ranked at distance `1`, `resolved`
- plus any earlier upstream witness bundles reachable through the same backward `cont` cone

Crucial limitation:

- `eff(o)` does **not** include `W(h)` unless there is some incoming carry with source `h` to a visited node
- under the current `ל` candidate there is no `carry(h, o)`, so `h` contributes no source bundle of its own

Therefore the exact proven statement is:

- from `o`, later letters can still see background that flows **into** `h`

The stronger statement is **not** proved:

- from `o`, later letters can directly see or select the held node `h` itself

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

Resolution is the same as for `ל`:

- `supp(h, F0)` resolves the carry immediately

So `eff(i)` includes:

- `W(F0)` ranked at distance `1`, `resolved`
- plus earlier upstream witness bundles, exactly as in `eff(o)`

Important consequence:

- under the current contract, `eff(i)` and `eff(o)` are the same whenever `ל` and `מ` have the same `cont/carry/supp` edges
- `eff()` does not inspect interior/exterior enclosure topology, except for chunk-boundary stopping rules

So `eff()` alone cannot distinguish the exterior continuation of `ל` from the interior continuation of `מ`.

## 5. Conclusion

### What is proved

Yes, `eff()` is sufficient to make the pre-`o` hold **contextual in the narrow carry/witness sense**.

Reason:

- `o` stays connected to `h` by backward `cont`
- `eff(o)` visits `h`
- while visiting `h`, `eff(o)` still sees the incoming carry `F0 -> h`
- that carry remains resolved because `supp(h, F0)` still holds

So later letters operating at `o` can inherit background that is mediated through the held node `h`, even though focus has advanced beyond it.

### What is not proved

Backward visibility alone does **not** prove any of the following:

- that `h` itself is returned by `eff()`
- that later letters can directly select `h` as an operand
- that hold-local state stored on `h` is visible, unless that state is exported through some carry-source witness bundle
- that `ל` and `מ` differ from each other at the `eff()` level

### Final verdict

`ל` does make the hold contextual rather than focal, but only in a limited sense:

- focal workspace: `o`
- contextual background available via `eff(o)`: witness flow that remains reachable through `h`

If the intended claim is only that the resolved hold stays on the backward continuation chain and therefore still mediates inherited context, the claim is proved.

If the intended claim is that `eff()` gives later letters direct access to the held node `h` itself, the claim is disproved.
