# M2a 월페이퍼 전력 측정

- 실행 시각: 2026-11-03T15:41:58.487Z
- Chromium: 153.0.8010.12
- 환경: headless Chromium, software GL likely. WebGL renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver); UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.12 Safari/537.36
- hidden 구간은 `document.hidden`/`visibilityState`를 덮어써 에뮬레이트한 것이며 실제 브라우저 스로틀링이 아니다.
- 파라미터: minutes=10, interval=30s, samples=20, hidden samples=4 (index 8..11), viewport=1280x720, url=/raccoon-village/w/?speed=1&seed=1&n=30
- 주민 수: n=30

| time(s) | segment | cpu_s_per_30s | heap_mb |
| ---: | --- | ---: | ---: |
| 30 | active | 25.086 | 9.2 |
| 60 | active | 24.655 | 11.1 |
| 90 | active | 24.849 | 8.9 |
| 120 | active | 24.554 | 10.3 |
| 150 | active | 24.629 | 8.4 |
| 180 | active | 24.413 | 9.8 |
| 210 | active | 24.383 | 10.8 |
| 240 | active | 24.707 | 8.8 |
| 270 | hidden | 0.073 | 6.7 |
| 300 | hidden | 0.002 | 6.7 |
| 330 | hidden | 0.000 | 6.7 |
| 360 | hidden | 0.001 | 6.7 |
| 390 | active | 24.806 | 7.3 |
| 420 | active | 24.189 | 7.3 |
| 450 | active | 24.788 | 7.2 |
| 480 | active | 24.617 | 7.5 |
| 510 | active | 24.838 | 7.9 |
| 540 | active | 24.465 | 7.3 |
| 570 | active | 24.566 | 7.3 |
| 600 | active | 24.716 | 7.8 |

## 요약

- active mean: 24.641 cpu_s/30s
- hidden mean: 0.019 cpu_s/30s
- ratio hidden/active: 0.1%
- first load (goto to __rv.ready): 614 ms
- observed fps over first 10 s (rAF callbacks / 10): 52.1
- threshold (hidden < 10% of active): PASS
- active vs M1 9.684 cpu_s/30s: ratio 2.54 (threshold 2.0) FAIL
