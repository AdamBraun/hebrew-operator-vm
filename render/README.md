# Rendering Lexicon

`render/lexicon.v1.yml` is the controlled vocabulary for atomic English rendering.

## Contract

- `lexicon_version`: lexicon schema/version (independent from trace schema).
- `render_version`: must match `src/reference/version.ts` `RENDER_VERSION`.
- `style`: currently `atomic`.
- `verbs`, `nouns`, `roles`: the only allowed terms for atomic emitters.
- `event_templates`: canonical render template per trace event kind.

## Atomic Style Rules

- Literal wording only.
- No metaphor.
- No synonym substitution (`synonyms_policy: none`).
- Emit only canonical terms from the lexicon.
- Event phrase shape: `<verb> <noun>...` (stable order, lowercase, ASCII).

## How To Extend Without Breaking Diffs

1. Additive only:
   keep existing terms and templates stable; add new terms only when a new event semantic requires them.
2. One event, one template:
   every trace event kind must have exactly one atomic template.
3. No implicit aliases:
   if wording changes, treat it as a render contract change and bump `render_version`.
4. Version discipline:
   any change under `render/` requires a `RENDER_VERSION` bump in
   `src/reference/version.ts`.
5. Validate before merge:
   run render lexicon tests to ensure no duplicates, required baseline terms exist,
   and all emitted tokens are in-lexicon.
