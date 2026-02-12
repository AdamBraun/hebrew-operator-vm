# Exemplar Library

Canonical, deterministic exemplars for publication and regression validation.

## Summary
- source_trace: `corpus/word_traces.jsonl`
- trace_sha256: `055ed803ff422cb93bb4a667a6ca31e5bcd018be74da60e606a6b707815ea354`
- semantic_versions: 1.0.0
- exemplars: 30
- regression_cases: 18
- observed_operator_events: 26
- covered_operator_events: 26

## Categories
- **High-frequency skeleton exemplars** (11): Top recurring skeletons; baseline references for broad stability checks.
- **Special mark exemplars** (4): Mappiq, shin/sin dots, and dagesh-sensitive words.
- **Operator-family exemplars** (5): Coverage-oriented picks that ensure every observed operator remains represented.
- **Boundary and final-form exemplars** (7): Word-edge behavior, auto-discharge/auto-close behavior, and final-letter form semantics.
- **Motif-driven exemplars** (3): Representative examples selected from the motif index.

## Exemplars

### High-frequency skeleton exemplars

Top recurring skeletons; baseline references for broad stability checks.

#### ex-001 — אֵת (Genesis 1:1#5)
- ref: `Genesis/1/1/5`
- token_ids: `11, 724`
- flow: `א alias ⇢ ת finalize+stamp`
- skeleton: `ALEPH.ALIAS -> TAV.FINALIZE`
- tags: `high_frequency, skeleton_rank:2`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-002 — עַל (Genesis 1:2#6)
- ref: `Genesis/1/2/6`
- token_ids: `521, 364`
- flow: `ל endpoint bind`
- skeleton: `LAMED.ENDPOINT`
- tags: `high_frequency, skeleton_rank:1`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-003 — וַיֹּאמֶר (Genesis 1:3#1)
- ref: `Genesis/1/3/1`
- token_ids: `179, 307, 1, 414, 639`
- flow: `א alias ⇢ מ open mem-zone ⇢ ר boundary close ⇢ □ mem auto-close`
- skeleton: `ALEPH.ALIAS -> MEM.OPEN -> RESH.BOUNDARY_CLOSE -> SPACE.MEM_AUTO_CLOSE`
- tags: `coverage_fill, high_frequency`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-004 — עֶרֶב (Genesis 1:5#9)
- ref: `Genesis/1/5/9`
- token_ids: `519, 646, 30`
- flow: `ר boundary close`
- skeleton: `RESH.BOUNDARY_CLOSE`
- tags: `high_frequency, skeleton_rank:8`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-005 — אֲשֶׁר (Genesis 1:7#8)
- ref: `Genesis/1/7/8`
- token_ids: `6, 687, 639`
- flow: `א alias ⇢ ש fork route ⇢ ר boundary close`
- skeleton: `ALEPH.ALIAS -> SHIN.FORK -> RESH.BOUNDARY_CLOSE`
- tags: `high_frequency, skeleton_rank:4`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-006 — אֶל (Genesis 1:9#7)
- ref: `Genesis/1/9/7`
- token_ids: `14, 364`
- flow: `א alias ⇢ ל endpoint bind`
- skeleton: `ALEPH.ALIAS -> LAMED.ENDPOINT`
- tags: `high_frequency, skeleton_rank:5`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-007 — יִהְיֶה (Genesis 1:29#26)
- ref: `Genesis/1/29/26`
- token_ids: `285, 137, 294, 136`
- flow: `ה declare(public) ⇢ ה breath tail`
- skeleton: `HE.DECLARE -> HE.DECLARE_BREATH`
- tags: `high_frequency, skeleton_rank:3`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-008 — לֹא (Genesis 2:5#13)
- ref: `Genesis/2/5/13`
- token_ids: `390, 1`
- flow: `ל endpoint bind ⇢ א alias`
- skeleton: `LAMED.ENDPOINT -> ALEPH.ALIAS`
- tags: `high_frequency, skeleton_rank:6`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-009 — וַיָּבֵא (Genesis 2:19#13)
- ref: `Genesis/2/19/13`
- token_ids: `179, 303, 39, 1`
- flow: `א alias`
- skeleton: `ALEPH.ALIAS`
- tags: `high_frequency, skeleton_rank:10`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-010 — יֹדֵעַ (Genesis 3:5#2)
- ref: `Genesis/3/5/2`
- token_ids: `306, 110, 521`
- flow: `ד boundary close`
- skeleton: `DALET.BOUNDARY_CLOSE`
- tags: `high_frequency, skeleton_rank:9`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.

#### ex-011 — עֵינֵי (Genesis 3:7#2)
- ref: `Genesis/3/7/2`
- token_ids: `517, 280, 450, 280`
- flow: `נ support debt ⇢ □ boundary support discharge`
- skeleton: `NUN.SUPPORT_DEBT -> SPACE.SUPPORT_DISCHARGE`
- tags: `high_frequency, skeleton_rank:7`
- explanation: High-frequency baseline skeleton used as a broad regression anchor.


### Special mark exemplars

Mappiq, shin/sin dots, and dagesh-sensitive words.

#### ex-012 — רֵאשִׁית (Genesis 1:1#2)
- ref: `Genesis/1/1/2`
- token_ids: `644, 1, 672, 280, 724`
- flow: `ר boundary close ⇢ א alias ⇢ ש fork route ⇢ ת finalize+stamp`
- skeleton: `RESH.BOUNDARY_CLOSE -> ALEPH.ALIAS -> SHIN.FORK -> TAV.FINALIZE`
- tags: `mark:shin_dot, motif, motif:ENDS_WITH_FINALIZE`
- explanation: Contains shin-dot (U+05C1), validating right-dot fork routing semantics.

#### ex-013 — בָּרָא (Genesis 1:1#3)
- ref: `Genesis/1/1/3`
- token_ids: `52, 650, 1`
- flow: `ר boundary close ⇢ א alias`
- skeleton: `RESH.BOUNDARY_CLOSE -> ALEPH.ALIAS`
- tags: `mark:dagesh`
- explanation: Contains dagesh (U+05BC), checking hardened-mark tokenization without trace drift.

#### ex-014 — עֹשֶׂה (Genesis 1:11#11)
- ref: `Genesis/1/11/11`
- token_ids: `526, 688, 136`
- flow: `ה breath tail`
- skeleton: `HE.DECLARE_BREATH`
- tags: `mark:sin_dot`
- explanation: Contains sin-dot (U+05C2), validating left-dot shin/sin disambiguation.

#### ex-015 — לְמִינָהּ (Genesis 1:24#7)
- ref: `Genesis/1/24/7`
- token_ids: `365, 406, 280, 463, 157`
- flow: `ל endpoint bind ⇢ מ open mem-zone ⇢ נ support debt ⇢ ה declare(public) ⇢ ה pin export ⇢ □ boundary support discharge ⇢ □ mem auto-close`
- skeleton: `LAMED.ENDPOINT -> MEM.OPEN -> NUN.SUPPORT_DEBT -> HE.DECLARE -> HE.DECLARE_PIN -> SPACE.SUPPORT_DISCHARGE -> SPACE.MEM_AUTO_CLOSE`
- tags: `mark:mappiq`
- explanation: Contains mappiq (הּ), so the trace must include HE.DECLARE_PIN in a stable place.


### Operator-family exemplars

Coverage-oriented picks that ensure every observed operator remains represented.

#### ex-016 — טוֹב (Genesis 1:4#6)
- ref: `Genesis/1/4/6`
- token_ids: `249, 187, 30`
- flow: `ט covert`
- skeleton: `TET.COVERT`
- tags: `operator_family, operator:TET.COVERT`
- explanation: Representative operator-family case for TET.COVERT (covert behavior).

#### ex-017 — וַיִּקְרָא (Genesis 1:5#1)
- ref: `Genesis/1/5/1`
- token_ids: `179, 286, 602, 650, 1`
- flow: `ק approximate ⇢ ר boundary close ⇢ א alias`
- skeleton: `QOF.APPROX -> RESH.BOUNDARY_CLOSE -> ALEPH.ALIAS`
- tags: `operator_family, operator:QOF.APPROX`
- explanation: Representative operator-family case for QOF.APPROX (approximation).

#### ex-018 — מַזְרִיעַ (Genesis 1:11#7)
- ref: `Genesis/1/11/7`
- token_ids: `418, 200, 642, 280, 521`
- flow: `מ open mem-zone ⇢ ז gate ⇢ ר boundary close ⇢ □ mem auto-close`
- skeleton: `MEM.OPEN -> ZAYIN.GATE -> RESH.BOUNDARY_CLOSE -> SPACE.MEM_AUTO_CLOSE`
- tags: `operator_family, operator:ZAYIN.GATE`
- explanation: Representative operator-family case for ZAYIN.GATE (gate routing).

#### ex-019 — וַתּוֹצֵא (Genesis 1:12#1)
- ref: `Genesis/1/12/1`
- token_ids: `179, 757, 187, 579, 1`
- flow: `ת finalize+stamp ⇢ צ normalize-to-exemplar ⇢ א alias`
- skeleton: `TAV.FINALIZE -> TSADI.ALIGN -> ALEPH.ALIAS`
- tags: `operator_family, operator:TSADI.ALIGN`
- explanation: Representative operator-family case for TSADI.ALIGN (alignment).

#### ex-020 — מִנְּשֹׂא (Genesis 4:13#7)
- ref: `Genesis/4/13/7`
- token_ids: `406, 445, 710, 1`
- flow: `מ open mem-zone ⇢ נ support debt ⇢ ס support discharge ⇢ א alias ⇢ □ mem auto-close`
- skeleton: `MEM.OPEN -> NUN.SUPPORT_DEBT -> SAMEKH.SUPPORT_DISCHARGE -> ALEPH.ALIAS -> SPACE.MEM_AUTO_CLOSE`
- tags: `operator_family, operator:SAMEKH.SUPPORT_DISCHARGE`
- explanation: Representative operator-family case for SAMEKH.SUPPORT_DISCHARGE (support discharge).


### Boundary and final-form exemplars

Word-edge behavior, auto-discharge/auto-close behavior, and final-letter form semantics.

#### ex-021 — אֱלֹהִים (Genesis 1:1#4)
- ref: `Genesis/1/1/4`
- token_ids: `5, 390, 143, 280, 400`
- flow: `א alias ⇢ ל endpoint bind ⇢ ה declare(public) ⇢ ם close mem-zone`
- skeleton: `ALEPH.ALIAS -> LAMED.ENDPOINT -> HE.DECLARE -> FINAL_MEM.CLOSE`
- tags: `final:mem`
- explanation: Representative final-mem close behavior; word-final closure should stay deterministic.

#### ex-022 — הָאָרֶץ (Genesis 1:1#8)
- ref: `Genesis/1/1/8`
- token_ids: `152, 20, 646, 569`
- flow: `ה declare(public) ⇢ א alias ⇢ ר boundary close ⇢ ץ final align`
- skeleton: `HE.DECLARE -> ALEPH.ALIAS -> RESH.BOUNDARY_CLOSE -> FINAL_TSADI.ALIGN_FINAL`
- tags: `final:tsadi`
- explanation: Representative final-tsadi align-final behavior at word end.

#### ex-023 — פְּנֵי (Genesis 1:2#7)
- ref: `Genesis/1/2/7`
- token_ids: `535, 450, 280`
- flow: `פ utterance ⇢ נ support debt ⇢ □ boundary support discharge`
- skeleton: `PE.UTTER -> NUN.SUPPORT_DEBT -> SPACE.SUPPORT_DISCHARGE`
- tags: `boundary:support_discharge`
- explanation: Shows support debt resolved at boundary via SPACE.SUPPORT_DISCHARGE.

#### ex-024 — מְרַחֶפֶת (Genesis 1:2#11)
- ref: `Genesis/1/2/11`
- token_ids: `402, 648, 237, 545, 724`
- flow: `מ open mem-zone ⇢ ר boundary close ⇢ ח compartment ⇢ פ utterance ⇢ ת finalize+stamp ⇢ □ mem auto-close`
- skeleton: `MEM.OPEN -> RESH.BOUNDARY_CLOSE -> HET.COMPARTMENT -> PE.UTTER -> TAV.FINALIZE -> SPACE.MEM_AUTO_CLOSE`
- tags: `boundary:mem_auto_close`
- explanation: Shows boundary-triggered mem auto-close (SPACE.MEM_AUTO_CLOSE) at word end.

#### ex-025 — בֵּין (Genesis 1:4#9)
- ref: `Genesis/1/4/9`
- token_ids: `40, 280, 439`
- flow: `ן support debt ⇢ ן same-word discharge`
- skeleton: `FINAL_NUN.SUPPORT_DEBT -> FINAL_NUN.SUPPORT_DISCHARGE`
- tags: `final:nun`
- explanation: Representative final-nun discharge pair; both debt and discharge must remain coupled.

#### ex-026 — וְעוֹף (Genesis 1:20#8)
- ref: `Genesis/1/20/8`
- token_ids: `163, 510, 187, 532`
- flow: `ף close utterance`
- skeleton: `FINAL_PE.UTTER_CLOSE`
- tags: `final:pe`
- explanation: Representative final-pe utterance close behavior at word boundary.

#### ex-027 — לך (Numbers 23:13#4)
- ref: `Numbers/23/13/4`
- token_ids: `364, 319`
- flow: `ל endpoint bind`
- skeleton: `LAMED.ENDPOINT`
- tags: `final:kaf_surface`
- explanation: Surface ends with final kaf (ך), preserving final-form boundary behavior.


### Motif-driven exemplars

Representative examples selected from the motif index.

#### ex-028 — וְאֵת (Genesis 1:1#7)
- ref: `Genesis/1/1/7`
- token_ids: `163, 11, 724`
- flow: `א alias ⇢ ת finalize+stamp`
- skeleton: `ALEPH.ALIAS -> TAV.FINALIZE`
- tags: `motif, motif:ENDS_WITH_FINALIZE`
- explanation: Representative motif case (ENDS_WITH_FINALIZE) chosen for stable motif-level validation.

#### ex-029 — בִדְגַת (Genesis 1:26#8)
- ref: `Genesis/1/26/8`
- token_ids: `35, 103, 81, 724`
- flow: `ד boundary close ⇢ ג bestowal ⇢ ת finalize+stamp`
- skeleton: `DALET.BOUNDARY_CLOSE -> GIMEL.BESTOW -> TAV.FINALIZE`
- tags: `motif, motif:CONTAINS_BESTOW_THEN_SEAL`
- explanation: Representative motif case (CONTAINS_BESTOW_THEN_SEAL) chosen for stable motif-level validation.

#### ex-030 — בִּדְגַת (Genesis 1:28#14)
- ref: `Genesis/1/28/14`
- token_ids: `36, 103, 81, 724`
- flow: `ד boundary close ⇢ ג bestowal ⇢ ת finalize+stamp`
- skeleton: `DALET.BOUNDARY_CLOSE -> GIMEL.BESTOW -> TAV.FINALIZE`
- tags: `motif, motif:CONTAINS_BESTOW_THEN_SEAL`
- explanation: Representative motif case (CONTAINS_BESTOW_THEN_SEAL) chosen for stable motif-level validation.

## Maintenance Rule

1. If semantics change, run corpus diff/regression first, then regenerate exemplars.
2. Update explanations only when the underlying skeleton meaning changes.
3. Preserve prior semantic-version notes; append new version notes instead of rewriting history.

## Version Notes

- 1.0.0: Auto-generated exemplar set for this semantic version. Update this note when semantics change materially.
