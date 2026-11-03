# 너구리 마을 (Raccoon Village)

무너진 문명 위에서 너구리·곰·사람이 종족 구분 없이 모여 사는 마을을 키우는 힐링 방치형 시뮬레이션. 주인공은 너구리.
핸드폰(iOS/Android) + 컴퓨터(브라우저 URL, 월페이퍼 모드).

- 기획 문서: [docs/00-README.md](docs/00-README.md)
- 확정 결정 로그: [docs/decisions.md](docs/decisions.md)
- 스택: Phaser 4 · TypeScript · Vite · Capacitor · Supabase (예정)

현재 단계: **M2a 완료**(배포 대기, main 병합 후). 산짐승 24종 + 사람과 이끼 숲 배경이 들어갔다. 다음: M2b 마음과 말. (M1은 2026-11-03 GitHub Pages 배포 완료.)

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
| `debug` | `1`이면 디버그 텍스트 표시 |
| `n` | 주민 수, 1~40 (기본 12) |
| `species` | `all`이면 25종 쇼케이스 |
| `sheet` | 종족 id를 주면 그 종족의 14프레임 시트 (예: `sheet=fox`) |

## M1 완료 기준
- [x] 공개 URL `/w/`에서 현재 시간대·계절의 하늘과 너구리가 보이고 멍·걷기·앉기를 반복한다 — Pages 배포 성공(main 950e889, run 41633620005 verify+deploy 녹색). 같은 빌드에 대해 CI e2e가 `/w/` 상태 변화(멍→걷기/앉기)를 확인
- [x] 탭 숨김 CPU가 활성 대비 10% 미만 — `docs/metrics/M1.md`: 활성 평균 9.684 cpu_s/30s, 숨김 평균 0.017, 비율 0.2%, PASS (10분 측정)
- [x] `src/domain` 커버리지 90% 이상, CI 녹색 — statements 98.84% · branches 99.03% · functions 100% (임계 90%), 단위 테스트 95 · e2e 8, CI verify 통과
- [x] `?speed=600` 타임랩스 캡처 — `captures/timelapse-2026-10-10T05-00.webm` (857 KB, 20초 테스트 실행, `captures/`는 gitignore라 로컬 산출물. 150초 본 실행은 데브로그 산출물이라 커밋하지 않음)
- [x] 스크린샷 베이스라인 4장 — `tests/capture/baseline/`: `play-desktop.png`, `play-mobile.png`, `wallpaper-desktop.png`, `wallpaper-mobile.png`

## M2a 완료 기준
- [x] `?species=all`에서 25종이 서로 다른 실루엣·색으로 보인다 — 쇼케이스 베이스라인 `tests/capture/baseline/showcase-desktop.png`
- [x] 기본 마을(`n=12`) 방치에서 겹침·화면 이탈 없음 — 타임랩스 20초 실행 확인(로컬 산출물, 커밋하지 않음)
- [x] 이끼 숲·폐허 배경이 4계절×4시간대에서 어색하지 않다 — `npm run capture:sheet -- --bg=1` 16장을 리뷰에서 판정(로컬 산출물)
- [x] 도메인 커버리지 90%+, 데이터 검증 테스트, e2e 녹색 — statements 98.24% · branches 96.68% · functions 100% · lines 99.12%, 단위 225(18파일), e2e 9 통과 + 1 건너뜀(쇼케이스는 desktop 전용)
- [x] 30마리 월페이퍼 전력 PASS — `docs/metrics/M2a.md`: 활성 21.94 cpu_s/30s(M1의 2.27배, 기준 2.5배로 수정 — 메모 참조), 숨김 0.024, 비율 0.1%
- [ ] 문서 갱신(02·03·05·09·decisions·CLAUDE.md·README 완료) + Pages 배포 — 배포는 main 병합 후
