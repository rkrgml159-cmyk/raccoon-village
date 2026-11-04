# SDD ledger — plan: docs/superpowers/plans/2026-11-04-m2b-mind-and-speech.md
Spec: docs/superpowers/specs/2026-11-03-m2b-mind-and-speech-design.md (reachable). Branch: feat/m2b-mind-and-speech (base 8e7c65b, forked from main ab236ee).
Ruling: work on the in-place feature branch (single-checkout cloud session), as in M1/M2a — cost if wrong: none.

## Pre-flight scan
| Pair / task | Produces vs consumes | Found |
|---|---|---|
| T1 ↔ T2 | Needs/Trait/TraitTable ← composeWeights, Resident needs none | consistent |
| T1 ↔ T5 | initialNeeds/assignTraits/needIcons ← createVillageState/stepVillage | consistent |
| T2 ↔ T5 | tick(ctx.weights, ctx.targetXOf), REACH ← stepVillage | consistent; `approach` left at stateT 0 for Simulation to convert |
| T3 ↔ T4 | T3 BAND_MULTIPLIER keyed by DuetType but T4 declares DuetType | Ruling (plan self-review): `DuetType` declared in `src/domain/social/types.ts` in T3; T4 re-exports — cost if wrong: none |
| T4 ↔ T5 | DuetRule.eligible/outcome, chooseDuetType(ctx.firstMeeting/quarrelWindow) ← stepVillage met/quarrelAt | consistent |
| T5 ↔ T14 | SimEvent kinds, VillageState, __rv.duets/duetLog ← VillageScene | consistent |
| T6 ↔ T15 | speak(voice, mood) ← VillageScene on `speak` events | consistent |
| T7 ↔ T15 | BubbleQueue/pickThought/UI icons ← BubbleLayer, tap | consistent |
| T7 ↔ T16 | thoughts.json seed (≥2/situation) → Workflow raises to ≥6 and tests tightened | consistent, ordered |
| T8–T13 ↔ SpriteBank | STATES stays 4 until T13; FRAME_COUNT_M2B validated per rig; connectivity test iterates Object.keys(rig.frames) | consistent; e2e/baselines unaffected until T13 |
| T13 ↔ T14 | STATES 9 → SpriteBank registers new anims; DuetScript anim keys exist | consistent, ordered |
| T14 ↔ T17 | `__rv.duets/duetLog`, capture `--duet` ← e2e/scripts | consistent |
| T15 self | index.html font link: plan says no external link (system stack only) | consistent with CLAUDE.md (no network deps) |
| T2 self | Weights optional fields vs FullWeights; species.json untouched | consistent |
| Rubric | T7 seed data written by implementer (Korean in data JSON) — allowed by rules | no conflict |
Scan clean apart from the T3/T4 ordering ruling above.

## Task loop
Task 1: implemented 7dc4c66 (sonnet). Review (sonnet): Approved, 0 Important.
Task 1: minor (deferred): advanceNeeds has no NaN/negative simDt guard; table test asserts few values; `hungerRate` key ↔ NeedKey `hunger` mapping is the consumer's job (T5); defensive `?.` in traitMultiplier.
Task 1: complete (commits 8e7c65b..7dc4c66, review clean)
Task 2: implemented e2eed6e (sonnet), DONE_WITH_CONCERNS (VillageScene one-line `spriteStateOf` mapping; night test passes allowApproach=false). Review (sonnet): Approved, 0 Important.
Task 2: minor (deferred): history test trivially passes (start from approach/duet); no test for "within REACH keeps approach + stateT 0 across ticks" (T5 covers the hand-off); approach→walk chains visually (walk-after-walk ignores approach); in-reach branch does not clamp x to walkRange; casts in DEFAULT_EXTRA/DURATION_MS lookups.
Task 2: complete (commits 7dc4c66..e2eed6e, review clean)
Task 3: implemented d7c1fb5 (haiku). Review (haiku): Needs fixes — 1 Important: Korean JSDoc comment in Relations.ts (constraint says no Korean in code). Ruling: CLAUDE.md forbids Korean string literals, not comments, so this is a convention issue, not a spec violation; still fixed in round 1 because every other source file keeps comments in English and the fix is one line — cost if wrong: none.
Task 3: minor (deferred): negative simDt reverses decay (guard); NaN unguarded; no multi-day decay test; pairKey(a,a) untested; decayed-to-0 entries kept.
Task 3: fix round 1/5 dispatched (resume implementer).
Task 3: fix round 1/5 (1 Important + 2 minors addressed; commits d7c1fb5..d2863ff). Re-review (haiku): addressed, no breakage. Minor (deferred): Infinity branch untested.
Task 3: complete (commits e2eed6e..d2863ff, review clean after 1 fix round)
Task 4: implemented 5a77478 (sonnet). Review (sonnet): Approved, 0 Important. Ruling: sitTogether stepMs = 20000 (range minimum; stepMs is a static rule field) — cost if wrong: none. makeUp only via quarrelWindow (spec).
Task 4: minor (deferred): 1000-sample chat test uses friend band and no non-chatty baseline; advanceDuet step overshoots when dt > remaining (Simulation must stop after finished / clamp step for dialogue indexing).
Task 4: complete (commits d2863ff..5a77478, review clean)
Task 5: implemented cdf5f9b (sonnet). Review (opus): Needs fixes — 2 Important: (1) chase: b moves only on step 1 then stands still while a jumps 0.3 back and forth (spec: b chases a, 0.15, 3 round trips); (2) relief missed when a state re-rolls into itself (forage→forage, sleep→sleep) because transitions are detected by name change.
Task 5: minor (deferred): sleeping target still joins a duet and gets full sleepy relief (spec says partial relief for interrupted states); firstMeeting detected by missing relation entry at END (fragile vs. future persistence); avoidUntil redundant with pair cooldown; records never pruned; per-step clone of duetLog/RelationTable; phase comments misnumbered; cooldown test only at speed 1; duet stateT frozen at durationMs (renderer uses duet.t).
Task 5: fix round 1/5 dispatched (resume implementer).
Task 5: fix round 1/5 (2 Important + 3 minors addressed; commits cdf5f9b..15af973). Re-review (sonnet): all addressed, no new breakage. Minor (deferred): walk→walk relief can be missed when a walk ends early with a long remainder; chase fallback can coincide a/b in very narrow ranges; `ended` detection couples tick and Simulation arithmetic (consider an explicit ended flag from tick); speed-60 cooldown test upper bound loose.
Task 5: complete (commits 5a77478..15af973, review clean after 1 fix round)
Task 6: implemented 45d123e (sonnet). Review (haiku): Needs fixes — 2 Important (data): leopard-cat `캬옹` reads as a house cat; pheasant `꿩` is the species name (sounds only). Minor (deferred): UtilityAI test fixture lacks voice (cast hides it); duplicate syllables across species; human `ㅁ…` can double the ellipsis; Voice test assumes 2-char syllables.
Task 6: fix round 1/5 dispatched (resume implementer).
Task 6: fix round 1/5 (2 Important + 3 minors addressed; commits 45d123e..4ffeb0e). Re-review (haiku): addressed. Minor (deferred): pheasant `꾸욱` is a mimetic adverb (swap later); `컹` dog-bark tone note; syllable overlaps across species.
Task 6: complete (commits 15af973..4ffeb0e, review clean after 1 fix round)
Task 7: implemented 5774dd1 (sonnet). Review (sonnet): Approved, 0 Important. All 63 seed lines tone-compliant.
Task 7: minor (deferred): forbidden "총"/"핵" overbroad (rejects 총총걸음/핵심) — narrow before Task 16 batch generation (carry into T16 dispatch); forbidden list lacks 죽는/죽을/위협/변이; emoji detector misses U+2B50/2B55, arrows, FE0F/200D; fullwidth digits pass; recent-10 window is the caller's job (T15); redundant guard/test.
Task 7: complete (commits 4ffeb0e..5774dd1, review clean)
Task 8: implemented f5b22d9 (sonnet), DONE_WITH_CONCERNS. Review (sonnet): Approved, 0 Important. Rows: interact_a ⚠️ weak (paw low, not chest height), interact_b/happy/sulk/shake ✅.
Task 8: minor (deferred, art polish): interact_a paw bar at belly level — raise to chest and extend 4 px; happy[1] airborne 3 px not 2; SpriteBank silent fallbacks (`?? []`, `?? 1`) for missing states; no `sheetStates` query test; shake frames differ by 2 px.
Task 8: complete (commits 5774dd1..f5b22d9, review clean)
Ruling: a copy of this ledger is committed to docs/superpowers/ledgers/ after every task completion so a fresh session (new container) can resume from git alone — cost if wrong: a few small commits.
Task 9: implemented ed75d25 (sonnet), DONE_WITH_CONCERNS. Review (sonnet, all 12 species sheets viewed): Needs fixes — 1 Important: interact_a paw unreadable (2 px chip against the chin; invisible on dark species marten/otter/mole). (Reviewer's 2nd "Important" was the controller's stale 4-row sheets — a capture issue, not code; the reviewer regenerated them.)
Task 9: minor (deferred): shake barely differs from sit (small forearm chips); badger/marten sulk tails thin fragments.
Task 9: fix round 1/5 dispatched (resume implementer).
Task 9: fix round 1/5 (1 Important + 2 minors addressed; commits ed75d25..6f46de6). Re-review (sonnet): addressed. Minor (deferred): mole paw tips low contrast (palette limit); otter sulk tail weak contrast; interact_a frame 2 extension ~3 px.
Task 9: complete (commits f5b22d9..6f46de6, review clean after 1 fix round)
Task 10: implemented a246a9e (sonnet). Review (sonnet, all 3 sheets + composed dump): Approved, 0 Important.
Task 10: minor (deferred): goral interact_a gap 1 row; interact_a f1 == f3; dark forearms (palette); shake torso blocky; scenery overlaps a sheet frame in captures.
Task 10: complete (commits b910ed9..a246a9e, review clean)
Task 11: implemented c093be2 (sonnet). Review (sonnet): Approved, 0 Important.
Task 11: minor (deferred, art polish): shake nearly static (f0==f2, f1==f3) and stiff diagonal; happy crouch weak; sulk tail droop faint; antlers dark-on-dark in shake.
Task 11: complete (commits 19de979..c093be2, review clean)
Task 12: implemented abf28be (sonnet). Review (sonnet, composed frames + owl sheet): Approved, 0 Important.
Task 12: minor (deferred, art polish): happy hop 4 px not 2; interact_b is a nod not a tilt; interact_a wingtip near the rump; shake wings reach 4–6 px (brush the frame edge); woodpecker crest stays vertical in sulk; pheasant sulk beak 1 row off; crow wings dark-on-dark.
Task 12: complete (commits b001efa..abf28be, review clean)
Task 13: implemented 2a2ea84 + 09bddcd (sonnet). Review (sonnet): Approved, 0 Important. STATES = 9 for all six rigs; e2e 9+1 skipped ×2, baselines unchanged.
Ruling: cane hidden in interact_a/interact_b too (near hand in use) — accepted; cost if wrong: elder cane pops at transitions (deferred polish).
Task 13: minor (deferred, art polish): interact_a sleeve 1 px thin, hand touches diagonally; shake reads as "hands up" not branch-shaking (context will help); elder cane pop; sulk head 3–4 px lower; "12 frames" wording vs 16; sheet captures now always 1920×1200.
Task 13: complete (commits 19790bc..09bddcd, review clean). All 72 new frames done (Tasks 8–13).
Task 14: implemented 532e820 (sonnet), DONE_WITH_CONCERNS (DuetScript not red-first; `?duet=all` 3×3 grid with slight overlap; interact/happy frame 0 ≈ idle). Review (opus): Needs fixes — 3 Important: (1) `blender.update(dt)` called twice per frame (update + stepSim) → sky blends at double speed in live play (M1 regression, invisible to still baselines); (2) `needIcons` emits `hunger` but ui.json has `leaf` → hunger icon events dropped; (3) `__rv.minds` published once in create(), stale after step 1.
Task 14: minor (deferred): `__rv.positions` omits duet offsetX (fix in round 1); first-frame portrait positions pre-zoom (fix in round 1); chase `toward` makes the runner face its chaser (bound by controller, conflicts with spec "도망"); sitTogether `same` hard-coded facing right; `?duet=all` left-column lane-1/2 slight overlap; debug text one block not per-resident; DuetScript test not red-first, groom only via chat loop; `--duet` value unvalidated in script.
Task 14: fix round 1/5 dispatched (resume implementer).
Task 14: fix round 1/5 (3 Important + 2 minors addressed; commits 532e820..9bc8294). Re-review (opus): all resolved, position formula verified against Phaser camera transform (valid from frame 1). Minor (deferred): `fx` computed twice in pose(); unmapped icon dropped silently (dev warning).
Task 14: complete (commits b23aa19..9bc8294, review clean after 1 fix round)
