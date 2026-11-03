# M2a 월페이퍼 전력 측정

- 실행 시각: 2026-11-03T14:20:05.395Z
- Chromium: 153.0.8010.12
- 환경: headless Chromium, software GL likely. WebGL renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver); UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.12 Safari/537.36
- hidden 구간은 `document.hidden`/`visibilityState`를 덮어써 에뮬레이트한 것이며 실제 브라우저 스로틀링이 아니다.
- 파라미터: minutes=10, interval=30s, samples=20, hidden samples=4 (index 8..11), viewport=1280x720, url=/raccoon-village/w/?speed=1&seed=1&n=30
- 주민 수: n=30

| time(s) | segment | cpu_s_per_30s | heap_mb |
| ---: | --- | ---: | ---: |
| 30 | active | 26.264 | 8.9 |
| 60 | active | 26.477 | 8.5 |
| 90 | active | 26.808 | 8.6 |
| 120 | active | 26.371 | 8.5 |
| 150 | active | 26.611 | 8.7 |
| 180 | active | 26.670 | 8.7 |
| 210 | active | 26.340 | 8.9 |
| 240 | active | 26.256 | 8.7 |
| 270 | hidden | 0.090 | 6.7 |
| 300 | hidden | 0.001 | 6.7 |
| 330 | hidden | 0.000 | 6.7 |
| 360 | hidden | 0.001 | 6.7 |
| 390 | active | 26.413 | 7.4 |
| 420 | active | 26.204 | 7.6 |
| 450 | active | 26.191 | 7.5 |
| 480 | active | 26.427 | 7.3 |
| 510 | active | 26.320 | 7.5 |
| 540 | active | 26.392 | 7.4 |
| 570 | active | 26.035 | 7.1 |
| 600 | active | 26.427 | 7.1 |

## 요약

- active mean: 26.388 cpu_s/30s
- hidden mean: 0.023 cpu_s/30s
- ratio hidden/active: 0.1%
- first load (goto to __rv.ready): 597 ms
- observed fps over first 10 s (rAF callbacks / 10): 25.6
- threshold (hidden < 10% of active): PASS
- active vs M1 9.684 cpu_s/30s: ratio 2.72 (threshold 2.0) FAIL

## 메모

- 주민 수는 원인이 아니다: n=1 / 12 / 30 모두 active ≈ 25-26 cpu_s/30s (2분 프로파일 런).
- 숲 RenderTexture 3장을 숨기면 active ≈ 8.7 (M1과 동일 수준). 증가분은 headless 소프트웨어 GL의 전면 쿼드 합성 비용이다. 틴트(setTint) 제거는 영향 없음.
- 레이어를 세로로 잘라 RT를 줄여 보았으나 (2.72 -> 2.64) 노이즈 수준이라 반영하지 않았다.
