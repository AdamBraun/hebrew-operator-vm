# Lexical Structure

## Alphabet

- Base letters: `א…ת` plus final forms `ך, ם, ן, ף, ץ`.
- Space operator: `□` (semantic boundary token).

## Token structure

```
Token = {
  letter: Letter | 'שׁ' | 'שׂ' | '□',
  attachments: Modifier[]
  features: {
    inside_dot_kind?: 'dagesh' | 'shuruk' | 'mappiq' | 'shin_dot_right' | 'shin_dot_left' | 'none'
  }
}
```

## Parsing rules (domain-agnostic)

- ASCII whitespace (` `, `\t`, `\n`) is semantic and tokenizes to a single `□`.
- Runs of whitespace collapse to **one** `□`.
- The input stream is executed with **implicit leading and trailing `□`**.
- Attachments (niqqud/diacritics) are bound to the nearest base letter and typed by tier.

## Attachment tiers

- **Rosh (above):** rosh-tier modifier.
- **Toch (inside):** toch-tier modifier.
- **Sof (below):** sof-tier modifier.

## Inside-dot disambiguation

A dot inside a host letter is **not** a separate modifier. It sets `features.inside_dot_kind` by deterministic rules:

- Host `ו` + inside dot → `shuruk`.
- Host in `{ב, ג, ד, כ, ך, פ, ף, ר, ת}` + inside dot → `dagesh`.
- Host `ה` + inside dot → `mappiq` (reserved).
- Host `ש` + dot on right → `shin_dot_right` and token letter `שׁ`.
- Host `ש` + dot on left → `shin_dot_left` and token letter `שׂ`.
- Otherwise → `none`.

Modifier semantics use `inside_dot_kind` to dispatch to the appropriate toch- or rosh-tier behavior.

For plain `ש` without a shin/sin dot, token letter remains plain `ש` (or profile-defined ambiguity handling, if enabled).
