## Mission statement

Define the Hebrew alphabet (including space) as a deterministic operator calculus over an explicit state space (“classroom world”).

* Alphabet: (\Sigma = {\text{א…ת}, \text{ך, ם, ן, ף, ץ}, \square}) where (\square) is space.
* State: (S\in\mathcal{S}) is a complete classroom configuration.
* Each letter (\ell\in\Sigma) denotes an operator (f_\ell:\mathcal{S}\to\mathcal{S}).
* **Universal stroke substrate (latest):** letters factor through seed/extension optionally:
  [
  f_\ell \;=\; \Delta_\ell \circ V^{v(\ell)} \circ Y^{y(\ell)}
  ]
  Interpretation: the only **primitive subroutines** used by any phase are Y and V; (\Delta_\ell) specifies *where* and *how many times* they are invoked across Select/Bound/Seal.
  This equation is a schematic normal form, not a claim that Y runs before V in time.
  with identities (Y^0=\mathrm{Id}), (V^0=\mathrm{Id}), and (y(\ell),v(\ell)\in\mathbb{N}), with default (y(\ell),v(\ell)\in\{0,1\}) unless (\Delta_\ell) specifies higher multiplicity.
  (Y) is the **י**-primitive (seed/pin/handle-initiation), (V) is the **ו**-primitive (extension/channel/propagation), and (\Delta_\ell) is the letter-specific sculptor.
  Diacritics are additional typed micro-graphs attached to Select/Bound/Seal phases; they do not introduce new primitives beyond Y/V.
  **Space** is treated as a runtime step instruction (see “Execution engine”), not as a stroke factorization.
* Each operator is specified by three primitives:

[
f_\ell(S)=\mathrm{Seal}_\ell(\mathrm{Bound}_\ell(\mathrm{Select}_\ell(S)))
]

* `Select_\ell : S \to (S, \text{operands}_{\text{sel}})` (may be pure or may update registers)
* `Bound_\ell : (S, \text{operands}_{\text{sel}}) \to (S, \text{construction})`
* `Seal_\ell : (S, \text{construction}) \to (S, \text{handle}, \text{residue})` (generative, pushes to stack / sets (F), always yields residue)

* **Select:** choose a handle (X) (a target, region, axis, or fiber) from the current focus/context.
* **Bound:** impose an **envelope** on what (X) can mean/do/contain. The output is “(X) inside bounds.”
* **Seal:** commit that bounded object as an addressable entity for later composition and cascade, and return the excluded residue handle (or (\bot)).
* **Alloc (Seal is generative):** `Seal_\ell` may allocate fresh, typed handles. Formally: `Seal_\ell : (state, construction) → (state', handle_id, residue_id)` where `handle_id` is new unless a canonical ID scheme is reused.
* **Handle IDs:** choose a deterministic rule such as `id := (\ell,\tau,local_counter)` or `id := hash(\ell,inputs,bounds,policy)`.
* **Edit policy (on seals):** each sealed handle carries `policy ∈ {soft, framed_lock, final}` (default `soft`). `framed_lock` blocks frame rewrites but allows interior edits; `final` blocks all mutation. `Bound` emits patches tagged as `interior` or `frame` so policies can deterministically gate edits.

* **Internal vs external (latest):** every operator has (i) an **internal act** (what it constructs/changes inside the focus) and (ii) an **external residue** (what becomes “outside” as a necessary side-effect, typically realized as partitions/boundaries and logged events). This is treated explicitly in the state (Boundaries (B) + event log (H)).
* **Kedushah vs le’umat-zeh as anchoring (latest):** model as an **anchor bit** on handles/boundaries:
  (a=1) = anchored/internal/receiving (bittul-mode), (a=0) = unanchored/external/autonomous (yeshut-mode).

* If a word is written as (\ell_1\ell_2\dots\ell_n) (right-to-left), execution applies them in reading order:
  [
  S' = f_{\ell_n} \circ \dots \circ f_{\ell_2} \circ f_{\ell_1}(S)
  ]
* The semantics is **cascade-compatible**: bounds are stored with a scope/target and can be refined later by narrower selection.

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

## Execution engine (determinism)

Augment the execution context with explicit registers:

* Ambient handle (\Omega): canonical “current world/root scope” handle (exists even in the void).
* Empty handle (\bot): canonical empty scope / no-outside handle; always exists.
* Handle stack (K): LIFO stack of sealed handles (top = most recent).
* Environment stack (E): frames with (F, \lambda, \Omega_\text{frame}) for nested scoping.
* Residue handle (R): canonical “outside remainder” of the last op (addressable); never undefined (defaults to (\bot)).
* Watchlist (W): persistent selectors created by ע.
* Word obligation stack (OStack_word): pending obligations opened inside a word; resolved by specific letters or by space/end-of-input using a per-kind boundary default.

**Obligation types:**

```
OKind := { MEM_ZONE, SUPPORT }

Obligation := {
  kind: OKind,
  parent: handle_id,       // focus before opening
  child:  handle_id,       // handle/zone produced by opening
  payload: map,            // kind-specific (may be empty)
  tau_created: int
}

OStack_word: stack<Obligation>   // LIFO
```

**Derived predicates (no new handle metadata):**

```
is_bent(h)  := exists o in OStack_word with o.kind=SUPPORT and o.child <=cont* h
is_open_mem(z) := exists o in OStack_word with o.kind=MEM_ZONE and o.child == z
```

**Initial registers (before first token):** (\Omega := \text{ScopeHandle(world\_root)}), (F := \Omega), (R := \bot), (K := [F, R]), (W := []), (OStack_word := []).

**Deterministic selection policy:** each letter declares (arity\_req(\ell), arity\_opt(\ell)). Required operands are sourced in order: pop from (K), then from (W), then current (F), then (R), then (\Omega). Optional operands are only supplied if available without forcing duplicates.

**Distinctness policy:** each letter declares (distinct\_required(\ell), distinct\_optional(\ell)). Distinctness checks apply within each bucket.

**Underflow policy:** if required operands are missing, fill as follows: if (reflexive\_ok(\ell)=true), duplicate the last selected operand; otherwise fill with (\bot). If any filled operand violates the operator’s type signature, the word is ill-formed (compile error).

**Deterministic seal policy:** Seal pushes (h\_out) onto (K), sets (F:=h\_out) in the current frame, and sets (R:=r\_out).

**Residue totality:** every letter yields (r\_out). If the operation is total over its focus, set (r\_out := \bot).

### Tokenization and attachment

* A letter token may carry a set of diacritics as compile-time attachments and an `inside_dot_kind` feature; if `inside_dot_kind=dagesh` then `hard=1`.
* During execution of a token ((\ell,\delta)), apply the phase modifier(s) before stepping to the next token.
* Space remains a runtime step; it resolves any pending obligations at word boundaries.
* The input stream is executed as if it begins with an implicit leading space (\square).

**Space (\square):**

```
Space(□):

1) τ := τ + 1

2) Resolve all pending obligations in OStack_word using boundary defaults:

   while OStack_word not empty:
     o := pop(OStack_word)

     case o.kind of

       MEM_ZONE:
         // boundary default = close silently (commit without export)
         CloseMemZoneSilently(o.child)
         // no handle is exported; no changes to F required

       SUPPORT:
         // boundary default = FALL (nefilah)
         log H += fall(o.child, o.parent, τ)
         R := o.child
         F := o.parent

3) Commit micro-trace/event batch to H (if you buffer per word)

4) Apply fixed stack discipline (reset K to [F, R] or keep top-k + Ω)

5) Garbage collect (optional cadence):
   roots := {Ω, F} ∪ K ∪ W ∪ {R}
   delete unreachable handles not in roots; keep policy=final artifacts as compact
```

**Boundary defaults (per kind):**

```
BoundaryDefault(kind):

MEM_ZONE  -> CloseMemZoneSilently(zone); no export; F unchanged
SUPPORT   -> FALL: log fall(child,parent,τ); R:=child; F:=parent
```

**Well-formedness (strict nesting):** obligations are properly nested and must be discharged in LIFO order. Dischargers may only consult `top(OStack_word)`; non-LIFO patterns are compile errors.

**Garbage collection:** at space (or every N steps), delete handles not reachable from roots `{\Omega, F} ∪ K ∪ W ∪ {R}`; keep compact representations for `policy=final` artifacts.

**Per-letter metadata:** each letter declares `arity_req(\ell)`, `arity_opt(\ell)`, `distinct_required(\ell)`, `distinct_optional(\ell)`, `reflexive_ok(\ell)`, input/output handle kinds, residue emission (updates to R), allowed coercions, and whether `Seal_\ell` allocates a new handle kind.

### Minimal test suite (obligation semantics)

* **T1 — Unresolved nun falls at boundary**
  * Program: `נ □`
  * Expected: event log contains `fall(child,parent,τ)`, (F) equals the pre-נ focus, and (R) equals the child created by נ.
* **T2 — Nun stabilized by samekh does not fall**
  * Program: `נ ס □`
  * Expected: no `fall` event for that nun, `policy(F)` is `framed_lock` after ס, and (F) remains in the supported continuation at boundary.
* **T3 — Final nun does not leave pending support**
  * Program: `ן □`
  * Expected: no `fall` event and `policy(F)` is `framed_lock`.
* **T4 — Mem pending closes silently at boundary (no export)**
  * Program: `מ □`
  * Expected: no exported mem handle pushed to (K) by boundary; the internal mem zone is closed via `CloseMemZoneSilently`.
* **T5 — Final mem exports handle**
  * Program: `מ ם □`
  * Expected: a stable mem handle is exported and becomes (F) before boundary; no pending (MEM_ZONE) remains at boundary.

---

## Classroom state space (\mathcal{S})

Use a minimal but sufficient classroom model:

* **Entities**

  * Students (U)
  * Groups (G) (each (g\subseteq U))
  * Class (C=U)
  * Tokens/bels (L) (e.g., “leader”, “quiet”, “pink-background”, “speaking-permission”)

* **Handles (typed)**

  * `ScopeHandle(scope_id, …)`
  * `EntityHandle(entity_id, …)`
  * `BoundaryHandle(boundary_id, inside_scope, outside_scope, anchor_bit a, …)`
  * `AliasHandle(alias_id, h1, h2, transports, …)`
  * `RuleHandle(rule_id, target_scope, patch, priority, …)`
  * `ArtifactHandle(artifact_id, payload, policy=final, …)`
  * `EmptyHandle(\bot)` (canonical empty scope)

* **Relations / facts**

  * Equality (=) on entities (your א)
  * Indistinguishability (\approx) on entities (your ק)
  * Membership (\in): student-in-group
  * Links (E): directed labeled links between entities (e.g., “talks-to”, “paired-with”)
  * Continuation links (E_cont): labeled cont edges, (cont(u,v)\in E_cont), with reachability (u <=cont* v) via zero-or-more cont steps
  * Boundaries (B): separations (who is partitioned from whom)
  * Anchor-tags (A): per-handle/per-boundary anchoring metadata (a\in\{0,1\}) (anchored/internal vs unanchored/external)
  * Policies (P): per-handle edit policy ({soft, framed_lock, final})
  * Edge modes (EM): per-handle metadata `edge_mode ∈ {free, gated, stabilized, convergent, committed, bundled, collapsed}`.
  * Head hints (H): optional metadata `head_hint ∈ {anchored, unanchored, none}`; hints do not override anchor bit (a).

* **Typing constraints**

  * Membership (\in) only applies between `EntityHandle` and `ScopeHandle`.
  * Head constructors consume `ScopeHandle` and produce `BoundaryHandle`.
  * Letters declare input/output handle kinds and must respect them.
  * Each letter declares (in\_types\_req, in\_types\_opt, out\_type) and a finite list of allowed coercions; if no coercion exists, mismatched kinds are a compile error.

* **Cascade layer**

  * A set of rules (\Phi), each rule is ((\text{target}, \text{bound}, \text{priority}))

* **Execution context (VM registers)**

  * Ambient handle (\Omega): canonical world/root handle
  * Focus (F): the current focus handle (students / groups / whole class)
  * Level (\lambda\in{\text{student},\text{group},\text{class}})
  * Time/step (\tau) and an event log (H) (for “sealing”)
  * Last-residue handle (R): canonical pointer to “what was excluded” by the latest op (defaults to (\bot))
  * Handle stack (K), environment stack (E), watchlist (W), and OStack_word as above

Initial state can be “infinite possibilities” by taking (\Phi=\top) (no bounds), (F=C), and leaving entities unnamed until instantiated/refined.

---

## Letter operators on the classroom

For each letter: **Selection** (what it targets), **Bounding** (what becomes committed/addressable for later letters).

### א — Identification / alias with transport

* **Select:** pick two handles (h1,h2) intended to denote the same referent (possibly across two representations/views).
* **Bound:** assert (h1 \equiv h2) and register bidirectional transport maps T(h1\to h2), T(h2\to h1) that propagate constraints deterministically; resolve collisions via the existing cascade rule (priority/scope/recency).
* **Seal:** commit a single alias-handle a := Alias(h1,h2) so future addressing of h1 or h2 resolves to a (using transport when needed).

### ב — Containment / “inside”

* **Select:** an anchor (x) and an active containment relation (\operatorname{in}_C) (what counts as “inside Dan” depends on context (C)).
* **Bound:** shift the *reference frame* to the interior of (x):
  [
  B(x):;;\text{Context} := \operatorname{Int}_C(x)
  ]
  Meaning: subsequent names resolve **relative to (x)**.
* **Seal:** commit the scoping boundary “inside (x)” as the current ambient world until changed.


### ג — Directed bestowal (flow landing on a point)

* **Select:** source (x), recipient (y), and payload (p) with (p\in M(x)).
* **Bound:** add a directed bestowal (x \xrightarrow{\text{bestow }p} y) and re-key the payload as endpointed to the recipient (p \to \iota(y)) (the internal ל stage).
* **Seal:** log (\text{bestow}(x,p,y)) at (\tau), reify the transfer as a selectable handle, and shift focus toward the recipient (or union with it).
* **Internal factorization (milui):** ג = sealed pipeline of **י–מ–ל**: pin recipient (\iota(y)), extract payload from source (p\in M(x)), bind payload to recipient (p\in L(\iota(y))).
* **Note:** the shape reads as ו + י (flow terminating in a point), matching the directed landing semantics.
* **Optional (privacy):** the event may seal into a non-public layer when a discreet transfer is intended.

### ד — Boundary / door (anchored corner)

* **Select:** an inside `ScopeHandle` (F) and an outside scope (from R or boundary context).
* **Bound:** construct an anchored head boundary `Head_anchored(F, outside)` producing `BoundaryHandle(a=1)`.
* **Seal:** allocate the boundary handle, attach an anchored head pin and three deterministic ports (inside/surface/outside), and register it as a stable scope boundary for later selection.

### ה — Exposure / announcement

* **Select:** the currently focused targets/rules.
* **Bound:** mark selected bounds as “visible/public/declared”.
* **Seal:** commit to the public layer (like writing on the board): later rules can reference this as a named, time-stamped declaration.

### ו — Extension / channel + Connect (V primitive) (your classroom split)

* **Select:** two targets/sets (A,B) (often “the class” and a criterion/handle), plus an optional mode `V(mode)` where `mode ∈ {plain, seeded, transport}`.
* **Bound (internal act):** create a grouping/connection structure (bind/extend):

  * if (A) contains multiple students, induce a partition (A \to {g_1,\dots,g_k})
  * add links “member-of” from students to groups, and a link that ties all groups under one classroom-configuration
* **Seal:** **reify the groups as first-class objects** and switch level (\lambda:=\text{group}). After sealing, later letters can target groups as units (CSS-like specificity narrowing).
* **External residue (explicit):** any binding/partition induces an outside remainder (who is not in the induced structure); represent via (B) and (R).
* **Mode semantics:**

  * `plain` (וו): pure extension with no interior pivot.
  * `seeded` (ויו): extension through a pinned port (Y inside V).
  * `transport` (ואו): extension mediated by alias/transport (א inside V).
* **Note (latest):** this letter’s semantics also serves as the universal (V) prefix used implicitly by all letters in (f_\ell=\Delta_\ell\circ V^{v(\ell)}\circ Y^{y(\ell)}). The distinct “letter ו” is (V) plus its own (\Delta_\text{ו}); milui selects the mode.

### ז — Gate / armed channel (ו with bilateral head)

* **Select:** an existing relation involving the current focus (membership, pairing, continuation-link, flow).
* **Bound:** insert a guarded mediator on that relation (x \to y becomes x \to g \to y) and attach a policy bundle to g (throttle/allow/deny); “cut” is the forced-closed special case.
* **Seal:** reify g as a stable handle so later letters can refine the gate locally (cascade-compatible).
* **Note:** midrash frames ז’s tagin as oriented toward ו and ח, aligning the operator to the gate between open channel and closed boundary; זין = gate → pin → persist.

### ח — Enclosure / compartment (domain with a controlled interface)

* **Select:** a candidate interior handle (X) and its boundary-crossing relations (E_{\partial}(X)).
* **Bound:** construct a compartment (H(X)) and rewrite each crossing edge through a boundary gate (u \to v becomes u \to g_e \to v) with a default-closed policy; internal flow continues (left ו), external access is mediated (right ז).
* **Seal:** reify (H(X)) as a selectable scope and register its interface gates as addressable handles for later cascade refinement.
* **Note:** ח is formed from ו + ז bridged by a roof; חית suggests enclosure → pin → finalize.

### ט — Covert internalization with a single exported handle

* **Select:** current target handle (X) and an intended internal patch/action (\pi).
* **Bound:** apply (\pi) to the interior of (X) and mark it latent/hidden; create a single exported proxy/port (p=\mathrm{port}(X,\pi)) as the only outward handle.
* **Seal:** commit the hidden interior patch in a non-default layer and reify (p) as the only externally reachable handle to the hidden good.

### י — Seed / pin / handle-initiation (Y primitive)

* **Select:** an anchor (x) (a person/object already in focus).
* **Bound:** create the minimal *addressable seed* on/for (x):
  [
  \iota(x);;=;;\text{“the pinned handle of }x\text{”}
  ]
  This is not a class, not an interior, not a target—just the minimal “this-exact-one” hook that other relations can attach to.
* **Seal:** commit (\iota(x)) as stable under further refinement: subsequent letters may change what you look at *relative to* (x), but the hook stays (x).
  * **Interface lead (ו):** the pin includes a single exported attachment port so later letters can bind to it after focus shifts.
  * **Anchored interface (ד):** set anchor bit (a=1) by default; treat the pin as a micro door between anchored inside and ambient outside.
* **Note (latest):** this (Y) is the universal prefix used implicitly by all letters in (f_\ell=\Delta_\ell\circ V\circ Y). “Extra yuds” that distinguish letters (e.g., the yud-behind of ד vs ר) are not this base-seed; they live in (\Delta_\ell) as **anchoring** or other structural modifiers.


### כ / ך — Capacity-cast as portioning (kaf = כף)

* **Select:** target (x) and template (T) (implicit if absent).
* **Bound:** compute a capacity-limited portion and residue:

  * p := portion_T(x) (largest/canonical subpart of x that fits T)
  * r := x \ p
* **Seal:** commit p as a unitized handle (`unitized=1`), set focus to it, and return (r\_out := r).
  * **Final ך:** same, but additionally closes the relevant aspect to further refinement (policy gating).
* **Note:** “as/like” is the special case where T is another object/pattern (“x-as-Y”); “capacity/measure” is the case where T is a vessel/limit.

### ל — Endpoint interface (to/for, keyed-by)

* **Select:** endpoint (x) and an active “to/at” relation (\to_C), plus an optional source scope (s) from (F/R/\Omega).
* **Bound:** open a candidate membrane (M_s) as the domain of eligible (y), form the endpoint fiber (L_s(x)={y\in M_s\mid y\to_C x}), and cut an anchored door boundary that treats L_s(x) as the admitted-at-(x) interface.
* **Seal:** commit an `EndpointHandle(x, domain=M_s, fiber=L_s(x), door=D_x)` and set focus to it.
* **Note (milui):** למד reads as endpoint (ל) + domain membrane (מ) + anchored door (ד).

### מ / ם — From-zone (MEM-open / MEM-close)

#### מ — MEM-open (open from-zone as pending obligation)

* **Select:** current anchor/focus handle (x) and active “from/within” relation (\in_C).
* **Bound:** allocate a fresh zone handle (Z := MemZone(x)) representing (M(x):={y | y \in_C x}) as a soft membrane (refinable/nestable).
* **Seal:** push obligation:

  ```text
  push OStack_word := {
    kind=MEM_ZONE, parent=F, child=Z, payload={anchor:x}, tau_created=τ
  }
  ```

  Keep (F) unchanged (mem-open does not enter the zone).

#### ם — MEM-close (commit/export the nearest pending MEM zone)

* **Select:** current focus (F) (and implicit stack).
* **Bound/Seal (deterministic):**

  * If (top(OStack_word)) is (MEM_ZONE) with child (Z), then:

    ```text
    o := pop(OStack_word)  // must be MEM_ZONE
    Z := o.child
    CloseMemZone(Z)
    Export handle h := MemHandle(Z)
    push h to K; set F := h
    ```

  * If (OStack_word) is empty: perform (מ) then (ם) immediately on the current anchor, exporting the handle.
  * Otherwise, the word is ill-formed under strict nesting (compile error).

#### Boundary default (space/end-of-input)

Any remaining (MEM_ZONE) obligation is resolved as `CloseMemZoneSilently(Z)` and produces no exported handle.


### נ — Provisional continuation under carried obligation (opens SUPPORT debt)

* **Select:** current focus (F) and its effective bundle (\psi := \mathrm{eff}(F, \Phi)).
* **Bound:**

  1. allocate successor (F^{+} := \mathrm{Succ}(F))
  2. attach (\psi) to (F^{+})
  3. add edges:

     * (\mathrm{cont}(F, F^{+}))
     * (\mathrm{carry}(\psi)(F, F^{+}))

* **Seal:**

  1. push SUPPORT obligation:

     ```text
     push OStack_word := {
       kind=SUPPORT, parent=F, child=F^{+}, payload={}, tau_created=τ
     }
     ```

  2. set (F := F^{+})

### ן — Straightening continuation (SUPPORT opened and discharged immediately)

* **Select/Bound:** identical to נ, producing (F^{+}) and cont/carry edges.
* **Seal:**

  1. create the SUPPORT obligation then immediately discharge it:

     ```text
     push OStack_word := { kind=SUPPORT, parent=F, child=F^{+}, ... }
     o := pop(OStack_word)
     assert o.kind=SUPPORT and o.child=F^{+}
     ```

  2. set (policy(F^{+}) := framed_lock)
  3. set (F := F^{+})

### ס — Support-ring / stabilization hull

* **Select:** current handle (X), its active bounds, and its boundary surface (\partial X).
* **Bound:** impose a support hull (\mathrm{Hull}(X)) that forbids boundary-crossing drift by default and treats the structure as load-bearing; later operators may act inside (X) but cannot perturb the frame without explicit boundary rewrite.
* **Seal:** commit X^{\mathrm{stable}} and set `policy := framed_lock` so the cascade respects the hull.
  * **Discharge hook:** if `top(OStack_word)` is a SUPPORT obligation with (o.child <=cont* F), pop it and optionally log `support(o.child, F, τ)`. Under strict nesting, any other top kind is ill-formed for a support discharge.
* **Note:** סמך is “closed and not open” (wall-like enclosure) and “supports the low,” matching a bounded-but-self-holding frame.

### ע — עין (נ + ו at base)

* **Select:** pick a target (x) from current focus (F).
* **Bound:** create a persistent watch-handle on (x): a live tether (ו) that keeps “this target” selectable across later scope/focus shifts (the persistence aspect comes from the נ-thread).
* **Seal:** reify the watch-handle as an addressable selector (the recorded eye); it stays available even when (F) changes.
* **Key difference:** ע creates one persistent pointer, not multiple branches.

### פ — Mouth-open articulation (פה פתוח)

* **Select:** a speaker/source handle (x), an internal payload (q) representable as an interior scope (q\subseteq \operatorname{Int}(x)), and optionally an audience/target scope (T) (default: current ambient scope).
* **Bound:** form an utterance-object (u) that exports interior structure as an external bound; inject into (\Phi) a rule ((T,\text{bound}=u(q),\text{priority})).
* **Seal:** log (\text{utter}(x,q,T)) in (H) and reify the utterance as a handle; keep the mouth-channel open for further refinement/append.
* **Note:** the shape reads as a mouth boundary enclosing an interior ב; the sense is “export inside to outside.”

### ף — Mouth-closed articulation (פה סתום)

* **Select:** same as פ, targeting the currently open utterance handle (if present).
* **Bound:** no new bound required beyond what was emitted; the act is closure.
* **Seal:** freeze the utterance into an atomic, non-extendable rule object; the mouth-channel closes.

### צ — צדי (non-final)

* **Select:** current focus (F) and an exemplar (x^*\in F) (the pinned reference).
* **Bound:** enforce the exemplar’s effective bundle across all of (F); normalize the focus to one standard.
* **Seal:** commit the aligned state as the new baseline (cascade-compatible: later narrower selections may override locally).
* **Key difference:** צ is continuation under guidance of a pinned reference, not outward tethering.

### ץ — Final tsadi (צדי פשוט)

* **Select:** current focus (F) and exemplar (x^*\in F).
* **Bound:** same as צ: normalize (F) to the exemplar’s effective bundle.
* **Seal:** reify the aligned result as an atomic handle (A=\operatorname{Aligned}(F,x^*)); set focus to (A).

### ק — Indistinguishability (≈) + optional descent-to-action channel

* **Select:** two targets (x,y).
* **Bound:** assert (x\approx y) (treat as interchangeable for selection/rules, without identity merge).
  * **Optional (latest, qof-mode):** attach a “projection-to-action” channel (\pi_\downarrow) (a descender) allowing the ≈-equivalence to be *realized in execution* (think: similarity that can descend into concrete deeds/outputs).
  * **Optional (definition):** (\pi_\downarrow := \text{V-channel} \circ \text{closed-mouth seal}) so descent is a vav-transport followed by a final ף-style freeze.
* **Seal:** store (\approx)-class (and if present (\pi_\downarrow)) so later selectors may pick “any representative” unless forced to distinguish; execution may use (\pi_\downarrow) when the context enables descent. Descended artifacts are sealed as `policy=final` while (\approx) remains soft.
* **Note (milui):** קו״ף reads as ≈ plus a vav-channel and a final ף freeze; the name is the descender.

### ר — Corner / head-handle (unanchored; paired with ד)

* **Select:** an inside `ScopeHandle` (F) and an outside scope (from R or boundary context).
* **Bound:** construct an unanchored head boundary `Head_unanchored(F, outside)` producing `BoundaryHandle(a=0)`.
* **Seal:** allocate the boundary handle, attach a head pin (י-like) and three deterministic ports (ש-like: inside/surface/outside), and register it as a stable head for later selection.
* **Note (milui):** רי״ש (ראש) reads as head + pin + tri-port interface; the midrashic split (ראש/רע) matches the unanchored head (a=0).

### ש — שין (tilted ן spine + two ו attached at the terminal end)

* **Select:** current focus (F).
* **Bound:** produce a structured handle with three internal access points:

  * (F^{\text{spine}}): sealed baseline/continuation spine (the ן)
  * (F^{L}, F^{R}): two exported access-handles (the two ו)
    All three inherit the currently-effective constraint bundle of (F).
* **Seal:** replace focus by this structured object, with a deterministic default active branch.
* **שׁ vs שׂ:** when `inside_dot_kind=shin_dot_right`, activate (F^{R}); when `inside_dot_kind=shin_dot_left`, activate (F^{L}); the other handle remains latent/available.
* **Key difference:** ש creates multiple internal handles inside one construction, not parallel futures.

### ת — Hard-finalization + outward mark (תי״ו)

* **Select:** current active construction (F), its effective bundle (\psi=\mathrm{eff}(F,\Phi)), and its boundary context (B).
* **Bound:** close the scope with a terminal boundary (B_{\text{end}}(F)), freeze interior bounds from further refinement, and emit an outward mark (m(F)) on the external face of B_{\text{end}}(F).
* **Seal:** reify the completed artifact (A=(F,\psi,B_{\text{end}}(F),m(F))) in a completed registry, set `policy := final`, log (\mathrm{finalize}(A)) at (\tau), and shift focus to the outside residue.
* **Note:** ת encodes “finish-and-stamp”: dalet closure plus outward vav mark, pinned as an addressable handle.

### Space (\square) — Time-step / boundary

* **Select:** current scope.
* **Bound:** optionally none; it is a boundary between constructions.
* **Seal:** increment (\tau), resolve all pending obligations in (OStack_word) using boundary defaults (MEM_ZONE closes silently; SUPPORT falls), commit the micro-trace to (H), apply stack discipline (reset (K) to [F, R] or keep top-k + \Omega), and optionally close the current environment frame.
