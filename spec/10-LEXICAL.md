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
    dot_kind?: 'dagesh' | 'shuruk' | 'mappiq' | 'none',
    inside_dot_kind?: 'dagesh' | 'shuruk' | 'mappiq' | 'shin_dot_right' | 'shin_dot_left' | 'none'
    letter_mode?: 'plain' | 'seeded' | 'transport',
    is_final?: boolean
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

- If `U+05BC` appears on host `ה` → `dot_kind=mappiq`, `inside_dot_kind=mappiq`.
- Else if `U+05BC` appears on host `ו` and no other Sof vowel marks are present → `dot_kind=shuruk`, `inside_dot_kind=shuruk`.
- Else if `U+05BC` appears → `dot_kind=dagesh`, `inside_dot_kind=dagesh`.
- Host `ש` + dot on right → `shin_dot_right` and token letter `שׁ`.
- Host `ש` + dot on left → `shin_dot_left` and token letter `שׂ`.
- Otherwise → `dot_kind=none`, `inside_dot_kind=none`.

Modifier semantics use `dot_kind`/`inside_dot_kind` to dispatch to the appropriate toch- or rosh-tier behavior.

`mappiq` is lexical classification only. It does not imply any retired letter-specific mode branch or declaration behavior for `ה`.

For plain `ש` without a shin/sin dot, token letter remains plain `ש` (or profile-defined ambiguity handling, if enabled).
