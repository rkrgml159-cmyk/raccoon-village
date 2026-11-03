# 너구리 마을 (Raccoon Village)

힐링 방치형 생활 시뮬레이션. 디스토피아 이후의 조용한 지구, 너구리 마을. 모바일(Capacitor) + 웹(/play) + PC 월페이퍼(/w/:id).

## 먼저 읽을 것
- `docs/decisions.md` (확정 결정) → `docs/09-roadmap.md` (현재 마일스톤) → 작업 중인 `docs/superpowers/plans/*.md`
- 설계 상세: `docs/03-gameplay-design.md`, `docs/04-tech-architecture.md`. 톤/금지 목록: `docs/02-story-worldbuilding.md`

## 스택
Phaser 4 · TypeScript · Vite · Vitest · Playwright · Capacitor · Supabase · Cloudflare Pages

## 절대 규칙
- `src/domain/**`은 Phaser를 import하지 않는다. 순수 TS, TDD(RED→GREEN→REFACTOR), 커버리지 90%+.
- 렌더 변경은 `tests/capture` 스크린샷 비교로 검증한다. 에셋 파일(이미지/오디오)은 읽지 않는다. 메타 JSON만 다룬다.
- 대사/텍스트는 `data/dialogue/*.json`에만. 코드에 한국어 문자열 하드코딩 금지.
- 소리: 갑작스러운 효과음·알림음 금지. 모든 오디오 -18 LUFS, 페이드 200ms+.
- 자유 텍스트 입력은 닉네임(8자, 금칙어 필터) 하나뿐. 방명록은 선택식 문구. 마을 이름은 "<닉네임>의 디스토피아". 비밀값은 `.env`만, 커밋 금지.
- 완료 선언 전 `npm test && npm run build` 실제 실행 결과를 보고한다.

## 워크플로
- 새 기능: superpowers `brainstorming` → `writing-plans` → `subagent-driven-development`. 산출물은 `docs/superpowers/{specs,plans}/`.
- 버그: `systematic-debugging`. 마일스톤 종료: `/code-review high`, `/security-review`.
- Workflow 도구는 병렬 리뷰·대사 배치 생성에만(`docs/06-dev-workflow.md`).
- 모델 배분: 설계/리뷰 Opus, 보일러플레이트/테스트 Sonnet 서브에이전트.

## 명령
```
npm run dev          # /play
npm run dev:wall     # /w/demo (월페이퍼 모드)
npm test             # vitest
npm run e2e          # playwright smoke (mobile-portrait, desktop, wallpaper)
npm run capture      # 데브로그용 스크린샷/타임랩스
npm run cap:ios / cap:android
```

## 톤
설명하지 않고 보여준다. 너구리는 인간을 모른다. 숫자 팝업 대신 연출. 랭킹 없음.
