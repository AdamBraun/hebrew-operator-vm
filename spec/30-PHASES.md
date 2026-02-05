# Phases

Each token executes as:

```
Select → Bound → Seal
```

## Phase contracts

### Select

- **Inputs:** current abstract state and VM registers.
- **Outputs:** `(state, operands_sel)`.
- **Allowed effects:** read-only over persistent state; MAY update registers that track focus/selection context.
- **Disallowed:** allocating new handles or mutating envelope traits.

### Bound

- **Inputs:** `(state, operands_sel)`.
- **Outputs:** `(state, construction)`.
- **Allowed effects:** compute and/or mutate envelope traits (policies, coupling, ports) for the construction.
- **Optional tagging:** `Bound` MAY tag patches as `interior` or `frame` so policy levels can deterministically gate edits.
- **Disallowed:** exporting artifacts or allocating new handles.

### Seal

- **Inputs:** `(state, construction)`.
- **Outputs:** `(state, handle_out, residue_out)`.
- **Allowed effects:** allocate new handles, commit/export artifacts, update stacks and residue.

## Modifier tiers

Modifiers wrap phases as follows:

- **Rosh-tier:** after `Select`, before `Bound`.
- **Toch-tier:** after `Bound`, before `Seal`.
- **Sof-tier:** after `Seal`.

Formally:

```
Select^δ(S) := let (S1, ops) = Select(S) in δ_rosh(S1, ops)
Bound^δ(S, ops) := let (S1, cons) = Bound(S, ops) in δ_toch(S1, cons)
Seal^δ(S, cons) := let (S1, h, r) = Seal(S, cons)
                  in let (S2, h') = δ_sof(S1, h)
                     in (S2, h', r)
```

Where only one of `δ_rosh`, `δ_toch`, `δ_sof` is non-identity for a simple modifier.

## Obligations

Letters MAY open obligations during `Seal`, which are resolved by other letters or by `□` (space) at word boundaries. Obligation rules are defined in `spec/60-VM.md`.
