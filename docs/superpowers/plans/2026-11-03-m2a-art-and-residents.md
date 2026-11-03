# M2a 아트와 주민 다양성 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 텍스트 픽셀맵 데이터로 그린 산짐승 24종 + 사람이 이끼 숲·폐허 배경 위에서 멍·걷기·앉기·자기를 하는 디오라마를 만들고, M1의 플레이스홀더를 전부 교체한다.

**Architecture:** 그림은 전부 `data/sprites/**`(리그·조각·종족·타일)와 `data/scenes/forest.json`의 JSON이고, `src/domain/sprites`(순수 TS)가 픽셀맵 + 팔레트 + 오버레이를 RGBA 버퍼로 합성한다. `src/render/sprites/SpriteBank`가 그 버퍼를 캔버스 텍스처로 올리고, `VillageScene`이 주민 N마리를 돌린다. 배경은 `src/domain/background/ForestPlan`이 시드로 배치를 정하고 `src/render/background/ForestLayer`가 층당 RenderTexture 1장을 만든다.

**Tech Stack:** Phaser 4.2.1 · TypeScript strict · Vite 8 · Vitest 5 · Playwright 1.63 · tsx (스크립트)

**Spec:** `docs/superpowers/specs/2026-11-03-m2a-art-and-residents-design.md`

## Global Constraints

- `src/domain/**`은 phaser·DOM을 import하지 않는다(ESLint `no-restricted-imports`). 커버리지 lines/branches/functions 90%+.
- 코드에 한국어 문자열 금지. 종족 한국어 이름은 `data/sprites/species.json`의 `name`에만.
- 이미지·오디오 파일을 만들거나 읽지 않는다. 픽셀맵 JSON은 데이터다. 렌더 검증은 스크린샷으로.
- 현실 종·현실 색만. 색은 `#rrggbb`. 배율 `scale`은 0.3~2.0.
- 리그 프레임 수: idle 4 · walk 6 · sit 2 · sleep 2. 캔버스: raccoon 32×32, quad-s 32×32, quad-l 48×40, bird 24×24, biped 24×40. 원점은 발밑 중앙(origin 0.5, 1). 오른쪽 보기 기준으로 그린다.
- 역할 글자(스프라이트): `. B b W L l D E P N M m H X`. 타일: `. T t G g F f R r K k V S D A`.
- 레인 y 0.62/0.72/0.82(M1 유지). `PX = 1.5`. 쿼리 `n` 1~40(기본 12), `species=all`, `sheet=<id>`.
- 월페이퍼: 숨김/활성 CPU < 10%, 활성은 M1(9.684 cpu_s/30s) 대비 2배 이내.
- 커밋마다 `npm run lint && npm test` 녹색. 커밋 트레일러는 세션 규칙대로.

## Review Focus

1. 데이터 파일 오류(행 길이 불일치, 미등록 글자, 없는 조각·앵커 참조) → 부팅이 아니라 테스트에서 실패해야 한다. (Task 4 레지스트리 테스트가 실제 data/ 전체를 검증)
2. 아주 좁은 세로 화면에서 곰(배율 1.7)처럼 큰 주민의 걷기 범위가 역전되면 안 된다 → 중앙 고정. (Task 11 종족별 `walkRangeFor` 테스트)
3. `?n=0`, `?n=999`, `?n=abc` → 기본 12 또는 1~40으로 클램프, 절대 0마리·수백 마리가 아니다. (Task 11 query 테스트)
4. 야행성 플래그는 낮↔밤만 뒤집고 새벽·노을은 그대로여야 한다. (Task 10 UtilityAI 테스트)
5. 같은 `seed`·`n`·화면 폭이면 마을 구성과 배경 배치가 완전히 같아야 한다(스크린샷 베이스라인의 전제). (Task 10 Village, Task 12 ForestPlan 결정성 테스트)

## 파일 구조

```
data/sprites/rigs/{raccoon,quad-s,quad-l,bird,biped}.json
data/sprites/parts/*.json                 조각(귀·꼬리·뿔·부리·마스크…)
data/sprites/species.json                 25종
data/sprites/tiles/*.json                 배경 타일
data/scenes/forest.json                   층·팔레트·배치 규칙
src/domain/sprites/types.ts               RigDef, PartDef, SpeciesDef, TileDef, SceneDef, Rgba
src/domain/sprites/PixelMap.ts            parsePixelMap, SPRITE_ROLES, TILE_ROLES
src/domain/sprites/Palette.ts             parseVariant, resolveVariant
src/domain/sprites/Compose.ts             composeFrame, FrameBuffer
src/domain/sprites/SpriteRegistry.ts      loadRegistry(검증), animKey, STATES
src/domain/sprites/catalog.ts             data/ JSON을 import.meta.glob으로 모음
src/domain/background/ForestPlan.ts       planLayer, tintFor
src/domain/village/Village.ts             createVillage
src/domain/resident/{Resident,UtilityAI}.ts  species·variant·scale·sleep·profile
src/render/sprites/SpriteBank.ts          composeFrame → 캔버스 텍스처 + anims
src/render/background/ForestLayer.ts      층별 RenderTexture
src/render/sky/SkyLayer.ts                스카이라인 제거
src/render/scenes/VillageScene.ts         주민 N마리, 쇼케이스·시트 모드
src/app/{query,boot,global.d}.ts          n·species·sheet
scripts/capture-sheet.ts                  쇼케이스·시트·배경 16조합 스크린샷 → captures/
tests/unit/sprites/*.test.ts, tests/unit/background/ForestPlan.test.ts, tests/unit/village/Village.test.ts
```

---

### Task 1: 픽셀맵 파서와 타입

**Files:**
- Create: `src/domain/sprites/types.ts`, `src/domain/sprites/PixelMap.ts`
- Test: `tests/unit/sprites/PixelMap.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // types.ts
  export type SpriteState = 'idle' | 'walk' | 'sit' | 'sleep'
  export interface Frame { rows: string[]; anchors: Record<string, [number, number]> }
  export interface RigDef { id: string; size: [number, number]; frames: Record<SpriteState, Frame[]>; frameRate: Record<SpriteState, number> }
  export interface PartVariant { offset: [number, number]; rows: string[] }
  export interface PartDef extends PartVariant { id: string; rigs: string[]; anchor: string; layer: 'above' | 'below'; fixed?: string; states?: Partial<Record<SpriteState, PartVariant>> }
  export interface Weights { idle: number; walk: number; sit: number; sleep: number }
  export interface SpeciesDef { name: string; rig: string; scale: number; share: number; lanes?: [number, number, number]; walkSpeed?: number; nocturnal?: boolean; weights?: { default: Weights; night: Weights }; palettes: Record<string, Record<string, string>>; overlays?: string[]; axes?: { kind: Record<string, string[]>; mask: Record<string, string[]>; tail: Record<string, string[]>; body: Record<string, number> } }
  export interface TileDef { id: string; size: [number, number]; rows: string[]; ground: number }
  export interface SceneLayer { id: 'back' | 'mid' | 'front'; y: number; scale: number; density: number; tint?: 'horizon'; alpha?: number; tiles: { id: string; w: number; max?: number }[] }
  export interface SceneDef { ground: { y: number }; layers: SceneLayer[]; palettes: Record<'spring' | 'summer' | 'autumn' | 'winter', Record<string, string>> }
  export interface PixelMap { w: number; h: number; cells: string[] } // cells[y*w+x] = role char
  // PixelMap.ts
  export const SPRITE_ROLES: ReadonlySet<string> // '.BbWLlDEPNMmHX'
  export const TILE_ROLES: ReadonlySet<string>   // '.TtGgFfRrKkVSDA'
  export function parsePixelMap(rows: string[], size: [number, number], roles: ReadonlySet<string>): PixelMap
  export function usedRoles(map: PixelMap): Set<string> // '.' 제외
  ```

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/unit/sprites/PixelMap.test.ts`
  - `parses a 3x2 map into cells`: rows `['.B.', 'LLL']`, size `[3,2]` → `cells` 길이 6, `cells[1] === 'B'`, `cells[3] === 'L'`.
  - `rejects wrong row count`: rows 1개, size `[3,2]` → throws `/rows/`.
  - `rejects wrong row length`: `['.B', 'LLL']` → throws `/row 0/`.
  - `rejects unknown role`: `['.Z.', 'LLL']` with `SPRITE_ROLES` → throws `/'Z'/`.
  - `tile roles accept T and G but not B`: `['TG']` size `[2,1]` with `TILE_ROLES` passes; `['B.']` throws.
  - `usedRoles excludes transparent`: `['.B.', 'LLL']` → `new Set(['B','L'])`.
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/sprites/PixelMap.test.ts` → FAIL (module not found)
- [ ] **Step 3: 구현** — `types.ts`에 위 인터페이스, `PixelMap.ts`에 `parsePixelMap`/`usedRoles`. 오류 메시지는 `rows: expected 2, got 1`, `row 0: expected width 3, got 2`, `row 0 col 1: unknown role 'Z'` 형식.
- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS
- [ ] **Step 5: 커밋** — `git add src/domain/sprites tests/unit/sprites && git commit -m "feat(sprites): 픽셀맵 파서와 데이터 타입"`

---

### Task 2: 너구리 리그(14프레임)와 리그 검증

**Files:**
- Create: `data/sprites/rigs/raccoon.json`, `src/domain/sprites/validateRig.ts`
- Test: `tests/unit/sprites/validateRig.test.ts`

**Interfaces:**
- Consumes: Task 1 `RigDef`, `parsePixelMap`, `SPRITE_ROLES`.
- Produces: `export const STATES: readonly SpriteState[] = ['idle','walk','sit','sleep']`, `export const FRAME_COUNT: Record<SpriteState, number> = { idle: 4, walk: 6, sit: 2, sleep: 2 }`, `export function validateRig(rig: RigDef): void` (throws with `rig <id>: …`).

- [ ] **Step 1: 실패하는 테스트** — `validateRig.test.ts`
  - 헬퍼 `makeRig(overrides)`: 32×32 투명 프레임을 FRAME_COUNT대로 채우고 앵커 `{ head:[20,10], tail:[6,14], back:[16,8], front:[22,24] }`.
  - `accepts a well-formed rig` → no throw.
  - `rejects wrong frame count`: idle 3개 → throws `/idle: expected 4 frames/`.
  - `rejects anchor set mismatch`: walk[0] 앵커에서 `tail` 삭제 → throws `/anchors/`.
  - `rejects anchor outside canvas`: head `[40, 10]` → throws `/head/`.
  - `rejects bad pixel rows`: idle[0].rows[0] 길이 31 → throws `/row 0/`.
  - `raccoon.json passes validateRig`: `import rig from '../../../data/sprites/rigs/raccoon.json'` → `validateRig(rig as RigDef)` no throw, 그리고 `usedRoles(idle[0])`에 `B`,`D`,`W`,`E`,`P`,`N`,`L` 포함(마스크·꼬리 줄무늬는 조각이므로 리그에는 `M`/`m` 없음).
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/sprites/validateRig.test.ts` → FAIL
- [ ] **Step 3: `validateRig` 구현** — 프레임 수, 각 프레임 `parsePixelMap(rows, size, SPRITE_ROLES)`, 앵커 이름 집합이 첫 프레임과 같은지, 앵커가 `[0,w)×[0,h)` 안인지, `frameRate` 4키 양수.
- [ ] **Step 4: `data/sprites/rigs/raccoon.json` 작성** — 32×32, 오른쪽 보기, 발밑 y=31. 비율: 몸 길이 20px·높이 10px, 머리 10×9 (오른쪽 위), 귀 2×2 둘, 눈 `E`+`P`, 코 `N`, 마스크는 `M`(눈 주변 띠), 꼬리는 왼쪽으로 10px·굵기 4px이고 줄무늬는 `m`. 걷기 6프레임은 다리 4개(`L`/`l`) 위상 차 + 몸 1px 바운스(홀수 프레임 y-1). 앉기 2는 몸을 세우고 꼬리를 앞으로, 자기 2는 몸을 낮추고(높이 6px) 눈 감음(`E` 없이 `D` 1px), 프레임 2는 등이 1px 부풀음. 앵커: `head`(머리 좌상단), `ears`(머리 위 중앙), `tail`(꼬리 뿌리), `back`(등 중앙), `front`(앞발 앞). 너구리 리그는 마스크·꼬리줄무늬를 몸에 그리지 않고 조각(Task 4)으로 넘기므로 리그에는 `M`/`m`을 쓰지 않는다 — **마스크·줄무늬 영역은 조각이 덮는다**.
- [ ] **Step 5: 통과 확인** — PASS. `npm run lint`.
- [ ] **Step 6: 커밋** — `git add data/sprites/rigs/raccoon.json src/domain/sprites/validateRig.ts tests/unit/sprites/validateRig.test.ts && git commit -m "feat(sprites): 너구리 리그 14프레임과 리그 검증"`

---

### Task 3: 팔레트 해석과 프레임 합성기

**Files:**
- Create: `src/domain/sprites/Palette.ts`, `src/domain/sprites/Compose.ts`
- Test: `tests/unit/sprites/Palette.test.ts`, `tests/unit/sprites/Compose.test.ts`

**Interfaces:**
- Consumes: Task 1 타입·파서.
- Produces:
  ```ts
  // Palette.ts
  export interface ResolvedVariant { palette: Record<string, [number, number, number]>; overlays: string[]; bodyScale: number }
  export function parseVariant(v: string): { palette: string; kind?: string; mask?: string; tail?: string; body?: string } // 'grey|common|default|5|normal' 또는 'red'
  export function resolveVariant(sp: SpeciesDef, variant: string): ResolvedVariant // 없는 팔레트/축 값 → throw
  export function hexToRgb(hex: string): [number, number, number] // '#rrggbb' 아니면 throw
  // Compose.ts
  export interface FrameBuffer { w: number; h: number; rgba: Uint8ClampedArray }
  export interface ComposeInput { rig: RigDef; state: SpriteState; index: number; variant: ResolvedVariant; parts: Record<string, PartDef> }
  export function composeFrame(input: ComposeInput): FrameBuffer
  ```
  합성 순서: `below` 조각(overlays 순) → 몸 → `above` 조각. 조각 위치 = 프레임 앵커 + `offset`(상태별 `states[state]`가 있으면 그것의 offset/rows). 캔버스 밖 픽셀은 버림. 역할 `X`는 조각 `fixed` 색(없으면 throw). 알파는 0 또는 255.

- [ ] **Step 1: Palette 테스트**
  - `parseVariant splits raccoon axes`: `'grey|common|default|5|normal'` → 5필드. `'red'` → `{ palette: 'red' }`.
  - `resolveVariant for a plain species`: 팔레트 `red`만 있는 여우형 SpeciesDef, overlays `['ears-a']` → `palette.B` = `[200, 98, 47]`(`#c8622f`), `overlays` = `['ears-a']`, `bodyScale` = 1.
  - `resolveVariant combines raccoon axes`: axes `{ kind: { common: [], cozumel: ['tail-gold'] }, mask: { default: ['mask-default'] }, tail: { '5': ['tail-5'] }, body: { baby: 0.7 } }`, overlays `['ears-round']`, variant `'grey|cozumel|default|5|baby'` → overlays `['ears-round','tail-gold','mask-default','tail-5']`, bodyScale 0.7.
  - `rejects unknown palette`: `'blue'` → throws `/palette 'blue'/`. `rejects unknown axis value`: mask `'x'` → throws `/mask 'x'/`.
  - `hexToRgb rejects short hex`: `'#fff'` → throws.
- [ ] **Step 2: Compose 테스트** — 4×4 리그 1프레임 `['....','.BB.','.BB.','.L..']` 앵커 `{ head: [1,1] }`.
  - `paints body roles with palette`: 팔레트 `{B:'#ff0000', L:'#00ff00'}` → 픽셀 (1,1) = `[255,0,0,255]`, (1,3) = `[0,255,0,255]`, (0,0) alpha 0.
  - `places an above part at anchor + offset`: 조각 `{ anchor:'head', layer:'above', offset:[1,-1], rows:['M'] }` → (2,0) = 팔레트 `M` 색.
  - `below part is covered by body`: `layer:'below'`, offset `[0,0]`, rows `['M']` → (1,1)은 여전히 `B` 색.
  - `uses state-specific rows`: `states: { sit: { offset:[0,0], rows:['m'] } }`, state `sit` → `m` 색이 (1,1) 위에.
  - `clips parts outside the canvas`: offset `[3,3]`, rows `['MM','MM']` → no throw, 버퍼 길이 64.
  - `X uses fixed color`: rows `['X']`, fixed `'#123456'` → `[18,52,86,255]`; fixed 없으면 throws `/fixed/`.
  - `missing palette role throws`: 팔레트에 `L` 없음 → throws `/role 'L'/`.
- [ ] **Step 3: 실패 확인** → FAIL
- [ ] **Step 4: 구현** — `Palette.ts`, `Compose.ts`. `composeFrame`은 `parsePixelMap`으로 몸과 조각을 파싱하고 `Uint8ClampedArray(w*h*4)`에 쓴다.
- [ ] **Step 5: 통과 확인** → PASS
- [ ] **Step 6: 커밋** — `git commit -m "feat(sprites): 변이 해석과 프레임 합성기"`

---

### Task 4: 너구리 조각·종족 데이터와 레지스트리

**Files:**
- Create: `src/domain/sprites/SpriteRegistry.ts`, `src/domain/sprites/catalog.ts`, `data/sprites/species.json`(너구리만), `data/sprites/parts/`: `ears-round.json`, `ears-small.json`, `coat-short.json`, `tail-gold-tip.json`, `mask-default.json`, `mask-wide.json`, `mask-one-eye.json`, `tail-stripes-3.json`, `tail-stripes-5.json`, `tail-stripes-7.json`, `tail-plain.json`
- Test: `tests/unit/sprites/SpriteRegistry.test.ts`

**Interfaces:**
- Consumes: Task 1–3.
- Produces:
  ```ts
  // catalog.ts  (import.meta.glob eager; Vite·Vitest 모두 지원)
  export const RIGS: Record<string, RigDef>; export const PARTS: Record<string, PartDef>; export const SPECIES: Record<string, SpeciesDef>; export const TILES: Record<string, TileDef>; export const FOREST: SceneDef
  // SpriteRegistry.ts
  export interface Registry { rigs: Record<string, RigDef>; parts: Record<string, PartDef>; species: Record<string, SpeciesDef> }
  export function loadRegistry(input: Registry): Registry // 검증 후 그대로 반환, 실패 시 throw
  export function animKey(species: string, variant: string, state: SpriteState): string // `spr:${species}:${variant}:${state}`
  export function defaultVariant(sp: SpeciesDef): string // 첫 팔레트 + 각 축의 첫 키 ('grey|common|default|5|normal')
  export function allVariants(sp: SpeciesDef): string[] // 축 곱집합(너구리 3×6×4×4×4=1152), 다른 종은 팔레트 목록
  ```
  검증 규칙(스펙 §4.1): 종족의 rig 존재 + `validateRig`; `scale` 0.3~2.0; 모든 팔레트 색 `#rrggbb`; overlays·axes가 참조하는 조각 존재; 조각 `rigs`에 그 종족의 rig 포함; 조각 `anchor`가 리그 앵커에 존재; 각 팔레트가 리그 몸 + 그 종족이 쓸 수 있는 모든 조각의 역할을 전부 가짐(`X` 제외); `share` ≥ 0; `lanes` 합 1±0.001.

- [ ] **Step 1: 실패하는 테스트**
  - 합성 레지스트리(Task 2 `makeRig` 재사용)로: `rejects species with unknown rig`, `rejects overlay referencing missing part`, `rejects part not allowed on rig`, `rejects part with unknown anchor`, `rejects palette missing a role used by a part`, `rejects scale out of range` (2.5), `rejects bad hex`.
  - `defaultVariant/allVariants`: 축 2×2 종족 → 4개, 첫 번째가 defaultVariant.
  - **실제 데이터**: `loadRegistry({ rigs: RIGS, parts: PARTS, species: SPECIES })` no throw; `SPECIES.raccoon.axes` 정의; `allVariants(SPECIES.raccoon).length === 1152`; 모든 변이에 대해 `composeFrame`이 idle[0]을 예외 없이 만든다(1152×1회, 수백 ms 이내).
- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: `catalog.ts`·`SpriteRegistry.ts` 구현** — `import.meta.glob('../../../data/sprites/parts/*.json', { eager: true, import: 'default' })` 형태. 키는 파일명(확장자 제외). `tsconfig`가 `data`를 include하므로 타입은 `as`로 좁힌다.
- [ ] **Step 4: 너구리 데이터 작성** — `species.json`의 `raccoon`: 스펙 §3.3 그대로(팔레트 6: grey `B #8a8f99 b #6b7079 W #e9e4d8 D #2b2b2b L #55585f l #3c3f45 E #f4f1ea P #1a1a1a N #1a1a1a M #2b2b2b m #2b2b2b H #b5b9c2`, brown/cinnamon/blonde/melanistic/albino는 현실 색으로; 백색증은 `M`이 연한 크림, 눈 `P`는 붉은 기 `#7a2a2a`), overlays `['ears-round']`, axes 스펙대로, `nocturnal: true`, `share: 0`, `lanes [0.3,0.4,0.3]`, `walkSpeed 0.06`. 조각 11개: 마스크는 `head` 앵커 위 `M` 띠 (default 폭 8·wide 폭 10·one-eye 폭 4), 꼬리 줄무늬는 `tail` 앵커 기준 `m` 세로 줄 3/5/7개, `tail-plain`은 빈 1픽셀 투명(rows `['.']`), `ears-small`은 `ears` 앵커 위 1×1, `coat-short`는 몸 아랫단 `b` 한 줄, `tail-gold-tip`은 꼬리 끝 2×4 `X` fixed `#d9a441`. 각 조각은 `states.sit`/`states.sleep`에 맞춘 offset을 가진다(꼬리가 앞으로 오는 앉기, 낮아지는 자기).
- [ ] **Step 5: 통과 확인** — `npx vitest run tests/unit/sprites` → PASS. `npm run test:cov` 도메인 90%+.
- [ ] **Step 6: 커밋** — `git commit -m "feat(sprites): 레지스트리 검증, 너구리 종족·조각 데이터"`

---

### Task 5: SpriteBank와 단일 너구리 교체, 시트 캡처

**Files:**
- Create: `src/render/sprites/SpriteBank.ts`, `scripts/capture-sheet.ts`
- Modify: `src/render/scenes/VillageScene.ts`, `src/app/query.ts`, `src/app/boot.ts`(쿼리 전달만), `package.json`(`"capture:sheet": "tsx scripts/capture-sheet.ts"`)
- Delete: `src/render/sprites/PlaceholderRaccoon.ts`
- Test: `tests/unit/app/query.test.ts`(sheet), 스크린샷(`captures/sheet-raccoon.png`)

**Interfaces:**
- Consumes: Task 4 `loadRegistry`, `animKey`, `defaultVariant`, `composeFrame`, `resolveVariant`.
- Produces:
  ```ts
  // SpriteBank.ts
  export class SpriteBank {
    constructor(scene: Phaser.Scene, registry: Registry)
    ensure(species: string, variant: string): void   // 14 텍스처 + 4 anims, 멱등
    textureKey(species: string, variant: string, state: SpriteState, index: number): string // `${animKey}:${index}`
    frameSize(species: string): [number, number]     // 리그 size
  }
  // query.ts BootOptions 추가: sheet?: string
  ```
  텍스처 생성: `scene.textures.createCanvas(key, w, h)` → `getContext().putImageData(new ImageData(rgba, w, h), 0, 0)` → `refresh()` → `setFilter(NEAREST)`. anims는 리그 `frameRate`, `repeat: -1`.

- [ ] **Step 1: query 테스트** — `tests/unit/app/query.test.ts`에 `parses sheet=raccoon` (`opts.sheet === 'raccoon'`), `ignores empty sheet` 추가 → FAIL → `parseQuery` 수정 → PASS.
- [ ] **Step 2: `SpriteBank` 구현**.
- [ ] **Step 3: `VillageScene` 수정** — `PlaceholderRaccoon` import 제거, `create()`에서 `this.bank = new SpriteBank(this, loadRegistry({ rigs: RIGS, parts: PARTS, species: SPECIES }))`, 주민은 아직 1마리(`species: 'raccoon'`, variant `defaultVariant`). `SPRITE_WIDTH_PX`는 `bank.frameSize('raccoon')[0]`, `spriteScale`에 `PX = 1.5` 곱. `still`일 때 `textureKey(..., 'idle', 0)`. **시트 모드**: `opts.sheet`가 있으면 그 종족 `defaultVariant`의 14프레임을 상태별 한 줄(idle/walk/sit/sleep)로 `still`처럼 정지 배치(간격 = 프레임 폭 × 배율 × 1.2, 화면 가운데), 주민 틱 없음, `__rv.ready = true`.
- [ ] **Step 4: `scripts/capture-sheet.ts`** — `startPreview(4177)`, `--sheet=raccoon`(기본) 이면 `/?sheet=<id>&at=2026-04-10T12:00&still=1` 1280×720 스크린샷 → `captures/sheet-<id>.png`; `--species=all` 이면 `/?species=all&at=...` → `captures/showcase.png`(Task 11까지는 미구현이라 `sheet`만 동작); `--bg=1`이면 16개 `at` 조합(각 계절 대표일 × 05:30/12:00/18:00/23:00)을 `captures/bg-<season>-<phase>.png`로(Task 12에서 사용). `stopPreview` 보장.
- [ ] **Step 5: 확인** — `npm run build && npm run capture:sheet` → `captures/sheet-raccoon.png`를 Read로 보고 **너구리로 읽히는지**(마스크·줄무늬 꼬리·네 다리·걷기 위상) 확인. 어색하면 `raccoon.json`·조각을 고치고 반복(최대 5회, 기록은 작업 보고에). `npm run e2e`는 베이스라인 차이로 실패해도 되지만 콘솔 에러는 0이어야 한다(`npx playwright test -g "loads without console errors"`의 스크린샷 단계만 실패 허용). 그 뒤 `npm run capture`로 베이스라인 4장 재생성하고 Read로 확인.
- [ ] **Step 6: 커밋** — `git add -A src/render src/app scripts package.json tests/capture/baseline tests/unit/app && git commit -m "feat(render): 픽셀맵 SpriteBank로 너구리 교체, 시트 캡처 스크립트"`

---

### Task 6: 소형 네발 리그와 12종

**Files:**
- Create: `data/sprites/rigs/quad-s.json`, 조각: `ears-pointed.json`, `ears-long.json`, `ears-tiny.json`, `tail-bushy.json`, `tail-thin.json`, `tail-short.json`, `tail-flat.json`(수달), `muzzle-long.json`, `muzzle-stripe.json`(오소리 흰 줄), `spines.json`(고슴도치), `cheek-stripe.json`(다람쥐 등줄), `ear-tufts.json`(청설모), `nose-pink.json`(두더지), `mask-dog.json`(한국너구리 눈가 `M`)
- Modify: `data/sprites/species.json`(+12)
- Test: Task 4 레지스트리 테스트가 자동으로 검증. `tests/unit/sprites/SpriteRegistry.test.ts`에 `every species composes every state frame 0 for its default variant` 추가(25종 완성 시까지 종 수는 늘어남).

종족·팔레트·조각(스펙 §2, 색은 현실):

| id | name | scale | share | 팔레트 | overlays |
|---|---|---|---|---|---|
| korean-raccoon-dog | 한국너구리 | 1.0 | 3 | brown | ears-round(공유 가능하면 rigs에 quad-s 추가), mask-dog, tail-short |
| fox | 여우 | 0.95 | 3 | red, grey | ears-pointed, tail-bushy, muzzle-long |
| leopard-cat | 삵 | 0.9 | 2 | spotted(`M` 반점은 리그 몸에 두지 않으므로 `spots.json` 조각 추가) | ears-pointed, tail-thin, spots |
| marten | 담비 | 0.8 | 2 | yellow-throat | ears-round, tail-bushy |
| badger | 오소리 | 1.0 | 2 | grey | ears-tiny, muzzle-stripe, tail-short |
| weasel | 족제비 | 0.55 | 3 | brown, winter-white | ears-tiny, tail-thin |
| otter | 수달 | 0.9 | 2 | brown | ears-tiny, tail-flat |
| hare | 멧토끼 | 0.75 | 3 | brown | ears-long, tail-short |
| chipmunk | 다람쥐 | 0.45 | 4 | striped | ears-round, tail-bushy, cheek-stripe |
| red-squirrel | 청설모 | 0.5 | 4 | dark-grey | ear-tufts, tail-bushy |
| hedgehog | 고슴도치 | 0.5 | 2 | brown | ears-tiny, spines |
| mole | 두더지 | 0.45 | 1 | black | nose-pink, tail-short |

- [ ] **Step 1: 테스트 추가** — 위 `every species composes…` + `quad-s rig has 14 frames`(validateRig on real file) → FAIL
- [ ] **Step 2: `quad-s.json` 작성** — 너구리보다 날씬한 범용 네발(몸 18×8, 머리 8×7, 꼬리는 조각이므로 리그엔 짧은 뿌리 2px만), 같은 앵커 집합(`head ears tail back front`), 걷기 6·앉기 2·자기 2.
- [ ] **Step 3: 조각 15개 + species 12종 작성** — 야행성: badger, weasel, leopard-cat, hedgehog, mole, marten → `nocturnal: true`. `lanes`: 소형은 앞 레인 선호 `[0.2,0.3,0.5]`.
- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit/sprites` PASS. `npm run capture:sheet -- --sheet=fox`, `--sheet=hedgehog`, `--sheet=chipmunk`(최소 3종)를 Read로 확인·수정.
- [ ] **Step 5: 커밋** — `git commit -m "feat(sprites): 소형 네발 리그와 산짐승 12종"`

---

### Task 7: 대형 네발 리그와 5종

**Files:**
- Create: `data/sprites/rigs/quad-l.json`(48×40), 조각: `ears-bear.json`, `chest-crescent.json`(반달 `X #f1e4d2`), `tusks.json`, `mane-boar.json`, `antlers.json`, `antlers-small.json`, `horns-goral.json`, `tail-stub.json`, `muzzle-deer.json`
- Modify: `species.json`(+5)

| id | name | scale | share | 팔레트 | overlays | nocturnal |
|---|---|---|---|---|---|---|
| black-bear | 반달가슴곰 | 1.7 | 1 | black, brown | ears-bear, chest-crescent, tail-stub | false |
| wild-boar | 멧돼지 | 1.5 | 1 | dark-brown | tusks, mane-boar, tail-stub | true |
| water-deer | 고라니 | 1.3 | 2 | tan | muzzle-deer, tusks(작은 송곳니: `tusks-small.json` 추가), tail-stub | false |
| roe-deer | 노루 | 1.35 | 2 | red-brown, grey-winter | antlers-small, muzzle-deer, tail-stub | false |
| goral | 산양 | 1.3 | 1 | grey | horns-goral, tail-stub | false |

- `weights.default` 대형: `{ idle: .6, walk: .15, sit: .15, sleep: .1 }`, `walkSpeed 0.045`, `lanes [0.5,0.4,0.1]`(뒤 레인 선호).
- [ ] Step 1 테스트(validateRig on `quad-l`, 종 수 증가) → Step 2 리그 작성(몸 30×14, 다리 길고 굵게, 앉기는 뒷다리 접기, 자기는 엎드림) → Step 3 조각·종족 → Step 4 `capture:sheet -- --sheet=black-bear`, `--sheet=roe-deer` 확인 → Step 5 커밋 `"feat(sprites): 대형 네발 리그와 5종"`

---

### Task 8: 새 리그와 6종

**Files:**
- Create: `data/sprites/rigs/bird.json`(24×24), 조각: `beak-short.json`, `beak-long.json`, `beak-hooked.json`, `crest.json`, `ear-tufts-owl.json`, `tail-long-pheasant.json`, `wing-patch.json`(까치 흰 어깨, 어치 파란 날개 `X`), `facial-disc.json`
- Modify: `species.json`(+6)

| id | name | scale | share | 팔레트 | overlays | nocturnal |
|---|---|---|---|---|---|---|
| carrion-crow | 까마귀 | 0.7 | 3 | black | beak-short | false |
| magpie | 까치 | 0.7 | 3 | pied | beak-short, tail-long-pheasant(짧은 버전 `tail-long.json`), wing-patch | false |
| eagle-owl | 수리부엉이 | 0.9 | 1 | brown | beak-hooked, ear-tufts-owl, facial-disc | true |
| woodpecker | 딱따구리 | 0.5 | 2 | pied-red(`X` 붉은 정수리) | beak-long, crest | false |
| jay | 어치 | 0.6 | 2 | pink-brown | beak-short, wing-patch(파랑 `X`) | false |
| pheasant | 꿩 | 0.9 | 2 | cock, hen | beak-short, tail-long-pheasant | false |

- 새 리그: 걷기 = 두 다리 종종걸음(6프레임, 머리 까딱), 앉기 = 웅크림, 자기 = 머리를 날개에. `weights.default { idle: .65, walk: .25, sit: .07, sleep: .03 }`, `walkSpeed 0.1`, `lanes [0.4,0.4,0.2]`. 걷기 지속은 UtilityAI가 거리로 정하므로 `walkSpeed`만 빠르게.
- [ ] Step 1 테스트 → Step 2 리그 → Step 3 조각·종족 → Step 4 `--sheet=magpie`, `--sheet=eagle-owl` 확인 → Step 5 커밋 `"feat(sprites): 새 리그와 6종"`

---

### Task 9: 두발 리그와 사람

**Files:**
- Create: `data/sprites/rigs/biped.json`(24×40), 조각: `hair-short.json`, `hair-long.json`, `hair-bun.json`, `hair-cap.json`(모자), `cane.json`(노인: `front` 앵커)
- Modify: `species.json`(+human)

- 사람: `scale 1.4`, `share 1`, 팔레트 4 = 피부톤 4(`B`=피부, `W`=옷 단색 각기 다른 차분한 색, `M`=머리색), overlays는 축이 아니라 **팔레트별 고정**이 아니므로 사람도 `axes`를 쓴다: `{ kind: { adult: [], child: [], elder: ['cane'] }, mask: { short: ['hair-short'], long: ['hair-long'], bun: ['hair-bun'], cap: ['hair-cap'] }, tail: { none: [] }, body: { adult: 1.0, child: 0.75, elder: 0.95 } }` (축 이름은 너구리와 공유하는 스키마를 그대로 쓴다; `kind`=나이대, `mask`=머리). 성별 표기 없음, 외모 우열 없음(09 리스크 표).
- `weights.default { idle: .55, walk: .3, sit: .1, sleep: .05 }`, `walkSpeed 0.06`, `lanes [0.3,0.5,0.2]`.
- [ ] Step 1 테스트(`allVariants(SPECIES.human).length === 4×3×4×1×… = 48`; `createVillage`는 Task 10) → Step 2 리그(두 팔·두 다리, 걷기 6 팔 스윙, 앉기 = 쪼그려 앉기, 자기 = 눕기) → Step 3 조각·종족 → Step 4 `--sheet=human` 확인 → Step 5 커밋 `"feat(sprites): 두발 리그와 사람"`

---

### Task 10: 도메인 — 종족별 주민, sleep, 마을 생성

**Files:**
- Modify: `src/domain/resident/Resident.ts`, `src/domain/resident/UtilityAI.ts`, `src/domain/events.ts`(변경 없음 확인)
- Create: `src/domain/village/Village.ts`
- Test: `tests/unit/resident/UtilityAI.test.ts`(수정·추가), `tests/unit/village/Village.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // Resident.ts
  export type ResidentState = 'idle' | 'walk' | 'sit' | 'sleep'
  export interface Resident { id: string; species: string; variant: string; scale: number; lane: 0|1|2; x: number; facing: 'left'|'right'; state: ResidentState; stateT: number; targetX?: number; history: ResidentState[] }
  export function createResident(id: string, x?: number, init?: Partial<Pick<Resident,'species'|'variant'|'scale'|'lane'>>): Resident // 기본 raccoon, defaultVariant는 호출자가 넣음(도메인은 registry를 모름), scale 1, lane 1
  // UtilityAI.ts
  export interface Profile { walkSpeed: number; weights: { default: Weights; night: Weights }; nocturnal: boolean }
  export interface AIContext { phase: Phase; walkRange: readonly [number, number]; profile: Profile }
  export const RIG_DEFAULT_PROFILE: Profile // { walkSpeed: 0.06, weights: { default: {idle:.6,walk:.2,sit:.12,sleep:.08}, night: {idle:.45,walk:.05,sit:.15,sleep:.35} }, nocturnal: false }
  export const DURATION_MS: { idle: [4000,12000]; sit: [6000,20000]; sleep: [10000,30000] }
  export function profileFor(sp: SpeciesDef): Profile // 종족 값이 없으면 RIG_DEFAULT_PROFILE
  export function effectivePhase(phase: Phase, nocturnal: boolean): Phase // nocturnal: night→day, day→night, dawn/dusk 그대로
  export function chooseNext(prev, history, phase, weights, rng): ResidentState
  export function tick(r: Resident, dtMs: number, ctx: AIContext, rng: () => number): Resident
  // Village.ts
  export interface VillageInput { seed: number; n: number; species: Record<string, SpeciesDef>; variantsOf: (id: string, sp: SpeciesDef) => string[]; bodyScaleOf: (id: string, variant: string) => number }
  export function createVillage(input: VillageInput): Resident[]
  ```
  `createVillage` 규칙(스펙 §5.3): 너구리 `ceil(n×0.6)`, 나머지는 `share` 가중 추첨(사람 최대 2, `share 0`은 제외), 변이는 `variantsOf` 균등, 레인은 `lanes` 확률(없으면 균등), 같은 레인 안에서 x 정렬 후 최소 간격 0.05, x는 `[0.1, 0.9]`에서 시작. id는 `${species}-${k}`. `scale`은 종족 `scale × bodyScaleOf(id, variant)`(너구리·사람 body 축, 그 외 1). 도메인은 레지스트리를 import하지 않고 두 콜백으로만 받는다.

- [ ] **Step 1: UtilityAI 테스트 수정·추가** — 기존 테스트에 `profile: RIG_DEFAULT_PROFILE` 추가. 새 테스트: `effectivePhase flips day and night only`(4 phase × nocturnal true/false 표), `sleep lasts 10-30 s`, `night weights favor sleep`(1000회 샘플, sleep 비율 0.35±0.05), `walk speed comes from profile`(walkSpeed 0.12 → 1 s에 x 0.12 이동), `no three in a row still holds with sleep`.
- [ ] **Step 2: Village 테스트** — `keeps at least 60% raccoons`(n=12 → raccoon ≥ 8), `is deterministic for the same seed`(deep equal), `differs for another seed`, `never exceeds two humans`(n=40, human share 100 → ≤2), `respects minimum spacing per lane`(같은 레인 x 차 ≥ 0.05), `uses variantsOf and bodyScaleOf`(scale = species.scale × bodyScale), `excludes share 0 species other than raccoon`.
- [ ] **Step 3: 실패 확인** → FAIL
- [ ] **Step 4: 구현** — `Resident.ts`, `UtilityAI.ts`(`WALK_SPEED` 상수 제거 → `ctx.profile.walkSpeed`), `Village.ts`(`mulberry32(seed)` 사용).
- [ ] **Step 5: 통과 확인** — `npm run test:cov` 도메인 90%+. `npm run build`(VillageScene 컴파일 오류는 `profile` 전달로 임시 수정: `profileFor(SPECIES.raccoon)`).
- [ ] **Step 6: 커밋** — `git commit -m "feat(domain): 종족별 주민·sleep·마을 생성"`

---

### Task 11: 렌더 — 주민 N마리와 쇼케이스

**Files:**
- Modify: `src/render/scenes/VillageScene.ts`, `src/app/query.ts`, `src/app/global.d.ts`, `tests/e2e/smoke.spec.ts`, `playwright.config.ts`(필요 시)
- Test: `tests/unit/app/query.test.ts`, `tests/unit/village/Lanes.test.ts`, e2e

**Interfaces:**
- Consumes: Task 5 `SpriteBank`, Task 10 `createVillage`, `profileFor`, Task 4 `allVariants`, `resolveVariant`.
- Produces: `BootOptions`에 `n: number`(1~40, 기본 12, 비정상 → 12), `species?: 'all'`. `window.__rv.residents: Resident[]`, `resident`는 `residents[0]`.

- [ ] **Step 1: query 테스트** — `n defaults to 12`, `n clamps to [1,40]`(0→1, 999→40), `n=abc → 12`, `species=all parsed`, `species=foo ignored`. `Lanes.test.ts`: `walkRangeFor collapses to centre for a bear on a narrow portrait`(visible `[0.25,0.75]`, halfSpriteFrac 0.3 → `[0.5,0.5]`) — 이미 있는 collapse 테스트가 있으면 값만 추가.
- [ ] **Step 2: 실패 확인** → FAIL → `parseQuery` 수정 → PASS.
- [ ] **Step 3: VillageScene** — `residents = createVillage({ seed, n, species: SPECIES, variantsOf: (id, sp) => allVariants(sp), bodyScaleOf: (id, v) => resolveVariant(SPECIES[id], v).bodyScale })`. 각 주민 `bank.ensure(species, variant)`, 스프라이트 생성, `profile` 캐시(`profileFor`). `update`: 주민마다 `tick`(walkRange는 종족·배율별 `walkRangeFor`), 애니 키 `animKey(species, variant, state)`, 깊이 `lane * 1000 + py`. `residentStateChanged`는 주민별 emit. `applyLayout`은 주민마다 walkRange 재계산·clamp. **쇼케이스** `species=all`: `still` 강제, 25종을 `Object.keys(SPECIES)` 순으로 레인 3개에 돌아가며 x 등간격 배치(각 종 defaultVariant), 틱 없음. `still=1`일 때 모든 스프라이트 idle 0프레임.
- [ ] **Step 4: e2e** — `smoke.spec.ts` 기존 4개 유지(`STILL`에 `&n=12` 명시), `resident changes state`는 `residents[0]` 대신 `residents.some(r => r.state !== s0[i])` 식으로 수정, 쇼케이스 테스트 추가: `/?species=all&at=2026-04-10T12:00&seed=1` → `toHaveScreenshot('showcase.png')`(desktop 프로젝트만, `test.skip(isMobile)`).
- [ ] **Step 5: 확인** — `npm run build`, `npm run capture`로 베이스라인 5장 재생성 후 Read로 확인(25종이 다 보이고 겹침 없음, 기본 마을 12마리가 화면 안). `npm run e2e` ×2 모두 통과. `npm run capture:sheet -- --species=all` → `captures/showcase.png` 확인.
- [ ] **Step 6: 커밋** — `git commit -m "feat(render): 주민 N마리, 쇼케이스 모드, e2e 갱신"`

---

### Task 12: 배경 — 타일·숲 배치·ForestLayer

**Files:**
- Create: `data/sprites/tiles/`: `fog-trees-a.json`, `fog-trees-b.json`, `trunk-moss-a.json`, `trunk-moss-b.json`, `canopy-a.json`, `ruin-cabin.json`, `ruin-brick.json`, `window-broken.json`, `rock-moss-a.json`, `rock-moss-b.json`, `fern.json`, `log-fallen.json`, `grass-a.json`, `grass-b.json`; `data/scenes/forest.json`; `src/domain/background/ForestPlan.ts`; `src/render/background/ForestLayer.ts`
- Modify: `src/render/sky/SkyLayer.ts`(스카이라인 블록·`horizon` 채움 제거, 하늘·별·달만), `src/render/scenes/VillageScene.ts`, `src/domain/sprites/catalog.ts`(TILES·FOREST), `src/domain/sprites/SpriteRegistry.ts`(`validateScene`)
- Test: `tests/unit/background/ForestPlan.test.ts`, `tests/unit/sprites/SpriteRegistry.test.ts`(장면 검증)

**Interfaces:**
```ts
// ForestPlan.ts
export interface Placement { tile: string; x: number; flip: boolean } // x = 타일 좌측 px(뷰 좌표)
export function planLayer(layer: SceneLayer, tiles: Record<string, TileDef>, seed: number, viewWidthPx: number, tileScale: number): Placement[]
// back: 타일 폭(size[0]×tileScale)으로 빈틈없이 왼쪽부터 채움(마지막은 화면 밖으로 넘어도 됨). mid/front: count = max(1, round(density × 12)), 슬롯 폭 = viewWidthPx / count, x = slot×i + rng×slot×0.6 − tileW/2, 타일은 w 가중 추첨, max 초과 시 재추첨(후보가 없으면 건너뜀), flip = rng < 0.5.
export function tintFor(sky: SkyColors): number // bottom 색의 밝기(0.299R+0.587G+0.114B)/255를 0.35~1.0으로 클램프한 회색 → 0xRRGGBB
export function validateScene(scene: SceneDef, tiles: Record<string, TileDef>): void // 층 3개(back/mid/front), 타일 존재·파싱(TILE_ROLES), 4계절 팔레트가 모든 타일의 사용 역할을 가짐, density 0~1, y 0~1
// ForestLayer.ts
export class ForestLayer { constructor(scene: Phaser.Scene, def: SceneDef, tiles: Record<string, TileDef>, seed: number); resize(w: number, h: number, view: View): void; render(season: Season, sky: SkyColors): void /* season 또는 tint 변화 시에만 재생성 */ ; destroy(): void }
```
- 렌더 규칙: 층 `y`는 뷰 높이 비율, 타일은 `ground` 행이 그 y에 닿게 놓는다. `tileScale = layer.scale × min(w,h)/360`. 깊이: back −5, mid −3(주민 0~2999 뒤), front 5000(주민 앞). 지면: `ground.y`부터 아래 끝까지 `G`(상단 2px `g`), 그 아래 `t` 색 띠 — SkyLayer의 `horizon` 채움을 대체. 밤 틴트는 `tintFor` 색을 각 층 RenderTexture `setTint`에.
- [ ] **Step 1: 테스트** — `planLayer`: `back layer covers the full width`(합산 폭 ≥ viewWidth), `mid layer count follows density`(0.55 → 7개), `respects max`(ruin-cabin max 1 → ≤1), `deterministic for seed`, `changes with seed`. `tintFor`: night sky(`#26324a`) → 어두운 회색, day(`#e8f1e4`) → `0xffffff`. `validateScene`: 실제 `FOREST`·`TILES` 통과, 팔레트에서 `G` 제거한 복사본 → throws `/role 'G'/`.
- [ ] **Step 2: 실패 확인** → FAIL → `ForestPlan.ts`, `validateScene` 구현 → PASS.
- [ ] **Step 3: 타일 14개 + `forest.json` 작성** — 스펙 §3.4 예시 구조. 타일 크기: fog-trees 48×24(실루엣 `A`만), trunk 16×40(`T t G`, 이끼는 북쪽 면), canopy 40×16(`F f`), ruin-cabin 48×28(`T t K D` 무너진 지붕 + `G V` 풀), ruin-brick 40×32(`K k V D` + `window-broken` 조각은 별도 타일로 mid에 drop), rock 20×12, fern 16×14(`F f`), log 32×10, grass 12×6. 팔레트 4계절: 봄 연두, 여름 짙은 초록, 가을 `F` 주황·`G` 탁한 녹색, 겨울 `G`→`#dfe6ea`(눈 덮임), `F`→빈 가지색 `#6b6358`.
- [ ] **Step 4: `ForestLayer`·`SkyLayer`·`VillageScene` 수정** — `SkyLayer.drawSky`에서 블록과 `horizon` 바닥 채움 제거(`SKYLINE_COUNT`, `blocks` 삭제). VillageScene: `forest = new ForestLayer(this, FOREST, TILES, seed)`, `applyLayout`에서 `forest.resize`, `update`에서 `forest.render(ctx.season, blender.current)`.
- [ ] **Step 5: 확인** — `npm run build && npm run capture:sheet -- --bg=1` → `captures/bg-*.png` 16장을 Read로 확인(이끼 숲·폐가가 읽히는지, 밤에 너무 어둡지 않은지, 주민이 앞층에 가려지지 않는지). 수정 반복. `npm run capture`로 베이스라인 5장 재생성·확인, `npm run e2e` 통과.
- [ ] **Step 6: 커밋** — `git commit -m "feat(background): 이끼 숲·폐허 타일과 숲 레이어, 스카이라인 제거"`

---

### Task 13: 전력 측정·타임랩스·메트릭

**Files:**
- Modify: `scripts/measure-wallpaper.ts`(`--n=` 인자를 쿼리로 전달, 결과 파일명 `--out=` 기본 `docs/metrics/M2a.md`), `scripts/capture-timelapse.ts`(`--n=` 전달)
- Create: `docs/metrics/M2a.md`(스크립트 산출)

- [ ] **Step 1: 스크립트 수정** — `parseArgs`의 `n`을 `&n=<n>`으로 URL에 붙임, `out` 인자. 비교 기준 줄 추가: `active vs M1 9.684 cpu_s/30s: ratio x.xx (threshold 2.0)` 와 PASS/FAIL, 실패면 exitCode 1.
- [ ] **Step 2: 실행** — `npm run measure:wall -- --n=30` (10분). 결과 Read. 활성 비율 > 2.0이면 원인(텍스처 수·깊이 정렬·RenderTexture 재생성)을 찾아 고치고 재측정(최대 2회).
- [ ] **Step 3: 타임랩스** — `npm run capture:timelapse -- --n=12` 20초 테스트 실행이 webm을 만드는지 확인(커밋하지 않음).
- [ ] **Step 4: 커밋** — `git add scripts docs/metrics/M2a.md && git commit -m "chore(metrics): M2a 30마리 월페이퍼 전력 측정"`

---

### Task 14: 문서와 DoD

**Files:**
- Modify: `docs/02-story-worldbuilding.md`, `docs/03-gameplay-design.md`, `docs/05-art-audio-direction.md`, `docs/09-roadmap.md`, `docs/decisions.md`, `CLAUDE.md`, `README.md`

- [ ] **Step 1: 02** — 핵심 설정 둘째 줄을 "산짐승 24종 + 사람이 같은 자격의 주민(목록은 `data/sprites/species.json`)"로, 챕터 2 "첫 다른 종족(랜덤 산짐승) 합류", 6+ "종족 파도".
- [ ] **Step 2: 03** — "다른 종족" 표를 스펙 §2 리그표로 교체, 자율 행동에 "자기(sleep)" 추가, 야행성 종족 목록.
- [ ] **Step 3: 05** — "캐릭터 시트" 절을 리그·조각·팔레트 방식으로 교체(프레임 수 14×5 리그), 파이프라인 표에 `픽셀맵 JSON → npm run capture:sheet → 스크린샷 확인` 행 추가, 배경 타일 목록.
- [ ] **Step 4: 09·decisions·CLAUDE·README** — 09 M2 행을 M2a(완료)/M2b/M2c로 분할하고 측정 절에 M2a 수치(번들·커버리지·CPU·테스트 수); decisions에 4줄(픽셀맵 데이터 아트, 산짐승 24+사람, 리그 5종, M2 분할); CLAUDE.md 절대 규칙에 "픽셀맵 JSON은 에셋이 아니라 데이터" 한 줄; README에 `n`·`species`·`sheet` 쿼리, `capture:sheet` 명령, M2a 완료 기준 체크리스트(스펙 §9 6항, 증거 링크).
- [ ] **Step 5: 확인** — `npm run lint`(prettier가 docs를 무시하는지 `.prettierignore` 확인), `npm test`, `npm run build`.
- [ ] **Step 6: 커밋** — `git commit -m "docs: M2a 종족·아트 파이프라인 반영, 로드맵 분할"`

---

## 셀프 리뷰
- 스펙 커버리지: §2 종족(T2,4,6–9), §3 형식(T1–4,12), §4 합성·렌더(T3,5,11,12), §5 도메인(T10), §6 성능(T13, T12 재생성 규칙), §7 테스트(각 태스크 + T11 e2e + T13), §8 문서(T14), §9 DoD(T11 쇼케이스, T12 16조합, T13 메트릭, T14 README). 누락 없음.
- 타입 일관성: `Weights`·`Profile`·`Registry`·`SpriteState`·`Placement` 이름을 태스크 간 동일하게 사용. `AIContext.profile`은 T10에서 추가되고 T5의 임시 전달은 T11에서 종족별로 바뀐다.
- 비율: 코드 블록은 서명·테스트 이름·값만. 데이터 작성 태스크(6–9, 12)는 그림이 산출물이라 표로 사양을 고정했다.
