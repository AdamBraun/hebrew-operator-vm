# Niqqud (modifier family)

Niqqud are phase-typed operator modifiers attached to base letters. They are not standalone letters.

## Micro-graph primitives

- Dot = `Y` (unary)
- Line = `V` (binary)
- Orientation is embedding, not semantics.

## Port coordinates (minimal)

```
pos := (tier ∈ {rosh,toch,sof}, port ∈ {L,C,R}, level optional)
```

Optional staged levels may be used for shva (`C₁`, `C₂`) or diagonals for kubutz (ordered Y nodes).

## Inside-dot typing

Inside-dot disambiguation follows `spec/10-LEXICAL.md` and sets `features.inside_dot_kind` for dispatch.

## Behavior classes

- `Gate`: mark a sealed handle with `edge_mode=gated` and a gate span.
- `Stabilize`: set `edge_mode=stabilized`, record support pins.
- `RepTokenCommit`: compress a gated shell + pin pair and mark representative (`≈`) with `edge_mode=committed`.
- `ConvergeToEndpoint`: set `edge_mode=convergent`, optional endpoint bias.
- `CommitRepresentativeToAtomic`: finalize representative as `ArtifactHandle`, `edge_mode=committed`.
- `CollapseToAlias`: create alias handle, `edge_mode=collapsed`.
- `Bundle`: bundle `≈` class into atomic handle, `edge_mode=bundled`.
- `HeadBiasToSealedEndpoint`: rosh-tier selection bias toward sealed endpoints.
- `CarrierActivation`: toch-tier activation of carrier mode (host `ו`).
- `HARDEN`: toh-tier envelope hardening (policy raise, port restriction, coupling tightening).
- `Reduce` (wrapper): short impulse, no handle allocation, reduced strength, bind-next, policy ceiling.

## VM effects (parameters)

- `hataf_realization ∈ {reduced, split}` (default `reduced`)

## Inventory

| Glyph       | Tier | Micro-graph              | Behavior                       | Host constraint          |
| ----------- | ---- | ------------------------ | ------------------------------ | ------------------------ |
| patach (ַ)  | Sof  | `V(L,R)`                 | `Gate`                         | none                     |
| tzere (ֵ)   | Sof  | `Y(L)+Y(R)`              | `Stabilize`                    | none                     |
| hiriq (ִ)   | Sof  | `Y((sof,C))`             | `RepTokenCommit`               | none                     |
| segol (ֶ)   | Sof  | `Y(L)+Y(R)+Y(C)`         | `ConvergeToEndpoint`           | none                     |
| kamatz (ָ)  | Sof  | `V(L,R)+Y(C)`            | `CommitRepresentativeToAtomic` | none                     |
| shva (ְ)    | Sof  | `Y(C₁)+Y(C₂)`            | `CollapseToAlias`              | none                     |
| hataf patach (ֲ) | Sof | `SHVA ⊕ PATAH`       | `Gate` (reduced)               | none                     |
| hataf segol (ֱ)  | Sof | `SHVA ⊕ SEGOL`       | `ConvergeToEndpoint` (reduced) | none                     |
| hataf kamatz (ֳ) | Sof | `SHVA ⊕ KAMATZ`      | `CommitRepresentativeToAtomic` (reduced; policy ceiling; no artifact allocation) | none |
| kubutz (ֻ)  | Sof  | `Seq[Y(p1),Y(p2),Y(p3)]` | `Bundle`                       | none                     |
| cholam (ֹ)  | Rosh | `Y((rosh,L))`            | `HeadBiasToSealedEndpoint`     | none                     |
| shuruk (וּ) | Toch | `Y((toch,C))`            | `CarrierActivation`            | `inside_dot_kind=shuruk` |
| dagesh (ּ)  | Toch | `Y((toch,C))`            | `HARDEN`                       | `inside_dot_kind=dagesh` |

## Composition and recognition

- `segol.graph = tzere.graph ⊕ hiriq.graph`
- `kamatz.graph = patach.graph ⊕ hiriq.graph`
- Overlay (`⊕`) is purely graphical; behavior is assigned by tiered recognizers.

Recognition rules (graph-only, tiered):

- `Y(L)+Y(R)+Y(C)` at Sof ⇒ `segol` ⇒ `ConvergeToEndpoint`
- `V(L,R)+Y(C)` at Sof ⇒ `kamatz` ⇒ `CommitRepresentativeToAtomic`
- `Y((toch,C))` with `inside_dot_kind=shuruk` ⇒ `shuruk` ⇒ `CarrierActivation`
- `Y((toch,C))` with `inside_dot_kind=dagesh` ⇒ `dagesh` ⇒ `HARDEN`
- If Sof graph contains `Y(C₁)+Y(C₂)` and matches another base vowel pattern, classify as `hataf(base)`.

## Hataf family (composite shevas) — reduced Sof vowels

In standard niqqud, the **חטף vowels are “composite shevas”**: a **שווא** combined with a base vowel sign, used to mark a **very short** version of that vowel. ([web.oru.edu][1])  
Example: **חטף קמץ** is explicitly described as **sheva + qamats** in composition. ([Wikimedia Commons][2])

### A) Micro-graph rule (glyph-level)

Let:

- `SHVA.graph = Y(C₁) + Y(C₂)` (vertical staged dots)
- `PATAH.graph = V(L,R)`
- `SEGOL.graph = Y(L) + Y(R) + Y(C)`
- `KAMATZ.graph = V(L,R) + Y(C)`

Then define a generic constructor:

**HATAF(δ_base).graph = SHVA.graph ⊕ δ_base.graph**

So:

- **חטף פתח (ֲ)**: `Y(C₁)+Y(C₂) ⊕ V(L,R)`
- **חטף סגול (ֱ)**: `Y(C₁)+Y(C₂) ⊕ (Y(L)+Y(R)+Y(C))`
- **חטף קמץ (ֳ)**: `Y(C₁)+Y(C₂) ⊕ (V(L,R)+Y(C))`

(⊕ = overlay of marks, not behavioral equivalence.)

### B) Behavior rule (calculus-level)

All חטפים are **Sof-tier** modifiers (below the letter ⇒ modifies Seal/export).

Define a wrapper:

**HATAF(δ_base).δ_sof(h) = Reduce( δ_base.δ_sof( SHVA.δ_sof(h) ) )**

Where `Reduce(·)` enforces:

1. **Short impulse (no autonomous vowel object).** Do not allocate a new handle kind. Annotate the exported handle with `trace_edge.strength := reduced` and `trace_edge.bind_next := true`.
2. **Policy ceiling.** Do not raise `policy` above `soft` (or at most `framed_lock` if you want a single uniform ceiling). Rationale: the “snatched” vowel is not a full commit; it is a minimal bridge.
3. **Shva-component effect remains.** Preserve the `CollapseToAlias / suppress traversal` aspect of shva, but allow the base vowel to contribute its **edge_mode** as a “thin” mode.

This matches the standard linguistic description that adding the sheva component makes the vowel “very short.” ([Wikipedia][3])

### Concrete definitions

#### 1) חטף פתח (ֲ) = HATAF(PATAH)

- **Tier:** Sof
- **Graph:** `Y(C₁)+Y(C₂) ⊕ V(L,R)`
- **Effect:** `edge_mode := gated` (from patach) + `strength := reduced` + `bind_next := true`
- **Interpretation:** “micro-gated crossing”: a controlled aperture, but too short to stand as its own exported structure.

#### 2) חטף סגול (ֱ) = HATAF(SEGOL)

- **Tier:** Sof
- **Graph:** `Y(C₁)+Y(C₂) ⊕ (Y(L)+Y(R)+Y(C))`
- **Effect:** `edge_mode := convergent` (to-endpoint) + reduced strength + bind-next
- **Interpretation:** “micro-converge”: directed ‘to’-ness, but only as a bridging impulse.

#### 3) חטף קמץ (ֳ) = HATAF(KAMATZ)

- **Tier:** Sof
- **Graph:** `Y(C₁)+Y(C₂) ⊕ (V(L,R)+Y(C))`
- **Effect:** `edge_mode := committed` (representative-commit) + reduced strength + bind-next, with policy ceiling
- **Interpretation:** “micro-commit”: choose/commit a representative direction, but do not finalize it as an artifact.

### Name-program checksum: what “חטף” must mean in your system

Treat **חטף** as a wrapper signature:

- **ח** ⇒ gated interface / mediated crossings
- **ט** ⇒ covert internalization with a single exported proxy
- **ף** ⇒ hard stop / freeze the emission channel

So the checksum constraint is:

**HATAF = “export only a proxy impulse, then immediately close it.”**

That is exactly what the `Reduce(·)` rule enforces.

## Note: alternative realization mode (Sephardi-style split)

This calculus supports an alternative **macro-expansion semantics** for the חטף family: not “reduced overlay,” but **sequential realization** of the components.

Traditional grammars already describe חטף as a combination of **שווא + vowel sign**, and (in Tiberian) the result is treated as a reduced vowel. ([Wikipedia][4]) Sephardi traditions also commonly interpret several niqqud distinctions as **length/realization differences**, and some Sephardi pronunciations do not apply reduction the same way. ([Wikipedia][5])

### Two deterministic modes for חטף

#### Mode A: Reduced (default, “single letter with composite micro-graph”)

- `HATAF(base).graph = SHVA.graph ⊕ base.graph`
- `HATAF(base).δ_sof(h) = Reduce( base.δ_sof( SHVA.δ_sof(h) ) )`

`Reduce` enforces: `strength=reduced`, `bind_next=true`, policy ceiling, and “no independent vowel object”.

#### Mode B: Split (Sephardi-style “as if two letters”)

Realize the same components as **two Sof substeps** without reduction:

- `HATAF(base).δ_sof_split(h) = base.δ_sof( SHVA.δ_sof(h) )`
- record `edge_duration := 2` (or `substeps := [shva, base]`) in the trace

Constraint: **do not execute Δ_ℓ twice**. The “two letters” here is a *rendering/realization split inside Seal*, not duplication of the consonant operator.

### Interpretation in trace terms

- Reduced mode: one edge with a “thin impulse” label.
- Split mode: the same edge is realized as two consecutive micro-edges:

  1. shva-collapse micro-edge
  2. base-vowel micro-edge
     This naturally lengthens articulation because the trace contains **two timed subevents** instead of one.

### Determinism and checksum compatibility

- If `hataf_realization=reduced`: use `Reduce ∘ base ∘ shva`.
- If `hataf_realization=split`: use `base ∘ shva` with `edge_duration=2` and no `Reduce`.
- Split realization is confined to the **Sof wrapper**; it must not duplicate the hosting letter’s Select/Bound/Seal (Δ_ℓ runs once).
- In split mode, interpret חטף as two short sealed impulses rather than one reduced impulse; both satisfy “proxy then close” at the trace level.

## Name checksum rule (optional, experimental)

Each modifier may declare a **name program** (letters spelling its name). The composed operator invariants MUST match the glyph behavior class or be explicitly marked non-checksummed.

Invariant tags (excerpt):

- `י`: pinned seed / handle-initiation
- `ו`: carrier/channel / propagation
- `ח`: gated compartment
- `ל`: endpoint fiber + door interface
- `מ`: membrane OPEN
- `ם`: membrane CLOSE
- `ק`: ≈ interchangeability
- `ר`: unanchored head boundary
- `ד`: anchored head boundary
- `ס`: framed_lock support hull
- `צ/ץ`: exemplar alignment / atomic aligned handle
- `ת`: finalize-and-stamp
- `א`: alias/transport merge
- `ב`: interior frame shift
- `חטף`: ReduceExportToProxyAndClose (wrapper semantics)

If `BC_glyph` differs from `BC_name`, the modifier MUST be marked non-checksummed.

[1]: https://web.oru.edu/current_students/class_pages/grtheo/mmankins/Hebrewhmpg_files/Power%20Pts/Vowel%20Pointings.pdf?utm_source=chatgpt.com "Hebrew Vowels"
[2]: https://commons.wikimedia.org/wiki/Category%3AHataf_kamatz?utm_source=chatgpt.com "Category:Hataf kamatz - Wikimedia Commons"
[3]: https://en.wikipedia.org/wiki/Kamatz?utm_source=chatgpt.com "Kamatz"
[4]: https://en.wikipedia.org/wiki/Shva?utm_source=chatgpt.com "Shva"
[5]: https://en.wikipedia.org/wiki/Sephardi_Hebrew?utm_source=chatgpt.com "Sephardi Hebrew"
