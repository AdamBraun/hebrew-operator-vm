# Build And Cache

## Niqqud Layer Operational Guarantees

### Dependency Scope

- Niqqud layer digesting depends only on:
  - `spineDigest`
  - niqqud layer config
  - niqqud layer version
  - niqqud layer code fingerprint
- Niqqud layer digesting must not depend on Letters/Cantillation/Layout digests.

### Parallelism

- Once `spineDigest` is available, Niqqud extraction can run in parallel with Letters, Cantillation, and Layout.
- Niqqud build must not wait on outputs from those layers.

### Rebuild Propagation

- A Niqqud rebuild triggers wrapper rebuild only.
- A Niqqud rebuild must not trigger Letters/Cantillation/Layout rebuilds.

### Example: Niqqud Mapping Change

1. Change `src/layers/niqqud/map.ts` (or another niqqud classification file).
2. Niqqud code fingerprint changes.
3. Niqqud digest changes and writes a new cache artifact under `outputs/cache/niqqud/<digest>/`.
4. Wrapper digest changes because wrapper consumes NiqqudIR keyed by Niqqud digest.
5. Letters digest is unchanged, Cantillation digest is unchanged, and Layout digest is unchanged.
