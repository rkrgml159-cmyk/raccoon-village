# 너구리 마을 (Raccoon Village)

무너진 문명 위에서 너구리·곰·사람이 종족 구분 없이 모여 사는 마을을 키우는 힐링 방치형 시뮬레이션. 주인공은 너구리.
핸드폰(iOS/Android) + 컴퓨터(브라우저 URL, 월페이퍼 모드).

- 기획 문서: [docs/00-README.md](docs/00-README.md)
- 확정 결정 로그: [docs/decisions.md](docs/decisions.md)
- 스택: Phaser 4 · TypeScript · Vite · Capacitor · Supabase (예정)

현재 단계: **M1 배포 완료** (2026-11-03, GitHub Pages). 다음: M2 아트 디렉션(픽셀 너구리 시트 + 이끼 숲·폐허 배경).

## 로컬 실행
```
git clone https://github.com/rkrgml159-cmyk/raccoon-village.git
cd raccoon-village
npm ci
npm run dev        # /play
npm run dev:wall   # /w/ (월페이퍼 모드)
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

## M1 완료 기준
- [x] 공개 URL `/w/`에서 현재 시간대·계절의 하늘과 너구리가 보이고 멍·걷기·앉기를 반복한다 — Pages 배포 성공(main 950e889, run 41633620005 verify+deploy 녹색). 같은 빌드에 대해 CI e2e가 `/w/` 상태 변화(멍→걷기/앉기)를 확인
- [x] 탭 숨김 CPU가 활성 대비 10% 미만 — `docs/metrics/M1.md`: 활성 평균 9.684 cpu_s/30s, 숨김 평균 0.017, 비율 0.2%, PASS (10분 측정)
- [x] `src/domain` 커버리지 90% 이상, CI 녹색 — statements 98.84% · branches 99.03% · functions 100% (임계 90%), 단위 테스트 95 · e2e 8, CI verify 통과
- [x] `?speed=600` 타임랩스 캡처 — `captures/timelapse-2026-10-10T05-00.webm` (857 KB, 20초 테스트 실행, `captures/`는 gitignore라 로컬 산출물. 150초 본 실행은 데브로그 산출물이라 커밋하지 않음)
- [x] 스크린샷 베이스라인 4장 — `tests/capture/baseline/`: `play-desktop.png`, `play-mobile.png`, `wallpaper-desktop.png`, `wallpaper-mobile.png`
