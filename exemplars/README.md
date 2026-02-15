# Exemplar Library

Canonical, deterministic exemplars for publication and regression validation.

## Summary
- source_trace: `corpus/word_traces.jsonl`
- trace_sha256: `2b00b9882588950a7a71107620b531f903e7632d707dd8d0f16fdb03b1b44df0`
- semantic_versions: 1.1.0
- exemplars: 30
- regression_cases: 18
- observed_operator_events: 26
- covered_operator_events: 26

## Categories
- **High-frequency skeleton exemplars** (10): Top recurring skeletons; baseline references for broad stability checks.
- **Special mark exemplars** (4): Mappiq, shin/sin dots, and dagesh-sensitive words.
- **Operator-family exemplars** (5): Coverage-oriented picks that ensure every observed operator remains represented.
- **Boundary and final-form exemplars** (7): Word-edge behavior, auto-discharge/auto-close behavior, and final-letter form semantics.
- **Motif-driven exemplars** (4): Representative examples selected from the motif index.

## Exemplars

### High-frequency skeleton exemplars

Top recurring skeletons; baseline references for broad stability checks.

#### ex-001 — אֶל (Deuteronomy 1:1#6)
- ref: `Deuteronomy/1/1/6`
- token_ids: `14, 364`
- flow: `א alias ⇢ ל endpoint bind`
- skeleton: `ALEPH.ALIAS -> LAMED.ENDPOINT`
- tags: `high_frequency, skeleton_rank:5`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-002 — כָּל (Deuteronomy 1:1#7)
- ref: `Deuteronomy/1/1/7`
- token_ids: `347, 364`
- flow: `ל endpoint bind`
- skeleton: `LAMED.ENDPOINT`
- tags: `high_frequency, skeleton_rank:1`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-003 — בְּעֵבֶר (Deuteronomy 1:1#9)
- ref: `Deuteronomy/1/1/9`
- token_ids: `32, 517, 43, 639`
- flow: `ר boundary close`
- skeleton: `RESH.BOUNDARY_CLOSE`
- tags: `high_frequency, skeleton_rank:8`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-004 — וְדִי (Deuteronomy 1:1#21)
- ref: `Deuteronomy/1/1/21`
- token_ids: `163, 106, 280`
- flow: `ד boundary close`
- skeleton: `DALET.BOUNDARY_CLOSE`
- tags: `high_frequency, skeleton_rank:9`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-005 — בְּנֵי (Deuteronomy 1:3#12)
- ref: `Deuteronomy/1/3/12`
- token_ids: `32, 450, 280`
- flow: `נ support debt ⇢ □ boundary support discharge`
- skeleton: `NUN.SUPPORT_DEBT -> SPACE.SUPPORT_DISCHARGE`
- tags: `high_frequency, skeleton_rank:7`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-006 — יְהֹוָה (Deuteronomy 1:3#17)
- ref: `Deuteronomy/1/3/17`
- token_ids: `282, 154, 183, 136`
- flow: `ה declare(public) ⇢ ה breath tail`
- skeleton: `HE.DECLARE -> HE.DECLARE_BREATH`
- tags: `high_frequency, skeleton_rank:3`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-007 — אֹתוֹ (Deuteronomy 1:3#18)
- ref: `Deuteronomy/1/3/18`
- token_ids: `22, 724, 187`
- flow: `א alias ⇢ ת finalize+stamp`
- skeleton: `ALEPH.ALIAS -> TAV.FINALIZE`
- tags: `high_frequency, skeleton_rank:2`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-008 — וּבֹאוּ (Deuteronomy 1:7#4)
- ref: `Deuteronomy/1/7/4`
- token_ids: `193, 56, 1, 193`
- flow: `א alias`
- skeleton: `ALEPH.ALIAS`
- tags: `high_frequency, skeleton_rank:10`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-009 — וָאֹמַר (Deuteronomy 1:9#1)
- ref: `Deuteronomy/1/9/1`
- token_ids: `183, 22, 418, 639`
- flow: `א alias ⇢ מ open mem-zone ⇢ ר boundary close ⇢ □ mem auto-close`
- skeleton: `ALEPH.ALIAS -> MEM.OPEN -> RESH.BOUNDARY_CLOSE -> SPACE.MEM_AUTO_CLOSE`
- tags: `coverage_fill, high_frequency`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-010 — לֹא (Deuteronomy 1:9#6)
- ref: `Deuteronomy/1/9/6`
- token_ids: `390, 1`
- flow: `ל endpoint bind ⇢ א alias`
- skeleton: `LAMED.ENDPOINT -> ALEPH.ALIAS`
- tags: `high_frequency, skeleton_rank:6`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.


### Special mark exemplars

Mappiq, shin/sin dots, and dagesh-sensitive words.

#### ex-011 — אֵלֶּה (Deuteronomy 1:1#1)
- ref: `Deuteronomy/1/1/1`
- token_ids: `11, 378, 136`
- flow: `א alias ⇢ ל endpoint bind ⇢ ה breath tail`
- skeleton: `ALEPH.ALIAS -> LAMED.ENDPOINT -> HE.DECLARE_BREATH`
- tags: `mark:dagesh`
- explanation: Contains dagesh (U+05BC), checking hardened-mark tokenization without trace drift.

#### ex-012 — אֲשֶׁר (Deuteronomy 1:1#3)
- ref: `Deuteronomy/1/1/3`
- token_ids: `6, 687, 639`
- flow: `א alias ⇢ ש fork route ⇢ ר boundary close`
- skeleton: `ALEPH.ALIAS -> SHIN.FORK -> RESH.BOUNDARY_CLOSE`
- tags: `high_frequency, mark:shin_dot, skeleton_rank:4`
- explanation: Contains shin-dot (U+05C1), validating right-dot fork routing semantics.

#### ex-013 — יִשְׂרָאֵל (Deuteronomy 1:1#8)
- ref: `Deuteronomy/1/1/8`
- token_ids: `285, 665, 650, 11, 364`
- flow: `ר boundary close ⇢ א alias ⇢ ל endpoint bind`
- skeleton: `RESH.BOUNDARY_CLOSE -> ALEPH.ALIAS -> LAMED.ENDPOINT`
- tags: `mark:sin_dot`
- explanation: Contains sin-dot (U+05C2), validating left-dot shin/sin disambiguation.

#### ex-014 — בָּהּ (Deuteronomy 1:22#19)
- ref: `Deuteronomy/1/22/19`
- token_ids: `52, 157`
- flow: `ה declare(public) ⇢ ה pin export`
- skeleton: `HE.DECLARE -> HE.DECLARE_PIN`
- tags: `mark:mappiq`
- explanation: Contains mappiq (הּ), so the trace must include HE.DECLARE_PIN in a stable place.


### Operator-family exemplars

Coverage-oriented picks that ensure every observed operator remains represented.

#### ex-015 — פָּארָן (Deuteronomy 1:1#16)
- ref: `Deuteronomy/1/1/16`
- token_ids: `554, 1, 650, 439`
- flow: `פ utterance ⇢ א alias ⇢ ר boundary close ⇢ ן support debt ⇢ ן same-word discharge`
- skeleton: `PE.UTTER -> ALEPH.ALIAS -> RESH.BOUNDARY_CLOSE -> FINAL_NUN.SUPPORT_DEBT -> FINAL_NUN.SUPPORT_DISCHARGE`
- tags: `operator_family, operator:PE.UTTER`
- explanation: Representative operator-family case for PE.UTTER (utterance).

#### ex-016 — זָהָב (Deuteronomy 1:1#22)
- ref: `Deuteronomy/1/1/22`
- token_ids: `216, 152, 30`
- flow: `ז gate ⇢ ה declare(public)`
- skeleton: `ZAYIN.GATE -> HE.DECLARE`
- tags: `operator_family, operator:ZAYIN.GATE`
- explanation: Representative operator-family case for ZAYIN.GATE (gate routing).

#### ex-017 — קָדֵשׁ (Deuteronomy 1:2#9)
- ref: `Deuteronomy/1/2/9`
- token_ids: `623, 110, 720`
- flow: `ק approximate ⇢ ד boundary close ⇢ ש fork route`
- skeleton: `QOF.APPROX -> DALET.BOUNDARY_CLOSE -> SHIN.FORK`
- tags: `operator_family, operator:QOF.APPROX`
- explanation: Representative operator-family case for QOF.APPROX (approximation).

#### ex-018 — טָרְחֲכֶם (Deuteronomy 1:12#4)
- ref: `Deuteronomy/1/12/4`
- token_ids: `266, 640, 231, 338, 400`
- flow: `ט covert ⇢ ר boundary close ⇢ ח compartment ⇢ ם close mem-zone`
- skeleton: `TET.COVERT -> RESH.BOUNDARY_CLOSE -> HET.COMPARTMENT -> FINAL_MEM.CLOSE`
- tags: `operator_family, operator:TET.COVERT`
- explanation: Representative operator-family case for TET.COVERT (covert behavior).

#### ex-019 — וַנִּסַּע (Deuteronomy 1:19#1)
- ref: `Deuteronomy/1/19/1`
- token_ids: `179, 447, 494, 510`
- flow: `נ support debt ⇢ ס support discharge`
- skeleton: `NUN.SUPPORT_DEBT -> SAMEKH.SUPPORT_DISCHARGE`
- tags: `operator_family, operator:SAMEKH.SUPPORT_DISCHARGE`
- explanation: Representative operator-family case for SAMEKH.SUPPORT_DISCHARGE (support discharge).


### Boundary and final-form exemplars

Word-edge behavior, auto-discharge/auto-close behavior, and final-letter form semantics.

#### ex-020 — הַדְּבָרִים (Deuteronomy 1:1#2)
- ref: `Deuteronomy/1/1/2`
- token_ids: `149, 104, 51, 642, 280, 400`
- flow: `ה declare(public) ⇢ ד boundary close ⇢ ר boundary close ⇢ ם close mem-zone`
- skeleton: `HE.DECLARE -> DALET.BOUNDARY_CLOSE -> RESH.BOUNDARY_CLOSE -> FINAL_MEM.CLOSE`
- tags: `final:mem`
- explanation: Representative final-mem close behavior; word-final closure should stay deterministic.

#### ex-021 — מֹשֶׁה (Deuteronomy 1:1#5)
- ref: `Deuteronomy/1/1/5`
- token_ids: `426, 687, 136`
- flow: `מ open mem-zone ⇢ ש fork route ⇢ ה breath tail ⇢ □ mem auto-close`
- skeleton: `MEM.OPEN -> SHIN.FORK -> HE.DECLARE_BREATH -> SPACE.MEM_AUTO_CLOSE`
- tags: `boundary:mem_auto_close`
- explanation: Shows boundary-triggered mem auto-close (SPACE.MEM_AUTO_CLOSE) at word end.

#### ex-022 — הַיַּרְדֵּן (Deuteronomy 1:1#10)
- ref: `Deuteronomy/1/1/10`
- token_ids: `149, 299, 640, 111, 439`
- flow: `ה declare(public) ⇢ ר boundary close ⇢ ד boundary close ⇢ ן support debt ⇢ ן same-word discharge`
- skeleton: `HE.DECLARE -> RESH.BOUNDARY_CLOSE -> DALET.BOUNDARY_CLOSE -> FINAL_NUN.SUPPORT_DEBT -> FINAL_NUN.SUPPORT_DISCHARGE`
- tags: `final:nun`
- explanation: Representative final-nun discharge pair; both debt and discharge must remain coupled.

#### ex-023 — סוּף (Deuteronomy 1:1#14)
- ref: `Deuteronomy/1/1/14`
- token_ids: `480, 193, 532`
- flow: `ף close utterance`
- skeleton: `FINAL_PE.UTTER_CLOSE`
- tags: `final:pe`
- explanation: Representative final-pe utterance close behavior at word boundary.

#### ex-024 — בַּרְנֵעַ (Deuteronomy 1:2#10)
- ref: `Deuteronomy/1/2/10`
- token_ids: `48, 640, 450, 521`
- flow: `ר boundary close ⇢ נ support debt ⇢ □ boundary support discharge`
- skeleton: `RESH.BOUNDARY_CLOSE -> NUN.SUPPORT_DEBT -> SPACE.SUPPORT_DISCHARGE`
- tags: `boundary:support_discharge`
- explanation: Shows support debt resolved at boundary via SPACE.SUPPORT_DISCHARGE.

#### ex-025 — בְּאֶרֶץ (Deuteronomy 1:5#3)
- ref: `Deuteronomy/1/5/3`
- token_ids: `32, 14, 646, 569`
- flow: `א alias ⇢ ר boundary close ⇢ ץ final align`
- skeleton: `ALEPH.ALIAS -> RESH.BOUNDARY_CLOSE -> FINAL_TSADI.ALIGN_FINAL`
- tags: `final:tsadi`
- explanation: Representative final-tsadi align-final behavior at word end.

#### ex-026 — לך (Numbers 23:13#4)
- ref: `Numbers/23/13/4`
- token_ids: `364, 319`
- flow: `ל endpoint bind`
- skeleton: `LAMED.ENDPOINT`
- tags: `final:kaf_surface`
- explanation: Surface ends with final kaf (ך), preserving final-form boundary behavior.


### Motif-driven exemplars

Representative examples selected from the motif index.

#### ex-027 — וַחֲצֵרֹת (Deuteronomy 1:1#20)
- ref: `Deuteronomy/1/1/20`
- token_ids: `179, 231, 579, 652, 724`
- flow: `ח compartment ⇢ צ normalize-to-exemplar ⇢ ר boundary close ⇢ ת finalize+stamp`
- skeleton: `HET.COMPARTMENT -> TSADI.ALIGN -> RESH.BOUNDARY_CLOSE -> TAV.FINALIZE`
- tags: `motif, motif:ENDS_WITH_FINALIZE`
- explanation: Representative motif case (ENDS_WITH_FINALIZE) chosen for stable motif-level validation.

#### ex-028 — בְּעַשְׁתֵּי (Deuteronomy 1:3#4)
- ref: `Deuteronomy/1/3/4`
- token_ids: `32, 521, 664, 736, 280`
- flow: `ש fork route ⇢ ת finalize+stamp`
- skeleton: `SHIN.FORK -> TAV.FINALIZE`
- tags: `motif, motif:ENDS_WITH_FINALIZE`
- explanation: Representative motif case (ENDS_WITH_FINALIZE) chosen for stable motif-level validation.

#### ex-029 — גְּדֹלֹת (Deuteronomy 1:28#14)
- ref: `Deuteronomy/1/28/14`
- token_ids: `70, 125, 390, 724`
- flow: `ג bestowal ⇢ ד boundary close ⇢ ל endpoint bind ⇢ ת finalize+stamp`
- skeleton: `GIMEL.BESTOW -> DALET.BOUNDARY_CLOSE -> LAMED.ENDPOINT -> TAV.FINALIZE`
- tags: `motif, motif:CONTAINS_BESTOW_THEN_SEAL`
- explanation: Representative motif case (CONTAINS_BESTOW_THEN_SEAL) chosen for stable motif-level validation.

#### ex-030 — וְכִגְבוּרֹתֶךָ (Deuteronomy 3:24#21)
- ref: `Deuteronomy/3/24/21`
- token_ids: `163, 330, 69, 30, 193, 652, 739, 323`
- flow: `ג bestowal ⇢ ר boundary close ⇢ ת finalize+stamp`
- skeleton: `GIMEL.BESTOW -> RESH.BOUNDARY_CLOSE -> TAV.FINALIZE`
- tags: `motif, motif:CONTAINS_BESTOW_THEN_SEAL`
- explanation: Representative motif case (CONTAINS_BESTOW_THEN_SEAL) chosen for stable motif-level validation.

## Maintenance Rule

1. If semantics change, run corpus diff/regression first, then regenerate exemplars.
2. Update explanations only when the underlying skeleton meaning changes.
3. Preserve prior semantic-version notes; append new version notes instead of rewriting history.

## Version Notes

- 1.0.0: Auto-generated exemplar set for this semantic version. Update this note when semantics change materially.
- 1.1.0: Auto-generated exemplar set for this semantic version. Update this note when semantics change materially.
