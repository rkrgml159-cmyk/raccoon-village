# M1 「살아있는 디오라마」 설계 스펙

- 작성: 2026-11-03 · 상태: 사용자 승인(설계 5개 섹션 전부) · 경로: 아키텍처형
- 상위 문서: `docs/09-roadmap.md` M1, `docs/03-gameplay-design.md`, `docs/04-tech-architecture.md`
- 결정 근거: `docs/decisions.md`

## 1. 목표와 범위

**목표**: 현실 시간·계절을 반영하는 하늘 아래 너구리 한 마리가 자율적으로 살아가는 디오라마를 PC 브라우저 URL로 띄워, 1시간 방치해도 어색하지 않고 저전력으로 동작함을 증명한다. 인스타 첫 타임랩스 소재를 만든다.

**포함**
- Phaser 4 + TypeScript + Vite 스캐폴드, 두 엔트리(`/` 플레이, `/w/` 월페이퍼)
- `DateContext`(시간대·계절·월령), `Clock`(실제/고정/배속)
- 너구리 1마리 `Resident` + `UtilityAI`(idle/walk/sit), 레인 3개 중 중앙 레인 고정
- 하늘 레이어(시간대×계절 색상 보간, 별, 달, 단순 스카이라인 실루엣)
- 코드로 그린 플레이스홀더 너구리(idle 4프레임, walk 6프레임, sit 2프레임) → `generateTexture`
- 바람 앰비언스 1레이어(Web Audio 합성, 에셋 없음)
- `PowerPolicy`(fps 캡, 탭 숨김 정지, 파티클 상한)
- Vitest 단위 테스트, Playwright e2e·스크린샷 비교, 월페이퍼 CPU 측정 스크립트
- GitHub Actions CI + GitHub Pages 배포

**제외(M2 이후)**: 주민 2명 이상·다른 종족, 상호작용·말풍선, 스킨, 아티팩트 배치, 자원·방치 보상, 저장, 백엔드, 날씨·절기·기념일, 실제 스프라이트, 음악, Capacitor.

**사용자 결정(2026-11-03)**: 아트는 코드 플레이스홀더 / 배포는 GitHub Pages / 레포는 공개 전환(사용자가 GitHub 설정에서 수행) / 렌더는 Phaser 4 전면.

## 2. 아키텍처와 폴더

```
raccoon-village/
├── index.html                 /  플레이 엔트리
├── w/index.html               /w/ 월페이퍼 엔트리 (서버 설정 없이 Pages에서 동작)
├── vite.config.ts             base '/raccoon-village/', 멀티 엔트리
├── src/
│   ├── domain/                Phaser import 금지. 순수 TS. Vitest 커버리지 90%+
│   │   ├── time/DateContext.ts
│   │   ├── time/Clock.ts
│   │   ├── resident/Resident.ts
│   │   ├── resident/UtilityAI.ts
│   │   ├── village/Lanes.ts
│   │   ├── wallpaper/PowerPolicy.ts
│   │   └── events.ts
│   ├── render/
│   │   ├── scenes/VillageScene.ts
│   │   ├── sky/SkyLayer.ts
│   │   ├── sprites/PlaceholderRaccoon.ts
│   │   └── audio/WindSynth.ts
│   └── app/
│       ├── main.ts            플레이 부팅
│       ├── wallpaper.ts       월페이퍼 부팅
│       └── boot.ts            공통: 쿼리 파싱(at, speed), Clock 선택, Phaser Game 생성
├── data/sky-palette.json      phase 4 × season 4 = 16 색상 세트
├── tests/unit/**  tests/e2e/**  tests/capture/{baseline,current}/
├── scripts/measure-wallpaper.ts
└── .github/workflows/ci.yml
```
원칙: 플레이와 월페이퍼는 같은 `VillageScene`을 쓰고, `PowerPolicy` 입력과 DOM UI 유무만 다르다. 도메인은 `dt`(ms)와 `Date`만 받는다.

## 3. 도메인 컴포넌트

### 3.1 DateContext
- 입력: `Date`, 타임존 문자열(기본 `Asia/Seoul`, `Intl.DateTimeFormat`으로 로컬 시·월 추출. 실패 시 기기 로컬).
- 출력:
  ```ts
  type Phase = 'dawn'|'day'|'dusk'|'night'
  type Season = 'spring'|'summer'|'autumn'|'winter'
  interface DateContext { phase: Phase; season: Season; moonPhase: number /*0~1, 0=삭, 0.5=망*/; skyKey: `${Season}-${Phase}`; hour: number; minute: number }
  ```
- 계절: 3~5 봄, 6~8 여름, 9~11 가을, 12·1·2 겨울.
- 시간대 경계(시, 계절 보정 포함):

  | 계절 | dawn | day | dusk | night |
  |---|---|---|---|---|
  | 봄·가을 | 05:00~07:00 | 07:00~17:00 | 17:00~19:00 | 그 외 |
  | 여름 | 04:30~06:30 | 06:30~18:30 | 18:30~20:30 | 그 외 |
  | 겨울 | 06:00~08:00 | 08:00~16:30 | 16:30~18:30 | 그 외 |
- 월령: 기준 신월 2000-01-06 18:14 UTC, 삭망월 29.530588일. `((days % P) + P) % P / P`.
- 불변식: 어떤 `Date`(1970, 2200년 포함)에도 유효한 값 반환. 예외 없음.

### 3.2 Clock
```ts
interface Clock { now(): Date }
RealClock               // new Date()
FixedClock(iso)         // 테스트·스크린샷용. ?at=2026-01-15T22:00 (타임존 Asia/Seoul 해석)
FastClock(start, speed) // ?speed=600 → 실제 1초 = 게임 10분. 타임랩스 캡처용
```

### 3.3 Resident / UtilityAI
- `Resident { id, species: 'raccoon', lane: 1, x: number /*0~1*/, facing: 'left'|'right', state: 'idle'|'walk'|'sit', stateT: number /*남은 ms*/, targetX?: number }`
- `UtilityAI.tick(resident, dtMs, ctx: {phase}, rng)`:
  - 상태 만료 시 다음 상태를 가중치로 선택. 기본 가중치 idle 0.70 / walk 0.20 / sit 0.10. `night`에는 idle 0.75 / walk 0.05 / sit 0.20.
  - 지속시간: idle 4~12초, sit 6~20초, walk는 목표 `x`(현재에서 ±0.1~0.4, 범위 클램프) 도달까지. 걷기 속도 0.06/초(화면 비율).
  - 같은 상태 연속 3회 금지(걷기 후 바로 걷기 제외).
  - `rng: () => number`를 주입(시드 기반 mulberry32). 같은 시드·같은 dt 시퀀스 → 같은 결과.
- 순수 함수형: 새 `Resident`를 반환(불변).

### 3.4 Lanes
- 레인 3개: y 비율 `[0.62, 0.72, 0.82]`, 스케일 `[0.8, 1.0, 1.2]`, x 범위 `[0.05, 0.95]`.
- `toScreen(lane, x, viewport) → {px, py, scale}`. M1은 lane 1만 사용하지만 구조는 3개.

### 3.5 PowerPolicy
```ts
policy({mode:'play'|'wallpaper', hidden:boolean, reducedMotion:boolean})
→ { targetFps: play 60 | wallpaper 30 | hidden 0, particleCap: play 200 | wallpaper 60 | reducedMotion 0, audioAllowed: !hidden }
```

### 3.6 events.ts
타입 안전 이벤트 버스(`on/off/emit`, 제네릭 맵). M1 이벤트: `phaseChanged`, `seasonChanged`, `residentStateChanged`. 렌더·오디오가 구독.

## 4. 데이터 흐름과 렌더

```
boot.ts: 쿼리 파싱 → Clock 선택 → PowerPolicy 초기값 → new Phaser.Game({scene: VillageScene})
VillageScene.create: PlaceholderRaccoon.generate(this) → 애니메이션 등록 / SkyLayer 생성 / Resident 초기화 / WindSynth 준비
VillageScene.update(dt):
  ctx = DateContext.compute(clock.now())      (1초에 1회 재계산, phase/season 변화 시 이벤트)
  resident = UtilityAI.tick(resident, dt, ctx, rng)
  SkyLayer.render(ctx, 보간 60초)            (phase 전환 시 60초 크로스페이드, FastClock이면 비례 단축)
  너구리 스프라이트 위치 = Lanes.toScreen, 애니 = state, flipX = facing
visibilitychange → PowerPolicy 재계산 → game.loop.targetFps 갱신, hidden이면 loop.sleep()/wake(), wake 시 DateContext 즉시 재계산
```

### 4.1 PlaceholderRaccoon
- `Phaser.GameObjects.Graphics`로 48×40 기준 캔버스에 그린다: 몸(회색 타원), 머리(원), 귀 2개, 검은 눈 마스크(띠), 흰 주둥이, 꼬리(줄무늬 5개 교차 회색/검정), 다리 4개.
- 프레임: `raccoon-idle-{0..3}`(눈 깜빡임·꼬리 흔들림), `raccoon-walk-{0..5}`(다리 교차·상하 2px 바운스), `raccoon-sit-{0..1}`(앉은 실루엣·꼬리 감싸기).
- `generateTexture(key, w, h)` 후 `anims.create`. M2에서 아틀라스 로드 시 같은 키를 쓰므로 씬 코드 변경 없음.

### 4.2 SkyLayer
- `data/sky-palette.json`: 16개 키 각각 `{top, bottom, horizon, starAlpha}`.
- 전체 화면 그라디언트(Graphics `fillGradientStyle`), 지평선 위 폐허 스카이라인(사각형 8~12개 실루엣, 시드 고정), 밤 별 30개(starAlpha), 달(원 + 월령에 따른 그림자 원 오프셋). 밤에 달 밝기 = 1 − |moonPhase − 0.5|×2.
- 보간: 현재 키 → 다음 키로 60초 선형 보간(`Phaser.Display.Color.Interpolate`).

### 4.3 반응형
- `Scale.RESIZE` + `autoCenter`. 가로(비율 > 1.2): 레인 x 범위 전체 표시. 세로: 카메라 줌으로 중앙 레인의 x 0.25~0.75 영역을 채움. `resize` 이벤트에서 재배치.

### 4.4 WindSynth
- `AudioContext` → 핑크 노이즈 버퍼(2초 루프) → `BiquadFilter(lowpass)` 컷오프 봄·가을 600Hz / 여름 900Hz / 겨울 400Hz → `GainNode` LFO(0.1~0.3Hz, 깊이 0.15) → 마스터 게인 0.12.
- 시작은 사용자 제스처에서만(`pointerdown`/월페이퍼 "소리 켜기" 버튼). `PowerPolicy.audioAllowed`가 false면 게인 0으로 페이드(200ms) 후 suspend.

### 4.5 월페이퍼 엔트리(`/w/`)
- DOM: 우하단 "🔈 소리 켜기" 버튼 1개(클릭 후 사라짐). 그 외 UI 없음, 커서 숨김(3초 무동작 시).
- 플레이 엔트리(`/`)는 M1에서 동일 화면 + 좌상단 작은 시계·계절 라벨(디버그용, `?debug=1`일 때만).

## 5. 에러 처리·성능

| 상황 | 처리 |
|---|---|
| 비정상 시계(1970, 2200) | DateContext는 항상 유효 값. 예외 없음 |
| 타임존 API 실패 | 기기 로컬 시간 사용, 콘솔 경고 1회 |
| WebGL 불가 | Phaser `AUTO` → Canvas 폴백 |
| AudioContext 생성 실패 | 무음, 콘솔 경고 1회, 버튼 숨김 |
| 탭 숨김 | 루프 sleep, 오디오 suspend. 복귀 시 wake + DateContext 즉시 재계산 |
| 리사이즈 폭주 | 100ms 디바운스 |

성능 목표(M1 측정 기록): 월페이퍼 모드 30fps 유지, 탭 숨김 시 CPU ~0, 번들(gzip) < 1.5MB, 첫 로드 < 3초(4G 시뮬레이션). 텍스처 생성은 부팅 1회.

## 6. 테스트·CI·배포

### 6.1 단위(Vitest, `tests/unit`)
- DateContext: 계절 4 × 시간대 4 조합 전부, 경계 시각(04:30, 05:00, 06:30, 07:00, 16:30, 17:00, 18:30, 19:00, 20:30, 00:00), 월령 기준일(2000-01-06 → 0, +14.77일 → ≈0.5), 1970·2200년 입력.
- Clock: FixedClock 고정, FastClock 배속 계산.
- UtilityAI: 시드 고정 시 100틱 시퀀스 스냅샷, 밤 가중치 분포(1만 샘플, 허용 오차 ±3%p), 연속 3회 금지, x 범위 클램프.
- Lanes: toScreen 수치, 범위 밖 입력 클램프.
- PowerPolicy: 입력 조합 표 전부.
- events: on/off/emit, 해제 후 미호출.

### 6.2 e2e(Playwright, `tests/e2e`)
- `/`, `/w/` 로드 → `canvas` 존재, 콘솔 에러 0, `?at=2026-01-15T22:00` 고정.
- 스크린샷 4장: `{desktop 1920×1080, mobile 390×844} × {/, /w/}` → `tests/capture/baseline/*.png`와 pixelmatch(임계 1%). 베이스라인 갱신은 `npm run capture -- --update`.
- 타임랩스 캡처 스크립트(`npm run capture:timelapse`): `?speed=600`으로 150초 녹화 → `captures/`(gitignore).

### 6.3 측정(`scripts/measure-wallpaper.ts`)
- Playwright + CDP `Performance.getMetrics`로 `/w/`를 10분 열어 두고 30초 간격 `TaskDuration`·`JSHeapUsedSize` 수집, 탭 숨김 2분 구간 포함 → `docs/metrics/M1.md` 표 생성. (1시간 방치 측정은 완료 기준 검증 시 1회 수동 실행.)

### 6.4 CI/배포(`.github/workflows/ci.yml`)
- 트리거 push/PR. 단계: `npm ci` → lint → `vitest run --coverage`(domain 90% 미만 실패) → `vite build` → Playwright e2e → main이면 `actions/upload-pages-artifact` + `actions/deploy-pages`.
- `vite.config.ts` base `/raccoon-village/`. 공개 URL: `https://rkrgml159-cmyk.github.io/raccoon-village/` 및 `/w/`.
- 전제: 레포 공개 전환 + Settings → Pages → Source: GitHub Actions(사용자 수행).

## 7. 완료 기준(DoD)
1. 공개 URL `/w/`에서 현재 시간대·계절의 하늘과 너구리가 보이고, 너구리가 멍·걷기·앉기를 반복한다.
2. 측정 스크립트 결과가 `docs/metrics/M1.md`에 기록되고, 탭 숨김 구간의 CPU 사용이 활성 구간 대비 10% 미만이다.
3. `src/domain` 커버리지 90% 이상, CI 녹색.
4. `?speed=600` 타임랩스 캡처로 하루가 2.4분에 지나가는 영상이 생성된다.
5. 스크린샷 베이스라인 4장이 커밋되어 있다.

## 8. 셀프 리뷰 기록
- 플레이스홀더 검사: TBD/TODO 없음.
- 일관성: 04 문서의 모듈 구조와 폴더 일치(M1 범위만). 시간대 경계가 03 문서(새벽/낮/노을/밤)와 일치하며 계절 보정은 이 스펙이 상세 정의.
- 범위: 단일 구현 계획으로 가능(예상 태스크 25~35개). 도메인→렌더→월페이퍼→CI 순 의존.
- 모호성 해소: "밤 가중치"를 수치로 고정, 보간 시간 60초로 고정, 레인은 M1에서 중앙만 사용함을 명시.
