# Composition Tests for Updated כ / ל / מ / ם

## Scope

These are symbolic composition tests, not runtime executions. The updated family definitions are not yet implemented in the reference interpreter, so the words are traced by hand against:

- updated family candidates:
  - `כ(F) = held(F)`
  - `ל(F) = hold(F) then continue beyond the hold`
  - `מ(F) = enclosed_open(held(F))`
  - `ם(F) = enclosed_closed(held(F))`
- the current prompt definitions for all other letters and niqqud

The goal is narrow: test what the **next letter receives** after an initial `כ`, `ל`, or `מ`, and separate family-level evidence from contamination by stale niqqud or stale non-family letters.

## Notation

- `K(x)` = updated `כ` on `x` = `held(x)`
- `L(x)` = updated `ל` on `x` = `hold(x)` then exterior continuation
- `M(x)` = updated `מ` on `x` = `hold(x)` then interior continuation under an open enclosure
- `δdag` = dagesh harden
- `δqam` = kamatz commit/atomic
- `δhol` = cholam head-bias to sealed endpoints
- `δtze` = tsere stabilize
- `δhir` = hiriq committed-representative
- `δseg` = segol converge
- `δshv` = shva collapse
- `A` = א alias-anchor
- `B` = ב forward deepening
- `H` = ה exposure/announcement
- `V` = ו minimal continuation
- `Y` = י pin
- `ך` = current old final-kaf/capacity spec

Verdict meanings:

- `supports` = the immediate handoff after `כ/ל/מ` fits the candidate cleanly
- `weakens` = the immediate handoff pushes against the candidate
- `unresolved` = the handoff is dominated by stale niqqud or stale later letters

## Tests

| Word     | Stepwise operator chain                                      | What the next letter receives after כ / ל / מ                       | Verdict      | Cause of any failure/contamination                                                                                                                   |
| -------- | ------------------------------------------------------------ | ------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `כָּל`   | `כָּ = δqam(δdag(K(F0))) -> ל = L(...)`                      | `ל` receives a hardened, committed hold                             | `supports`   | `kamatz` may be stale because it atomicizes the hold before `ל`, but the `כ -> ל` handoff itself is coherent                                         |
| `כֹּל`   | `כֹּ = δhol(δdag(K(F0))) -> ל = L(...)`                      | `ל` receives a hardened hold with cholam endpoint-bias on selection | `weakens`    | this exposes likely stale `cholam`: its endpoint bias still leans on the older endpoint-`ל` story rather than the new exterior-continuation `ל`      |
| `כְּלָל` | `כְּ = δshv(δdag(K(F0))) -> לָ = δqam(L(...)) -> ל = L(...)` | first `ל` receives a hardened, collapsed hold                       | `supports`   | `shva` and later `kamatz` are strong modifiers, but they do not force hidden metadata in `כ` or `ל`                                                  |
| `כֵּלִי` | `כֵּ = δtze(δdag(K(F0))) -> לִ = δhir(L(...)) -> י = Y(...)` | `ל` receives a hardened, stabilized hold                            | `supports`   | later `hiriq + י` may be stale or over-strong, but the `כ -> ל` transition is still mechanically clean                                               |
| `כֶּלֶב` | `כֶּ = δseg(δdag(K(F0))) -> לֶ = δseg(L(...)) -> ב = B(...)` | `ל` receives a hardened, convergent hold                            | `supports`   | later `ב` deepening is independent contamination, not a `כ/ל` failure                                                                                |
| `כֶּלֶא` | `כֶּ = δseg(δdag(K(F0))) -> לֶ = δseg(L(...)) -> א = A(...)` | `ל` receives a hardened, convergent hold                            | `supports`   | any awkwardness comes from `segol` or `א`, not from the updated `כ` primitive                                                                        |
| `מֶלֶךְ` | `מֶ = δseg(M(F0)) -> לֶ = δseg(L(...)) -> ךְ = δshv(ך(...))` | `ל` receives a convergent interior continuation                     | `supports`   | strong contamination from stale final-`ך` and final `shva`; the direct `מ -> ל` handoff still works                                                  |
| `לֵב`    | `לֵ = δtze(L(F0)) -> ב = B(...)`                             | `ב` receives a stabilized exterior continuation                     | `supports`   | later `ב` semantics may be stale, but they do not undermine `ל` as exterior continuation                                                             |
| `לֹא`    | `לֹ = δhol(L(F0)) -> א = A(...)`                             | `א` receives an exterior continuation under cholam endpoint-bias    | `weakens`    | again this looks like stale `cholam`, not a direct failure of `ל`; the rosh modifier still assumes endpoint-oriented selection                       |
| `לוֹ`    | `ל = L(F0) -> וֹ = δhol(V(...))`                             | `ו` receives a plain exterior continuation                          | `supports`   | this is one of the cleanest tests: `ל` hands off to a plain continuation operator without needing extra metadata; only the `holam` on `ו` is suspect |
| `לָה`    | `לָ = δqam(L(F0)) -> ה = H(...)`                             | `ה` receives a committed/atomic exterior continuation               | `unresolved` | the result is dominated by likely stale `kamatz` and the current broad `ה` definition                                                                |
| `לִי`    | `לִ = δhir(L(F0)) -> י = Y(...)`                             | `י` receives a committed-representative exterior continuation       | `supports`   | `hiriq` may be too strong, but a pin attaching to the exterior continuation remains mechanically compatible with `ל`                                 |
| `מָה`    | `מָ = δqam(M(F0)) -> ה = H(...)`                             | `ה` receives a committed/atomic interior continuation               | `unresolved` | dominated by likely stale `kamatz` and `ה`; this does not clearly falsify or confirm `מ`                                                             |
| `מִי`    | `מִ = δhir(M(F0)) -> י = Y(...)`                             | `י` receives a committed-representative interior continuation       | `supports`   | `hiriq` may be stale, but the immediate `מ -> י` handoff is coherent: `י` can pin the interior focus                                                 |
| `מָל`    | `מָ = δqam(M(F0)) -> ל = L(...)`                             | `ל` receives a committed/atomic interior continuation               | `supports`   | this is the strongest direct `מ -> ל` test; the only contamination is `kamatz`, not the family handoff itself                                        |

## What these tests say about the family

### Strongest support cases

- `לוֹ`: `ל` handing off to plain `ו` strongly supports `ל` as exterior continuation.
- `מָל`: `מ` handing off directly to `ל` strongly supports `מ` as interior continuation that still yields a workable next focus.
- `מֶלֶךְ`: despite stale ending layers, the `מ -> ל` transition itself is structurally fine.

### Main weakening cases

- `כֹּל`
- `לֹא`

These do not mainly weaken `כ` or `ל`. They expose a likely stale `cholam` layer whose current endpoint-bias semantics still assume the older endpoint-style `ל`.

### General contamination pattern

The niqqud layer is probably too strong for clean family testing:

- `kamatz` frequently atomicizes too early
- `hiriq` frequently injects representative-commit structure
- `segol` and `tsere` add directional edge behavior before the next consonant gets a clean test

So most words test the family only at the **first handoff**. After that point, the niqqud system and stale non-family letters dominate.

## Bottom line

The representative words do **not** reveal a direct composition failure in the updated `כ/ל/מ/ם` family.

What they do reveal is:

- `כ -> ל` is mechanically usable across several niqqud settings
- `ל -> next` is especially clean when the next letter is a plain continuation operator (`ו`)
- `מ -> next` is mechanically usable, and `מ -> ל` is a particularly strong positive case
- the current niqqud layer, especially `cholam`, is likely stale enough to contaminate interpretation of several words

So the present evidence mostly supports the updated consonantal family, while also showing that the niqqud layer now needs re-review against the new `כ/ל/מ/ם` topology.
