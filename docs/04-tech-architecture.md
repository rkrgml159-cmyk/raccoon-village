# 04. 기술 아키텍처

## 엔진 결정: Phaser 4 + TypeScript (권장)
메모에 적힌 후보(Unity / Unreal / Tripo / Blender / Godot)를 이 게임의 요구사항으로 평가했다.

| 요구사항 | Phaser 4 + TS | Godot 4 | Unity | Unreal | Tripo / Blender |
|---|---|---|---|---|---|
| PC에서 **URL로 띄우는 월페이퍼** | ◎ 웹이 본진. 수백 KB~수 MB | △ 웹 내보내기 가능하나 30MB+, iOS Safari 불안정 보고 | △ WebGL 빌드 무겁고 모바일 브라우저 약함 | ✕ | 해당 없음(에셋 도구) |
| 모바일 앱 | ◎ Capacitor 래핑(iOS/Android 동일 코드) | ◎ 네이티브 내보내기 | ◎ | ○ (2D 캐주얼엔 과함) | — |
| 2D 사이드뷰·팔레트 스왑·레이어 스킨 | ◎ | ◎ | ○ | △ | — |
| Claude Code와의 궁합(테스트·리뷰·자동화) | ◎ TypeScript·Vitest·Playwright 전부 텍스트 기반, 이 환경에 Playwright가 이미 있음 | ○ GDScript는 OK, 씬(.tscn) 파일 diff 리뷰가 번거로움 | ○ 공식 Unity 플러그인 존재. 단 에디터 의존 | △ | — |
| 배터리/저전력 월페이퍼 제어 | ◎ requestAnimationFrame 직접 제어 | ○ | △ | ✕ | — |
| 라이선스/비용 | MIT | MIT | 런타임 수수료 정책 리스크 | 로열티 | Tripo 유료, Blender 무료 |
| 3D 필요성 | 이 게임은 2D | — | — | — | **3D 전용 → MVP 불필요**. 2.5D 프리렌더 스프라이트를 원할 때만 Blender 검토 |

**결론**: 월페이퍼 URL 요구사항이 결정적이다. 웹이 1급 시민이어야 하므로 **웹 네이티브 스택**을 택하고, 모바일은 Capacitor로 감싼다.
Godot은 차선책(에디터 UI를 선호하고, 웹 월페이퍼를 "나중에"로 미룰 수 있다면). Unity/Unreal은 제외. Tripo/Blender는 아트 파이프라인 도구이지 엔진이 아니며, 2D 방향이므로 MVP에서 제외.

## 스택
| 계층 | 선택 | 이유 |
|---|---|---|
| 렌더/게임 루프 | **Phaser 4** (v4.2.x, WebGL 재작성, ESM) | 2D 스프라이트·타일·파티클·오디오 내장, 큰 커뮤니티 |
| 언어/빌드 | **TypeScript + Vite** (`npm create @phaserjs/game`) | 공식 템플릿 |
| 상태 관리 | 순수 TS 도메인 모델 + 이벤트 버스 (렌더와 분리) | 게임 로직을 Phaser 없이 Vitest로 테스트하기 위함 (TDD 필수 조건) |
| UI(메뉴/도감/상점) | **HTML/CSS 오버레이** (Phaser 캔버스 위 DOM) | 텍스트·스크롤·접근성은 DOM이 압도적, 한국어 폰트 렌더 깔끔 |
| 모바일 | **Capacitor** (+ 플러그인: App, Preferences, LocalNotifications, Haptics) | 웹 코드 그대로, 스토어 배포 |
| 백엔드 | **Supabase** (Postgres, Auth, Realtime, Storage, Edge Functions) | 무료 티어로 MVP 충분, RLS로 권한 처리 |
| 호스팅 | Cloudflare Pages 또는 Vercel (정적 + 엣지) | 월페이퍼 URL 전 세계 캐시 |
| 테스트 | **Vitest**(도메인), **Playwright**(스크린샷 회귀·월페이퍼 모드 smoke) | 이 세션 환경에도 Playwright 사전 설치 |
| 린트/포맷 | ESLint + Prettier, husky pre-commit | 슈퍼파워스 TDD/리뷰 루프와 결합 |

## 모듈 구조 (레포 초안)
```
raccoon-village/
├── CLAUDE.md                 # templates/CLAUDE.md 복사
├── docs/                     # 이 문서들 + superpowers 산출물(specs/plans)
├── src/
│   ├── domain/               # 엔진 독립. 순수 TS. 100% 단위테스트 대상
│   │   ├── raccoon/          # Raccoon, Traits, Needs, UtilityAI, Relationship
│   │   ├── village/          # Slots(lanes), Artifacts, Economy(idle 계산)
│   │   ├── time/             # DateContext(계절/시간대/절기/기념일/월령), OfflineProgress
│   │   ├── dialogue/         # 너굴어 생성기, 속마음 선택기, 번역 단계
│   │   └── story/            # Chapter 조건, Artifact 도감
│   ├── render/               # Phaser Scenes: Boot, Village, Station(환승역), Wallpaper
│   │   ├── sprites/          # 팔레트 스왑 파이프, 스킨 오버레이, 앵커
│   │   ├── sky/              # 시간대·계절·날씨 레이어
│   │   └── audio/            # ASMR 믹서(레이어별 볼륨, 크로스페이드)
│   ├── ui/                   # DOM 오버레이 (Preact 또는 vanilla)
│   ├── platform/             # Capacitor 어댑터, 웹 어댑터 (알림/저장/햅틱 추상화)
│   ├── net/                  # Supabase 클라이언트, 스냅샷 동기화, 방문
│   └── app/                  # 엔트리: /play, /w/:id
├── data/                     # dialogue/*.json, artifacts.json, skins.json, holidays.json
├── assets/                   # sprites/, audio/, (원본은 Git LFS 또는 별도 저장소)
└── tests/                    # vitest(unit), playwright(e2e)
```
핵심 원칙: **`src/domain`은 Phaser를 import하지 않는다.** 이 경계 덕분에 Claude가 TDD로 로직 대부분을 브라우저 없이 작성·검증할 수 있고, 토큰이 가장 많이 드는 "눈으로 확인" 작업이 줄어든다.

## 핵심 시스템 설계 메모
### 시간/날짜 (DateContext)
- 입력: `Date.now()`, 타임존, (선택) 위도경도.
- 출력: `{ hour, phase: dawn|day|dusk|night, season, solarTerm?, holiday?, moonPhase, weather? }`
- 월령: 간단한 synodic month 계산(29.53일) — 정확도 1일 이내면 충분.
- 음력 기념일(설/추석): `korean-lunar-calendar` 류 라이브러리 사용 또는 2026~2036 테이블 하드코딩(의존성 0, 추천).
- 날씨: Open-Meteo (`https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current=weather_code`). 1시간 캐시. 실패 시 무시.
- 테스트: 고정 Date 주입으로 계절·시간대 경계값 전부 단위테스트.

### 방치(오프라인) 진행
- 마지막 저장 시각과 현재 시각의 차를 **도메인 시뮬레이션의 축약 계산**으로 처리(틱을 실제로 돌리지 않음). 상한 8시간.
- 복귀 연출: 너구리가 모은 자원을 들고 집에서 나오는 애니메이션. 숫자 팝업 금지(기둥 1).

### 스프라이트 파이프
- 베이스 너구리: 1벌(idle, walk, sit, sleep, shake, interact ×2) 좌우 플립.
- 팔레트 스왑: 셰이더(WebGL) 1개로 원본 팔레트 → 타깃 팔레트 매핑. 무늬 변형은 별도 오버레이 레이어.
- 스킨: 프레임별 앵커 JSON(`anchors.json`)으로 위치. Aseprite 태그 → 내보내기 스크립트.
- 렌더 비용: 너구리 30마리 + 파티클에서도 모바일 60fps, 월페이퍼 30fps 캡.

### 오디오 (ASMR 믹서)
- 레이어: `ambience`(계절·시간·날씨), `interaction`(발걸음, 잎사귀, 물), `music`(선택, 기본 OFF, 로파이 피아노)
- 모든 SFX는 -18 LUFS 이하 정규화, 어택 완만. 갑작스러운 소리 금지(기둥 4).
- 브라우저 자동재생 정책: 첫 사용자 제스처 후 `AudioContext.resume()`. 월페이퍼 모드는 "🔈 소리 켜기" 버튼 하나만 보여주고 클릭 후 사라짐.
- 모바일 백그라운드: 앱이 백그라운드면 오디오 정지(배터리).

### 저장/동기화
- 로컬: IndexedDB(웹) / Capacitor Preferences(모바일)에 `VillageSnapshot` JSON. 버전 필드 + 마이그레이션.
- 클라우드: 로그인(익명 → 이메일/Apple/Google 연결) 후 Supabase `villages` 테이블에 스냅샷 upsert. 마지막 수정 시각 기준 충돌 해결(LWW), 충돌 시 더 많은 "마음"을 가진 쪽 우선.
- 월페이퍼 `/w/:publicId`: RLS로 공개 읽기 허용 컬럼만 노출(이름·스냅샷). 이메일 등 개인정보는 컬럼 분리.

### 방문/환승역 (Supabase)
- `visits(from_village, to_village, raccoon_params, gift, created_at)`: 비동기 방문 기록.
- 실시간 환승역: `realtime.presence` 채널 `station:<region>` 에 너구리 파라미터만 브로드캐스트. 위치는 클라이언트 보간.
- 방명록: `guestbook(village_id, phrase_id)` — 자유 텍스트 없음.

### 성능/저전력 목표
| 모드 | 목표 |
|---|---|
| 모바일 플레이 | 60fps, 첫 로드 3초(4G), 번들 < 5MB(오디오 제외, 오디오는 지연 로드) |
| PC 월페이퍼 | 30fps 캡, 탭 비활성 시 0fps, CPU < 5% (M1 기준 체감), 메모리 < 200MB |

## 보안/개인정보
- 위치 권한은 날씨 기능 켤 때만 요청, 좌표는 소수점 1자리로 반올림해 서버에 저장하지 않음(클라이언트에서만 사용).
- 미성년 사용자 고려: 자유 채팅 없음, 방명록 선택식.
- 앱스토어 개인정보 라벨 작성 항목을 09 로드맵 M5에 포함.

## 대안 경로 (결정이 바뀔 경우)
- **Godot 선택 시**: GDScript, 도메인 로직은 `Resource` + 순수 클래스로 분리해 GUT로 테스트. 월페이퍼는 Godot 웹 내보내기 대신 "정적 스냅샷 + 가벼운 Canvas 뷰어"를 별도 제작(이중 구현 비용 발생). SpriteCook 플러그인에 Godot 전용 스킬이 있어 에셋 반입은 편하다.
- **Unity 선택 시**: 공식 Unity Claude Code 플러그인(`2d-pixel-perfect`, `sprite-editor`, `optimize-web` 등)을 쓴다. 단 월페이퍼는 WebGL 빌드 크기 때문에 품질 타협 필요.
