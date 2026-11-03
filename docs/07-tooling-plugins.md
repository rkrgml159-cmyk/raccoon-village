# 07. 플러그인 & 스킬 목록 (조사 결과와 설치 판정)

조사 범위: claude.ai 플러그인 카탈로그(Anthropic Directory) 검색 + GitHub 공개 스킬 검색 (2026-11-03 기준).
판정: **필수** = 바로 설치 / **선택** = 특정 마일스톤에서 / **제외** = 이 프로젝트와 안 맞음.
현재 계정에 활성화된 플러그인은 없음(ListPlugins 결과 0건) → 아래가 전부 신규 설치.

## A. 개발 방법론
| 플러그인 | 출처 | 판정 | 용도 |
|---|---|---|---|
| **Superpowers** (obra, v6.4.x, MIT) | Anthropic Directory / `/plugin install superpowers@claude-plugins-official` | **필수** | brainstorming → writing-plans → subagent-driven-development → TDD → code review. 06 문서 참조 |
| ux-superpowers | Directory | 선택(M0~M1) | 페르소나·유저 저니. 힐링 타깃 검증에 1회 사용 |
| Phase Runner | Directory | 제외 | 슈퍼파워스와 역할 중복 |
| ZSL Superpowers | Directory | 제외 | PRD→이슈→PR 루프. 중복 |
| phaser (Dave Kruse) | Directory | 제외 | 이름만 Phaser이고 게임 엔진과 무관(OpenSpec 기반 반복 워크플로) |
| 내장 `/code-review`, `/security-review`, `/simplify` | Claude Code 기본 | **필수** | 마일스톤 품질 게이트 |
| 내장 Workflow 도구 | Claude Code 기본 | 선택 | 병렬 리뷰·대사 배치 생성만 (06 문서 §Workflow) |

## B. 게임 엔진/아트
| 플러그인 | 출처 | 판정 | 용도 |
|---|---|---|---|
| **SpriteCook** (MCP, 무료 티어 확인 필요) | Directory | **선택→권장(M1~M2)** | 스프라이트·타일셋·UI킷·짧은 애니 초안 생성. Godot 반입 스킬 포함 |
| Unity 공식 플러그인 (Unity Technologies) | Directory | 제외(엔진 미선택) | Unity 선택 시에만: 2d-pixel-perfect, sprite-editor, optimize-web |
| unity-perf | Directory | 제외 | 동상 |
| Phaser 4 아키텍처 스킬 (`weberwang/phaser-skills`, skills.sh) | GitHub/skills.sh | **선택(M1 초기 1회 읽기)** | Phaser 4 프로젝트 구조·Capacitor 어댑터 패턴 참고. 외부 스킬이므로 내용 검토 후 필요한 부분만 CLAUDE.md에 흡수 |
| Adobe MCP (이 환경에 이미 연결) | 세션 내 | **선택(마케팅·무드보드)** | Firefly Boards 무드보드, Express로 인스타 이미지, 이미지 배경 제거·리사이즈 |
| Design (Anthropic 공식) | Directory | 선택 | design-critique, accessibility-review, ux-copy(한국어 UI 문구 검토) |

## C. 마케팅 / 인스타그램
| 도구 | 출처 | 판정 | 용도 |
|---|---|---|---|
| **sergebulaev/instagram-skills** (MIT, 9개 스킬) | GitHub — `npx skills add sergebulaev/instagram-skills` 또는 claude.ai Skills → Add from GitHub | **필수(초안)** | Caption Writer, Carousel Planner, Hook Extractor, Hashtag Strategist, Humanizer, Content Planner, Repurposer, Profile Optimizer, Audience Insights. 발행은 수동 또는 Publora(선택) |
| **moboutrig/instagram-claude-skill** (MIT, Graph API v25) | GitHub — `.claude/skills/instagram/`에 복사 | **필수(발행, M2부터)** | 이미지·릴스·스토리·캐러셀 발행, 인사이트, DM. Meta 개발자 앱 + Business/Creator 계정 필요. 하루 100포스트 제한. 인사이트는 팔로워 100명 이상부터 |
| Jakeschincariol/instagram-agent-skill (13개 ig-* 스킬) | GitHub | 선택 | 릴스·캐러셀·댓글·DM 템플릿. sergebulaev와 겹치므로 둘 중 하나 |
| Social Media Skills (106개) | Directory | 선택 | `instagram-growth`, `reels-script`, `hashtag-strategy`, `behind-the-scenes-and-founder`, `suno`, `ai-music-and-sound` 등. 범위가 넓어 필요할 때만 |
| instagram (채널 플러그인, Graph API) | Directory | 선택(런칭 후) | 댓글·DM 자동 응답 채널. 커뮤니티 커지면 |
| Community & Reddit Marketing | Directory | 선택(런칭 시) | 서브레딧/커뮤니티 규칙 검사 후 게시 판정 — 한국 커뮤니티(디시·루리웹) 홍보 전 규칙 확인용 |
| Posty / Postify / Ayrshare / So-me Studio | Directory | 제외(초기) | 유료 스케줄링 SaaS. 무료 조합(sergebulaev + moboutrig)으로 충분. 다중 플랫폼 확장 시 Ayrshare 재검토 |
| vrajdesai78/instagram-skill | GitHub | 제외 | 비공식 웹 API 사용 → 계정 리스크 |

## D. 이 세션 환경에서 이미 쓸 수 있는 것
- **Playwright** (사전 설치) → 스크린샷 회귀, 데브로그 GIF 캡처 스크립트
- **Adobe Express/Firefly/Acrobat MCP** → 마케팅 이미지, PDF 기획서 변환
- **Notion / Google Drive / Gmail / Calendar MCP** → 콘텐츠 캘린더를 Notion DB로 운영 가능(08 문서)
- 내장 스킬: `dataviz`(분석 리포트), `artifact-design`(웹 아티팩트), `code-review`, `security-review`, `simplify`, `run`

## 설치 순서 (다음 세션)
```bash
# 1. 슈퍼파워스
/plugin install superpowers@claude-plugins-official
# 2. 인스타 초안 스킬 (레포 루트에서)
npx skills add sergebulaev/instagram-skills
# 3. 인스타 발행 스킬 (M2 시점, Meta 앱 준비 후)
git clone https://github.com/moboutrig/instagram-claude-skill /tmp/igs && cp -r /tmp/igs .claude/skills/instagram
# 4. SpriteCook: claude.ai 플러그인 디렉터리에서 활성화 (M1 아트 시작 시)
```
외부 GitHub 스킬은 설치 전 SKILL.md와 스크립트를 한 번 읽고(프롬프트 인젝션·토큰 유출 여부) 쓴다.
