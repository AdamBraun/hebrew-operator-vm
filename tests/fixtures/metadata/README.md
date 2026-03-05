# Metadata Fixture: Genesis 1

This fixture provides a minimal metadata planning input/output set for fast local iteration.

Files:

- `torah_1y_plan.fixture_genesis1.v1.json`: one-parasha, 7-aliyah dataset over `Genesis/1/1..Genesis/1/31`
- `ref_order.fixture_genesis1.json`: canonical ref order limited to Genesis 1 (31 verses)
- `metadata.plan.expected.json`: deterministic expected output from `buildMetadataPlan`

Snapshot parameters:

- `generated_at` fixed to `2026-03-03T00:00:00.000Z`
- `includeParashot=true`
- `includeRanges=false`

Use this fixture to validate metadata normalization/validation/plan-building logic without running the full Torah corpus.
