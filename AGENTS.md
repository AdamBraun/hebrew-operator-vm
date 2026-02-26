# AGENTS.md

## Verification Rules (Hard)

1. Never bypass verification hooks. `--no-verify` is forbidden.
2. `pre-commit` and `pre-push` checks must run and pass before commit or push.
3. If hooks fail due artifact drift, run the required regeneration/repair and re-run checks until clean.
4. Do not commit or push changes until you understand and can explain output ramifications.
