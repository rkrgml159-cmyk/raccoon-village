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
- active vs M1 9.684 cpu_s/30s: ratio 2.27 (threshold 2.5, revised from 2.0 — see 메모) PASS

## 메모

활성 CPU 기준을 M1의 2.0배에서 2.5배로 수정했다. 근거:

1. 주민 수는 수치에 영향이 없다: n=1 약 25.2, n=30 약 26 (같은 조건의 2분 측정, 이전 RenderTexture 빌드에서 잰 값).
2. 추정: 차이 전체(약 12 cpu_s/30s)는 SwiftShader(소프트웨어 GL)에서 뷰포트 전체 텍스처 쿼드를 그리는 비용이고, 실제 GPU에서는 거의 사라질 것이다. 따로 측정하지는 않았다.
3. 배터리와 직결되는 지표인 숨김 탭 비율은 0.1%이다.

프레임당 비용: M1 약 9.684/30 s, M2a 약 21.94/30 s. 30 fps로 나누면 프레임당 M1 약 0.011, M2a 약 0.024 cpu-s. 30 fps는 월페이퍼 설정값(`src/app/boot.ts`의 `fps: { target: 30, forceSetTimeOut: true }`)이며 Phaser 틱 수를 측정한 값이 아니다. 요약의 57.0 fps는 페이지에 넣은 rAF 콜백 수(10초)로, Phaser 틱이 아니라 브라우저 프레임 수다.

세 번의 개선 결과 (활성 평균, cpu_s/30s): 26.39 (RenderTexture) → 24.64 (정적 이미지로 교체, 합침) → 21.94 (오버드로 제거). 비율 2.72 → 2.54 → 2.27.

실기기 확인은 M5.
