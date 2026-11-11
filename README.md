# 너구리 마을 (Raccoon Village)

무너진 문명 위에서 너구리·곰·사람이 종족 구분 없이 모여 사는 마을을 키우는 힐링 방치형 시뮬레이션. 주인공은 너구리.
핸드폰(iOS/Android) + 컴퓨터(브라우저 URL, 월페이퍼 모드).

- 기획 문서: [docs/00-README.md](docs/00-README.md)
- 확정 결정 로그: [docs/decisions.md](docs/decisions.md)
- 스택: Phaser 4 · TypeScript · Vite · Capacitor · Supabase (예정)

현재 단계: **M2b 마음과 말 구현 완료**(2026-11-11, `feat/m2b-mind-and-speech`, main 병합·배포 전). 주민이 욕구와 성격으로 움직이고, 둘씩 만나 인사·수다·같이 앉기 등 8종 듀엣을 하며 관계가 쌓인다. 말은 종족어·속마음·아이콘 풍선으로만 보인다. 다음: M2c 살림.

## 로컬 실행
```
git clone https://github.com/rkrgml159-cmyk/raccoon-village.git
cd raccoon-village
npm ci
npm run dev        # /play
npm run dev:wall   # /w/ (월페이퍼 모드)
npm run capture:sheet -- --sheet=<종족 id>   # 시트 캡처 (--species=all, --bg=1 16조합, --portrait=1 1080×2400)
```

## 공개 URL
- 플레이: https://rkrgml159-cmyk.github.io/raccoon-village/
- 월페이퍼: https://rkrgml159-cmyk.github.io/raccoon-village/w/

## 쿼리 파라미터
| 파라미터 | 의미 |
|---|---|
| `at` | 기기 시계 대신 지정한 날짜/시각으로 시작 (예: `at=2026-10-10T05:00`) |
| `speed` | 시간 배속, 1~3600 (`speed=600`이면 하루 2.4분) |
| `seed` | 너구리 행동 난수 시드 고정 |
| `still` | `1`이면 애니메이션·하늘 보간 없이 정지 화면 (스크린샷용) |
| `debug` | `1`이면 디버그 텍스트 표시(주민별 욕구·특성, 진행 중 듀엣) |
| `n` | 주민 수, 1~40 (기본 12) |
| `species` | `all`이면 25종 쇼케이스 |
| `sheet` | 종족 id를 주면 그 종족의 26프레임 시트 (예: `sheet=fox`) |
| `duet` | 듀엣 종류(`greet`·`chat`·`sitTogether`·`chase`·`share`·`groom`·`quarrel`·`makeUp`) 또는 `all`. 너구리 두 마리가 그 듀엣의 첫 장면으로 정지(스크린샷용) |

## 조작
- 플레이(`/`): 주민을 탭하면 그 주민의 속마음 한 줄이 뜬다(관계에 따라 끝에 ❤/💧). 그 밖의 행동은 전부 자율.
- 월페이퍼(`/w/`): 입력 없음. 10분마다 랜덤 주민의 속마음이 저절로 뜬다.

## M1 완료 기준
- [x] 공개 URL `/w/`에서 현재 시간대·계절의 하늘과 너구리가 보이고 멍·걷기·앉기를 반복한다 — Pages 배포 성공(main 950e889, run 41633620005 verify+deploy 녹색). 같은 빌드에 대해 CI e2e가 `/w/` 상태 변화(멍→걷기/앉기)를 확인
- [x] 탭 숨김 CPU가 활성 대비 10% 미만 — `docs/metrics/M1.md`: 활성 평균 9.684 cpu_s/30s, 숨김 평균 0.017, 비율 0.2%, PASS (10분 측정)
- [x] `src/domain` 커버리지 90% 이상, CI 녹색 — statements 98.84% · branches 99.03% · functions 100% (임계 90%), 단위 테스트 95 · e2e 8, CI verify 통과
- [x] `?speed=600` 타임랩스 캡처 — `captures/timelapse-2026-10-10T05-00.webm` (857 KB, 20초 테스트 실행, `captures/`는 gitignore라 로컬 산출물. 150초 본 실행은 데브로그 산출물이라 커밋하지 않음)
- [x] 스크린샷 베이스라인 4장 (M2a에서 showcase 1장 추가, 총 5장) — `tests/capture/baseline/`: `play-desktop.png`, `play-mobile.png`, `wallpaper-desktop.png`, `wallpaper-mobile.png`

## M2a 완료 기준
- [x] `?species=all`에서 25종이 서로 다른 실루엣·색으로 보인다 — 쇼케이스 베이스라인 `tests/capture/baseline/showcase-desktop.png`
- [x] 기본 마을(`n=12`) 1시간 방치 시 모든 주민이 멍·걷기·앉기·자기를 하며 화면 이탈이 없고 스폰 시 겹치지 않는다(지나칠 때의 겹침은 M2b 회피 전까지 허용; 세로 화면에서 주민이 많으면 겹칠 수 있음(M2b 회피 전)) — 데스크톱 `play-desktop.png`에서 스폰 겹침 없음 확인
- [x] 이끼 숲·폐허 배경이 4계절×4시간대에서 어색하지 않다 — `npm run capture:sheet -- --bg=1` 16장을 리뷰에서 판정(로컬 산출물)
- [x] 도메인 커버리지 90%+, 데이터 검증 테스트, e2e 녹색 — statements 98.35% · branches 96.65% · functions 100% · lines 99.16%, 단위 253(19파일), e2e 9 통과 + 1 건너뜀(쇼케이스는 desktop 전용)
- [x] 30마리 월페이퍼 전력 PASS — `docs/metrics/M2a.md`: 활성 21.94 cpu_s/30s(M1의 2.27배, 기준 2.5배로 수정 — 메모 참조), 숨김 0.024, 비율 0.1%
- [x] 문서 갱신(02·03·05·09·decisions·CLAUDE.md·README) + Pages 배포 — main 2849529, run 41679182501 verify+deploy 녹색, deployment 7525160071 success

## M2b 완료 기준
- [x] `n=12` 10분 타임랩스에서 8종 듀엣이 전부 1회 이상 — `docs/metrics/M2b.md` 2차: greet 36 · chat 25 · chase 7 · sitTogether 4 · share 3 · quarrel 3 · makeUp 2 · groom 1 (speed 600, seed 1, `captures/duet-log.json`)
- [x] 인사·수다·같이 앉기 연출 — `npm run capture:sheet -- --duet=all` + `--duet=<type>` 8장으로 마주 보기·교대 말풍선·나란히 앉기·등 돌리기 확인(로컬 산출물; 스펙의 `?duet=chat` 베이스라인 추가는 하지 않았다 — 베이스라인은 still 5장 그대로)
- [x] 플레이 모드 탭 → 속마음 1줄, 월페이퍼 10분마다 1회 자동, 화면에 숫자 없음 — e2e `tap shows a thought bubble in play mode`, `wallpaper ignores taps`
- [ ] `thoughts.json` ≥ 240줄(560줄), 금지어 0 — 테스트 통과. **사람 검수 표시는 `docs/dialogue-review.md`에서 대기 중**
- [x] 도메인 커버리지 90%+, 실제 데이터 테스트, e2e 녹색, 72프레임 연결성 — statements 98.56% · branches 96.81% · functions 100% · lines 99.26%, vitest 423(34파일), e2e 14 통과 + 2 건너뜀
- [ ] 전력 PASS + 문서 갱신 + Pages 배포 — 전력 PASS(활성 20.646 cpu_s/30s, M2a 대비 0.94배, 숨김 0.1%), 문서 갱신 완료. 배포는 main 병합 후

