## Diacritics (niqqud) as phase-typed operator modifiers

Diacritics are compile-time micro-graphs attached to a letter’s Select/Bound/Seal phases, not standalone letters.

### Phase mapping (placement ⇒ which primitive is modified)

* Rosh (above) ⇒ modifies **Select**
* Toch (inside) ⇒ modifies **Bound**
* Sof (below) ⇒ modifies **Seal**

### Phase wrapping (typed)

Define phase wrappers:

* (\mathrm{Select}^{\delta}(S) := \text{let } (S', \text{ops}) = \mathrm{Select}(S) \text{ in } \delta_{\text{rosh}}(S', \text{ops}))
* (\mathrm{Bound}^{\delta}(S, \text{ops}) := \text{let } (S', \text{cons}) = \mathrm{Bound}(S, \text{ops}) \text{ in } \delta_{\text{toch}}(S', \text{cons}))
* (\mathrm{Seal}^{\delta}(S, \text{cons}) := \text{let } (S', h, r) = \mathrm{Seal}(S, \text{cons}) \text{ in let } (S'', h') = \delta_{\text{sof}}(S', h) \text{ in } (S'', h', r))

A simple niqqud (\delta) is represented as typed modifiers:

- (\delta_{\text{rosh}} : (S, \text{operands}_{\text{sel}}) \to (S, \text{operands}_{\text{sel}}))
- (\delta_{\text{toch}} : (S, \text{construction}) \to (S, \text{construction}))
- (\delta_{\text{sof}} : (S, \text{handle}) \to (S, \text{handle}))

Only one of (\delta_{\text{rosh}},\delta_{\text{toch}},\delta_{\text{sof}}) is non-identity for a simple niqqud.

Execution of a token ((\ell, \delta)) (let (S_0) be the current state):

1) (S_1, \text{ops}) := \mathrm{Select}_\ell(S_0)
2) (S_2, \text{ops}') := \delta_{\text{rosh}}(S_1, \text{ops})
3) (S_3, \text{cons}) := \mathrm{Bound}_\ell(S_2, \text{ops}')
4) (S_4, \text{cons}') := \delta_{\text{toch}}(S_3, \text{cons})
5) (S_5, h, r) := \mathrm{Seal}_\ell(S_4, \text{cons}')
6) (S_6, h') := \delta_{\text{sof}}(S_5, h)
Return (S_6) with exported handle (h') and residue (r) pushed/set per VM policy.

### Micro-graph primitives

* Dot = **Y** (unary port marker / seed)
* Line = **V** (binary connector), orientation-free (direction is embedding, not semantics)
* **V is the abstract line principle; ו is a vertical embedding instance; letter strokes are embeddings of V/Y, not new primitives.**

### Port coordinates (minimal)

* `pos := (tier ∈ {rosh, toch, sof}, port ∈ {L, C, R}, level optional)`
* Optional staged levels for shva (`C₁`, `C₂`) or diagonals for kubutz (ordered Y nodes)
* Example: cholam uses `Y((rosh, L))`, hiriq uses `Y((sof, C))`, shuruk uses `Y((toch, C))` on ו.
* When a diacritic’s tier is fixed, `Y(L)` abbreviates `Y((tier, L))` (same for `C`, `R`).

### Micro-graph sequencing

* `Seq[·]` denotes ordered application of unary marks (staged sequence), not a new edge type.

### Diacritic names as semantic checksums

* **Checksum rule:** every diacritic (\delta) has:
  1. a **glyph micro-graph** over primitives {Y,V} with placement (Rosh/Toch/Sof; above/inside/below), and
  2. a **name program** (Hebrew letters spelling its name) whose composed operator must imply the same behavior class.
* The name program is a **secondary constraint**: if glyph-meaning and name-meaning disagree, revise glyph semantics until they agree, or explicitly mark the diacritic as “non-checksummed.”

**Inside-dot typing:** a dot inside the host letter is typed by `inside_dot_kind ∈ {dagesh, shuruk, mappiq, shin_dot_right, shin_dot_left, none}` with deterministic compilation:

* If host glyph is ו and inside dot present → `inside_dot_kind=shuruk`.
* Else if host glyph is in `{ב, ג, ד, כ, ך, פ, ף, ר, ת}` and dot present → `inside_dot_kind=dagesh`.
* Else if host glyph is ה and dot present → `inside_dot_kind=mappiq` (placeholder, reserved).
* Else if host glyph is ש and dot present: right dot → `shin_dot_right`, left dot → `shin_dot_left`.
* Otherwise → `inside_dot_kind=none`.

`dagesh` sets `hard=1` and applies `HARDEN` to the Toch envelope. `shuruk` is a Toch modifier on ו (CarrierActivation). Shin/sin dots are Select-level branch activation for ש and are not niqqud or HARDEN.

**Name → invariants (from existing letter semantics)**

| Name | Invariant |
| --- | --- |
| י | pinned seed / handle-initiation |
| ו | carrier/channel / propagation / grouping (V-mode) |
| ח | gated compartment / mediated crossings (default-closed) |
| ל | endpoint fiber + door interface |
| מ | from-zone membrane OPEN (collect candidates) |
| ם | from-zone membrane CLOSE (commit/export membrane handle) |
| ק | ≈-interchangeability + representative selection (+ optional descent) |
| ר | unanchored head boundary (a=0) |
| ד | anchored head boundary (a=1) |
| ס | framed_lock support hull |
| צ/ץ | exemplar alignment / atomic aligned handle (in ץ) |
| ת | finalize-and-stamp (`policy=final`) |
| א | alias/transport merge |
| ב | interior frame shift (inside-of) |

* `Expand(c) := milui(c)` if declared, else `[c]`.
* `INV(name) := inv(Expand(c1) + Expand(c2) + … + Expand(ck))`.
* Expansion depth defaults to `1`; recursive expansion is disabled unless explicitly enabled.

### Diacritic notes (expanded)

#### Patach (ַ) — gate/clamp export (Sof)

* **MicroGraph:** `V(L,R)`
* **Tier:** `Sof`
* **Semantics:** `Gate` (`edge_mode=gated`, controlled gate on export span between L/R ports)
* **NameSignature:** utterance-export + finalize-stamp + gated-compartment ⇒ controlled gate.

#### Tzere (ֵ) — two-rail stabilization (Sof)

* **MicroGraph:** `Y(L)+Y(R)`
* **Tier:** `Sof`
* **Semantics:** `Stabilize` (`edge_mode=stabilized`, `support_pins={L,R}`, optional `head_hint=unanchored`)
* **NameSignature:** exemplar-align + pin + unanchored-head + pin.

#### Hiriq (ִ) — rep-token commit (Sof)

* **MicroGraph:** `Y((sof, C))`
* **Tier:** `Sof`
* **DesugarsTo:** `Y_C^in ⊕ Y_C^out` (implicit inside Seal)
* **Semantics:** `RepTokenCommit` (`h1 := GateShell(h)`, `h2 := Pin_in(h1)`, `h3 := HeadHint(unanchored, h2)`, `h4 := Pin_out(h3)`, `h5 := MarkAsRepresentative≈(h4)`, `edge_mode=committed`)
* **NameSignature:** gated + pin + unanchored head + pin + ≈.

#### Segol (ֶ) — converge / TO (Sof)

* **MicroGraph:** `Y(L)+Y(R)+Y(C)`
* **Tier:** `Sof`
* **Semantics:** `ConvergeToEndpoint` (`edge_mode=convergent`, `commit_node=C`, optional `endpoint_bias=true`)
* **NameSignature:** framed_lock + bestowal (י–מ–ל) + channel + endpoint.

#### Kamatz (ָ) — span + commit (Sof)

* **MicroGraph:** `V(L,R)+Y(C)`
* **Tier:** `Sof`
* **Semantics:** `CommitRepresentativeToAtomic` (`CommitRepresentative(≈-class, FromZone) → AtomicHandle`, `edge_mode=committed`)
* **NameSignature:** ≈ + membrane-open + atomic finalize.

#### Shva (ְ) — branch collapse (Sof)

* **MicroGraph:** `Y(C₁)+Y(C₂)`
* **Tier:** `Sof`
* **Semantics:** `CollapseToAlias` (`BranchPotential → CollapseToAlias`, `edge_mode=collapsed`)
* **NameSignature:** branch + channel + alias.

#### Kubutz (ֻ) — directed bundling (Sof)

* **MicroGraph:** `Seq[Y(p1), Y(p2), Y(p3)]` (diagonal order)
* **Tier:** `Sof`
* **Semantics:** `Bundle` (bundle via ≈ + interior-shift + atomize (ץ), `edge_mode=bundled`)
* **NameSignature:** ≈ + channel + interiorize + channel + atomic.

#### Cholam (ֹ) — head bias (Rosh)

* **MicroGraph:** `Y((rosh, L))`
* **Tier:** `Rosh`
* **Semantics:** `HeadBiasToSealedEndpoint` (bias selection toward endpoint structures with closure-ready policy or sealed interface handles)
* **NameSignature:** gated-compartment + channel + endpoint + mem-close.

#### Shuruk (וּ) — carrier activation (Toch)

* **MicroGraph:** `Y((toch, C))` on ו
* **Tier:** `Toch`
* **Semantics:** `CarrierActivation` (implemented as (\delta_{\text{toch}}) on ו: set carrier mode = seeded/transport and inject ≈-representative flag)
* **NameSignature:** branch + carrier + unanchored head + carrier + ≈.
* **Host typing:** `inside_dot_kind=shuruk`.

#### Dagesh (ּ) — harden envelope (Toch)

* **MicroGraph:** `Y((toch, C))` inside the host letter
* **Tier:** `Toch`
* **Semantics:** `HARDEN` (apply to the letter’s Toch-envelope)
* **NameSignature:** non-checksummed (hard bit)
* **Host typing:** `inside_dot_kind=dagesh` (typed at compile time).

### Inventory (glyph → tier → micro-graph → trace effect → host constraint)

| Glyph | Tier | Micro-graph | Effect | NameSignature | HostConstraint |
| --- | --- | --- | --- | --- | --- |
| patach (ַ) | Sof (below) | `V(L,R)` | `Gate` (controlled gate) | utterance-export + finalize-stamp + gated-compartment ⇒ controlled gate | none |
| tzere (ֵ) | Sof (below) | `Y(L)+Y(R)` | `Stabilize` (`edge_mode=stabilized`, `head_hint=unanchored`) | exemplar-align + pin + unanchored-head + pin | none |
| hiriq (ִ) | Sof (below) | `Y((sof, C))` | `RepTokenCommit` (compressed pin-pair, `edge_mode=committed`) | gated + pin + unanchored head + pin + ≈ | none |
| segol (ֶ) | Sof (below) | `Y(L)+Y(R)+Y(C)` | `ConvergeToEndpoint` (`edge_mode=convergent`) | framed_lock + bestowal (י–מ–ל) + channel + endpoint | none |
| kamatz (ָ) | Sof (below) | `V(L,R)+Y(C)` | `CommitRepresentativeToAtomic` (`edge_mode=committed`, declared `out_type`) | ≈ + membrane-open + atomic finalize | none |
| shva (ְ) | Sof (below) | `Y(C₁)+Y(C₂)` | `CollapseToAlias` (`edge_mode=collapsed`) | branch + channel + alias | none |
| kubutz (ֻ) | Sof (below) | `Seq[Y(p1), Y(p2), Y(p3)]` | `Bundle` (`edge_mode=bundled`) | ≈ + channel + interiorize + channel + atomic | none |
| cholam (ֹ) | Rosh (above) | `Y((rosh, L))` | `HeadBiasToSealedEndpoint` (bias toward sealed endpoint handles) | gated-compartment + channel + endpoint + mem-close | none |
| shuruk (וּ) | Toch (inside) | `Y((toch, C))` on ו | `CarrierActivation` (δ_toch on ו) | branch + carrier + unanchored head + carrier + ≈ | inside_dot_kind=shuruk |
| dagesh (ּ) | Toch (inside) | `Y((toch, C))` | `HARDEN` (Toch envelope) | non-checksummed (hard bit) | inside_dot_kind=dagesh |

### Compositional identities

**Glyph composition**

* `segol.graph = tzere.graph ⊕ hiriq.graph`
* `kamatz.graph = patach.graph ⊕ hiriq.graph`
* Here “⊕” is micro-graph overlay, not behavioral equivalence.
* “⊕” is pure overlay on marks; behavioral composition is defined by the tier wrapper and may include implicit desugaring (e.g., hiriq compression).
* `segol.behavior ≠ tzere.behavior ∘ hiriq.behavior` in general; behavior-class is assigned by a recognizer over the final graph plus tier.

**Classification (graph-only)**

* Recognize diacritics by micro-graph pattern at tier; assign behavior by class.
* If graph = `Y(L)+Y(R)+Y(C)` at Sof ⇒ **segol** ⇒ `ConvergeToEndpoint`.
* If graph = `V(L,R)+Y(C)` at Sof ⇒ **kamatz** ⇒ `CommitRepresentativeToAtomic`.
* If graph = `Y((toch, C))` inside and `inside_dot_kind=shuruk` ⇒ **shuruk** ⇒ `CarrierActivation`; if `inside_dot_kind=dagesh` ⇒ **dagesh** ⇒ `HARDEN`.
* Chataf variants and diagonals: pending.

### Diacritic VM effects

* `Gate(h: Handle) -> Handle`: annotate `h` with `edge_mode=gated` and `gate_span=(L,R)`; preserve handle kind.
* `Stabilize(h: Handle) -> Handle`: set `edge_mode=stabilized`, record `support_pins={L,R}`, and optionally set `head_hint=unanchored`.
* `RepTokenCommit(h: Handle) -> Handle`: `h1 := GateShell(h)` (minimal ח-like interface shell), `h2 := Pin_in(h1)`, `h3 := HeadHint(unanchored, h2)` (hint only), `h4 := Pin_out(h3)`, `h5 := MarkAsRepresentative≈(h4)` (set ≈-rep), set `edge_mode=committed`.
* `ConvergeToEndpoint(h: Handle) -> Handle`: set `edge_mode=convergent`, `commit_node=C`, optional `endpoint_bias=true`.
* `CommitRepresentativeToAtomic(h: Handle) -> ArtifactHandle`: finalize representative as `ArtifactHandle(payload=rep, policy=final)` (declared `out_type`), `edge_mode=committed`.
* `CollapseToAlias(h: Handle) -> AliasHandle`: create alias handle tying branches with `transports=on` (declared `out_type`), `edge_mode=collapsed`.
* `Bundle(h: Handle) -> ArtifactHandle`: bundle ≈-class with interior-shift, `policy=final` (declared `out_type`), `edge_mode=bundled`.
* `HeadBiasToSealedEndpoint(ops_sel) -> ops_sel`: add `prefer_endpoint+sealed` to selection policy.
* `CarrierActivation(cons) -> cons`: set `carrier_mode=seeded` and `rep_flag=1` (on ו).
* `HARDEN(cons) -> cons`: apply to envelope `E = {ctx_flow, x_flow, data_flow, edit_flow, ports, coupling, policy}` with:
  1) `ctx_flow := LOW` and remove implicit inheritance edges unless explicit in `ports`.
  2) `x_flow := EXPLICIT_ONLY`, `ports := ports ∩ ExplicitPorts` (default `∅`).
  3) `data_flow := SNAPSHOT`, `coupling := CopyNoBacklink`.
  4) `policy := policy_raise(policy)` (`soft → framed_lock → final`), `edit_flow := tightened`.

**Diacritic typing constraints:** (\delta_{\text{rosh}}) may only reorder/weight selection preferences; (\delta_{\text{toch}}) may only change bounds/patch metadata; (\delta_{\text{sof}}) may allocate a new handle only if its output type is declared, otherwise it preserves the input handle kind.
Declared `out_type` effects: `CommitRepresentativeToAtomic`, `CollapseToAlias`, `Bundle`.
**Dagesh default:** `inside_dot_kind=dagesh` sets `hard=1` and applies `HARDEN` to the Toch envelope.

### Validation: glyph ↔ name coherence

* `behavior_class(\delta) ∈ {Gate, Stabilize, ConvergeToEndpoint, RepTokenCommit, CommitRepresentativeToAtomic, CollapseToAlias, Bundle, HeadBiasToSealedEndpoint, CarrierActivation, HARDEN}`.
* For each diacritic (\delta): record `(tier, micro-graph, behavior-class, NameSignature)`.
* Require that the derived name behavior matches the glyph behavior (see functions below).

Define:

* `inv(·): letter → invariant-tag` (table above)
* `INV(name) := inv(Expand(c1) + … + Expand(ck))` as an ordered list
* `Let (BC_name, reasons) := behavior_class_from_invariants(INV(name), tier)`

Require: `BC_glyph(\delta) == BC_name` and `tier` matches before acceptance.

`behavior_class_from_invariants(INV, tier)` returns `(class, reasons)` with rule precedence (rules may inspect order; defaults use containment) and assumes milui-expanded `INV`:

* If `tier=Rosh`, only Rosh rules are considered; if `tier=Toch`, only Toch rules are considered; otherwise treat the remaining rules as Sof-tier rules.
* Rule order is fixed; first match wins.

* if `tier=Toch` and INV contains “carrier/channel” → `CarrierActivation`
* else if `tier=Rosh` and INV contains “gated compartment” (ח) and “carrier/channel” (ו) and “endpoint fiber” (ל) and “from-zone membrane CLOSE” (ם) → `HeadBiasToSealedEndpoint`
* else if INV contains “≈-interchangeability” and “unanchored head boundary” (ר) and two “pinned seed” (י twice) → `RepTokenCommit`
* else if INV contains “unanchored head boundary” (ר) and two “pinned seed” (י twice) and not “≈-interchangeability” → `Stabilize`
* else if INV contains “alias/transport” → `CollapseToAlias`
* else if INV contains “≈-interchangeability” and “from-zone membrane OPEN” (מ) and “atomic aligned handle” (ץ) → `CommitRepresentativeToAtomic`
* else if INV contains “≈-interchangeability” and “atomic aligned handle” (ץ) → `Bundle`
* else if INV contains “endpoint fiber” (ל) and “framed_lock support hull” (ס) → `ConvergeToEndpoint`
* else if INV contains “finalize-and-stamp” (ת) and “gated compartment” (ח) → `Gate`
* else → `Unknown` (must be explicitly marked non-checksummed)

### Distance metric (optional)

* Structural distance = graph edit distance on {Y,V}
* Zone penalty for above/inside/below mismatch
* Axis penalty for horizontal vs vertical vs diagonal patterns

### Example: אל with vowel modifiers

* Base trace: `א → ל`.
* `אַל` uses patach (Sof: `V(L,R)`) ⇒ export becomes a controlled gate.
* `אֵל` uses tzere (Sof: `Y(L)+Y(R)`) ⇒ stabilize rails with `head_hint=unanchored`.
* `אֶל` uses segol (Sof: tzere + hiriq) ⇒ supported frame + rep-token commit ⇒ converge-to-lamed.

---

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
