# M1 살아있는 디오라마 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현실 시간·계절을 반영하는 하늘 아래 플레이스홀더 너구리 한 마리가 자율 행동하는 Phaser 4 디오라마를 `/`와 `/w/` 두 엔트리로 만들어 GitHub Pages에 배포하고, 저전력·결정적 테스트·타임랩스 캡처까지 갖춘다.

**Architecture:** `src/domain`은 Phaser를 모르는 순수 TS(시계, 날짜 컨텍스트, 주민 AI, 레인, 전력 정책, 팔레트 보간)로 Vitest가 전부 검증한다. `src/render`는 도메인 출력을 Phaser 씬에 그리기만 하고, `src/app/boot.ts`가 쿼리(`at`, `speed`, `seed`, `still`, `debug`)로 시계·시드를 고르고 모드별 Phaser 설정을 만든다. 플레이와 월페이퍼는 같은 씬을 쓰며 fps 설정과 DOM UI만 다르다.

**Tech Stack:** Node 22 · TypeScript 5 · Vite 8 · Phaser 4.2.1 · Vitest 5 · @playwright/test 1.63 · ESLint 9 + Prettier · GitHub Actions + Pages

**Spec:** `docs/superpowers/specs/2026-11-03-m1-living-diorama-design.md`

## Global Constraints

- `src/domain/**`은 `phaser`를 import하지 않는다(ESLint `no-restricted-imports`로 강제). 커버리지 `src/domain` 90% 이상(lines/branches/functions).
- 한국어 문자열을 코드에 하드코딩하지 않는다. M1의 유일한 UI 문구(소리 켜기 버튼)는 `data/ui.json`에서 읽는다.
- 오디오는 사용자 제스처 후에만 시작, 게인 변화는 200ms 이상 페이드. 갑작스러운 소리 없음.
- 타임존 기본 `Asia/Seoul`. 시간대 경계·가중치·보간 시간은 스펙 §3·§4 값 그대로.
- Vite `base`는 `/raccoon-village/`. 엔트리는 `index.html`, `w/index.html`.
- 난수는 전부 주입(`rng: () => number`). 스크린샷은 `?at=&seed=&still=1`로 결정적.
- 커밋은 Conventional Commits. 에셋 파일을 커밋하지 않는다(M1은 에셋 0개). 비밀값 없음.

## Review Focus

1. 자정을 넘기는 순간(23:59:59 → 00:00:00) phase가 night→night로 유지되고 season이 12→1월에서 winter로 유지되어야 한다. → Task 3 테스트에 23:59:59/00:00:00, 12-31/01-01 추가.
2. 탭이 밤에 잠들었다가 아침에 깨면 하늘이 60초 보간 없이 즉시 아침이어야 한다(사용자는 어두운 화면을 1분 보게 된다). → Task 14에 resume 시 `SkyLayer.snapTo` 호출 테스트(도메인 보간기 `reset` 단위 테스트는 Task 10).
3. FastClock으로 하루가 2.4분이면 phase 전환이 4번 연속 오는데, 보간이 60초면 전환이 겹친다. → Task 10에서 보간 시간은 `60s / speed`로 비례 단축, 테스트로 고정.
4. 세로 화면(390×844)에서 너구리가 화면 밖으로 걸어 나가면 안 된다. → Task 14에서 세로 모드 카메라가 x 0.25~0.75를 보이고, Task 7에서 x 클램프 [0.05, 0.95]이지만 세로에서는 `walkRange`를 [0.3, 0.7]로 주입. 테스트: Lanes/UtilityAI에 range 파라미터.
5. AudioContext가 `suspended`로 생성되는 브라우저(Safari)에서 버튼을 눌러도 소리가 안 날 수 있다. → Task 15에서 버튼 핸들러가 `ctx.resume()`을 await한 뒤 게인 페이드. e2e에서 버튼 클릭 후 `window.__audioState === 'running'` 확인.

---

## 파일 구조

| 경로 | 책임 |
|---|---|
| `package.json`, `vite.config.ts`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`, `.prettierrc` | 빌드·테스트 설정 |
| `index.html`, `w/index.html` | 두 엔트리. 각각 `src/app/main.ts`, `src/app/wallpaper.ts` 로드 |
| `data/sky-palette.json`, `data/ui.json` | 하늘 색상 16세트, UI 문구 |
| `src/domain/rng.ts` | mulberry32 시드 난수 |
| `src/domain/time/Clock.ts` | `Clock` 인터페이스, `RealClock`, `FixedClock`, `FastClock` |
| `src/domain/time/DateContext.ts` | `computeDateContext(date, tz)` |
| `src/domain/village/Lanes.ts` | 레인 상수, `toScreen` |
| `src/domain/resident/Resident.ts` | 타입·초기 생성 |
| `src/domain/resident/UtilityAI.ts` | `tick` 순수 함수 |
| `src/domain/wallpaper/PowerPolicy.ts` | `policy()` |
| `src/domain/events.ts` | 타입 안전 이벤트 버스 |
| `src/domain/sky/SkyPalette.ts` | 팔레트 조회·색 보간·`SkyBlender` |
| `src/app/query.ts` | URL 쿼리 → `BootOptions` 순수 파서 |
| `src/app/boot.ts` | `BootOptions` → Clock/rng/PowerPolicy/Phaser 설정, `createGame(mode)` |
| `src/app/main.ts`, `src/app/wallpaper.ts` | 엔트리 |
| `src/render/sprites/PlaceholderRaccoon.ts` | Graphics → 텍스처·애니메이션 등록 |
| `src/render/sky/SkyLayer.ts` | 그라디언트·스카이라인·별·달 그리기 |
| `src/render/audio/WindSynth.ts` | Web Audio 바람 합성 |
| `src/render/scenes/VillageScene.ts` | 도메인 틱 → 그리기, 리사이즈, resume |
| `tests/unit/**` | Vitest |
| `tests/e2e/smoke.spec.ts`, `tests/capture/baseline/*.png` | Playwright 스모크·스크린샷 |
| `scripts/capture-timelapse.ts`, `scripts/measure-wallpaper.ts` | 캡처·측정 |
| `.github/workflows/ci.yml` | CI + Pages |
| `docs/metrics/M1.md` | 측정 결과 |

---

### Task 1: 프로젝트 스캐폴드

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc`, `index.html`, `w/index.html`, `src/app/main.ts`, `src/app/wallpaper.ts`, `tests/unit/smoke.test.ts`
- Modify: `.gitignore` (추가: `coverage/`, `test-results/`, `playwright-report/`, `tests/capture/current/`)

**Interfaces:**
- Produces: npm 스크립트 `dev`, `dev:wall`, `build`, `preview`, `test`, `test:cov`, `lint`, `e2e`, `capture`, `capture:timelapse`, `measure:wall`. Vite `base: '/raccoon-village/'`, 멀티 엔트리 `{ main: 'index.html', w: 'w/index.html' }`. 경로 별칭 `@domain/*`, `@render/*`, `@app/*`.

- [ ] **Step 1: 패키지 초기화 및 의존성 설치**

Run:
```bash
npm init -y
npm i phaser@4.2.1
npm i -D typescript@^5.6 vite@^8.3 vitest@^5.1 @vitest/coverage-v8@^5.1 @playwright/test@1.63.0 eslint@^9 @eslint/js typescript-eslint prettier eslint-config-prettier tsx
```
Expected: `node_modules/phaser/package.json`의 version이 `4.2.1`.

- [ ] **Step 2: 설정 파일 작성**

`vite.config.ts`: `base: '/raccoon-village/'`, `build.rollupOptions.input = { main: resolve('index.html'), w: resolve('w/index.html') }`, `resolve.alias` 3개.
`vitest.config.ts`: `include: ['tests/unit/**/*.test.ts']`, `coverage: { provider: 'v8', include: ['src/domain/**'], thresholds: { lines: 90, branches: 90, functions: 90 } }`.
`eslint.config.js`: typescript-eslint recommended + 규칙 `no-restricted-imports`를 `files: ['src/domain/**']`에 `{ paths: ['phaser'], patterns: ['phaser/*'] }`로 적용.
`tsconfig.json`: `strict: true`, `target: ES2022`, `moduleResolution: bundler`, `paths` 별칭.
`package.json` scripts:
```json
"dev": "vite", "dev:wall": "vite --open /raccoon-village/w/", "build": "tsc --noEmit && vite build", "preview": "vite preview",
"test": "vitest run", "test:cov": "vitest run --coverage", "lint": "eslint . && prettier -c .",
"e2e": "playwright test", "capture": "playwright test --update-snapshots",
"capture:timelapse": "tsx scripts/capture-timelapse.ts", "measure:wall": "tsx scripts/measure-wallpaper.ts"
```

- [ ] **Step 3: 두 엔트리 HTML과 빈 엔트리 TS 작성**

`index.html`과 `w/index.html`은 `<div id="game"></div>`와 `<script type="module" src="/src/app/main.ts">`(월페이퍼는 `wallpaper.ts`). `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `html,body,#game{margin:0;height:100%;background:#000;overflow:hidden}`. 엔트리 TS는 `console.log('boot')`만.

- [ ] **Step 4: 스모크 테스트 작성 및 실행**

```ts
// tests/unit/smoke.test.ts
import { describe, it, expect } from 'vitest'
describe('toolchain', () => { it('runs', () => expect(1 + 1).toBe(2)) })
```
Run: `npm test` → Expected: 1 passed. Run: `npm run build` → Expected: `dist/index.html`, `dist/w/index.html` 생성. Run: `npm run lint` → Expected: 에러 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: Vite+Phaser 4+Vitest 스캐폴드, 두 엔트리(/, /w/)"
```

---

### Task 2: 시드 난수와 Clock

**Files:**
- Create: `src/domain/rng.ts`, `src/domain/time/Clock.ts`, `tests/unit/rng.test.ts`, `tests/unit/time/Clock.test.ts`

**Interfaces:**
- Produces: `mulberry32(seed: number): () => number` (0 이상 1 미만). `interface Clock { now(): Date }`, `class RealClock`, `class FixedClock(iso: string, tz = 'Asia/Seoul')`, `class FastClock(start: Date, speed: number, real: Clock = new RealClock())` — `now()`는 `start + (real.now() - createdAt) * speed`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// rng.test.ts
it('same seed gives same sequence', () => {
  const a = mulberry32(42), b = mulberry32(42)
  expect([a(), a(), a()]).toEqual([b(), b(), b()])
})
it('values in [0,1)', () => { const r = mulberry32(7); for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1) } })
// Clock.test.ts
it('FixedClock parses local Seoul time', () => {
  expect(new FixedClock('2026-01-15T22:00').now().toISOString()).toBe('2026-01-15T13:00:00.000Z')
})
it('FastClock advances speed× real time', () => {
  let t = 0; const real = { now: () => new Date(t) }
  const c = new FastClock(new Date('2026-06-01T00:00:00Z'), 600, real)
  t = 1000
  expect(c.now().toISOString()).toBe('2026-06-01T00:10:00.000Z')
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/unit/rng.test.ts tests/unit/time` → Expected: FAIL (module not found).

- [ ] **Step 3: 구현** — `mulberry32`는 표준 알고리즘. `FixedClock`은 `iso`에 타임존 오프셋이 없으면 `Asia/Seoul`로 해석(`Intl.DateTimeFormat`으로 오프셋 계산 후 보정).

- [ ] **Step 4: 통과 확인** — Run: 같은 명령 → Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(domain): mulberry32 rng, Real/Fixed/Fast clock"`

---

### Task 3: DateContext — 계절과 시간대

**Files:**
- Create: `src/domain/time/DateContext.ts`, `tests/unit/time/DateContext.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Phase = 'dawn' | 'day' | 'dusk' | 'night'
  export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
  export interface DateContext { phase: Phase; season: Season; moonPhase: number; skyKey: `${Season}-${Phase}`; hour: number; minute: number }
  export function computeDateContext(date: Date, tz = 'Asia/Seoul'): DateContext
  export function localParts(date: Date, tz: string): { year: number; month: number; day: number; hour: number; minute: number }
  ```
  (moonPhase·skyKey는 Task 4에서 채움. 이 태스크에서는 `moonPhase: 0`, skyKey는 `${season}-${phase}`.)

- [ ] **Step 1: 실패하는 테스트 작성** — 스펙 §3.1 표 전부를 `it.each`로:

```ts
const seoul = (iso: string) => new FixedClock(iso).now()
it.each([
  ['2026-04-10T05:00', 'spring', 'dawn'], ['2026-04-10T06:59', 'spring', 'dawn'], ['2026-04-10T07:00', 'spring', 'day'],
  ['2026-04-10T16:59', 'spring', 'day'], ['2026-04-10T17:00', 'spring', 'dusk'], ['2026-04-10T19:00', 'spring', 'night'],
  ['2026-07-10T04:30', 'summer', 'dawn'], ['2026-07-10T06:30', 'summer', 'day'], ['2026-07-10T18:30', 'summer', 'dusk'], ['2026-07-10T20:30', 'summer', 'night'],
  ['2026-10-10T04:59', 'autumn', 'night'], ['2026-10-10T05:00', 'autumn', 'dawn'],
  ['2026-01-10T06:00', 'winter', 'dawn'], ['2026-01-10T08:00', 'winter', 'day'], ['2026-01-10T16:30', 'winter', 'dusk'], ['2026-01-10T18:30', 'winter', 'night'],
  ['2026-12-31T23:59', 'winter', 'night'], ['2027-01-01T00:00', 'winter', 'night'],
  ['2026-03-01T12:00', 'spring', 'day'], ['2026-06-01T12:00', 'summer', 'day'], ['2026-09-01T12:00', 'autumn', 'day'], ['2026-12-01T12:00', 'winter', 'day'],
])('%s → %s %s', (iso, season, phase) => {
  const c = computeDateContext(seoul(iso)); expect(c.season).toBe(season); expect(c.phase).toBe(phase)
})
it('uses given timezone', () => {
  expect(computeDateContext(new Date('2026-04-10T22:00:00Z'), 'Asia/Seoul').phase).toBe('day')   // 07:00 KST
  expect(computeDateContext(new Date('2026-04-10T22:00:00Z'), 'UTC').phase).toBe('night')
})
it('never throws on extreme dates', () => {
  for (const d of [new Date(0), new Date('2200-06-15T12:00:00Z'), new Date(-1e12)]) expect(() => computeDateContext(d)).not.toThrow()
})
it('falls back to local time on invalid tz', () => { expect(() => computeDateContext(new Date(), 'Not/AZone')).not.toThrow() })
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/unit/time/DateContext.test.ts` → FAIL.

- [ ] **Step 3: 구현** — `localParts`는 `Intl.DateTimeFormat(tz, {hour12:false, …}).formatToParts`; `RangeError`면 `try/catch`로 기기 로컬(`getHours` 등)로 대체하고 `console.warn` 1회(모듈 변수 플래그). phase 판정은 분 단위 정수(`hour*60+minute`)와 계절별 경계 테이블로.

- [ ] **Step 4: 통과 확인** — Run: 같은 명령 → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(domain): DateContext 계절·시간대 판정"`

---

### Task 4: DateContext — 월령과 skyKey

**Files:**
- Modify: `src/domain/time/DateContext.ts`
- Test: `tests/unit/time/DateContext.test.ts`

**Interfaces:**
- Produces: `export function moonPhase(date: Date): number` (0 이상 1 미만). `computeDateContext`가 `moonPhase`와 `skyKey` 채움.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it('moon phase: new moon epoch → 0, +14.765 days → ~0.5', () => {
  const epoch = new Date('2000-01-06T18:14:00Z')
  expect(moonPhase(epoch)).toBeCloseTo(0, 3)
  expect(moonPhase(new Date(epoch.getTime() + 14.765294 * 86400e3))).toBeCloseTo(0.5, 2)
  expect(moonPhase(new Date(epoch.getTime() - 86400e3))).toBeGreaterThan(0.9)  // 음수 모듈로 처리
})
it('skyKey combines season and phase', () => {
  expect(computeDateContext(new FixedClock('2026-10-10T18:00').now()).skyKey).toBe('autumn-dusk')
})
```

- [ ] **Step 2: 실패 확인** — Run → FAIL. **Step 3: 구현** — `P = 29.530588`, `((days % P) + P) % P / P`. **Step 4: 통과 확인** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(domain): 월령 계산과 skyKey"`

---

### Task 5: Lanes

**Files:**
- Create: `src/domain/village/Lanes.ts`, `tests/unit/village/Lanes.test.ts`

**Interfaces:**
- Produces: `export const LANES = [{ y: 0.62, scale: 0.8 }, { y: 0.72, scale: 1.0 }, { y: 0.82, scale: 1.2 }] as const`, `export const X_RANGE: readonly [number, number] = [0.05, 0.95]`, `export function clampX(x: number, range = X_RANGE): number`, `export function toScreen(lane: 0|1|2, x: number, viewport: { width: number; height: number }): { px: number; py: number; scale: number }`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it('maps lane 1 center to screen', () => {
  expect(toScreen(1, 0.5, { width: 1000, height: 500 })).toEqual({ px: 500, py: 360, scale: 1.0 })
})
it('clamps x', () => { expect(clampX(1.2)).toBe(0.95); expect(clampX(-1)).toBe(0.05); expect(clampX(0.5, [0.3, 0.7])).toBe(0.5); expect(clampX(0.9, [0.3, 0.7])).toBe(0.7) })
it('lane 0 is smaller and higher than lane 2', () => {
  const a = toScreen(0, 0.5, { width: 100, height: 100 }), b = toScreen(2, 0.5, { width: 100, height: 100 })
  expect(a.scale).toBeLessThan(b.scale); expect(a.py).toBeLessThan(b.py)
})
```

- [ ] **Step 2: 실패 확인** → FAIL. **Step 3: 구현**. **Step 4: 통과** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(domain): 레인 3개 좌표 변환"`

---

### Task 6: Resident와 UtilityAI

**Files:**
- Create: `src/domain/resident/Resident.ts`, `src/domain/resident/UtilityAI.ts`, `tests/unit/resident/UtilityAI.test.ts`

**Interfaces:**
- Consumes: `clampX` (Task 5), `Phase` (Task 3), `() => number` rng (Task 2).
- Produces:
  ```ts
  export type ResidentState = 'idle' | 'walk' | 'sit'
  export interface Resident { id: string; species: 'raccoon'; lane: 0|1|2; x: number; facing: 'left'|'right'; state: ResidentState; stateT: number; targetX?: number; history: ResidentState[] /* 최근 3개 */ }
  export function createResident(id: string, x = 0.5): Resident   // state 'idle', stateT 6000, facing 'right'
  export interface AIContext { phase: Phase; walkRange: readonly [number, number] }
  export const WEIGHTS = { default: { idle: 0.70, walk: 0.20, sit: 0.10 }, night: { idle: 0.75, walk: 0.05, sit: 0.20 } }
  export const DURATION_MS = { idle: [4000, 12000], sit: [6000, 20000] }
  export const WALK_SPEED = 0.06   // x/초
  export function tick(r: Resident, dtMs: number, ctx: AIContext, rng: () => number): Resident   // 불변, 새 객체 반환
  export function chooseNext(prev: ResidentState, history: ResidentState[], phase: Phase, rng: () => number): ResidentState
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
const ctx = { phase: 'day' as Phase, walkRange: [0.05, 0.95] as const }
it('idle expires then transitions to a new state', () => {
  let r = createResident('a'); const rng = mulberry32(1)
  r = tick(r, 6000, ctx, rng); expect(r.state).not.toBe(undefined); expect(r.stateT).toBeGreaterThan(0)
})
it('walk moves toward targetX at WALK_SPEED and faces the right way', () => {
  const r0 = { ...createResident('a', 0.5), state: 'walk' as const, targetX: 0.8, stateT: Infinity, facing: 'left' as const }
  const r1 = tick(r0, 1000, ctx, () => 0.5)
  expect(r1.x).toBeCloseTo(0.56, 5); expect(r1.facing).toBe('right')
})
it('walk ends when target reached and never leaves walkRange', () => {
  const r0 = { ...createResident('a', 0.68), state: 'walk' as const, targetX: 0.7, stateT: Infinity }
  const r1 = tick(r0, 1000, { ...ctx, walkRange: [0.3, 0.7] }, () => 0.5)
  expect(r1.x).toBeLessThanOrEqual(0.7); expect(r1.state).not.toBe('walk')
})
it('walk target is within ±0.1..0.4 and clamped to walkRange', () => {
  for (let i = 0; i < 200; i++) { const rng = mulberry32(i); let r = createResident('a', 0.5)
    r = { ...r, stateT: 0 }; r = tick(r, 16, { ...ctx, walkRange: [0.3, 0.7] }, rng)
    if (r.state === 'walk') { expect(r.targetX!).toBeGreaterThanOrEqual(0.3); expect(r.targetX!).toBeLessThanOrEqual(0.7); expect(Math.abs(r.targetX! - 0.5)).toBeGreaterThanOrEqual(0.1 - 1e-9) } }
})
it('night weights: sit ≈ 20%, walk ≈ 5% over 10k samples', () => {
  const rng = mulberry32(3); const n = { idle: 0, walk: 0, sit: 0 }
  for (let i = 0; i < 10000; i++) n[chooseNext('idle', [], 'night', rng)]++
  expect(n.sit / 10000).toBeCloseTo(0.20, 1); expect(n.walk / 10000).toBeLessThan(0.08)
})
it('no state three times in a row except walk after walk is also forbidden', () => {
  const rng = mulberry32(9)
  for (let i = 0; i < 2000; i++) { const s = chooseNext('sit', ['sit', 'sit'], 'day', rng); expect(s).not.toBe('sit') }
})
it('durations within spec ranges', () => {
  for (let i = 0; i < 300; i++) { const rng = mulberry32(i); const r = tick({ ...createResident('a'), stateT: 0 }, 16, ctx, rng)
    if (r.state === 'idle') { expect(r.stateT).toBeGreaterThanOrEqual(4000); expect(r.stateT).toBeLessThanOrEqual(12000) }
    if (r.state === 'sit') { expect(r.stateT).toBeGreaterThanOrEqual(6000); expect(r.stateT).toBeLessThanOrEqual(20000) } }
})
it('deterministic for same seed', () => {
  const run = () => { let r = createResident('a'); const rng = mulberry32(77); const out: string[] = []
    for (let i = 0; i < 100; i++) { r = tick(r, 500, ctx, rng); out.push(`${r.state}:${r.x.toFixed(3)}`) } return out }
  expect(run()).toEqual(run())
})
```

- [ ] **Step 2: 실패 확인** → FAIL. **Step 3: 구현** — `tick`: `stateT -= dt`; walk면 `x`를 목표 방향으로 `WALK_SPEED*dt/1000` 이동(도달 시 overshoot 방지), 도달하면 만료 처리; 만료 시 `chooseNext` → 새 상태·지속시간·(walk면) `targetX = clampX(x ± (0.1 + rng*0.3), walkRange)`; `history`는 최근 3개 유지. `chooseNext`: "같은 상태 연속 3회 금지"는 `history`의 마지막 2개가 모두 후보와 같으면 제외, walk는 직전이 walk면 제외.
- [ ] **Step 4: 통과 확인** → PASS. **Step 5: Commit** — `git commit -m "feat(domain): Resident와 UtilityAI(idle/walk/sit)"`

---

### Task 7: PowerPolicy와 events

**Files:**
- Create: `src/domain/wallpaper/PowerPolicy.ts`, `src/domain/events.ts`, `tests/unit/wallpaper/PowerPolicy.test.ts`, `tests/unit/events.test.ts`

**Interfaces:**
- Produces: `export type Mode = 'play' | 'wallpaper'`, `export function policy(i: { mode: Mode; hidden: boolean; reducedMotion: boolean }): { targetFps: number; particleCap: number; audioAllowed: boolean }`. `export class Emitter<M extends Record<string, unknown>> { on<K extends keyof M>(k: K, f: (p: M[K]) => void): () => void; off(k, f): void; emit<K>(k: K, p: M[K]): void }`, `export type GameEvents = { phaseChanged: { from: Phase; to: Phase }; seasonChanged: { from: Season; to: Season }; residentStateChanged: { id: string; state: ResidentState } }`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it.each([
  [{ mode: 'play', hidden: false, reducedMotion: false }, { targetFps: 60, particleCap: 200, audioAllowed: true }],
  [{ mode: 'wallpaper', hidden: false, reducedMotion: false }, { targetFps: 30, particleCap: 60, audioAllowed: true }],
  [{ mode: 'wallpaper', hidden: true, reducedMotion: false }, { targetFps: 0, particleCap: 60, audioAllowed: false }],
  [{ mode: 'play', hidden: false, reducedMotion: true }, { targetFps: 60, particleCap: 0, audioAllowed: true }],
])('policy %o', (i, o) => expect(policy(i as any)).toEqual(o))
// events
it('on/emit/off', () => { const e = new Emitter<{ a: number }>(); const got: number[] = []; const off = e.on('a', v => got.push(v)); e.emit('a', 1); off(); e.emit('a', 2); expect(got).toEqual([1]) })
```

- [ ] **Step 2: 실패 확인** → FAIL. **Step 3: 구현**. **Step 4: 통과** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(domain): PowerPolicy와 타입 안전 이벤트 버스"`

---

### Task 8: 하늘 팔레트와 보간기 (도메인)

**Files:**
- Create: `data/sky-palette.json`, `src/domain/sky/SkyPalette.ts`, `tests/unit/sky/SkyPalette.test.ts`

**Interfaces:**
- Consumes: `skyKey` (Task 4).
- Produces:
  ```ts
  export interface SkyColors { top: string; bottom: string; horizon: string; starAlpha: number }   // '#rrggbb'
  export function getSky(key: string): SkyColors            // 16키, 없으면 'spring-day'
  export function lerpHex(a: string, b: string, t: number): string
  export function lerpSky(a: SkyColors, b: SkyColors, t: number): SkyColors
  export class SkyBlender { constructor(initial: SkyColors, durationMs = 60000); setTarget(c: SkyColors): void; snapTo(c: SkyColors): void; update(dtMs: number): SkyColors; get current(): SkyColors }
  ```
  `data/sky-palette.json`: 16개 키. 값 예시(구현자가 톤만 유지하며 채움): `spring-day {top:#9ec9e8, bottom:#e8f1e4, horizon:#c9d8c0, starAlpha:0}`, `autumn-dusk {top:#5b4b7a, bottom:#e58a4a, horizon:#9a6a4f, starAlpha:0.2}`, `winter-night {top:#0b1026, bottom:#1d2742, horizon:#2c3550, starAlpha:1}`. 네온·고채도 금지(05 문서).

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it('palette has all 16 keys with valid hex', () => {
  for (const s of ['spring','summer','autumn','winter']) for (const p of ['dawn','day','dusk','night']) {
    const c = getSky(`${s}-${p}`); for (const h of [c.top, c.bottom, c.horizon]) expect(h).toMatch(/^#[0-9a-f]{6}$/i); expect(c.starAlpha).toBeGreaterThanOrEqual(0); expect(c.starAlpha).toBeLessThanOrEqual(1) }
})
it('unknown key falls back to spring-day', () => expect(getSky('nope')).toEqual(getSky('spring-day')))
it('lerpHex midpoint', () => expect(lerpHex('#000000', '#ffffff', 0.5)).toBe('#808080'))
it('blender reaches target after duration and snapTo is immediate', () => {
  const a = getSky('winter-night'), b = getSky('winter-dawn'); const bl = new SkyBlender(a, 60000)
  bl.setTarget(b); bl.update(30000); expect(bl.current.top).not.toBe(a.top); expect(bl.current.top).not.toBe(b.top)
  bl.update(30000); expect(bl.current).toEqual(b)
  bl.snapTo(a); expect(bl.current).toEqual(a)
})
it('duration scales with speed (60s / speed)', () => { const bl = new SkyBlender(getSky('spring-day'), 60000 / 600); bl.setTarget(getSky('spring-dusk')); bl.update(100); expect(bl.current).toEqual(getSky('spring-dusk')) })
```

- [ ] **Step 2: 실패 확인** → FAIL. **Step 3: 구현** (JSON은 `import palette from '../../../data/sky-palette.json'`; tsconfig `resolveJsonModule`). **Step 4: 통과** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(domain): 하늘 팔레트 16세트와 보간기"`

---

### Task 9: 쿼리 파서와 부트 옵션

**Files:**
- Create: `src/app/query.ts`, `tests/unit/app/query.test.ts`

**Interfaces:**
- Produces: `export interface BootOptions { at?: string; speed: number; seed: number; still: boolean; debug: boolean }`, `export function parseQuery(search: string): BootOptions` — 기본 `{ speed: 1, seed: Date.now() 대신 1234? }`. 결정: `seed` 미지정 시 `Math.floor(Math.random()*1e9)`를 **parseQuery 밖**(boot)에서 넣는다. `parseQuery`는 `seed?: number`로 반환.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it('parses all params', () => expect(parseQuery('?at=2026-01-15T22:00&speed=600&seed=7&still=1&debug=1')).toEqual({ at: '2026-01-15T22:00', speed: 600, seed: 7, still: true, debug: true }))
it('defaults', () => expect(parseQuery('')).toEqual({ speed: 1, still: false, debug: false }))
it('rejects bad speed', () => expect(parseQuery('?speed=-5').speed).toBe(1))
```

- [ ] **Step 2: 실패 확인** → FAIL. **Step 3: 구현** (`URLSearchParams`, speed는 1~3600 클램프). **Step 4: 통과** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(app): URL 쿼리 → BootOptions 파서"`

---

### Task 10: 플레이스홀더 너구리 텍스처

**Files:**
- Create: `src/render/sprites/PlaceholderRaccoon.ts`

**Interfaces:**
- Produces: `export const RACCOON_KEYS = { idle: ['raccoon-idle-0', …3], walk: ['raccoon-walk-0', …5], sit: ['raccoon-sit-0', 'raccoon-sit-1'] }`, `export function generateRaccoonTextures(scene: Phaser.Scene): void` (텍스처 12개 생성, 이미 있으면 skip), `export function registerRaccoonAnims(scene: Phaser.Scene): void` (anims `raccoon-idle` 4fps repeat, `raccoon-walk` 8fps repeat, `raccoon-sit` 2fps repeat). 기준 크기 48×40, 원점 하단 중앙.

- [ ] **Step 1: 구현** — `scene.add.graphics()`에 그리고 `generateTexture(key, 48, 40)` 후 `destroy()`. 색: 몸 `#8a8f99`, 마스크·꼬리 줄 `#2b2b2b`, 주둥이 `#e9e4d8`, 다리 `#55585f`. idle 프레임 1·3은 눈을 1px 선으로(깜빡임), 꼬리 끝 2px 흔들림. walk는 다리 x 오프셋 ±3px 교차, 프레임 짝수에 y −2px. sit은 몸 높이 70%, 꼬리를 앞으로.
- [ ] **Step 2: 수동 확인용 디버그 씬 없이 진행**(Task 12 스크린샷에서 검증). 타입체크: `npx tsc --noEmit` → 에러 0.
- [ ] **Step 3: Commit** — `git commit -m "feat(render): 코드로 그린 플레이스홀더 너구리 텍스처·애니"`

---

### Task 11: SkyLayer와 WindSynth

**Files:**
- Create: `src/render/sky/SkyLayer.ts`, `src/render/audio/WindSynth.ts`, `data/ui.json`

**Interfaces:**
- Consumes: `SkyColors`, `SkyBlender` (Task 8), `DateContext` (Task 4), `mulberry32` (Task 2).
- Produces:
  ```ts
  export class SkyLayer { constructor(scene: Phaser.Scene, seed: number); resize(w: number, h: number): void; render(c: SkyColors, moonPhase: number): void }
  export class WindSynth { constructor(); get state(): 'off'|'running'|'suspended'|'unavailable'; async start(): Promise<void>; setSeason(s: Season): void; fadeTo(gain: number, ms = 200): void; suspend(): void }
  ```
  `data/ui.json`: `{ "soundOn": "소리 켜기" }`.

- [ ] **Step 1: SkyLayer 구현** — 전체 화면 `Graphics`에 `fillGradientStyle(top, top, bottom, bottom)`; 지평선(y = h×0.6)에 `horizon` 색 사각형 실루엣 8~12개(seed 고정, 너비 w×0.04~0.12, 높이 h×0.05~0.25); 별 30개는 `Graphics` 점(alpha = starAlpha); 달은 원(r = h×0.04) + 그림자 원 오프셋 `(moonPhase-0.5)*2*r*2`로 월령 표현, 밝기 `1 - |moonPhase-0.5|*2`는 alpha에. `render`는 색이 바뀐 프레임에만 다시 그린다(이전 값 비교).
- [ ] **Step 2: WindSynth 구현** — 2초 핑크 노이즈 `AudioBuffer`(Paul Kellet 근사) 루프 → `BiquadFilterNode` lowpass(봄·가을 600, 여름 900, 겨울 400Hz) → `GainNode`(LFO: `OscillatorNode` 0.2Hz → `GainNode` 0.15 → gain.gain) → 마스터 `GainNode` 0 → destination. `start()`는 `new AudioContext()` 실패 시 `state='unavailable'`; `await ctx.resume()` 후 `fadeTo(0.12, 200)`(`linearRampToValueAtTime`). `suspend()`는 fadeTo(0) 후 220ms 뒤 `ctx.suspend()`.
- [ ] **Step 3: 타입체크** — `npx tsc --noEmit` → 에러 0. **Step 4: Commit** — `git commit -m "feat(render): SkyLayer 그라디언트·별·달, WindSynth 바람 합성"`

---

### Task 12: VillageScene, boot, 두 엔트리

**Files:**
- Create: `src/render/scenes/VillageScene.ts`, `src/app/boot.ts`
- Modify: `src/app/main.ts`, `src/app/wallpaper.ts`, `w/index.html`(버튼 컨테이너 `<div id="ui"></div>`)

**Interfaces:**
- Consumes: 모든 도메인 모듈, Task 10·11.
- Produces:
  ```ts
  // boot.ts
  export interface BootDeps { clock: Clock; rng: () => number; opts: BootOptions; mode: Mode; blendMs: number }
  export function makeDeps(mode: Mode, search = location.search): BootDeps   // at→FixedClock, speed>1→FastClock(FixedClock or now), seed 기본 random, blendMs = 60000/speed
  export function createGame(deps: BootDeps, parent = 'game'): Phaser.Game
  // 월페이퍼: fps { target: 30, forceSetTimeOut: true }, 플레이: fps { target: 60 }. autoFocus false. scale { mode: RESIZE, autoCenter: CENTER_BOTH }
  // VillageScene
  export class VillageScene extends Phaser.Scene { constructor(deps: BootDeps) }
  // window.__rv = { ready: boolean, ctx: DateContext, resident: Resident, audio: string }  — e2e 검사용(debug 여부와 무관하게 노출)
  ```

- [ ] **Step 1: VillageScene 구현** — `create`: 텍스처·애니 등록, `SkyLayer`, `Resident` 생성(x 0.5, lane 1), 스프라이트 `setOrigin(0.5, 1)`, `SkyBlender` 초기값 = 현재 skyKey, 1초 타이머로 `computeDateContext` 재계산 → skyKey 변경 시 `blender.setTarget`, phase/season 변경 시 `Emitter.emit`. `update(t, dt)`: `opts.still`이면 AI·애니 정지(frame 0); 아니면 `tick(resident, dt*speed?…)` — **주의**: 배속은 시계에만 적용하고 AI dt는 실제 dt를 쓴다(너구리가 미친 듯 뛰지 않게). 위치 = `toScreen(lane, x, viewport)`, 애니 = state, `flipX = facing==='left'`. `walkRange`는 세로 화면(`w/h < 1.2`)이면 `[0.3, 0.7]`, 아니면 `[0.05, 0.95]`.
  `this.game.events.on('resume')`(Phaser가 hidden→visible에서 발생) → `computeDateContext` 즉시 재계산 → `blender.snapTo(getSky(key))`.
  `scale.on('resize')` 100ms 디바운스 → `SkyLayer.resize`, 세로면 `cameras.main.setZoom`으로 x 0.25~0.75가 화면 폭을 채우도록.
  `?debug=1`이면 좌상단 `this.add.text`로 `skyKey hh:mm state`(영문 키만, 한국어 없음).
- [ ] **Step 2: boot·엔트리 구현** — `main.ts`: `createGame(makeDeps('play'))`, `pointerdown` 1회에 `wind.start()`. `wallpaper.ts`: `createGame(makeDeps('wallpaper'))`, `#ui`에 버튼(텍스트 `ui.soundOn`) → 클릭 시 `await wind.start()` 후 버튼 제거; `document.body`에 3초 무동작 시 `cursor:none`. 두 엔트리 모두 `visibilitychange`에서 `policy()` 재계산 → `audioAllowed`가 false면 `wind.suspend()`, true면 `wind.fadeTo(0.12)`(이미 start된 경우만).
- [ ] **Step 3: 수동 스모크** — Run: `npm run dev` 후 다른 터미널에서 `curl -s localhost:5173/raccoon-village/ | grep -c main.ts` → 1. `npm run build` → 성공. (시각 확인은 Task 13 스크린샷으로.)
- [ ] **Step 4: Commit** — `git commit -m "feat: VillageScene과 두 엔트리(/, /w/) 부팅"`

---

### Task 13: Playwright 스모크·스크린샷 베이스라인

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`, `tests/capture/baseline/*.png`(4장, 생성물)

**Interfaces:**
- Consumes: `window.__rv` (Task 12).
- Produces: 프로젝트 `desktop`(1920×1080)·`mobile`(390×844) 2개, `webServer: { command: 'npm run preview -- --port 4173', url: 'http://localhost:4173/raccoon-village/' }`, `snapshotPathTemplate: 'tests/capture/baseline/{arg}-{projectName}{ext}'`, `expect.toHaveScreenshot: { maxDiffPixelRatio: 0.01 }`, `use.launchOptions.executablePath = process.env.PW_CHROMIUM`(설정 시).

- [ ] **Step 1: 테스트 작성**

```ts
const STILL = '?at=2026-01-15T22:00&seed=1&still=1'
for (const path of ['', 'w/']) {
  test(`${path || 'play'} loads without console errors`, async ({ page }) => {
    const errors: string[] = []; page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    await page.goto(`/raccoon-village/${path}${STILL}`)
    await page.waitForFunction(() => (window as any).__rv?.ready)
    expect(errors).toEqual([]); await expect(page.locator('canvas')).toBeVisible()
    expect(await page.evaluate(() => (window as any).__rv.ctx.skyKey)).toBe('winter-night')
    await expect(page).toHaveScreenshot(`${path ? 'wallpaper' : 'play'}.png`)
  })
}
test('wallpaper sound button starts audio', async ({ page }) => {
  await page.goto('/raccoon-village/w/' + STILL); await page.waitForFunction(() => (window as any).__rv?.ready)
  await page.getByRole('button').click()
  await expect.poll(() => page.evaluate(() => (window as any).__rv.audio)).toMatch(/running|unavailable/)
  await expect(page.getByRole('button')).toHaveCount(0)
})
test('resident changes state over time with FastClock', async ({ page }) => {
  await page.goto('/raccoon-village/?at=2026-04-10T12:00&seed=5'); await page.waitForFunction(() => (window as any).__rv?.ready)
  const s0 = await page.evaluate(() => (window as any).__rv.resident.state)
  await page.waitForFunction(s => (window as any).__rv.resident.state !== s, s0, { timeout: 20000 })
})
```

- [ ] **Step 2: 베이스라인 생성** — Run: `npm run build && npm run capture` → Expected: `tests/capture/baseline/` 에 `play-desktop.png`, `play-mobile.png`, `wallpaper-desktop.png`, `wallpaper-mobile.png`. 스크린샷을 열어 하늘이 겨울밤(남색)이고 너구리가 중앙 레인에 보이는지 확인(이 확인은 PNG 1회 읽기 허용).
- [ ] **Step 3: 통과 확인** — Run: `npm run e2e` → Expected: 8 passed (4 테스트 × 2 프로젝트 중 스크린샷은 각 프로젝트).
- [ ] **Step 4: Commit** — `git add playwright.config.ts tests && git commit -m "test(e2e): 스모크·스크린샷 베이스라인 4장"`

---

### Task 14: 타임랩스 캡처 스크립트

**Files:**
- Create: `scripts/capture-timelapse.ts`

**Interfaces:**
- Produces: `npm run capture:timelapse [-- --at=2026-10-10T05:00 --seconds=150 --out=captures/]` → `captures/timelapse-<at>.webm`. `captures/`는 gitignore.

- [ ] **Step 1: 구현** — `playwright`의 `chromium.launch()` → `newContext({ viewport: {width:1920,height:1080}, recordVideo: { dir, size } })` → `/raccoon-village/w/?at=…&speed=600&seed=1` 열고 `seconds` 대기 → `context.close()` → 비디오 파일명 변경. 서버는 `vite preview`를 스크립트가 직접 spawn(포트 4174)하고 종료 시 kill.
- [ ] **Step 2: 확인** — Run: `npm run build && npm run capture:timelapse -- --seconds=20` → Expected: `captures/timelapse-*.webm` 존재, 크기 > 100KB.
- [ ] **Step 3: Commit** — `git commit -m "feat(scripts): 배속 타임랩스 캡처"`

---

### Task 15: 월페이퍼 전력 측정

**Files:**
- Create: `scripts/measure-wallpaper.ts`, `docs/metrics/M1.md`(생성물)

**Interfaces:**
- Produces: `npm run measure:wall [-- --minutes=10]` → `docs/metrics/M1.md`에 표(시각, 구간 active/hidden, TaskDuration 증가분(s)/30s, JSHeapUsedSize MB).

- [ ] **Step 1: 구현** — Playwright CDP 세션 `Performance.enable` → 30초마다 `Performance.getMetrics`에서 `TaskDuration`, `JSHeapUsedSize`. 전체의 중간 2분은 hidden 구간: `page.evaluate`로 `Object.defineProperty(document,'hidden',{get:()=>true})` + `document.dispatchEvent(new Event('visibilitychange'))`, 끝나면 복원·재발생. 결과 표와 요약(활성 평균 CPU초/30s, 숨김 평균, 비율)을 마크다운으로 작성.
- [ ] **Step 2: 확인** — Run: `npm run measure:wall -- --minutes=3` → Expected: `docs/metrics/M1.md` 생성, 숨김 구간 평균이 활성 구간 평균의 10% 미만. 미만이 아니면 Task 12의 `visibilitychange` 처리(Phaser `autoPause`·`loop.sleep`)를 systematic-debugging으로 조사.
- [ ] **Step 3: Commit** — `git add scripts docs/metrics && git commit -m "feat(scripts): 월페이퍼 CPU·힙 측정과 M1 기록"`

---

### Task 16: CI와 GitHub Pages 배포

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: push/PR에 `lint → test:cov → build → e2e`; `main` push면 `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`(path `dist`), `actions/deploy-pages@v4`. permissions `pages: write, id-token: write`. Playwright는 `npx playwright install --with-deps chromium`.

- [ ] **Step 1: 워크플로 작성** — job `verify`(ubuntu-latest, node 22, `npm ci`, 4단계, 실패 시 `playwright-report` 업로드) → job `deploy`(needs verify, `if: github.ref == 'refs/heads/main'`).
- [ ] **Step 2: 로컬 검증** — Run: `npm run lint && npm run test:cov && npm run build && npm run e2e` → 전부 통과, 커버리지 표에서 `src/domain` lines ≥ 90.
- [ ] **Step 3: Commit & push** — `git commit -m "ci: lint/test/build/e2e와 GitHub Pages 배포" && git push origin main`
- [ ] **Step 4: 배포 확인** — Run: `gh run list --limit 1`로 성공 확인 후 `curl -sI https://rkrgml159-cmyk.github.io/raccoon-village/w/ | head -1` → `HTTP/2 200`.

---

### Task 17: 문서 정리와 DoD 확인

**Files:**
- Modify: `CLAUDE.md`(명령 섹션을 실제 스크립트와 일치), `README.md`(공개 URL 2개, 로컬 실행법), `docs/decisions.md`(M1 결정 4건 추가), `docs/09-roadmap.md`(M1 상태 "완료" + 측정값)

- [ ] **Step 1: 수정** — CLAUDE.md 명령: `dev`, `dev:wall`, `test`, `test:cov`, `e2e`, `capture`, `capture:timelapse`, `measure:wall`(cap:ios/android는 M5로 표기). decisions.md: 플레이스홀더 아트 / GitHub Pages / 레포 공개 / Phaser 4 전면.
- [ ] **Step 2: DoD 체크** — 스펙 §7의 5개 항목을 README 하단 체크리스트로 적고 각 증거(URL, `docs/metrics/M1.md`, 커버리지 수치, `captures/` 파일명, 베이스라인 4장) 기록.
- [ ] **Step 3: Commit & push** — `git commit -m "docs: M1 완료 기준 확인과 명령 갱신" && git push origin main`

---

## Self-Review 기록

- **스펙 커버리지**: §2 폴더(T1·T12), §3.1~3.6(T3·T4·T2·T6·T5·T7·T7), §4.1(T10), §4.2(T8·T11), §4.3(T12), §4.4(T11·T12), §4.5(T12), §5 표(T3 tz 실패·극단 날짜, T11 Audio 실패, T12 resume·디바운스, Phaser AUTO 폴백은 기본값), §6.1(T2~T9), §6.2(T13·T14), §6.3(T15), §6.4(T16), §7(T17). 누락 없음.
- **타입 일관성**: `computeDateContext`, `tick`, `chooseNext`, `policy`, `SkyBlender.snapTo/setTarget/update`, `makeDeps/createGame`, `window.__rv` 이름을 전 태스크에서 동일하게 사용.
- **Review Focus 반영**: 1→T3, 2→T8(snapTo)·T12(resume), 3→T8(blendMs=60000/speed)·T12, 4→T5(range)·T6(walkRange)·T12(zoom), 5→T11(resume await)·T13(버튼 테스트).
- **비율**: 스펙 약 190줄, 계획 약 330줄. 코드 블록은 테스트 단언과 시그니처 위주.
