# M2a 「아트와 주민 다양성」 설계 스펙

- 작성: 2026-11-03 · 상태: 사용자 승인(설계 8개 섹션 전부) · 경로: 아키텍처형
- 상위 문서: `docs/09-roadmap.md` M2, `docs/03-gameplay-design.md`, `docs/05-art-audio-direction.md`, `docs/02-story-worldbuilding.md`
- 선행: M1 스펙 `2026-11-03-m1-living-diorama-design.md` (main 950e889에 병합·배포됨)

## 1. 목표와 범위

**목표**: M1의 네모 플레이스홀더를 진짜 픽셀아트로 바꾸고, 산짐승 24종 + 사람이 같은 마을에서 각자 다르게 보이며 멍·걷기·앉기·자기를 하는 디오라마를 만든다. 배경은 이끼 낀 숲과 폐허가 된 집. 월페이퍼 저전력 기준은 유지한다.

**사용자 결정(2026-11-03)**
- 캐릭터·배경 모두 **텍스트 픽셀맵 데이터**로 만든다(이미지 파일 없음). AI 이미지 생성은 이 환경에서 불가하고, 사람이 그린 시트는 M2a를 막는다.
- 종족은 **산짐승**(마을새·물새·가축 제외) 24종 + 사람. 스토리상 모든 종족(사람 포함)이 디스토피아 폐허에서 같이 돕고 산다.
- 체형 리그 5종 + 종족 오버레이 방식(접근법 A).
- M2 로드맵 항목은 M2a(이 스펙) / M2b(마음과 말) / M2c(살림)로 분할한다.

**포함**
- 픽셀맵 데이터 형식(리그·조각·타일)과 순수 TS 합성기(`src/domain/sprites`)
- 리그 5종: 너구리 전용 / 소형 네발 / 대형 네발 / 새 / 두발. 상태 4종(idle 4·walk 6·sit 2·sleep 2 프레임)
- 종족 정의 데이터(`data/sprites/species.json`) 25종, 너구리 파라메트릭 변형
- 배경 타일과 숲 장면 구성(뒤/중/앞 3층, 계절 팔레트, 시간대 틴트)
- 도메인: `Resident.species/variant`, `sleep` 상태, 종족별 속도·가중치·레인 선호, `Village` 시드 배치(N마리)
- 렌더: 주민 N마리 스프라이트, 종족·변이별 텍스처 캐시, 깊이 정렬, 쇼케이스 모드
- 검증: 단위 테스트(데이터 스키마 포함), 스크린샷 베이스라인 갱신, 30마리 전력 재측정
- 문서 갱신(02·03·05·09·decisions)

**제외(M2b·M2c 이후)**: 욕구·성격·관계, 말풍선·속마음·아이콘, 상호작용 8종, 아티팩트 배치, 스킨, 자원·저장·방치 보상, 합류 연출·챕터 트리거(M3), 소리 추가.

## 2. 종족과 리그

| 리그 id | 캔버스(px) | 종족 (현실 종, 현실 색만) |
|---|---|---|
| `raccoon` | 32×32 | 너구리(라쿤) — 주인공, 파라메트릭 변형 |
| `quad-s` | 32×32 | 한국너구리, 여우, 삵, 담비, 오소리, 족제비, 수달, 멧토끼, 다람쥐, 청설모, 고슴도치, 두더지 |
| `quad-l` | 48×40 | 반달가슴곰, 멧돼지, 고라니, 노루, 산양 |
| `bird` | 24×24 | 까마귀, 까치, 수리부엉이, 딱따구리, 어치, 꿩 |
| `biped` | 24×40 | 사람 |

- 종족 id는 영문 소문자 하이픈(`korean-raccoon-dog`, `black-bear`, `roe-deer`, `eurasian-eagle-owl`, `human` …). 한국어 이름은 `species.json`의 `name` 필드에만 있다(코드에 한국어 금지 규칙).
- 종족 **배율** `scale`(렌더 곱): 다람쥐·족제비·두더지 0.45~0.55, 여우·삵·한국너구리·수달 0.9~1.0, 너구리 1.0, 산양·고라니·노루 1.3~1.4, 멧돼지 1.5, 곰 1.7, 새 0.5~0.9(수리부엉이·꿩 0.9), 사람 1.4.
- **색 변이**: 종족당 1~3개 팔레트(예: 여우 붉은/회색, 곰 검정/갈색, 다람쥐 1개). 전부 현실 털색. 발광·비현실 색 금지.
- **너구리 변형 축**(03 문서 표를 데이터로): 종 3(아메리카·게잡이·코수멜 = 오버레이 세트) × 털색 6(회색·갈색·계피·금발·흑색증·백색증 = 팔레트) × 얼굴 무늬 4(마스크 오버레이) × 꼬리 줄무늬 4(꼬리 오버레이) × 체형 4(배율 0.8/1.0/1.1/0.7). 성격은 M2b.
- 스폰 비율: 너구리 60% 이상. 나머지는 종족별 `share` 가중치(새·소형이 자주, 곰·멧돼지는 드물게). 사람은 `share` 소량(마을에 1~2명).

## 3. 픽셀맵 데이터 형식

모든 그림은 "한 글자 = 한 픽셀"인 문자열 행 배열이다. 글자는 **역할**이고 색은 팔레트가 정한다.

| 글자 | 역할 | 글자 | 역할 |
|---|---|---|---|
| `.` | 투명 | `D` | 윤곽·어두운 부분 |
| `B` | 몸 | `b` | 몸 그늘 |
| `W` | 배·밝은 털 | `L` | 다리 |
| `l` | 다리 그늘 | `E` | 눈 흰자 |
| `P` | 눈동자 | `N` | 코 |
| `M` | 무늬 1(종족 액센트) | `m` | 무늬 2 |
| `H` | 하이라이트 | `X` | 고정색(오버레이 전용, 팔레트 무시) |

배경 타일은 별도 역할표(`T` 줄기, `t` 줄기 그늘, `G` 이끼, `g` 이끼 그늘, `F` 잎, `f` 잎 그늘, `R` 바위, `r` 바위 그늘, `K` 벽돌, `k` 벽돌 그늘, `V` 덩굴, `S` 눈, `D` 어둠, `A` 안개 실루엣)를 쓴다.

### 3.1 리그 `data/sprites/rigs/<rig>.json`
```json
{
  "id": "quad-s",
  "size": [32, 32],
  "frames": {
    "idle": [{ "rows": ["....", "...."], "anchors": { "head": [22, 10], "tail": [4, 14], "back": [14, 9], "front": [24, 20] } }],
    "walk": [], "sit": [], "sleep": []
  },
  "frameRate": { "idle": 4, "walk": 8, "sit": 2, "sleep": 1 }
}
```
- `rows` 길이는 `size[1]`, 각 행 길이는 `size[0]`. 프레임 수: idle 4, walk 6, sit 2, sleep 2. 원점은 발밑 중앙(`origin` 0.5, 1).
- `anchors`는 프레임마다 있어야 하며 이름 집합은 리그 전체에서 같다. 오른쪽을 보는 기준으로 그리고 왼쪽은 렌더에서 플립.

### 3.2 조각 `data/sprites/parts/<part>.json`
```json
{
  "id": "ears-long",
  "rigs": ["quad-s"],
  "anchor": "head",
  "layer": "above",
  "offset": [-3, -7],
  "rows": ["..", ".."],
  "states": { "sleep": { "offset": [-3, -5], "rows": ["..", ".."] } }
}
```
- `layer`는 `above`(몸 위) 또는 `below`(몸 뒤). `offset`은 앵커 기준 좌상단. `states`로 상태별 대체 그림을 둘 수 있다(앉기 때 꼬리 말기 등). 없으면 모든 상태에 같은 그림.
- 조각도 역할 글자를 쓰므로 종족 팔레트가 그대로 적용된다. `X`는 조각의 `fixed` 색을 쓴다.

### 3.3 종족 `data/sprites/species.json`
```json
{
  "fox": {
    "name": "여우",
    "rig": "quad-s",
    "scale": 0.95,
    "share": 3,
    "lanes": [0.2, 0.5, 0.3],
    "walkSpeed": 0.08,
    "nocturnal": false,
    "weights": { "default": { "idle": 0.6, "walk": 0.22, "sit": 0.1, "sleep": 0.08 }, "night": { "idle": 0.45, "walk": 0.05, "sit": 0.15, "sleep": 0.35 } },
    "palettes": { "red": { "B": "#c8622f", "b": "#9c4a22", "W": "#f1e4d2", "D": "#2a1f1a", "L": "#2a1f1a", "l": "#1c1512", "E": "#f4efe6", "P": "#1a1a1a", "N": "#1a1a1a", "M": "#f1e4d2", "m": "#2a1f1a", "H": "#e8a06a" }, "grey": {} },
    "overlays": ["ears-pointed", "tail-bushy", "muzzle-long"]
  },
  "raccoon": {
    "name": "너구리", "rig": "raccoon", "scale": 1.0, "share": 0, "lanes": [0.3, 0.4, 0.3], "walkSpeed": 0.06, "nocturnal": true,
    "weights": { "...": "..." },
    "palettes": { "grey": {}, "brown": {}, "cinnamon": {}, "blonde": {}, "melanistic": {}, "albino": {} },
    "axes": {
      "kind": { "common": [], "crab-eating": ["ears-small", "coat-short"], "cozumel": ["tail-gold-tip"] },
      "mask": { "default": ["mask-default"], "wide": ["mask-wide"], "one-eye": ["mask-one-eye"], "none": [] },
      "tail": { "3": ["tail-stripes-3"], "5": ["tail-stripes-5"], "7": ["tail-stripes-7"], "plain": ["tail-plain"] },
      "body": { "chubby": 1.1, "normal": 1.0, "slim": 0.9, "baby": 0.7 }
    }
  }
}
```
- `weights`·`walkSpeed`·`lanes`·`nocturnal`은 선택이며 없으면 리그 기본값(§5.2). `nocturnal: true`는 낮/밤 가중치 표를 뒤집는다.
- 너구리만 `axes`를 가진다. `variant`는 `"<palette>|<kind>|<mask>|<tail>|<body>"` 문자열. 다른 종족의 `variant`는 팔레트 이름.
- 종족 전부는 `share` 합과 너구리 60% 규칙으로 뽑는다(§5.3).

### 3.4 타일 `data/sprites/tiles/<tile>.json`과 장면 `data/scenes/forest.json`
- 타일: `{ "id": "ruin-cabin", "rows": [...], "size": [w, h], "ground": 1 }` (`ground`는 발밑으로 삼을 행 오프셋).
- 타일 목록(최소): `fog-trees-a/b`(뒤층 실루엣), `trunk-moss-a/b`, `canopy-a`, `ruin-cabin`(지붕 무너진 오두막), `ruin-brick`(덩굴 벽돌집), `window-broken`, `rock-moss-a/b`, `fern`, `log-fallen`, `grass-a/b`.
- 장면:
```json
{
  "ground": { "y": 0.60 },
  "layers": [
    { "id": "back",  "y": 0.56, "tint": "horizon", "alpha": 0.8, "scale": 2.0, "density": 0.9, "tiles": [{ "id": "fog-trees-a", "w": 3 }, { "id": "fog-trees-b", "w": 2 }] },
    { "id": "mid",   "y": 0.62, "scale": 2.5, "density": 0.55, "tiles": [{ "id": "trunk-moss-a", "w": 4 }, { "id": "trunk-moss-b", "w": 3 }, { "id": "ruin-cabin", "w": 1, "max": 1 }, { "id": "ruin-brick", "w": 1, "max": 1 }] },
    { "id": "front", "y": 0.90, "scale": 2.5, "density": 0.35, "tiles": [{ "id": "rock-moss-a", "w": 3 }, { "id": "fern", "w": 4 }, { "id": "log-fallen", "w": 1, "max": 1 }, { "id": "grass-a", "w": 5 }] }
  ],
  "palettes": { "spring": { "G": "#5f8f4e", "g": "#3f6b35", "F": "#7bb061", "f": "#4e7a3f", "T": "#6b5a48", "t": "#473a2d", "R": "#8a8f84", "r": "#5f655c", "K": "#9a6f5a", "k": "#6e4d3e", "V": "#4f7a3a", "S": "#ffffff", "D": "#1e1a17", "A": "#6f7f72" }, "summer": {}, "autumn": {}, "winter": {} }
}
```
- 배치는 시드 기반 결정적(seed = 쿼리 `seed`). `density`는 화면 폭 1.0당 타일 개수 기대값, `w`는 선택 가중치, `max`는 장면당 최대 개수. 뒤층은 가로 전체를 틈 없이 채우고, 중·앞층은 간격 지터.
- 주민은 `ground.y` 기준 레인(0.62/0.72/0.82 유지)에 서고, 앞층(0.90)은 주민 앞에, 중층은 주민 뒤에 그린다.
- 계절 팔레트는 4개 필수. 겨울은 `G/g`가 눈색 쪽으로, `F`는 빈 가지 색. 시간대 틴트는 하늘 팔레트 `bottom` 색을 곱한다(밤은 어둡고 푸르게, 낮은 1.0). 지면은 평평한 이끼 띠(`G`)와 흙(`t`) 두 줄.

## 4. 합성기와 렌더 파이프라인

### 4.1 `src/domain/sprites` (Phaser 금지, 100% 테스트 대상)
- `PixelMap.parse(rows, size)` → `{ w, h, cells: Uint8Array(역할 코드) }`. 행 길이 불일치·미등록 글자는 `Error`.
- `Palette.resolve(species, variant)` → 역할→RGBA 표. 너구리는 `axes`로 오버레이 목록·배율·팔레트를 조합.
- `composeFrame(rig, state, index, species, variant, registry)` → `{ w, h, rgba: Uint8ClampedArray }`. 순서: `below` 조각 → 몸 → `above` 조각. 조각은 프레임 앵커 + `offset`에 놓고 캔버스를 벗어나는 픽셀은 버린다. `X`는 조각의 `fixed` 색.
- `SpriteRegistry.load({ rigs, parts, species })` → 검증: 리그 존재, 프레임 수·크기, 앵커 집합 일치, 조각의 `rigs`에 해당 리그 포함, 조각 앵커가 리그에 존재, 팔레트가 사용된 역할을 전부 가짐, 색은 `#rrggbb`, `scale` 0.3~2.0, 너구리 `axes` 참조 조각 존재. **실제 데이터 파일로 테스트**한다.
- `animKey(species, variant, state)` = `spr:<species>:<variant>:<state>`.

### 4.2 `src/render/sprites`
- `SpriteBank`: `ensure(species, variant)` → 14프레임을 `composeFrame`으로 만들고 `textures.createCanvas`(또는 `addCanvas`)에 `putImageData`로 올린 뒤 `NEAREST` 필터, 애니메이션 등록. 같은 키는 1회만. 스폰된 변이만 생성한다(25종 전부 미리 만들지 않음).
- 크기: `displayScale = laneScale × species.scale × bodyScale × PX × min(w,h)/360`, `PX = 1.5`(리그 32px 너구리가 M1의 40px 높이와 비슷해지는 값. 스크린샷으로 조정 가능). 정수 배율을 강제하지 않는다(픽셀 밀도 차이는 NEAREST로 충분).
- `walkRange`는 종족별 반폭으로 계산(M1의 `walkRangeFor`를 주민마다 적용).

### 4.3 `src/render/background/ForestLayer`
- 장면 JSON을 읽어 층별로 **RenderTexture 1장**을 만든다(타일을 캔버스 텍스처로 올린 뒤 그려 넣음). 계절·시간대(skyKey)가 바뀔 때만 다시 만든다. 프레임마다 하는 일은 없다(틴트는 RenderTexture 색상에 적용).
- 가로 크기 변경 시 다시 배치(시드 동일 → 같은 배치). 세로 화면은 M1과 같이 카메라 확대 2배.
- M1 `SkyLayer`의 사각 스카이라인은 제거하고 하늘·별·달만 남긴다.

### 4.4 VillageScene 변경
- `residents: Resident[]`와 `sprites: Map<id, Sprite>`. `update`는 주민 전부 `tick` → 스프라이트 위치·애니메이션·플립·깊이(`lane × 1000 + y`).
- 쿼리: `n=<1..40>`(기본 12), `species=all`(쇼케이스: 25종을 종족 id 순으로 한 줄씩 레인에 나눠 정지 배치, `still` 자동), `sheet=<species>`(한 종족의 14프레임을 격자 정지 배치). 쇼케이스·시트는 DoD 확인·스크린샷·인스타 컷용.
- `window.__rv`에 `residents: Resident[]`(기존 `resident`는 첫 번째를 가리켜 e2e 호환 유지).

## 5. 도메인 변경

### 5.1 Resident
```ts
export type ResidentState = 'idle' | 'walk' | 'sit' | 'sleep'
export interface Resident {
  id: string; species: string; variant: string; scale: number
  lane: 0 | 1 | 2; x: number; facing: 'left' | 'right'
  state: ResidentState; stateT: number; targetX?: number; history: ResidentState[]
}
```
### 5.2 UtilityAI
- `AIContext`에 `profile: { walkSpeed, weights, nocturnal }` 추가. `sleep` 지속 10~30 s, 밤에 가중치 ↑. `nocturnal`이면 `phase === 'night'`를 낮처럼, 낮을 밤처럼 취급(올빼미·너구리·오소리·족제비·삵·멧돼지·고슴도치·두더지).
- 리그 기본 가중치: `quad-l`은 sit·sleep ↑, `bird`는 idle ↑·walk 짧게(`walkSpeed` 0.1, 지속 짧음), `biped`는 walk ↑. 히스토리 규칙(3연속 금지, walk 연속 금지)은 유지.
- 주민끼리의 회피·접근은 M2b. M2a에서는 겹침을 스폰 시 간격으로만 완화한다.

### 5.3 Village
- `createVillage(seed, n, registry)` → `Resident[]`. 너구리 수 = `ceil(n × 0.6)`, 나머지는 `share` 가중 추첨(사람은 최대 2). 너구리 변이는 축별 균등 추첨. 레인은 종족 `lanes` 확률. 같은 레인 안에서 x를 정렬 후 최소 간격 0.05로 밀어낸다.
- 결정적: 같은 `seed`·`n`이면 같은 마을(스크린샷 베이스라인 전제).

## 6. 성능과 에러 처리
- 텍스처 생성: 스폰된 변이 수 × 14장의 32~48px 캔버스. 30마리 기준 수십 ms. 부팅 1회.
- 배경: 층당 RenderTexture 1장, 재생성은 계절·시간대 변화 때만.
- 월페이퍼 30fps 캡·탭 숨김 정지는 M1 그대로. DoD에 30마리 전력 재측정 포함.
- 데이터 오류는 부팅 전 테스트에서 잡는다. 런타임에는 `SpriteRegistry.load`가 `Error`를 던지고 부팅이 콘솔에 1회 기록 후 중단(깨진 그림을 그리지 않는다).
- 그림 수정 루프: 픽셀맵(JSON) 수정 → `npm run capture:sheet`(Playwright로 `?species=all`과 `?sheet=<id>`를 `captures/`에 저장) → 스크린샷 확인 → 반복. 베이스라인에는 포함하지 않는다.

## 7. 테스트·검증
- 단위(도메인 90%+ 유지): PixelMap 파싱·오류, 팔레트 해석(너구리 축 조합 포함), `composeFrame` 앵커·레이어 순서·클리핑·`X` 고정색, 레지스트리 검증을 **실제 data/ 파일 전체**에 대해, `createVillage` 비율·간격·결정성, UtilityAI sleep·nocturnal, 장면 배치 결정성·`max`·`density`.
- e2e: 기존 4개 스모크 유지(`n` 기본값으로 베이스라인 4장 재생성) + 쇼케이스 `species=all` 데스크톱 1장. `still=1`은 모든 주민을 idle 0프레임으로 고정.
- 전력: `npm run measure:wall -- --n=30` 10분, 숨김/활성 < 10%, 활성 CPU는 M1(9.7 cpu_s/30s, SwiftShader) 대비 2배 이내. 결과는 `docs/metrics/M2a.md`.
- 타임랩스: `npm run capture:timelapse`로 데브로그 컷 1개(커밋하지 않음).

## 8. 문서 갱신(이 마일스톤 안에서)
- `02`: 핵심 설정 "산짐승 24종 + 사람" 명시, 챕터 2 "첫 다른 종족(랜덤 산짐승) 합류", 챕터 6+ "종족 파도". 사람 챕터 3 유지.
- `03`: 종족 표를 §2 리그표로 교체, 자율 행동에 `sleep` 추가.
- `05`: 캐릭터 시트 절을 리그·조각·팔레트 방식으로 교체, 제작 파이프라인에 픽셀맵·콘택트 시트 루프 추가, 배경 타일 목록.
- `09`: M2 → M2a/M2b/M2c 행 분할, M2a 완료 기준은 §9.
- `decisions.md`: 픽셀맵 데이터 아트, 산짐승 24종+사람, 리그 5종, M2 분할.
- `CLAUDE.md`: "에셋 파일은 읽지 않는다"에 "픽셀맵 JSON은 에셋이 아니라 데이터" 한 줄.

## 9. 완료 기준(DoD)
1. `?species=all`에서 25종이 각자 다른 실루엣·색으로 보이고, 같은 리그끼리도 구분된다(스크린샷 첨부).
2. 기본 마을(`n=12`)에서 1시간 방치 시 모든 주민이 멍·걷기·앉기·자기를 하며 화면 이탈이 없고 스폰 시 겹치지 않는다(지나칠 때의 겹침은 M2b 회피 전까지 허용).
3. 이끼 숲·폐허 배경이 4계절·4시간대에서 어색하지 않다(16조합 쇼케이스 스크린샷).
4. 도메인 커버리지 90%+, 실제 데이터 파일 검증 테스트 통과, e2e 녹색.
5. 30마리 월페이퍼 전력 측정 PASS, `docs/metrics/M2a.md`.
6. 문서 §8 갱신, Pages 배포.

## 10. 셀프 리뷰 기록
- 플레이스홀더: 없음. 조각·타일 목록은 최소 집합이며 플랜에서 늘릴 수 있다.
- 일관성: 레인 y(0.62/0.72/0.82)는 M1 그대로, 배경 `ground.y` 0.60은 레인 0 위에 놓인다. `PX` 상수는 스크린샷으로 조정한다고 명시.
- 범위: 데이터 25종 작성이 가장 큰 작업이므로 플랜에서 리그 5종 → 종족 묶음 4~5개 → 배경 → 통합 순으로 나눈다.
- 모호성: `variant` 문자열 형식, `share`·60% 규칙, 결정성 조건, 쿼리 이름을 명시했다.

## 11. 구현 중 변경(2026-11-03)
- 리그 6종: 사족보행을 `quad-l`(큰 사족)과 `quad-deer`(사슴류)로 분리.
- 배경 렌더: RenderTexture → 정적 합성 이미지(레이어를 원본 해상도로 합성해 NEAREST로 확대).
- 활성 CPU 기준 2.0× → 2.5×(SwiftShader 측정 기준, 실기기 측정은 M5).
- 야행성 9종(담비 추가).
- 사람 변이 144가지, 너구리 기본 변이는 꼬리 3줄.
- 폐허 타일은 `min` 배치로 반드시 나타난다.
- §9-2 재정의: 스폰 시 겹침 없음, 지나칠 때의 겹침은 M2b 회피까지 허용.
- `n ≥ 10`이면 사람을 최소 1명 보장(상한 2명 유지).
- 쇼케이스는 `showcaseLayout`으로 큰 종을 뒤 레인에, 앞 두 레인은 크고 작은 종을 번갈아 배치.
