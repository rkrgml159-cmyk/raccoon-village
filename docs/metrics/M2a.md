# M2a 월페이퍼 전력 측정

- 실행 시각: 2026-11-03T15:59:44.388Z
- Chromium: 153.0.8010.12
- 환경: headless Chromium, software GL likely. WebGL renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver); UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.12 Safari/537.36
- hidden 구간은 `document.hidden`/`visibilityState`를 덮어써 에뮬레이트한 것이며 실제 브라우저 스로틀링이 아니다.
- 파라미터: minutes=10, interval=30s, samples=20, hidden samples=4 (index 8..11), viewport=1280x720, url=/raccoon-village/w/?speed=1&seed=1&n=30
- 주민 수: n=30

| time(s) | segment | cpu_s_per_30s | heap_mb |
| ---: | --- | ---: | ---: |
| 30 | active | 21.478 | 10.7 |
| 60 | active | 21.149 | 9.7 |
| 90 | active | 22.100 | 11.1 |
| 120 | active | 21.703 | 9.0 |
| 150 | active | 22.181 | 9.7 |
| 180 | active | 22.360 | 10.5 |
| 210 | active | 22.311 | 11.2 |
| 240 | active | 22.206 | 8.7 |
| 270 | hidden | 0.093 | 6.7 |
| 300 | hidden | 0.002 | 6.7 |
| 330 | hidden | 0.000 | 6.7 |
| 360 | hidden | 0.001 | 6.7 |
| 390 | active | 21.935 | 6.9 |
| 420 | active | 21.550 | 7.3 |
| 450 | active | 21.652 | 7.6 |
| 480 | active | 21.886 | 7.4 |
| 510 | active | 21.614 | 7.9 |
| 540 | active | 22.295 | 8.2 |
| 570 | active | 21.718 | 7.1 |
| 600 | active | 22.902 | 7.2 |

## 요약

- active mean: 21.940 cpu_s/30s
- hidden mean: 0.024 cpu_s/30s
- ratio hidden/active: 0.1%
- first load (goto to __rv.ready): 549 ms
- observed fps over first 10 s (rAF callbacks / 10): 57.0
- threshold (hidden < 10% of active): PASS
- active vs M1 9.684 cpu_s/30s: ratio 2.27 (threshold 2.0) FAIL
