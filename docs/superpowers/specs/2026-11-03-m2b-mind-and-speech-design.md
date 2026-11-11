# M2b 「마음과 말」 설계 스펙

- 작성: 2026-11-03 · 상태: 사용자 승인(접근법 A + 설계 10개 섹션) · 경로: 아키텍처형
- 상위 문서: `docs/09-roadmap.md` M2b, `docs/03-gameplay-design.md`(주민·욕구·상호작용·언어), `docs/02-story-worldbuilding.md`(언어·톤·금지 목록), `docs/06-dev-workflow.md`(대사 배치 생성)
- 선행: M2a 스펙 `2026-11-03-m2a-art-and-residents-design.md` (main 2849529에 병합·배포)

## 1. 목표와 범위

**목표**: 주민이 서로를 안다. 욕구와 성격이 행동을 고르고, 두 주민이 만나면 같은 **듀엣**에 묶여 인사·수다·같이 앉기 같은 상호작용을 하며, 관계가 쌓인다. 말은 종족어 말풍선·한국어 속마음·아이콘 풍선으로 보인다. 숫자는 화면에 나오지 않는다.

**사용자 결정(2026-11-03)**
- 새 애니메이션 프레임은 로드맵대로 전부: 리그 6종 × (shake 4 · interact_a 4 · interact_b 4 · happy 2 · sulk 2) = 72장.
- 속마음·종족어 대사는 06 문서 방식의 **Workflow 배치 생성**(구현 단계에서 1회, 사용자 요청으로 기록). 사람이 최종 검수.
- 접근법 A(듀엣 모델) 채택.

**포함**
- 욕구 4(배고픔·졸림·심심함·외로움)와 성격 특성 2개(8종 중) — 주민 속성, 시드 배정
- 행동 선택 확장: 욕구·특성 → 가중치, 새 행동 `forage`(땅 냄새 맡기), `approach`(다가가기)
- 듀엣 시스템 8종(인사·수다·같이 앉기·꼬리 잡기·도토리 나눠주기·털 고르기·다툼·화해), 역할 a/b, 결과(욕구·관계)
- 관계도(쌍별 점수, 4개 띠, 자연 복귀)
- 말: 종족어 생성기(`species.json` `voice`), 속마음 선택기(`data/dialogue/thoughts.json`), 아이콘 풍선
- 렌더: `BubbleLayer`(말·생각·아이콘 풍선), 72프레임 애니메이션, 듀엣 연출(마주 보기·나란히·쫓기·등 돌리기), 탭 입력(플레이 모드)
- 대사 파이프라인: Workflow 1회 실행 → JSON, 스키마·금지어·길이 테스트
- 검증: 도메인 TDD, e2e(듀엣 발생·탭 풍선), 듀엣 쇼케이스 스크린샷, n=30 전력 재측정
- 문서 갱신(02·03·05·06·09·decisions·README)

**제외(이후)**: 번역 자막·번역기(M3), 아티팩트·자원·저장·방치 보상(M2c; 배고픔은 `forage`로 임시 해소), 합류 연출·챕터 트리거(M3), 소리 추가, 플레이어가 상호작용을 지시하는 기능(없음, 영구).

## 2. 욕구와 성격

### 2.1 욕구 (`Needs`)
```ts
export interface Needs { hunger: number; sleepy: number; bored: number; lonely: number } // 0..1, 1 = 가장 급함
```
- 시뮬 시간(`dtMs × speed`)으로 선형 증가. 0→1까지: 배고픔 4h, 졸림 8h, 심심함 1.5h, 외로움 2h.
- 해소(상태가 끝날 때 적용, 상태 중에는 비율로): `sleep` 졸림 −1.0(완료 시), `forage` 배고픔 −0.6, `walk` 심심함 −0.1, 듀엣 결과는 §3 표.
- 야행성 종족은 졸림의 증가가 낮에 1.5배, 밤에 0.5배(기존 `nocturnal`과 합성).
- 초기값은 시드로 0.2~0.6 균등(마을이 시작하자마자 전부 자지 않도록).
- 화면 표시 없음. `?debug=1`에서만 텍스트. 아이콘 풍선은 욕구 ≥ 0.8일 때 1회(§5.3).

### 2.2 성격 (`Trait`)
```ts
export type Trait = 'calm' | 'curious' | 'timid' | 'glutton' | 'chatty' | 'dreamer' | 'tidy' | 'nightowl'
export interface Personality { traits: [Trait, Trait] } // 서로 다른 2개, 시드 배정(8C2 = 28)
```
한국어 표시명은 `data/dialogue/traits.json`에만(느긋·호기심·겁쟁이·먹보·수다쟁이·몽상가·청결·밤형).

**특성 배수표** (`data/behavior/traits.json`, 행동·듀엣 가중치에 곱한다. 없는 항목은 1):

| 특성 | 배수 |
|---|---|
| calm | idle ×1.3, approach ×0.8, quarrel ×0.5 |
| curious | walk ×1.4, approach ×1.2, forage ×1.2 |
| timid | approach ×0.6, quarrel ×0.3, chase ×0.5, 다툼 당하면 외로움 +0.2 |
| glutton | forage ×1.6, share(주는 쪽) ×0.4, 배고픔 증가 ×1.3 |
| chatty | approach ×1.6, chat ×1.5, greet ×1.2 |
| dreamer | idle ×1.2, 속마음 자동 확률 ×2, sit ×1.2 |
| tidy | groom ×1.8, forage ×0.8 |
| nightowl | `nocturnal` 토글(종족 값과 XOR) |

### 2.3 행동 선택 (UtilityAI 확장)
- 상태 집합: `idle | walk | sit | sleep | forage | approach | duet`.
- 기본 가중치는 M2a `Profile.weights`에 `forage 0.06`, `approach 0.08`을 더한 표(합은 정규화하므로 1일 필요 없음).
- 욕구 배수: `sleep ×(1 + 2·sleepy)`, `forage ×(1 + 2·hunger)`, `approach ×(1 + 2·lonely + bored)`, `walk ×(1 + bored)`.
- 특성 배수 §2.2. 히스토리 규칙(3연속·walk 연속 금지)은 유지하되 `duet`은 히스토리에 넣지 않는다.
- `forage`: 지속 6~12 s, idle 프레임 + 🍂 아이콘, 끝나면 배고픔 −0.6.
- `approach`: 대상 선택 §3.1. 대상이 없으면 `idle`로 대체. 지속 상한 20 s(못 닿으면 포기).
- `still` 모드·쇼케이스·시트 모드에서는 욕구·듀엣이 돌지 않는다.

## 3. 듀엣 시스템 (`src/domain/social/`)

### 3.1 다가가기와 성립
- 대상 후보: 같은 레인, 듀엣 중 아님, 자는 중 아님, 최근 60 s 안에 같은 쌍 듀엣 없음, 다툼 회피 중 아님. 가중치 `1 / (0.05 + |dx|) × (1 + relation)`(relation −1..1) — 가까운 친구를 선호.
- 도달 판정: `|x_a − x_b| ≤ 0.06`(발밑 중심 거리, 뷰 폭 비율). 도달하면 `Village.startDuet(a, b)`.
- 상대가 걷는 중이면 상대는 즉시 멈춘다(정지 후 듀엣). 상대가 `forage`·`sit`이면 그 상태를 끊고 참여한다.

### 3.2 듀엣 레코드
```ts
export type DuetType = 'greet' | 'chat' | 'sitTogether' | 'chase' | 'share' | 'groom' | 'quarrel' | 'makeUp'
export interface Duet { id: string; type: DuetType; a: string; b: string; t: number; durationMs: number; step: number }
```
- 종류 선택: 조건을 만족하는 종류의 기본 가중치(인사 1.0, 수다 0.8, 같이 앉기 0.6, 꼬리 잡기 0.4, 나눠주기 0.4, 털 고르기 0.4, 다툼 0.08, 화해는 조건 시 1.0 고정) × 특성 배수(§2.2) × 관계 띠 배수(§4). 첫 만남(관계 0, 기록 없음)은 항상 인사.
- 동시 듀엣 ≤ 3(마을), 같은 쌍 간격 ≥ 60 s, 종료 후 두 주민은 `idle`(stateT 4 s)로.
- 역할: 시작한 쪽이 a. `share`는 b의 배고픔이 더 높으면 역할 교환.

### 3.3 종류 표

| type | 조건 | 지속 | 연출(a / b) | 결과 |
|---|---|---|---|---|
| greet | 항상 | 3 s | interact_a / interact_b 1회, 종족어 1마디씩, 마주 보기 | relation +0.05, lonely −0.2(둘) |
| chat | 띠 ≥ 보통, chatty ↑ | 8~14 s | interact_a/b 번갈아 3~5마디(말풍선 교대) | relation +0.10, bored −0.4(둘) |
| sitTogether | 띠 ≥ 친구 | 20~40 s | 둘 다 `sit`, 간격 0.03으로 나란히, 같은 방향 | relation +0.08, lonely −0.6(둘) |
| chase | 둘 다 bored ≥ 0.5, timid ↓ | 9~12 s | b가 a를 쫓아 왕복 3회(walk, 거리 0.15), 끝에 둘 다 happy | relation +0.12, bored −0.8(둘) |
| share | a가 glutton 아님, b hunger ≥ 0.5 | 4 s | a interact_a → b happy, b 위 🍂 | b hunger −0.5, relation +0.15 |
| groom | 띠 ≥ 친구, tidy ↑ | 8 s | interact_a/b 교대 2회, ✨ 아이콘 | relation +0.10, lonely −0.4(둘) |
| quarrel | 띠 ≤ 보통, 둘 다 bored ≥ 0.7, 기본 가중치 0.08 | 5 s | 둘 다 sulk, 등 돌리기(flip 반대), 💢 | relation −0.15, 이후 30 s 서로 회피(후보 제외), 화해 창 1~5분 열림 |
| makeUp | 다툼 후 1~5분, 둘 다 회피 끝, 띠 > 서먹 | 5 s | interact_a/b + happy, ❤ | relation +0.20 |

- 종족 간 배수 없음(기둥). 사람도 같은 표.
- 듀엣 중 두 주민의 `state === 'duet'`; 애니 키는 듀엣 단계(`step`)가 정한다(§6.2).

## 4. 관계

```ts
export type Band = 'awkward' | 'neutral' | 'friend' | 'bestie'
export interface Relations { get(a, b): number; set(a, b, v): void; band(a, b): Band; decay(dtMs): void }
```
- 점수 −1..1, 쌍 키는 정렬된 `${a}|${b}`. 띠: awkward < −0.2 ≤ neutral < 0.3 ≤ friend < 0.7 ≤ bestie.
- 하루(시뮬 24h)에 0.02씩 0으로 복귀.
- 띠 배수(듀엣 종류 가중치): awkward: greet ×1.5, quarrel ×1.5, 나머지 ×0.5 / friend: chat·sitTogether·groom ×1.3 / bestie: sitTogether ×1.6, quarrel ×0.2.
- 화면에는 탭 시 속마음 풍선 아래 ❤ 0~3개(neutral 0, friend 1, bestie 3; awkward는 💧)로만.
- 저장은 M2c. M2b에서는 세션 메모리.

## 5. 말

### 5.1 종족어 (`species.json` → `voice`)
```json
"voice": { "syllables": ["너굴", "뀨", "뀨르"], "marks": ["?", "…", "!"], "maxSyllables": 3 }
```
- 생성: 시드로 1~`maxSyllables`음절 + 부호 1개. 같은 음절 연속 허용(`너굴너굴?`). 사람은 `syllables: ["ㅇ", "아", "ㅁ…", "으"]`처럼 깨진 자모. 새는 "까악", "깍", "부엉". 종족 25개 전부 `voice` 필수(레지스트리 검증).
- 듀엣 `step`마다 한 마디. 감정: greet는 `?`·`!`, quarrel은 `…`·`!` 큰 글자 없음(톤: 조용함).

### 5.2 속마음 (`data/dialogue/thoughts.json`)
```json
{ "situations": ["hungry","sleepy","bored","lonely","afterGreet","afterChat","afterSit","afterChase","afterShare","afterGroom","afterQuarrel","afterMakeUp","bestie","friend","awkward","dawn","day","dusk","night","spring","summer","autumn","winter","forest","ruin","moon","rain" ,"idleLong","walkFar","sleepWake"],
  "entries": [ { "situation": "lonely", "trait": "any", "species": "any", "lines": ["옆에 누가 앉으면 좋겠다."] } ] }
```
- 30개 상황 × 특성(`any` + 8) = 270 풀, 종족 태그(`any` | 종족 id)로 세계관 단서(곰 "담", 사람 "할머니", 수달 "물") 10% 혼입.
- 선택기 `pickThought(ctx, rng)`: 현재 상황 우선순위(듀엣 직후 > 욕구 ≥ 0.8 > 관계 띠 > 시간대·계절 > 기본) → 같은 상황에서 `trait` 일치 → `any`; 최근 10개 중복 금지; 후보 없으면 `idleLong`.
- 길이 ≤ 22자, 마침표 1개 이하, 설명조·숫자 금지, 02 금지 목록(시체·전쟁·바이러스·핵·지배·주인·명령·그리움 등 키워드 리스트는 `data/dialogue/forbidden.json`)을 테스트가 실제 파일로 검사.
- 노출: 플레이 모드 탭(스프라이트 `pointerup`) 즉시 1개, 월페이퍼는 10분마다 1회 랜덤 주민 자동(dreamer ×2 확률). 동시에 속마음 1개.

### 5.3 아이콘 풍선
- 종류: 🍂(배고픔/나눠주기), 💤(졸림), 🌀(심심함), 💭(외로움), ❤(관계 상승), 💢(다툼), ✨(털 고르기), ❓(인사 첫 만남).
- 욕구 ≥ 0.8이면 1회(그 욕구가 0.5 아래로 내려갈 때까지 재표시 없음), 듀엣 결과 시 1회. 지속 2 s, 페이드 250 ms.
- 이모지는 `data/ui.json`의 `icons` 맵에서 읽는다(코드에 문자 없음).

### 5.4 풍선 규칙(공통)
- 동시 표시 ≤ 3(마을), 같은 주민은 1개. 우선순위: 속마음 > 종족어 > 아이콘.
- 페이드 인/아웃 250 ms, 갑작스러운 등장 없음. `still`·쇼케이스에서는 풍선 없음.

## 6. 아트와 애니메이션

### 6.1 새 프레임
- 리그 6종(`raccoon`, `quad-s`, `quad-l`, `quad-deer`, `bird`, `biped`) 각각 `shake 4`, `interact_a 4`, `interact_b 4`, `happy 2`, `sulk 2` = 리그당 12, 총 72. `FRAME_COUNT`·`STATES`에 5개 상태 추가, `validateRig`가 강제.
- interact_a: 상대 쪽으로 몸을 기울이고 앞발/손을 내밈(4프레임 왕복). interact_b: 받는 쪽, 고개를 들어 끄덕임. happy: 작은 점프 2프레임(발이 바닥에서 1~2 px). sulk: 머리 숙이고 몸을 낮춤, 등 돌리기는 렌더 flip. shake: M2c 나무 흔들기용(앞발 들고 몸 흔듦) — 이번엔 그리기만 하고 쓰지 않는다.
- 앵커 5개 동일. 조각(`parts/*.json`)은 `states.interact_a` 등 상태별 offset을 필요한 것만 추가(꼬리·뿔·귀 연결성 테스트가 전 상태 전 프레임을 검사).
- 프레임레이트: interact 6, happy 4, sulk 2, shake 8.

### 6.2 듀엣 연출 매핑 (렌더)
| step | greet | chat | sitTogether | chase | share | groom | quarrel | makeUp |
|---|---|---|---|---|---|---|---|---|
| 0 | 마주 보기(flip), interact_a/b | interact_a + 말 | 둘 sit | b walk→a | interact_a + 🍂 | interact_a/b | 둘 sulk + 등 돌리기 | interact_a/b |
| 1 | — | interact_b + 말 | — | a walk 도망 | b happy | interact_b/a | — | 둘 happy + ❤ |
| 2.. | — | 교대 | — | 왕복 반복 | — | 교대 | — | — |

- 도메인이 `step`과 `t`만 제공하고 렌더가 표로 애니·풍선을 고른다. chase의 이동은 도메인이 x를 바꾼다(결정적).

## 7. 렌더·입력

- `src/render/ui/BubbleLayer.ts`: 풍선 1개 = 둥근 사각 `Graphics` + `Text`(폰트 `"Noto Sans KR", "Apple SD Gothic Neo", sans-serif`, 폰트는 CSS로 로드하고 `document.fonts.ready` 뒤에 시작; CI는 `fonts-noto-cjk` 설치됨). 아이콘은 Text로 이모지. 주민 머리 앵커(리그 `head` 앵커 × 배율) 위 6 px. 깊이 2_000_000. 화면 밖이면 안쪽으로 밀어 넣는다.
- 입력: 플레이 모드에서 스프라이트 `setInteractive({ useHandCursor: true })` + `pointerup` → `showThought(id)`. 월페이퍼는 입력 없음(M1 규칙). 드래그·더블탭 없음.
- `?debug=1`: 각 주민 아래 `H.5 S.2 B.7 L.1 · calm/chatty` 한 줄, 듀엣은 `greet 2.1s`.
- 쿼리 `?duet=<type>`: 쇼케이스처럼 정지 연출 — 너구리 2마리를 가운데에 두고 해당 듀엣 step 0 프레임을 보여준다(스크린샷용, `still` 강제).
- 성능: 풍선 ≤ 3, Text 객체는 풀(pool) 6개 재사용. 듀엣 매칭은 레인별 정렬 1회/초.

## 8. 데이터 파이프라인(속마음 배치 생성)

- 구현 단계의 한 태스크로 **Workflow를 1회 실행**(사용자 승인 기록: 2026-11-03 "Workflow 배치 생성" 선택). 구성: 특성별 초안 에이전트 8개 병렬(각 30상황 × 2문장 = 60줄, 종족 태그 줄 10% 포함) → 톤 검수 에이전트 1개(금지 목록·길이·설명조·중복 제거, 거부 사유 기록) → `data/dialogue/thoughts.json` 병합 → 사람 검수 목록 `docs/dialogue-review.md`(검수자가 체크).
- 톤 가이드(프롬프트에 포함): 02 "설명하지 않고 보여준다", 슬픔은 있되 따뜻하게, 옛 세계 그리움 금지, 종족 우열 금지, 반말 독백, 한 줄 ≤ 22자, 이모지 금지, 숫자 금지.
- 테스트(실제 파일): 스키마, 상황 30개 전부 ≥ 6줄, 특성별 ≥ 20줄, 금지어 0건, 길이, 중복 0.

## 9. 테스트·검증

- 도메인 TDD 90%+: 욕구 증가·해소·야행성 배수, 특성 배정(28조합·시드 결정성), 가중치 합성, `forage`/`approach`, 대상 선택, 듀엣 성립·종류 선택·조건·결과·동시 상한·간격·회피·화해 창, 관계 띠·복귀, 종족어 생성(음절·부호), 속마음 선택(우선순위·중복 금지·폴백), 아이콘 규칙.
- 실제 데이터 테스트: `voice` 전 종족, `traits.json`, `thoughts.json`(§8), `forbidden.json`.
- e2e: `?speed=60&seed=7&n=12`로 120 s 안에 `__rv.duets.length ≥ 1`; 플레이 모드에서 첫 주민 탭 → `__rv.bubbles` 에 thought 1개; 월페이퍼 모드는 탭해도 풍선 없음. 베이스라인 5장은 still이라 불변 + `?duet=chat` 데스크톱 1장 추가.
- 전력: n=30 10분, 숨김 < 10%, 활성 ≤ M2a(21.94) × 1.1. 결과 `docs/metrics/M2b.md`.
- 1시간 타임랩스(`speed=600`)에서 듀엣이 너무 잦지 않은지(분당 ≤ 2회) 확인.

## 10. 문서 갱신
- 03: 욕구·성격 배수표, 듀엣 표, 관계 띠 수치. 02: 언어 규칙(종족어 생성·속마음 노출). 05: 프레임 72장·앵커·프레임레이트. 06: Workflow 실행 기록과 검수 절차. 09: M2b 완료 + 측정. decisions: 듀엣 모델, 프레임 72장, Workflow 1회, 배고픔 임시 해소. README: 쿼리 `duet`, 탭 조작, M2b 완료 기준.

## 11. 완료 기준(DoD)
1. `n=12`, `speed=60` 타임랩스 10분 안에 8종 듀엣이 전부 최소 1회 발생한다(로그 `__rv.duetLog`).
2. 인사·수다·같이 앉기가 자연스럽다: 마주 보기·교대 말풍선·나란히 앉기가 스크린샷(`?duet=*` 8장)으로 확인된다.
3. 플레이 모드 탭 → 속마음 1줄, 월페이퍼 10분에 1회 자동. 숫자가 화면에 없다.
4. `thoughts.json` ≥ 240줄, 금지어 0, 사람 검수 완료 표시.
5. 도메인 커버리지 90%+, 실제 데이터 테스트, e2e 녹색, 72프레임 연결성 테스트 통과.
6. 전력 PASS(`docs/metrics/M2b.md`), 문서 갱신, Pages 배포.

## 12. 셀프 리뷰 기록
- 플레이스홀더 없음. 상황 30개는 §5.2에 열거.
- 일관성: `duet` 상태는 히스토리 제외, 동시 상한 3, 풍선 상한 3, 속마음 1개 — 서로 충돌 없음. 야행성과 nightowl은 XOR로 명시.
- 범위: 아트 72장 + 도메인 5모듈 + 렌더 2 + 파이프라인 1 — 한 플랜으로 가능하지만 태스크 15~18개 예상. 데이터(72장)는 리그별 6태스크로 나눈다.
- 모호성: 도달 거리 0.06, 간격 60 s, 지속 시간, 배수 전부 숫자로 고정.
