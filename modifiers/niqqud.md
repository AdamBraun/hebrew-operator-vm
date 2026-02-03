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

## Inventory

| Glyph       | Tier | Micro-graph              | Behavior                       | Host constraint          |
| ----------- | ---- | ------------------------ | ------------------------------ | ------------------------ |
| patach (ַ)  | Sof  | `V(L,R)`                 | `Gate`                         | none                     |
| tzere (ֵ)   | Sof  | `Y(L)+Y(R)`              | `Stabilize`                    | none                     |
| hiriq (ִ)   | Sof  | `Y((sof,C))`             | `RepTokenCommit`               | none                     |
| segol (ֶ)   | Sof  | `Y(L)+Y(R)+Y(C)`         | `ConvergeToEndpoint`           | none                     |
| kamatz (ָ)  | Sof  | `V(L,R)+Y(C)`            | `CommitRepresentativeToAtomic` | none                     |
| shva (ְ)    | Sof  | `Y(C₁)+Y(C₂)`            | `CollapseToAlias`              | none                     |
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

If `BC_glyph` differs from `BC_name`, the modifier MUST be marked non-checksummed.
