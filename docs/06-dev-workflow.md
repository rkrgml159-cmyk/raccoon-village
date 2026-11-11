# 06. 개발 워크플로 — 슈퍼파워스 + Workflow + 토큰 절약

## 원칙
1. **문서가 진실의 원천.** 매 세션은 `docs/`를 읽고 시작하고, 결정은 `docs/decisions.md`에 한 줄씩 추가한다. 같은 설명을 두 번 하지 않는다.
2. **도메인 로직은 TDD, 렌더는 스크린샷 회귀.** 눈으로 확인하는 작업(가장 비싼 토큰)을 최소화한다.
3. **작은 태스크, 새 컨텍스트.** 슈퍼파워스 `subagent-driven-development`로 태스크마다 서브에이전트를 띄워 메인 컨텍스트를 깨끗하게 유지한다.
4. **품질은 리뷰 게이트로 지킨다.** 태스크 종료마다 `requesting-code-review`, 마일스톤 종료마다 `/code-review high` + `security-review`.

## 슈퍼파워스(obra/superpowers) 적용 흐름
설치: `/plugin install superpowers@claude-plugins-official` (MIT, Claude Code 공식 마켓플레이스)

| 단계 | 스킬 | 이 프로젝트에서의 산출물 |
|---|---|---|
| 1 | `brainstorming` | 기능 1개당 설계 문서 `docs/superpowers/specs/<기능>.md`. 03/04 문서를 입력으로 주면 질문이 줄어 토큰 절약 |
| 2 | `using-git-worktrees` | 기능별 워크트리·브랜치. 테스트 베이스라인 녹색 확인 |
| 3 | `writing-plans` | `docs/superpowers/plans/<기능>.md` — 2~5분 단위 태스크, 파일 경로·검증 명령 포함 |
| 4 | `subagent-driven-development` (기본) / `executing-plans` (작은 변경) | 태스크별 서브에이전트 구현 + 즉시 리뷰 |
| 5 | `test-driven-development` | `src/domain/**`은 예외 없이 RED→GREEN→REFACTOR |
| 6 | `systematic-debugging` | 버그 시 가설→재현→수정. "일단 고쳐보기" 금지 |
| 7 | `verification-before-completion` | "됐습니다" 전에 테스트/빌드 실제 실행 |
| 8 | `finishing-a-development-branch` | PR 생성, 워크트리 정리 |

### 기능 단위 예시 (M1)
```
brainstorm "DateContext: 날짜→계절/시간대/월령/기념일" (입력: docs/03 §날짜, docs/04 §시간)
 → spec → plan(태스크 6개) → 서브에이전트 구현(각 TDD) → 리뷰 → PR
```

## Claude Code Workflow 도구 사용 지침
Workflow(멀티에이전트 오케스트레이션)는 토큰을 많이 쓰므로 **아래 3경우에만** 쓴다. 호출할 때 프롬프트에 "use a workflow"라고 명시한다.
1. **마일스톤 종료 리뷰**: 정확성 / 성능(모바일·월페이퍼) / 접근성 / 세계관 톤(대사 데이터) 4차원 병렬 리뷰 → 각 발견을 검증 에이전트가 재확인 → 확정 목록만 수정.
2. **대사 대량 생성**: 성격 8종 × 상황 30종의 속마음 문장을 성격별 병렬 에이전트로 초안 → 톤 검수 에이전트 → `data/dialogue/*.json`. (사람이 최종 검수)
3. **크로스 플랫폼 스모크**: Playwright로 /play 가로·세로, /w 월페이퍼, 오프라인 복귀 시나리오를 병렬 실행.

**실행 기록 — M2b 속마음 배치(2026-11-04, `wf_eb98c8d4-25b`)**: 특성별 초안 에이전트 8개(sonnet) 병렬 → 스크립트 규칙 필터(길이·숫자·이모지·금지어) → 톤 검수 에이전트 1개(opus). 에이전트 9개, 오류 0, 4.8분. 초안 528줄 → 규칙 거부 0 → 톤 거부 31 → 채택 497줄. `scripts/merge-thoughts.ts`로 시드 63줄에 병합(정렬, 마침표 정규화) → `data/dialogue/thoughts.json` 560줄. 검수 절차와 거부 사례는 `docs/dialogue-review.md`(사람 검수 체크란).

그 외 일반 개발은 슈퍼파워스 서브에이전트로 충분하다(에이전트 10개 이하 가이드라인 준수).

## 토큰 절약 규칙 (품질은 유지)
| 규칙 | 효과 |
|---|---|
| CLAUDE.md는 60줄 이내, 상세는 docs/ 링크 | 매 턴 반복 비용 절감 |
| 큰 파일 전체 읽기 금지 → grep/부분 읽기 | 컨텍스트 폭발 방지 |
| 에셋(이미지·오디오)은 절대 토큰으로 다루지 않음. 파일명·메타 JSON만 | 멀티모달 비용 0 |
| 모델 배분: 설계·리뷰·디버깅 = Opus, 보일러플레이트·테스트 작성·데이터 변환 = Sonnet 서브에이전트, 단순 파일 정리 = Haiku | 비용 1/3~1/5 |
| 스크린샷 확인은 Playwright 자동 캡처 → 변경된 것만 비교(pixelmatch) | 사람/모델 시각 확인 최소화 |
| 세션 시작 시 `docs/decisions.md` + 현재 plan 파일만 읽기 | 재설명 방지 |
| 긴 세션은 기능 단위로 끊고 PR로 마무리 | 컨텍스트 요약 손실 방지 |
| 대사/도감 텍스트는 Workflow로 한 번에 배치 생성 | 반복 호출 방지 |

## 레포 규칙
- 브랜치: `main`(보호), `feat/<기능>`, `fix/<이슈>`
- 커밋: Conventional Commits (`feat(domain): DateContext 계절 계산`)
- PR 템플릿: 변경 요약 / 테스트 명령 / 스크린샷(렌더 변경 시) / docs 갱신 여부
- CI(GitHub Actions): lint → vitest → build → playwright smoke → (main) Cloudflare Pages 배포. 월페이퍼 URL이 항상 최신 main을 가리키게 한다.
- 에셋 원본: Git LFS 또는 별도 private 저장소. 레포에는 내보낸 최적화본만.

## 세션 템플릿 (매 개발 세션 첫 메시지)
```
docs/decisions.md 와 docs/09-roadmap.md 의 현재 마일스톤을 읽고,
다음 기능을 superpowers brainstorming 으로 시작해줘: <기능명>
입력 문서: docs/03-gameplay-design.md §<절>, docs/04-tech-architecture.md §<절>
제약: src/domain 은 Phaser import 금지, TDD, 서브에이전트 구현, 완료 전 verification.
```

## 품질 게이트 (마일스톤마다)
- [ ] vitest 커버리지 `src/domain` ≥ 90%
- [ ] Playwright 스모크 3종(모바일 세로, PC 가로, 월페이퍼) 통과
- [ ] 월페이퍼 1시간 방치 CPU 측정 기록
- [ ] `/code-review high` 결과 중 CONFIRMED 0건
- [ ] `security-review` (Supabase RLS, 개인정보) 통과
- [ ] 대사 톤 검수(02 금지 목록 위반 0건)
