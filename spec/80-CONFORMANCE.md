# Conformance Levels

Implementations MUST declare the highest level they satisfy and MUST pass the corresponding tests under `/tests/`.

## L0 Core VM

- Tokenization and lexical rules
- VM execution model
- Determinism rules
- Space (`□`) semantics
- No requirement to implement full letter library

## L1 Modifier Engine

- Attachment typing and tiered modifier application
- Inside-dot disambiguation
- Modifier constraints from `spec/50-MODIFIER-SYSTEM.md`

## L2 Letter Library

- Full operator definitions from `/letters/`
- Registry consistency with `/registry/letters.yaml`
- All letter-level tests under `/tests/letters/`

## L3 Profile Runtime

- End-to-end tests for at least one profile under `/profiles/*`
- All required profile tests under `/tests/profiles/<profile>/`
