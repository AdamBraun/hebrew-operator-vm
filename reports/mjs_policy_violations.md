# MJS Policy Violations

- mode: fail
- generated_at_utc: 2026-03-12T10:25:44.027Z
- touched_source: working_tree
- touched_files: 7
- files_scanned: 28
- wrappers_detected: 9
- legacy_business_logic: 19
- touched_legacy_business_logic: 0
- touched_legacy_exceptions: 0
- new_business_logic: 0
- blocking_violations: 0

## Classification

| file                                         | touched | classification        | touched_legacy_reason                                                                                                    |
| -------------------------------------------- | ------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| scripts/artifacts/config.mjs                 | no      | legacy_business_logic |                                                                                                                          |
| scripts/artifacts/lib.mjs                    | no      | legacy_business_logic |                                                                                                                          |
| scripts/artifacts/needs-update.mjs           | no      | legacy_business_logic |                                                                                                                          |
| scripts/artifacts/repair.mjs                 | no      | legacy_business_logic |                                                                                                                          |
| scripts/artifacts/verify-deep.mjs            | no      | legacy_business_logic |                                                                                                                          |
| scripts/artifacts/verify-pasuk-corpus.mjs    | no      | legacy_business_logic |                                                                                                                          |
| scripts/artifacts/verify.mjs                 | no      | legacy_business_logic |                                                                                                                          |
| scripts/compile-token-operators.mjs          | no      | legacy_business_logic |                                                                                                                          |
| scripts/download-torah.mjs                   | no      | wrapper_allowlisted   |                                                                                                                          |
| scripts/exemplar-library.mjs                 | no      | legacy_business_logic | Gimel shoulder semantics required a label update in this legacy .mjs entrypoint; full TypeScript extraction is deferred. |
| scripts/extract-token-registry.mjs           | no      | wrapper_allowlisted   |                                                                                                                          |
| scripts/iterate-torah.mjs                    | no      | wrapper_allowlisted   |                                                                                                                          |
| scripts/normalize-torah.mjs                  | no      | wrapper_allowlisted   |                                                                                                                          |
| scripts/pasuk-trace-corpus.mjs               | no      | legacy_business_logic |                                                                                                                          |
| scripts/pasuk-trace.mjs                      | no      | wrapper_allowlisted   |                                                                                                                          |
| scripts/pattern-index.mjs                    | no      | legacy_business_logic | Gimel shoulder semantics required a motif rename in this legacy .mjs entrypoint; full TypeScript extraction is deferred. |
| scripts/phrase-tree.mjs                      | no      | wrapper_allowlisted   |                                                                                                                          |
| scripts/render-pasuk-graph.mjs               | no      | legacy_business_logic |                                                                                                                          |
| scripts/render/pasukGraph.mjs                | no      | legacy_business_logic |                                                                                                                          |
| scripts/smoke-nav-integrity.mjs              | no      | legacy_business_logic |                                                                                                                          |
| scripts/split-index.mjs                      | no      | legacy_business_logic |                                                                                                                          |
| scripts/src-artifacts/config.mjs             | no      | legacy_business_logic |                                                                                                                          |
| scripts/src-artifacts/recompute.mjs          | no      | legacy_business_logic |                                                                                                                          |
| scripts/src-artifacts/verify-lfs-outputs.mjs | no      | legacy_business_logic |                                                                                                                          |
| scripts/src-artifacts/verify-push.mjs        | no      | wrapper_allowlisted   |                                                                                                                          |
| scripts/teamim-registry.mjs                  | no      | wrapper_allowlisted   |                                                                                                                          |
| scripts/torah-corpus.mjs                     | no      | wrapper_allowlisted   |                                                                                                                          |
| scripts/validate-split-index.mjs             | no      | legacy_business_logic |                                                                                                                          |
