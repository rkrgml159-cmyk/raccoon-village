# M2b 마음과 말 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 주민에게 욕구·성격·관계를 주고, 두 주민이 듀엣(상호작용 8종)으로 만나며, 종족어·속마음·아이콘 풍선으로 말하게 한다. 새 프레임 72장과 대사 데이터 파이프라인을 포함한다.

**Architecture:** 마을 시뮬레이션을 순수 TS `stepVillage(state, dt, env, rng)` 하나로 묶는다(`src/domain/village/Simulation.ts`). 욕구(`mind/`), 관계·듀엣(`social/`), 말(`speech/`)은 각각 작은 순수 모듈이고 시뮬레이션이 조립한다. 렌더는 시뮬레이션이 내는 상태·이벤트만 보고 애니(`DuetDirector`)와 풍선(`BubbleLayer`)을 그린다. 데이터(특성 배수·속마음·금칙어·아이콘·종족어)는 전부 JSON이며 실제 파일을 테스트가 검증한다.

**Tech Stack:** Phaser 4.2.1 · TypeScript strict · Vite 8 · Vitest 5 · Playwright 1.63 · tsx · Claude Code Workflow(대사 1회)

**Spec:** `docs/superpowers/specs/2026-11-03-m2b-mind-and-speech-design.md`

## Global Constraints

- `src/domain/**`은 phaser·DOM을 import하지 않는다(`import.meta.glob`은 허용). 커버리지 90%+ (lines/branches/functions). TDD.
- 코드에 한국어 문자열 금지: 특성 이름·속마음·아이콘(이모지)은 `data/dialogue/*.json`, `data/ui.json`에만.
- 숫자는 화면에 나오지 않는다(`?debug=1` 제외). 갑작스러운 등장 없음: 풍선 페이드 250 ms.
- 시뮬 시간 = `dtMs × speed`는 욕구·관계 복귀·쿨다운·속마음 자동 타이머에만 쓰고, 이동·상태 지속·듀엣 지속은 실제 `dtMs`를 쓴다.
- 욕구 0→1 시간: hunger 4h, sleepy 8h, bored 1.5h, lonely 2h. 초기값 시드 0.2~0.6. 야행성 졸림 증가 낮 ×1.5 밤 ×0.5.
- 듀엣: 도달 거리 0.06, 동시 ≤ 3, 같은 쌍 간격 ≥ 60 s, 다툼 후 회피 30 s, 화해 창 60~300 s, `approach` 상한 20 s, `forage` 6~12 s.
- 관계 띠: awkward < −0.2 ≤ neutral < 0.3 ≤ friend < 0.7 ≤ bestie. 하루 0.02 복귀.
- 풍선: 동시 ≤ 3, 주민당 1, 우선순위 속마음 > 종족어 > 아이콘, 아이콘 2 s, 속마음 플레이 탭 즉시·월페이퍼 10분 1회. `still`·쇼케이스·시트·`duet` 모드에서는 시뮬레이션이 돌지 않는다(`duet` 모드는 정지 연출만).
- 새 프레임: 리그 6종 × (shake 4 · interact_a 4 · interact_b 4 · happy 2 · sulk 2). 프레임레이트 interact 6, happy 4, sulk 2, shake 8. 연결성 테스트(단일 blob)는 전 상태 전 프레임에 그대로 적용.
- 속마음 줄: ≤ 22자, 마침표 ≤ 1, 숫자·이모지 금지, `forbidden.json` 0건.
- 커밋마다 `npm run lint && npm test` 녹색, 트레일러는 세션 규칙.

## Review Focus

1. `speed=3600` 같은 극단 배속에서 욕구가 한 프레임에 1을 넘어도 0..1로 클램프되고 아이콘이 매 프레임 재발사되지 않는다. (Task 1: `advanceNeeds` 클램프 테스트, `needIcons` 히스테리시스 테스트)
2. 듀엣 상대가 듀엣 도중 화면 밖으로 밀리거나(리사이즈) 레인 범위가 줄어도 두 주민이 분리되지 않는다 — 듀엣 중에는 `tick`이 x를 걷기 범위로만 클램프하고 듀엣 종료 시 둘 다 idle. (Task 5: 리사이즈 중 듀엣 테스트)
3. n=1(주민 하나)에서는 `approach` 후보가 없어도 멈추지 않는다 — `approach`는 즉시 `idle`로 대체. (Task 2/5: n=1 테스트)
4. 속마음 데이터가 비어 있거나 상황에 줄이 없을 때 빈 풍선이 뜨지 않는다 — `pickThought`는 `idleLong`로 폴백, 그것도 없으면 `null`이고 렌더는 풍선을 만들지 않는다. (Task 7)
5. 탭을 연타해도 풍선이 겹치지 않고(주민당 1개, 전체 ≤ 3), 월페이퍼는 탭을 무시한다. (Task 7 BubbleQueue 테스트, Task 15 e2e)

## 파일 구조

```
data/behavior/traits.json                 특성 배수표
data/dialogue/traits.json                 특성 한국어 이름
data/dialogue/thoughts.json               속마음(Task 7 시드 → Task 16 Workflow 본문)
data/dialogue/forbidden.json              금칙어
data/ui.json                              icons 맵 추가
data/sprites/species.json                 voice 추가(25종)
data/sprites/rigs/*.json                  +12프레임 × 6
src/domain/mind/Needs.ts                  Needs, advanceNeeds, relieve, needIcons
src/domain/mind/Traits.ts                 Trait, assignTraits, traitMultiplier
src/domain/mind/Weights.ts                composeWeights
src/domain/resident/Resident.ts           states +forage/approach/duet, targetId, duetId
src/domain/resident/UtilityAI.ts          forage/approach tick
src/domain/social/Relations.ts            RelationTable
src/domain/social/Duets.ts                DUET_RULES, chooseDuetType, advanceDuet
src/domain/social/Matchmaker.ts           pickTarget, inReach
src/domain/village/Simulation.ts          VillageState, stepVillage, SimEvent
src/domain/speech/Voice.ts                speak
src/domain/speech/Thoughts.ts             pickThought, situationFor, violations
src/domain/speech/Bubbles.ts              BubbleQueue
src/domain/sprites/{types,validateRig,catalog,SpriteRegistry}.ts  새 상태·voice 검증·catalog(BEHAVIOR, DIALOGUE)
src/render/social/DuetDirector.ts         duet step → 역할별 anim/flip/offset
src/render/ui/BubbleLayer.ts              풍선 그리기(풀 6)
src/render/scenes/VillageScene.ts         Simulation 연결, 입력, duet 모드, debug
src/app/{query,global.d}.ts               duet 쿼리, __rv.duets/duetLog/bubbles
scripts/capture-sheet.ts                  --duet=all
tests/unit/{mind,social,speech,village}/*.test.ts, tests/unit/sprites/*.test.ts
```

---

### Task 1: 욕구와 특성 (도메인 + 데이터)

**Files:**
- Create: `src/domain/mind/Needs.ts`, `src/domain/mind/Traits.ts`, `data/behavior/traits.json`, `data/dialogue/traits.json`
- Modify: `src/domain/sprites/catalog.ts`(`BEHAVIOR_TRAITS` export: `data/behavior/traits.json` 명시 import)
- Test: `tests/unit/mind/Needs.test.ts`, `tests/unit/mind/Traits.test.ts`

**Interfaces:**
```ts
// Needs.ts
export type NeedKey = 'hunger' | 'sleepy' | 'bored' | 'lonely'
export interface Needs { hunger: number; sleepy: number; bored: number; lonely: number }
export const NEED_FULL_MS: Record<NeedKey, number> // hunger 14_400_000, sleepy 28_800_000, bored 5_400_000, lonely 7_200_000
export const NEED_ICON_ON = 0.8; export const NEED_ICON_OFF = 0.5
export function initialNeeds(rng: () => number): Needs            // each uniform [0.2, 0.6]
export function advanceNeeds(n: Needs, simDtMs: number, mods: Partial<Record<NeedKey, number>>): Needs // mods multiply the rate; clamp 0..1
export function relieve(n: Needs, delta: Partial<Needs>): Needs    // subtract, clamp 0..1
export function needIcons(n: Needs, shown: Set<NeedKey>): { fire: NeedKey[]; shown: Set<NeedKey> } // fire when ≥0.8 and not shown; drop from shown when <0.5
// Traits.ts
export type Trait = 'calm'|'curious'|'timid'|'glutton'|'chatty'|'dreamer'|'tidy'|'nightowl'
export const TRAITS: readonly Trait[]
export type TraitTable = Record<Trait, Record<string, number>>   // trait → { key: multiplier }
export function assignTraits(rng: () => number): [Trait, Trait]  // two distinct, deterministic
export function traitMultiplier(traits: readonly Trait[], key: string, table: TraitTable): number // product, 1 when absent
export function validateTraitTable(table: unknown): TraitTable    // throws `traits: …`
```
`data/behavior/traits.json` 값(스펙 §2.2): calm {idle 1.3, approach 0.8, quarrel 0.5}, curious {walk 1.4, approach 1.2, forage 1.2}, timid {approach 0.6, quarrel 0.3, chase 0.5, lonelyOnQuarrel 0.2}, glutton {forage 1.6, shareGive 0.4, hungerRate 1.3}, chatty {approach 1.6, chat 1.5, greet 1.2}, dreamer {idle 1.2, thoughtAuto 2, sit 1.2}, tidy {groom 1.8, forage 0.8}, nightowl {nocturnalFlip 1}. `data/dialogue/traits.json`: `{ "calm": "느긋", "curious": "호기심", "timid": "겁쟁이", "glutton": "먹보", "chatty": "수다쟁이", "dreamer": "몽상가", "tidy": "청결", "nightowl": "밤형" }`.

- [ ] **Step 1: 실패하는 테스트** — Needs: `initialNeeds within [0.2,0.6]`(100 seeds), `advanceNeeds reaches 1 after NEED_FULL_MS`(hunger after 14_400_000 → 1), `clamps at 1 for huge simDt`(speed 3600 × 16 ms × 1000 frames), `mods scale the rate`(hungerRate 1.3 → 1.3×), `relieve clamps at 0`, `needIcons fires once above 0.8 then not again until below 0.5`(0.85 → fire; 0.9 → none; 0.4 → shown cleared; 0.85 → fire). Traits: `assignTraits gives two distinct traits`(200 seeds), `deterministic for seed`, `traitMultiplier multiplies across traits`(chatty+curious approach = 1.6×1.2), `1 when absent`, `real traits.json validates and has all 8`, `validateTraitTable rejects non-number`.
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/mind` → FAIL
- [ ] **Step 3: 구현 + 데이터 작성**
- [ ] **Step 4: 통과 확인** → PASS, `npm run lint`
- [ ] **Step 5: 커밋** — `feat(mind): 욕구와 성격 특성`

---

### Task 2: 주민 상태 확장과 가중치 합성 (forage·approach)

**Files:**
- Create: `src/domain/mind/Weights.ts`
- Modify: `src/domain/resident/Resident.ts`, `src/domain/resident/UtilityAI.ts`, `src/domain/sprites/types.ts`(`Weights`에 `forage`, `approach` 추가, 기존 species.json은 없으면 기본값), `src/domain/events.ts`(변경 없음 확인)
- Test: `tests/unit/resident/UtilityAI.test.ts`(수정·추가), `tests/unit/mind/Weights.test.ts`

**Interfaces:**
```ts
// Resident.ts
export type ResidentState = 'idle'|'walk'|'sit'|'sleep'|'forage'|'approach'|'duet'
export interface Resident { …기존…; targetId?: string; duetId?: string }
// types.ts
export interface Weights { idle: number; walk: number; sit: number; sleep: number; forage?: number; approach?: number }
// Weights.ts
export interface FullWeights extends Required<Weights> {}
export const DEFAULT_EXTRA = { forage: 0.06, approach: 0.08 }
export function composeWeights(base: Weights, needs: Needs, traits: readonly Trait[], table: TraitTable): FullWeights
//   sleep×(1+2·sleepy), forage×(1+2·hunger), approach×(1+2·lonely+bored), walk×(1+bored), then trait multipliers for idle/walk/sit/forage/approach
// UtilityAI.ts
export interface AIContext { phase: Phase; walkRange: readonly [number,number]; profile: Profile; weights?: FullWeights; targetXOf?: (id: string) => number | undefined }
export const DURATION_MS = { idle:[4000,12000], sit:[6000,20000], sleep:[10000,30000], forage:[6000,12000], approach:[20000,20000] }
export const REACH = 0.06
export function tick(r: Resident, dtMs: number, ctx: AIContext, rng: () => number): Resident
```
규칙: `chooseNext` 후보에서 `duet`은 제외(시뮬레이션만 부여), `approach`는 `ctx.targetXOf`가 없거나 `r.targetId`가 없으면 후보에서 제외되고 선택돼도 즉시 `idle`로 대체; `approach` 중에는 `targetXOf(targetId)`를 향해 `walkSpeed`로 이동(facing 갱신), 거리 ≤ REACH이면 상태 유지한 채 `stateT 0`(시뮬레이션이 듀엣으로 바꿈), 20 s 상한 만료 시 idle; `forage`는 지속 후 idle(배고픔 해소는 시뮬레이션이 상태 전이 이벤트로 적용); `duet` 상태는 `tick`이 건드리지 않는다(x·stateT 그대로). `ctx.weights`가 있으면 `profile.weights` 대신 쓴다(야간 선택은 호출자가 처리). 히스토리에는 `duet`·`approach`를 넣지 않는다.

- [ ] **Step 1: 테스트** — Weights: `needs raise matching weights`(hunger 1 → forage ×3), `traits multiply`(chatty approach ×1.6), `defaults when species omits forage/approach`. UtilityAI: 기존 테스트 유지 + `approach moves toward target and stops within REACH`(target 0.5, x 0.2, walkSpeed 0.1 → after 3.1 s stateT ≤ 0 and |x−0.5| ≤ 0.06), `approach expires after 20 s if target unreachable`, `approach without targetXOf falls back to idle`, `forage lasts 6–12 s`, `duet state is untouched by tick`, `history never contains duet or approach`.
- [ ] **Step 2: 실패 확인** → FAIL. **Step 3: 구현.** **Step 4:** `npm run test:cov` domain ≥ 90%, `npm run build`(VillageScene 컴파일: `Weights` 선택 필드 추가로 깨지지 않음). **Step 5: 커밋** — `feat(domain): forage·approach 상태와 욕구·특성 가중치 합성`

---

### Task 3: 관계

**Files:** Create `src/domain/social/Relations.ts`; Test `tests/unit/social/Relations.test.ts`

**Interfaces:**
```ts
export type Band = 'awkward'|'neutral'|'friend'|'bestie'
export const BAND_MULTIPLIER: Record<Band, Partial<Record<DuetType, number>>> // awkward {greet 1.5, quarrel 1.5, others 0.5 via DEFAULT}, friend {chat 1.3, sitTogether 1.3, groom 1.3}, bestie {sitTogether 1.6, quarrel 0.2}
export const DECAY_PER_DAY = 0.02
export function pairKey(a: string, b: string): string             // sorted `${a}|${b}`
export class RelationTable {
  get(a: string, b: string): number                                // 0 when unknown
  add(a: string, b: string, delta: number): number                 // clamp −1..1, returns new
  band(a: string, b: string): Band
  has(a: string, b: string): boolean
  decay(simDtMs: number): void                                     // toward 0 by 0.02 per 86_400_000 ms
  snapshot(): Record<string, number>
}
export function bandOf(v: number): Band
export function bandMultiplier(band: Band, type: DuetType): number // 1 when unlisted, awkward default 0.5 for unlisted
```
- [ ] **Step 1: 테스트** — `bandOf thresholds`(−0.2 → neutral, −0.21 → awkward, 0.3 → friend, 0.7 → bestie), `add clamps`, `pairKey symmetric`, `decay moves toward zero by 0.02 per day`(0.5 → 0.48 after 1 day; −0.01 → 0 not −0.01), `bandMultiplier table`, `has false for unknown`.
- [ ] Step 2 FAIL → Step 3 구현 → Step 4 PASS → **Step 5: 커밋** `feat(social): 관계 테이블과 띠`

---

### Task 4: 듀엣 규칙

**Files:** Create `src/domain/social/Duets.ts`; Test `tests/unit/social/Duets.test.ts`

**Interfaces:**
```ts
export type DuetType = 'greet'|'chat'|'sitTogether'|'chase'|'share'|'groom'|'quarrel'|'makeUp'
export const DUET_TYPES: readonly DuetType[]
export interface Duet { id: string; type: DuetType; a: string; b: string; t: number; durationMs: number; step: number; stepT: number }
export interface DuetMind { needs: Needs; traits: readonly Trait[] }
export interface DuetCtx { band: Band; firstMeeting: boolean; quarrelWindow: boolean /* 60–300 s after a quarrel */; table: TraitTable }
export interface DuetRule { base: number; duration: [number, number]; stepMs: number; eligible(a: DuetMind, b: DuetMind, ctx: DuetCtx): boolean; outcome(a: DuetMind, b: DuetMind): { relation: number; a: Partial<Needs>; b: Partial<Needs> } }
export const DUET_RULES: Record<DuetType, DuetRule>   // values from spec §3.3: base greet 1.0, chat 0.8, sitTogether 0.6, chase 0.4, share 0.4, groom 0.4, quarrel 0.08, makeUp 1.0; durations greet 3000, chat 8000–14000, sitTogether 20000–40000, chase 9000–12000, share 4000, groom 8000, quarrel 5000, makeUp 5000; stepMs greet 1500, chat 2500, chase 3000, groom 4000, others = duration
export function chooseDuetType(a: DuetMind, b: DuetMind, ctx: DuetCtx, rng: () => number): DuetType // firstMeeting → greet; quarrelWindow & eligible → makeUp; else weighted by base × traitMultiplier(a∪b traits, type) × bandMultiplier
export function startDuet(id: string, type: DuetType, a: string, b: string, rng: () => number): Duet
export function advanceDuet(d: Duet, dtMs: number): { duet: Duet; finished: boolean }   // step = floor(t / stepMs)
export const CHASE_OFFSET = 0.15   // b runs toward a's x ± offset, alternating each step (movement applied by Simulation)
```
eligibility(스펙 표): chat band ≥ neutral; sitTogether band ≥ friend; chase both bored ≥ 0.5; share b.hunger ≥ 0.5 and a has no glutton; groom band ≥ friend; quarrel band ≤ neutral and both bored ≥ 0.7; makeUp quarrelWindow and band > awkward; greet always. outcomes: greet rel +0.05, lonely −0.2 both; chat +0.10, bored −0.4; sitTogether +0.08, lonely −0.6; chase +0.12, bored −0.8; share +0.15, b hunger −0.5; groom +0.10, lonely −0.4; quarrel −0.15 (+ timid victim lonely +0.2 → encoded as negative relief); makeUp +0.20.

- [ ] **Step 1: 테스트** — `first meeting is always greet`, `quarrel window prefers makeUp when band > awkward`, `chat needs neutral band`, `share needs hungry b and non-glutton a`, `quarrel needs both bored ≥ 0.7 and band ≤ neutral`, `weights respect trait and band multipliers`(1000 samples: chatty pair picks chat > 40%), `durations in range`, `advanceDuet steps and finishes`, `outcome values match table`(each of 8).
- [ ] Step 2–4 → **Step 5: 커밋** `feat(social): 듀엣 규칙 8종`

---

### Task 5: 매치메이커와 마을 시뮬레이션

**Files:**
- Create: `src/domain/social/Matchmaker.ts`, `src/domain/village/Simulation.ts`
- Test: `tests/unit/social/Matchmaker.test.ts`, `tests/unit/village/Simulation.test.ts`

**Interfaces:**
```ts
// Matchmaker.ts
export interface Candidate { id: string; lane: 0|1|2; x: number; state: ResidentState }
export function pickTarget(self: Candidate, others: Candidate[], relation: (id: string) => number, blocked: (id: string) => boolean, rng: () => number): string | undefined
//   same lane, not duet/sleep/approach, not blocked; weight 1/(0.05+|dx|) × (1+relation)
export function inReach(a: number, b: number): boolean   // |a−b| ≤ REACH
// Simulation.ts
export interface Mind { needs: Needs; traits: [Trait, Trait]; iconShown: Set<NeedKey> }
export interface VillageState { residents: Resident[]; minds: Record<string, Mind>; relations: RelationTable; duets: Duet[]; lastDuetAt: Record<string, number> /* pairKey → sim ms */; avoidUntil: Record<string, number>; quarrelAt: Record<string, number>; met: Set<string>; simMs: number; nextDuetId: number; duetLog: { type: DuetType; a: string; b: string; at: number }[] }
export interface SimEnv { phase: Phase; speed: number; walkRangeOf: (id: string) => readonly [number, number]; profileOf: (species: string) => Profile; nocturnalOf: (species: string) => boolean; traitTable: TraitTable }
export type SimEvent = { kind: 'state'; id: string; state: ResidentState } | { kind: 'duetStart'; duet: Duet } | { kind: 'duetStep'; duet: Duet } | { kind: 'duetEnd'; duet: Duet } | { kind: 'icon'; id: string; icon: NeedKey | 'heart' | 'anger' | 'sparkle' | 'leaf' | 'question' } | { kind: 'speak'; id: string; duet: Duet }
export const MAX_DUETS = 3; export const PAIR_COOLDOWN_MS = 60_000; export const AVOID_MS = 30_000; export const MAKEUP_WINDOW: [number, number] = [60_000, 300_000]
export function createVillageState(residents: Resident[], seed: number): VillageState   // minds via initialNeeds/assignTraits with mulberry32(seed ^ 0x5151)
export function stepVillage(s: VillageState, dtMs: number, env: SimEnv, rng: () => number): { state: VillageState; events: SimEvent[] }
```
`stepVillage` 순서: (1) simDt = dt×speed; 욕구 전진(야행성·glutton 배수), 관계 복귀, simMs; (2) 듀엣 전진: step 변화 → `duetStep`+`speak`(chat/greet/groom/makeUp), chase는 b의 x를 a 쪽/반대로 CHASE_OFFSET만큼 step마다 이동(walkRange 클램프), 완료 → 결과 적용(관계·욕구·아이콘 heart/anger/sparkle/leaf), 둘을 idle(stateT 4000)로, `lastDuetAt`, quarrel이면 `avoidUntil`·`quarrelAt`; (3) 듀엣이 아닌 주민 `tick`(weights = composeWeights(야간 선택된 base, needs, traits)); `approach` 진입 시 `pickTarget`(blocked = 듀엣 중·avoid·쿨다운)로 `targetId` 부여, 없으면 idle; `approach`이고 inReach이고 `duets.length < MAX_DUETS`이면 `startDuet`(상대가 걷는 중이면 멈춤; sit/forage 끊음) + `duetStart` + 첫 `speak`; `forage` 종료 시 hunger −0.6; `sleep` 종료 시 sleepy −1; `walk` 종료 bored −0.1; (4) 욕구 아이콘 `needIcons` → `icon` 이벤트; (5) 상태 변화 → `state` 이벤트. 결정적: 같은 입력·rng → 같은 출력.

- [ ] **Step 1: 테스트** — Matchmaker: `prefers near friends`(1000 draws), `excludes other lanes, duet, sleep, blocked`, `undefined when none`, `inReach`. Simulation: `n=1 never approaches and never throws`(10 min sim), `needs rise with speed`(speed 60 ⇒ bored 0→1 in 90 s real), `approach leads to a duet within reach`(two residents x 0.3/0.5 same lane, forced lonely 1 → duet within 30 s, both state 'duet', event duetStart), `first duet is greet`, `duet outcome applies relation and needs`, `max 3 concurrent duets`(10 residents forced lonely), `pair cooldown 60 s`, `quarrel sets avoid and makeUp follows within window`(force quarrel via rng stub), `chase moves b`, `sleeping resident is not targeted`, `resize mid-duet keeps both in duet and inside walkRange`(shrink walkRange → x clamped, state still duet), `deterministic for seed`, `duetLog records types`.
- [ ] Step 2 FAIL → Step 3 구현 → Step 4 `npm run test:cov` ≥ 90% → **Step 5: 커밋** `feat(village): 매치메이커와 마을 시뮬레이션(듀엣 생애주기)`

---

### Task 6: 종족어 (voice)

**Files:** Modify `data/sprites/species.json`(25종 `voice`), `src/domain/sprites/types.ts`(`SpeciesDef.voice`), `src/domain/sprites/SpriteRegistry.ts`(voice 필수 검증: syllables ≥ 2, marks ≥ 1, maxSyllables 1..4); Create `src/domain/speech/Voice.ts`; Test `tests/unit/speech/Voice.test.ts`, registry test 추가.

**Interfaces:**
```ts
export interface Voice { syllables: string[]; marks: string[]; maxSyllables: number }
export type Mood = 'greet' | 'chat' | 'soft' | 'upset'
export function speak(v: Voice, mood: Mood, rng: () => number): string // 1..maxSyllables syllables + one mark; greet → '?'|'!' preferred, upset → '…'|'!' lowercase (no change), soft → '…'
```
voice 예: raccoon `["너굴","뀨","뀨르"]`, black-bear `["크릉","흠","으르"]`, human `["ㅇ","아","으","ㅁ…"]`, birds `["까악","깍"]`(crow), `["깍깍","깍"]`(magpie), `["부엉","부"]`(owl), `["딱","따르륵"]`(woodpecker), `["꺅","깩"]`(jay), `["꿩","꿔궝"]`(pheasant); 포유류 각자 현실 소리를 짧은 음절로. 전부 한국어 음절이며 데이터 파일에만 있다.

- [ ] Step 1 테스트: `speak uses 1..max syllables and ends with a mark`(500 draws), `greet prefers ? or !`(≥ 80%), `deterministic`, 레지스트리 `every species has a valid voice`, `rejects species without voice`. Step 2–4. **Step 5: 커밋** `feat(speech): 종족어 생성기와 voice 데이터`

---

### Task 7: 속마음·아이콘·풍선 큐 (도메인 + 시드 데이터)

**Files:**
- Create: `src/domain/speech/Thoughts.ts`, `src/domain/speech/Bubbles.ts`, `data/dialogue/thoughts.json`(시드: 30상황 × `any` 2줄 = 60줄, 사람이 쓴 톤 예시), `data/dialogue/forbidden.json`
- Modify: `data/ui.json`(`icons`: leaf 🍂, sleepy 💤, bored 🌀, lonely 💭, heart ❤, anger 💢, sparkle ✨, question ❓), `src/domain/sprites/catalog.ts`(`THOUGHTS`, `FORBIDDEN`, `UI` export)
- Test: `tests/unit/speech/Thoughts.test.ts`, `tests/unit/speech/Bubbles.test.ts`, `tests/unit/speech/dialogueData.test.ts`

**Interfaces:**
```ts
// Thoughts.ts
export const SITUATIONS: readonly string[] // the 30 from spec §5.2
export interface ThoughtEntry { situation: string; trait: Trait | 'any'; species: string; lines: string[] }
export interface ThoughtsData { situations: string[]; entries: ThoughtEntry[] }
export interface ThoughtCtx { lastDuet?: DuetType; needs: Needs; band?: Band; phase: Phase; season: Season; traits: readonly Trait[]; species: string; idleMs: number }
export function situationFor(c: ThoughtCtx): string[]            // ordered candidates: afterX > need≥0.8 (hungry/sleepy/bored/lonely) > band (bestie/friend/awkward) > phase > season > idleLong
export function pickThought(c: ThoughtCtx, data: ThoughtsData, recent: string[], rng: () => number): string | null // trait match first then any; species-tagged lines only when species matches; skip recent (last 10); null when nothing
export function validateThoughts(data: unknown, forbidden: string[]): ThoughtsData   // schema, ≤22 chars, ≤1 '.', no digits/emoji, no forbidden substrings; throws `thoughts: …`
export function violations(lines: string[], forbidden: string[]): string[]
// Bubbles.ts
export type BubbleKind = 'thought' | 'speech' | 'icon'
export interface Bubble { id: string; residentId: string; kind: BubbleKind; text: string; bornMs: number; ttlMs: number }
export const BUBBLE_TTL = { thought: 5000, speech: 2500, icon: 2000 }; export const MAX_BUBBLES = 3; export const FADE_MS = 250
export class BubbleQueue { push(b: Omit<Bubble,'id'|'bornMs'>, nowMs: number): boolean /* false when refused */; tick(nowMs: number): Bubble[] /* alive */; alphaOf(b: Bubble, nowMs: number): number /* 0..1 with 250 ms fade in/out */ }
```
규칙: 주민당 1개(높은 우선순위는 낮은 것을 교체), 전체 ≤ 3(우선순위 낮은 새 풍선은 거부), 우선순위 thought > speech > icon.

- [ ] Step 1 테스트: situation 우선순위 4케이스, `trait match beats any`, `species line only for that species`, `skips recent 10`, `falls back to idleLong then null`, 데이터: `real thoughts.json validates`, `every situation has ≥ 2 lines`(시드 기준; Task 16이 6으로 올림), `forbidden.json has ≥ 15 words`, `violations finds a forbidden word`; Bubbles: `max 3`, `one per resident replaced by higher priority`, `lower priority refused`, `alpha ramps 250 ms`, `expires after ttl`.
- [ ] Step 2–4 → **Step 5: 커밋** `feat(speech): 속마음 선택기·금칙어·풍선 큐, 시드 대사`

---

### Task 8: 너구리 리그 +12프레임

**Files:** Modify `data/sprites/rigs/raccoon.json`, `data/sprites/parts/*.json`(필요한 `states.interact_a/interact_b/happy/sulk/shake` offset), `src/domain/sprites/types.ts`(`SpriteState` 확장), `src/domain/sprites/validateRig.ts`(`validateRig(rig, states = STATES)`, `FRAME_COUNT_M2B = { shake 4, interact_a 4, interact_b 4, happy 2, sulk 2 }`, `STATES`는 아직 M1 4개); Test `tests/unit/sprites/validateRig.test.ts`(`raccoon has the M2b states with FRAME_COUNT_M2B and anchors`), 연결성 테스트는 `Object.keys(rig.frames)` 전체를 돈다.

- [ ] Step 1 테스트 → FAIL. Step 2: 프레임 작성(스펙 §6.1 포즈, frameRate 추가: interact_a 6, interact_b 6, happy 4, sulk 2, shake 8). Step 3: `npm run build && npm run capture:sheet -- --sheet=raccoon`은 아직 4상태만 보이므로 시트 스크립트에 `--states=all`(STATES 대신 `Object.keys(rig.frames)`)을 추가해 Read로 확인(≤ 4 라운드, 기록). Step 4: 테스트·lint. **Step 5: 커밋** `feat(sprites): 너구리 리그 상호작용·감정 프레임 12장`

### Task 9: quad-s +12프레임 (Task 8과 같은 절차, 조각 `states` 확장 — 귀·꼬리·가시·반점)
### Task 10: quad-l +12프레임 (곰 앉아서 손 내밀기, 멧돼지 코 끄덕임, 산양)
### Task 11: quad-deer +12프레임
### Task 12: bird +12프레임 (interact = 고개 숙임/날개 살짝, happy = 폴짝, sulk = 깃털 부풀리고 고개 돌림)
### Task 13: biped +12프레임 + STATES 확장
- Task 13 추가 단계: `STATES = [...M1, 'shake','interact_a','interact_b','happy','sulk']`, `FRAME_COUNT` 병합, `FRAME_COUNT_M2B` 제거, `validateRig` 시그니처 원복; 모든 리그 테스트 통과; `SpriteBank`는 STATES를 돌므로 자동으로 애니 등록; `npm run capture:sheet -- --sheet=<6종 대표>` Read. 커밋 `feat(sprites): 두발 리그 12장과 9상태 확정`

(Tasks 9–13의 각 커밋: `feat(sprites): <리그> 상호작용·감정 프레임 12장`. 각 태스크는 자기 리그의 6종(또는 대표 3종) 시트를 `--states=all`로 Read해 판정 기록.)

---

### Task 14: 렌더 — 시뮬레이션 연결과 듀엣 연출

**Files:**
- Create: `src/render/social/DuetDirector.ts`
- Modify: `src/render/scenes/VillageScene.ts`, `src/app/query.ts`(`duet?: DuetType | 'all'`), `src/app/global.d.ts`(`__rv.duets: Duet[]`, `duetLog`, `minds` (debug), `bubbles: Bubble[]`), `src/domain/sprites/catalog.ts`(BEHAVIOR_TRAITS·THOUGHTS 이미 export)
- Test: `tests/unit/app/query.test.ts`(`duet` 파싱: 8종 + all, 그 외 무시), `tests/unit/render` 없음(Phaser) — `DuetDirector`의 순수 부분은 `src/domain/social/DuetScript.ts`로 두고 테스트: `scriptFor(type, step, role) → { anim: SpriteState; flip: 'toward'|'away'|'same'; offsetX: number }`

**Interfaces:**
```ts
// src/domain/social/DuetScript.ts (pure)
export type Role = 'a' | 'b'
export interface Cue { anim: SpriteState; flip: 'toward' | 'away' | 'same'; offsetX: number /* fraction of width, relative to own x */ }
export function scriptFor(type: DuetType, step: number, role: Role): Cue   // table from spec §6.2; sitTogether offsetX a −0.015 / b +0.015, facing same; quarrel flip 'away'; chase uses walk
```
VillageScene: `create()`에서 `createVillageState(residents, seed)`; `update()`에서 still/showcase/sheet/duet 모드가 아니면 `stepVillage` 1회, 이벤트 처리: `state`/`duetStart`/`duetStep`/`duetEnd` → 애니 키(`duet`이면 `scriptFor`의 anim), flip(`toward`: 상대 x 비교), 위치 오프셋; `speak`/`icon`은 Task 15의 BubbleLayer로(이 태스크에서는 `__rv.bubbles`에 큐만). `__rv`에 `duets`, `duetLog`, `minds`(debug 시). `?duet=<type>`: 정지 연출 — 너구리 2마리(default variant, lane 1, x 0.45/0.55)를 `scriptFor(type, 0, 'a'/'b')` 프레임 0으로 고정, `still` 강제, `__rv.ready`; `?duet=all`: 8종을 가로로 2마리씩 배치. `?debug=1` 줄: 주민마다 `H.5 S.2 B.7 L.1 calm/chatty` + 듀엣 `greet 2.1s`.

- [ ] Step 1 테스트(query, DuetScript 8×steps×roles 표) → FAIL → 구현 → PASS. Step 2: `npm run build`, `npm run capture:sheet -- --duet=all`(스크립트에 추가: `/?duet=all&at=2026-04-10T12:00&seed=1` → `captures/duet-all.png`) Read: 8쌍이 마주 보고/나란히/등 돌린 포즈로 보인다. `npm run e2e`(기존 10개) 통과, 베이스라인 불변(still). **Step 3: 커밋** `feat(render): 마을 시뮬레이션 연결, 듀엣 연출, duet 모드`

---

### Task 15: 렌더 — 풍선 레이어와 입력

**Files:**
- Create: `src/render/ui/BubbleLayer.ts`
- Modify: `src/render/scenes/VillageScene.ts`, `index.html`·`w/index.html`(Noto Sans KR 폰트 `<link>`는 외부 네트워크 → 대신 시스템 폰트 스택만; `document.fonts.ready` 대기 불필요), `src/app/wallpaper.ts`(변경 없음 확인: 입력 없음)
- Test: e2e `tests/e2e/smoke.spec.ts` 추가 2개

BubbleLayer: 풀 6개(각 `Graphics` 둥근 사각 + `Text`), `sync(bubbles: Bubble[], nowMs, positions: (id) → {x,y,headY})`로 BubbleQueue 결과를 그림; 위치 = 스프라이트 머리 위(`frameSize[1] × displayScale` 위 6 px), 화면 안으로 클램프, 깊이 2_000_000, 알파 = `queue.alphaOf`. 폰트: `"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif` 14 px(세로 화면은 카메라 줌으로 2배). 텍스트 색 `#2b2b2b`, 배경 `#f4efe6` 알파 0.92, 생각 풍선은 꼬리 대신 작은 원 2개. 아이콘은 Text(이모지) 18 px.
VillageScene: `speak` 이벤트 → `speak(voice, mood, rng)`로 문장 → `queue.push({kind:'speech'})`; `icon` → `UI.icons[name]`; 탭(플레이 모드만, `deps.mode === 'play'`): 스프라이트 `setInteractive()` + `pointerup` → `pickThought(ctx…)` → `queue.push({kind:'thought'})` (탭 시 band에 따라 ❤/💧 아이콘 1개를 같은 풍선 텍스트 끝에 붙임: `ui.json` `relationMarks`); 월페이퍼: `thoughtTimer` 10분(시뮬 시간 아님, 실제 시간) 랜덤 주민(dreamer ×2 가중), `__rv.bubbles`.

- [ ] Step 1: e2e 추가 — `tap shows a thought bubble in play mode`(`/?at=2026-04-10T12:00&seed=5&n=12`, ready 후 첫 주민의 화면 좌표를 `__rv.positions[0]`(Task 14에서 노출)로 받아 `page.mouse.click`, `expect.poll(() => __rv.bubbles.some(b => b.kind === 'thought'))`), `wallpaper ignores taps`(같은 클릭 후 1 s 동안 bubbles 길이 0). Step 2: 구현. Step 3: `npm run e2e` ×2(12 passed + 1 skipped), 베이스라인 불변. **Step 4: 커밋** `feat(render): 풍선 레이어, 탭 속마음, 월페이퍼 자동 속마음`

---

### Task 16: 속마음 대사 Workflow 배치 생성

**Files:** Modify `data/dialogue/thoughts.json`(시드 60줄 → ≥ 240줄), Create `docs/dialogue-review.md`(검수 체크리스트), Modify `tests/unit/speech/dialogueData.test.ts`(`every situation ≥ 6 lines`, `every trait ≥ 20 lines`, `no duplicates`)

- [ ] Step 1: 테스트 기준 상향(≥ 6/≥ 20/중복 0) → FAIL.
- [ ] Step 2: **Workflow 실행**(사용자 승인: 2026-11-03 "Workflow 배치 생성" 선택; 컨트롤러가 "use a workflow"로 호출): 특성별 초안 에이전트 8개 병렬(각 30상황 × 2줄 + 종족 태그 줄 6개; 입력: 02 톤·금지 목록, 03 특성 설명, 상황 정의, 기존 시드 예시, 출력 JSON 스키마) → 톤 검수 에이전트 1개(금칙어·길이·설명조·숫자·중복·우열·그리움 제거, 거부 목록 반환) → 병합 스크립트(`scripts/merge-thoughts.ts`, tsx: 기존 시드 유지 + 신규 추가, 정렬) → `thoughts.json`.
- [ ] Step 3: `npx vitest run tests/unit/speech` PASS; `docs/dialogue-review.md`에 상황별 줄 수 표와 "사람 검수: [ ]" 체크란, 검수 에이전트 거부 사례 10개.
- [ ] Step 4: 커밋 `feat(dialogue): 속마음 240+줄 배치 생성과 검수 목록`

---

### Task 17: 검증 — e2e 듀엣, 캡처, 전력, 타임랩스

**Files:** Modify `tests/e2e/smoke.spec.ts`(`a duet happens within 120 s at speed 60`: `/?speed=60&seed=7&n=12&at=2026-04-10T12:00` → `waitForFunction(() => __rv.duets.length ≥ 1 || __rv.duetLog.length ≥ 1, {timeout: 120000})`; 데스크톱만), `scripts/capture-sheet.ts`(`--duet=all` 외에 `--duet=<type>` 8장: `captures/duet-<type>.png`), `scripts/measure-wallpaper.ts`(`--out docs/metrics/M2b.md`, 비교 기준 M2a 21.94 ×1.1), `playwright.config.ts`(해당 테스트 timeout 150 s)
- [ ] Step 1: e2e 추가 → 실행 ×2. Step 2: `npm run capture:sheet -- --duet=all` + 8장 Read(마주 보기·교대 말풍선·나란히 앉기·등 돌리기가 읽히는지). Step 3: `npm run build && npm run measure:wall -- --n=30 --out=docs/metrics/M2b.md`(10분) → 숨김 < 10%, 활성 ≤ 24.1. Step 4: `npm run capture:timelapse -- --n=12 --speed=600 --seconds=60`(스크립트가 `speed` 인자를 받도록) 후 `__rv.duetLog`를 콘솔로 덤프해 분당 듀엣 ≤ 2와 8종 전부 발생(DoD 1) 확인 — 스크립트에 `--log=duets` 옵션으로 종료 시 `captures/duet-log.json` 저장. Step 5: 커밋 `chore(verify): 듀엣 e2e·캡처·M2b 전력·타임랩스 로그`

---

### Task 18: 문서와 DoD

**Files:** `docs/02-story-worldbuilding.md`(언어: voice 생성·속마음 노출 규칙), `docs/03-gameplay-design.md`(욕구 시간·특성 배수표·듀엣 표·관계 띠·상태 7개), `docs/05-art-audio-direction.md`(리그당 26프레임, 프레임레이트, 앵커 불변), `docs/06-dev-workflow.md`(Workflow 실행 기록·검수 절차 링크), `docs/09-roadmap.md`(M2b 완료 행 + 측정 줄), `docs/decisions.md`(듀엣 모델, 72장, Workflow 1회, 배고픔 임시 해소, 숫자 비노출), `README.md`(쿼리 `duet`, 탭 조작, M2b 완료 기준 6항 + 증거, 테스트 수치)
- [ ] 편집 → `npm run lint && npm test && npm run build` → 커밋 `docs: M2b 마음과 말 반영`

---

## 셀프 리뷰
- 스펙 커버리지: §2(T1,T2), §3(T4,T5), §4(T3), §5(T6,T7,T15,T16), §6(T8–T13, T14 DuetScript), §7(T14,T15), §8(T16), §9(T5 테스트·T17), §10(T18), §11 DoD(T14 duet 캡처, T15 탭, T16 대사, T17 로그·전력, T18 문서). 누락 없음.
- 타입 일관성: `Needs/NeedKey/Trait/TraitTable`(T1) → T2·T5·T7; `DuetType/Duet/DuetMind`(T4) → T3 `BAND_MULTIPLIER`(T3가 T4의 `DuetType`을 import하므로 T3는 타입만 먼저 `social/types.ts`에 두거나 T4 뒤에 실행 — **결정: `DuetType`은 `src/domain/social/types.ts`에 T3에서 먼저 선언**, T4가 재export). `SimEvent icon` 이름과 `ui.json` 키(leaf·sleepy·bored·lonely·heart·anger·sparkle·question) 일치. `SpriteState` 확장(T8)과 `FRAME_COUNT_M2B` → T13에서 `STATES` 확정.
- 순서 의존: T8–T13 동안 `STATES`가 4개라 `SpriteBank`는 새 상태 애니를 만들지 않으므로 기존 e2e·베이스라인이 깨지지 않는다. T14는 T13 이후.
- 비율: 코드 블록은 서명·상수·테스트 이름. 데이터 작성 태스크는 포즈 서술로 고정.
