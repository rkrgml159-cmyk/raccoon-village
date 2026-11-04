# 속마음 대사 검수 목록

M2b에서 주민이 말풍선으로 띄우는 속마음 대사(`data/dialogue/thoughts.json`)의 생성 기록과 사람 검수용 체크리스트다.

## 규칙 요약

- 한 줄 22자 이하, 마침표는 줄당 1개 이하.
- 숫자와 이모지 금지.
- 금지어는 `data/dialogue/forbidden.json`(부분 문자열 일치)로 거른다. 과하게 넓던 "총", "핵"은 "총알/총소리/총을", "핵폭/핵전/방사능"으로 좁혔고 "죽는", "죽을", "위협", "변이"를 더했다.
- 중복 줄 금지. 검증은 `validateThoughts`가 로드 시점과 테스트에서 강제한다.
- 톤: 담담한 혼잣말, 존댓말 없음, 옛 세계 그리움·종족 우열 없음 (`docs/02-story-worldbuilding.md`).

## 생성 기록

- Workflow run id `wf_eb98c8d4-25b`, 2026-11-04, 일회성 실행(사용자 승인).
- 구성: sonnet 초안 8명(특성별) + 스크립트 규칙 필터 + opus 톤 검수 1명.
- 결과: 528줄 초안 -> 규칙 필터 자동 탈락 0 -> 톤 검수 탈락 31 -> 497줄 채택.
- 병합: `npx tsx scripts/merge-thoughts.ts <batch.json>`. 기존 시드 63줄 유지, 497줄 추가, 스크립트 단계 스킵 0줄, 마침표 보정 61줄(끝이 글자로 끝나고 22자 이하인 줄에 "." 추가). 최종 560줄.

## 상황별 줄 수 (병합 후)

| 상황 | 전체 | 그중 trait=any |
| --- | --- | --- |
| hungry | 19 | 2 |
| sleepy | 18 | 2 |
| bored | 19 | 2 |
| lonely | 19 | 2 |
| afterGreet | 18 | 2 |
| afterChat | 16 | 2 |
| afterSit | 18 | 2 |
| afterChase | 18 | 2 |
| afterShare | 18 | 2 |
| afterGroom | 18 | 2 |
| afterQuarrel | 17 | 2 |
| afterMakeUp | 16 | 2 |
| bestie | 18 | 2 |
| friend | 17 | 2 |
| awkward | 18 | 2 |
| dawn | 19 | 2 |
| day | 20 | 2 |
| dusk | 18 | 2 |
| night | 22 | 2 |
| spring | 17 | 2 |
| summer | 19 | 2 |
| autumn | 21 | 2 |
| winter | 20 | 2 |
| forest | 21 | 2 |
| ruin | 22 | 4 |
| moon | 19 | 2 |
| rain | 19 | 3 |
| idleLong | 18 | 2 |
| walkFar | 18 | 2 |
| sleepWake | 20 | 2 |

## 특성별 줄 수 (병합 후)

| 특성 | 줄 수 |
| --- | --- |
| any | 63 |
| calm | 62 |
| curious | 61 |
| timid | 65 |
| glutton | 59 |
| chatty | 64 |
| dreamer | 63 |
| tidy | 61 |
| nightowl | 62 |

## 종 태그별 줄 수 (병합 후)

| 종 | 줄 수 |
| --- | --- |
| any | 525 |
| black-bear | 4 |
| carrion-crow | 1 |
| eagle-owl | 4 |
| hare | 2 |
| hedgehog | 4 |
| human | 6 |
| magpie | 1 |
| mole | 2 |
| otter | 7 |
| raccoon | 1 |
| red-squirrel | 2 |
| woodpecker | 1 |

## 톤 검수 탈락 예시 (31건 중 10건)

| 상황/특성/종 | 줄 | 사유 |
| --- | --- | --- |
| hungry/calm/any | 열매가 익기를 기다린다. | 시드 '열매는 언제 익을까.'와 사실상 같은 내용 |
| awkward/calm/any | 서먹해도 서둘지 않는다. | '서먹하다'로 상황(awkward)을 이름 붙여 말하는 설명조 |
| afterChase/curious/otter | 물가 돌 밑에 뭐가 있을까. | 술래잡기 뒤(afterChase) 상황이 드러나지 않음 |
| afterQuarrel/timid/any | 큰 소리가 귓속에 남았다. | 다툼 중 고함을 직접 떠올리게 함(큰 소리 금지) |
| night/glutton/any | 어둠 속에서도 코는 열매를 찾는다. | 198번 '코가 먼저 열매를 찾는다.'와 사실상 같음 |
| winter/glutton/red-squirrel | 볼주머니 속 호두를 굴려 본다. | 청설모는 볼주머니가 없음(다람쥐 특징)이라 종 특징이 틀림 |
| sleepWake/chatty/black-bear | 돌담에 기대 하품하며 말을 건다. | 곰 태그인데 반달가슴곰 특징이 전혀 없음 |
| dusk/dreamer/human | 할머니 손 같은 구름이 저문다. | '구름이 저문다'는 어색한 연어이고 할머니와 저묾이 겹쳐 그리움·상실 뉘앙스 |
| hungry/tidy/black-bear | 돌담에 등 비비니 먼지가 인다 | 배고픔(hungry) 상황과 무관함 |
| bored/nightowl/any | 다들 자는 시간이라 조용하다. | 이유를 풀어 말하는 설명조 |

## 검수자(opus) 총평

> 전체적으로 톤은 잘 지켜졌습니다. 옛 세계 그리움이나 무너진 원인, 종족 간 우열, 존댓말은 없고, 시계탑과 표지판 모티프도 담담하게 쓰였습니다. 다만 종 태그 줄이 '돌담'(곰)이나 '할머니'(사람) 같은 소품을 반복할 뿐 종 특징이 비어 있는 경우가 많습니다. '한 발 더', '주머니엔 뭐가 있을까', '일어나자마자 ~부터' 같은 틀이 특성을 넘나들며 되풀이되는 점도 아쉽습니다. tidy 특성 줄(396-461)은 모두 마침표가 빠져 다른 줄·시드와 형식이 다르니 일괄로 맞추는 게 좋겠습니다. species=any 줄의 꼬리·앞발 표현은 사람 주민에게 어색할 수 있다는 점도 함께 적어 둡니다.

## 사람 검수 시 유의점

- species=any 줄에 꼬리, 앞발 같은 표현이 있으면 사람 주민에게 어색할 수 있다.
- "한 발 더", "주머니엔 뭐가 있을까" 같은 틀이 여러 줄에서 되풀이된다. 눈에 띄면 하나만 남기고 줄이거나 바꾼다.
- 종 태그 줄이 돌담(곰), 할머니(사람) 같은 소품에 기대는 경우가 많다. 종 특징이 빈 줄은 다듬거나 삭제한다.
- 시드 줄 본문은 손대지 않았다. 마침표 보정은 배치 줄에만 적용했다.

## 검수 체크리스트

- hungry: 사람 검수: [ ]
- sleepy: 사람 검수: [ ]
- bored: 사람 검수: [ ]
- lonely: 사람 검수: [ ]
- afterGreet: 사람 검수: [ ]
- afterChat: 사람 검수: [ ]
- afterSit: 사람 검수: [ ]
- afterChase: 사람 검수: [ ]
- afterShare: 사람 검수: [ ]
- afterGroom: 사람 검수: [ ]
- afterQuarrel: 사람 검수: [ ]
- afterMakeUp: 사람 검수: [ ]
- bestie: 사람 검수: [ ]
- friend: 사람 검수: [ ]
- awkward: 사람 검수: [ ]
- dawn: 사람 검수: [ ]
- day: 사람 검수: [ ]
- dusk: 사람 검수: [ ]
- night: 사람 검수: [ ]
- spring: 사람 검수: [ ]
- summer: 사람 검수: [ ]
- autumn: 사람 검수: [ ]
- winter: 사람 검수: [ ]
- forest: 사람 검수: [ ]
- ruin: 사람 검수: [ ]
- moon: 사람 검수: [ ]
- rain: 사람 검수: [ ]
- idleLong: 사람 검수: [ ]
- walkFar: 사람 검수: [ ]
- sleepWake: 사람 검수: [ ]

전체 승인: [ ]
