# 너구리 마을 (Raccoon Village) — 기획 문서 인덱스

> 작성일: 2026-11-03 · 세션 목적: 계획 수립 + 문서화 (코드 작성 없음)
> 다음 세션부터는 이 폴더를 게임 레포의 `docs/`로 그대로 옮겨서 사용한다.

## 한 줄 요약
무너진 문명 위에서 너구리·곰·사람이 종족 구분 없이 모여 사는 마을을 키우는 **힐링 방치형 시뮬레이션**. 주인공은 너구리.
핸드폰(iOS/Android) + 컴퓨터(브라우저 URL, 월페이퍼 모드) 동시 지원.

## 문서 목록
| # | 문서 | 내용 |
|---|------|------|
| 01 | [게임 컨셉](01-game-concept.md) | 핵심 기둥, 레퍼런스(거지 키우기/롤러코스터 타이쿤/심즈), 타깃, 플랫폼 |
| 02 | [세계관 & 스토리](02-story-worldbuilding.md) | 디스토피아 배경, "만남의 공간" 설정 오류 해결, 스토리 전달 방식 |
| 03 | [게임플레이 설계](03-gameplay-design.md) | 코어 루프, 너구리 시스템(다양성 해결), 상호작용/언어, 스킨, 아티팩트, 날짜 반영, 놀러가기 |
| 04 | [기술 아키텍처](04-tech-architecture.md) | 엔진 결정(Phaser 4 + TS + Capacitor + Supabase), 월페이퍼 URL, 오디오, 저장/동기화 |
| 05 | [아트 & 오디오 디렉션](05-art-audio-direction.md) | 비주얼 스타일, 너구리 파라메트릭 변형, 에셋 목록, ASMR BGM 계획, 제작 도구 |
| 06 | [개발 워크플로](06-dev-workflow.md) | 슈퍼파워스 적용법, Claude Code Workflow, 토큰 절약 규칙, 레포 구조 |
| 07 | [플러그인 & 스킬 목록](07-tooling-plugins.md) | 조사한 모든 플러그인/스킬과 설치 판정(필수/선택/제외) |
| 08 | [인스타그램 마케팅](08-marketing-instagram.md) | 데브로그 전략, 콘텐츠 기둥, 스킬 파이프라인, 캘린더 |
| 09 | [로드맵](09-roadmap.md) | 마일스톤 M0~M5, 리스크, 완료 기준 |
| 10 | [열린 질문](10-open-questions.md) | 결정 항목 10개 — 2026-11-03 전부 확정 |
| — | [templates/CLAUDE.md](templates/CLAUDE.md) | 게임 레포에 넣을 CLAUDE.md 초안 |

## 이 세션에서 내린 주요 결정 (1·3·4번은 사용자 확정, 캐릭터는 라쿤·변이 허용 확정)
1. **엔진: Phaser 4 + TypeScript + Vite**, 모바일은 **Capacitor**, 백엔드는 **Supabase**. (Unity/Unreal/Godot/Tripo/Blender 비교는 04 문서)
2. **뷰: 2.5D 사이드뷰 디오라마(깊이 레인 3개)**. 아이소메트릭보다 스프라이트 비용이 1/4 이하이고 월페이퍼로 예쁘다.
3. **너구리는 현실 종·현실 색만.** 파라메트릭 변형(종 3 × 털색 6 × 무늬 × 체형 × 성격)으로 다양성 해결. **마을은 종족 구분 없이** 너구리·곰·사람이 같은 자격의 주민으로 산다.
4. **언어: 너굴어("너굴너굴?") 말풍선 + 한국어 속마음(생각 풍선) 하이브리드.** 스토리 진행으로 "번역기" 아티팩트를 얻으면 너굴어가 일부 해석된다.
5. **"만남의 공간" 설정 오류 해결: 모든 마을은 같은 지구의 폐허 도시 안 서로 다른 구역이고, 폐지하철 환승역이 만남의 공간.** 놀러가기 = 터널을 타고 이동. (02 문서)
6. **날짜 데이터: 기기 시계 기반 계절(4계절 + 절기) / 시간대(새벽·낮·노을·밤) / 기념일 이벤트**, 월페이퍼 모드에서는 선택적으로 실제 날씨 API(Open-Meteo, 무료·키 불필요).
7. **워크플로: 슈퍼파워스(brainstorming → writing-plans → subagent-driven-development → TDD → code review)** + 병렬 리뷰에만 Workflow 도구 사용. 토큰 절약 규칙은 06 문서.
8. **마케팅: 인스타 데브로그.** 초안은 `sergebulaev/instagram-skills`(MIT), 발행은 `moboutrig/instagram-claude-skill`(MIT, Meta Graph API) — 둘 다 무료.

## 다음 세션 시작 방법
```
1. 새 레포 생성 (예: raccoon-village) 후 이 docs/ 폴더 복사, templates/CLAUDE.md → 레포 루트 CLAUDE.md
2. /plugin install superpowers@claude-plugins-official
3. 슈퍼파워스 brainstorming 스킬로 M1(프로토타입) 범위 확정 → writing-plans → 실행
```
