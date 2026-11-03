# 08. 인스타그램 마케팅 — 개발 과정 공개(데브로그)

## 목표
- 런칭 전: 팔로워 1,000명 (인사이트 API는 100명부터 열림), 사전예약/대기 리스트 확보
- 런칭 시: 릴스 1개가 게임 설명을 대신한다(01 성공 기준)
- 톤: 게임과 같다. 조용하고, 자랑하지 않고, 너구리가 주인공. 개발자는 "마을을 돌보는 사람"으로만 등장.

## 계정 세팅 (M1 시작과 동시에)
1. Instagram **Creator 또는 Business** 계정 전환 (Graph API 발행 필수 조건)
2. Facebook 페이지 연결 (Graph API 토큰 발급 경로)
3. Meta for Developers 앱 생성 → Instagram Graph API 제품 추가 → 장기 토큰 발급 → `.env`에 `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID` (레포에 커밋 금지, `.gitignore`)
4. 핸들·프로필: 10-open-questions #5(제목 확정) 이후. 바이오는 `sergebulaev` Profile Optimizer 스킬로 3안 생성 후 선택.

## 콘텐츠 기둥 (5개, 비율)
| 기둥 | 비율 | 형식 | 예시 |
|---|---|---|---|
| 오늘의 너구리 | 30% | 이미지 1장 + 속마음 한 줄 | 랜덤 파라미터 너구리 + "저 큰 돌은 왜 안 움직일까" |
| 마을이 자라는 과정 | 25% | 릴스 15~30초 (Playwright 타임랩스 캡처) | 빈 터 → 숨숨집 → 우물 |
| 소리 | 15% | 릴스(ASMR 녹음 비하인드) | 낙엽 밟기 녹음하는 폰 화면 |
| 만드는 사람 | 15% | 캐러셀(개발 비하인드, Claude와 작업하는 장면 포함) | "오늘 너구리 성격 8종을 정했다" |
| 세계관 단서 | 15% | 이미지/캐러셀 | 아티팩트 도감 한 장, 멈춘 전광판 |

## 주간 캘린더 (주 4회, 과하지 않게)
| 요일 | 콘텐츠 |
|---|---|
| 월 | 오늘의 너구리 |
| 수 | 마을 성장 릴스 또는 소리 릴스 (격주) |
| 금 | 만드는 사람 캐러셀 |
| 일 | 세계관 단서 + 스토리 Q&A(투표 스티커) |
스토리: 매일 1개(개발 화면 캡처 그대로). 릴스 커버·캐러셀 템플릿은 Adobe Express MCP로 1080×1350 고정.

## 스킬 파이프라인 (토큰 최소)
```
[소재 자동 수집]  Playwright 캡처 스크립트 → captures/YYYY-MM-DD/*.png, *.webm (주 1회 배치)
        ↓
[초안]  sergebulaev/instagram-skills: Content Planner(주간) → Caption Writer / Carousel Planner / Hook Extractor → Hashtag Strategist → Humanizer
        ↓  (사람 검수: 톤·금지목록·오타, 5분)
[발행]  moboutrig/instagram-claude-skill: ig_api.py publish-image / publish-reel / publish-carousel  (예약은 M3부터 Edge Function 크론)
        ↓
[측정]  매월 1일: ig_api.py insights → 간단 표(어떤 기둥이 저장·공유 높은지) → 비율 조정
```
- 주간 초안은 **세션 1회, 4포스트 배치**로 처리한다(포스트마다 세션 열지 않음).
- 캡션 한국어 기본 + 마지막 줄 영어 한 문장(해외 유입). 해시태그 10개 이내: #너구리 #힐링게임 #방치형게임 #인디게임개발 #게임개발일지 #indiegame #cozygame #raccoon #devlog #pixelart
- 댓글 응답은 런칭 전까지 수동(진정성). 런칭 후 `instagram` 채널 플러그인 검토.

## 런칭 캠페인 (M5)
- D-30: 사전예약 링크(스토어 사전등록 + 월페이퍼 URL 체험판 공개 — 체험판은 로그인 없는 데모 마을)
- D-14: "너구리 이름 지어주기" 참여형 투표 → 당첨 이름은 게임 기본 이름 풀에 수록
- D-7: 릴스 트레일러 30초 (ASMR 그대로, 내레이션 없음)
- D-Day: 월페이퍼 URL + 스토어 링크. 커뮤니티 홍보 전 Community & Reddit Marketing 플러그인으로 각 커뮤니티 규칙 검사.

## 측정 지표
저장수 > 공유수 > 댓글 > 좋아요 순으로 본다(힐링 콘텐츠는 저장이 핵심). 월 1회 08 문서 하단에 수치와 조정 사항 기록.

## 지표 기록
| 월 | 팔로워 | 상위 기둥 | 조정 |
|---|---|---|---|
| (기록 시작) | | | |
