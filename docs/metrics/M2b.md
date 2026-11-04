# M2b 월페이퍼 전력 측정

- 실행 시각: 2026-11-04T02:53:59.808Z
- Chromium: 153.0.8010.12
- 환경: headless Chromium, software GL likely. WebGL renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver); UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.12 Safari/537.36
- hidden 구간은 `document.hidden`/`visibilityState`를 덮어써 에뮬레이트한 것이며 실제 브라우저 스로틀링이 아니다.
- 파라미터: minutes=10, interval=30s, samples=20, hidden samples=4 (index 8..11), viewport=1280x720, url=/raccoon-village/w/?speed=1&seed=1&n=30
- 주민 수: n=30

| time(s) | segment | cpu_s_per_30s | heap_mb |
| ---: | --- | ---: | ---: |
| 30 | active | 22.320 | 10.8 |
| 60 | active | 21.739 | 10.6 |
| 90 | active | 21.966 | 14.5 |
| 120 | active | 21.402 | 14.5 |
| 150 | active | 20.423 | 10.0 |
| 180 | active | 21.184 | 9.8 |
| 210 | active | 20.099 | 11.3 |
| 240 | active | 20.653 | 8.9 |
| 270 | hidden | 0.041 | 8.5 |
| 300 | hidden | 0.001 | 8.5 |
| 330 | hidden | 0.000 | 8.5 |
| 360 | hidden | 0.001 | 8.5 |
| 390 | active | 20.126 | 10.5 |
| 420 | active | 20.454 | 11.8 |
| 450 | active | 20.236 | 9.7 |
| 480 | active | 20.351 | 11.0 |
| 510 | active | 20.225 | 8.4 |
| 540 | active | 19.777 | 8.6 |
| 570 | active | 19.909 | 10.4 |
| 600 | active | 19.474 | 8.5 |

## 요약

- active mean: 20.646 cpu_s/30s
- hidden mean: 0.011 cpu_s/30s
- ratio hidden/active: 0.1%
- first load (goto to __rv.ready): 596 ms
- observed fps over first 10 s (rAF callbacks / 10): 56.5
- threshold (hidden < 10% of active): PASS
- active vs M2a 21.94 cpu_s/30s: ratio 0.94 (threshold 1.1) PASS

## 듀엣 타임랩스 (n=12, speed=600, 600 s)

- 명령: `npm run capture:timelapse -- --n=12 --speed=600 --seconds=600 --log=duets` (seed=1, at=2026-10-10T05:00)
- 로그: `captures/duet-log.json` (`window.__rv.duetLog` 덤프)

| 듀엣 종류 | 횟수 |
| --- | ---: |
| greet | 44 |
| chat | 24 |
| chase | 7 |
| groom | 5 |
| share | 4 |
| sitTogether | 0 |
| quarrel | 0 |
| makeUp | 0 |
| **합계** | **84** |

- 실시간 분당 듀엣: 84 / 10 = 8.40
- 시뮬레이션 분당 듀엣: 84 / (600 x 600 / 60 = 6000 sim min) = 0.0140
- 8종 중 5종만 발생. 미발생: sitTogether, quarrel, makeUp (시뮬레이션 파라미터는 변경하지 않음).
