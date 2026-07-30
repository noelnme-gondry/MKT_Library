# PERF MKT LIB — HARNESS (초압축, agent 전용 표기)

표기: `∅`=금지 `!`=필수 `→`=하면 `∵`=이유. 상세=git·PR·`docs/*.md`·`docs/harness-detail.md`. §번호 불변(코드/문서가 참조).

---

## 1. 정체성
앱 퍼포 마케팅 SOP + CSV 운영분석 툴. 타겟=시니어 퍼포 마케터(KR·한글UI). 배포 Railway(main 자동), 도메인 `growthoptplaybook.com`(SEO SSOT=`routeMap.js SITE_URL`+`layout.js`). AdSense `ca-pub-3073450406371629`. repo `noelnme-gondry/MKT_Library`. 데이터=사내민감 → 클라만.

## 2. 절대원칙 ∅깨기
1. v2 only. `v2-migration/`=Next16+React19+Zustand5. 레거시 index.html 삭제됨. 순수수학=`src/utils/*`(골든), UI=components, 상태=store.
2. 클라 100%. 유저CSV=브라우저메모리만. 서버전송·저장 ∅.
3. Supabase service_role key 요청·저장·언급 ∅. anon만.
4. main 직접push ∅. feat브랜치→PR→squash.
5. force push main ∅. `--no-verify` ∅.
6. `git add -A`/`.` ∅ (PR#54 사고). `git status`→변경파일 명시. 외부데이터 먼저 `.gitignore`.
7. 모호결정 임의확정 ∅. 선택지2+ → `AskUserQuestion`.
8. 정직. 동작∅기능·거짓숫자·보안모델 모순카피 ∅. 모르면 "추정 불가".
9. 병렬(Antigravity+CC) → 작업전 `git fetch`+`status`. 리모트 다르면 "pull?" 물음.
10. 전체덮어쓰기·임의포맷 ∅. 타겟 delta만.
11. 외부노출 = KR/EN 동시. UI·카피·CTA·링크·SEO메타·구조화데이터·랜딩·도구흐름 수정 → 같은 작업서 EN도 동등수정+양쪽 검증. EN미지원=`EN_READY_*` 게이트 유지, 반쪽번역 ∅.

## 3. 스택
Next16 AppRouter(Turbopack)·React19·Zustand5·Chart.js4·PapaParse5·gray-matter+marked(블로그MD, server전용).
- CSS: `globals.css` 단일. Obsidian Flux 토큰(`--bg-1`·`--text-muted`) + `body.light-mode` 오버라이드. CSS Modules ∅(토큰 스코핑 불가). Tailwind ∅.
- 테스트 `npm test`(golden,node) / `npm run test:smoke`(jsdom) / `test:all` / `npm run lint`(0 err).
- Supabase 현재 미사용(layout 주석 `TODO(B2B)`). §2.3 불변.

## 4. 아키
4.1 **Path 라우팅**: `app/[[...slug]]/page.js` → `lib/routeMap.js`(slug↔id SSOT) → 컴포넌트. **내부 id(`5-2`) 절대불변**(북마크·수백참조). 표시번호만 바꿀 땐 `displayItemNumber/displayGroupNumber`.
4.2 도구: 5-2 대시보드(8탭) · 5-22 포화도 · 5-3 예산 · 5-4 A/B · 5-23 증분 · 5-6 소재 · 5-18 MMM(3탭) · 5-20 Aha · 5-21 PVM · 9-1 요소 · 9-2 킬러콘텐츠. 전부 free(Pro 삭제됨).
4.3 **CSV 그룹스코프**: `csvGroups{efficiency·creative·experiment·response·aha·content_*}`. `csvData`=활성 미러(`setCurrentRouteId`가 스왑). 효율family(5-2·5-21·5-22·5-3) 공유, 이질 격리. 소비자는 `s.csvData`만 읽음.
4.4 **캐시**: 무거운계산=키(매핑+데이터해시) 캐시. 토글=lookup만, 재계산 ∅.
4.5 인증·Pro 삭제됨(전체무료).

## 5. 컨벤션
JS: `var`∅·`const`기본·`let`재할당만. 순수함수 우선. camelCase, bool=`is/has/can`. 통계=객체로 묶음(`ALLOC_MATH` 등).
CSS: 의미변수만. 인라인style=일회성만.
한/영: UI=한글, 식별자=영어, 주석=한글OK. 외부노출은 §2.11.
Chart.js: `responsive+maintainAspectRatio:false` !, 부모 `.chart-container`, 색=`CHART_THEME`/`getCssVar` (하드코딩hex ∅), 재렌더전 destroy, PNG=배경 깔고 export.

## 6. 워크플로
1) 모호→물음. 2) `git fetch origin main`+`status` → 최신main 위 **단명브랜치**(장수feat 재사용 ∅). 3) 검증 `npm run test:all`+`lint`(+`next build`). **preview 스크린샷 육안검증 생략** — Gondry 직접확인이 빠름. 콘솔에러 재현 디버깅만 preview 허용. 4) `git add <명시파일>`+커밋(1행요약≤50자+사유본문+`Co-Authored-By:`). 5) push→PR(`## Summary`+`## Test plan`). 6) squash merge→브랜치삭제.
충돌: 장수브랜치는 보통 main superset이나 **맹목 `--ours` ∅** — `git diff origin/main`으로 진짜 divergent(같은라인 다른값) 확인 후 판단. 마커 남긴 커밋 ∅.

## 7. 트리아지 + 함정
**5단계**: 증상(스샷·콘솔) → 재현(scratchpad Node로 실CSV+의심함수) → 근본원인(edge: 윤년/0/NaN/빈배열/타입) → 방어코드+진단패널 → 테스트 재실행.

**함정 목록** (전체상세=`docs/harness-detail.md`):
- 윤년 `dayOfYear` 1~366 → 배열 367.
- CSV콤마 `"2,488"` → PapaParse(직접split ∅), dynamicTyping ∅ → 전부 문자열, `parseFloat`.
- 차트 transparent→PNG: 배경 합성 후 export.
- localStorage 영속 ∅(요청시만). 새로고침 리셋 기본.
- 큰파라미터 Beta PDF → underflow → log-space 후 max빼고 exp.
- **CSV다운 = CRLF + BOM + `text/csv;charset=utf-8`**. `\n`만 → Excel 한행 뭉침. 콤마=따옴표이스케이프. 날짜컬럼은 `parseFloat`가 연도만 뽑으니 원본라벨 별도보존.
- 공유CSS클래스+전역핸들러 = cross-page 점프. 신규핸들러는 페이지전용 `data-*` 스코프.
- 페이지 제거 = renderer+등록 통째삭제(죽은코드가 버그불씨).
- `const x = f(()=>...x...)` 자기참조 = TDZ throw. 단락(`&&`)으로 안도는 기본경로는 멀쩡 → **전 상태값(전채널·전토글)으로 repro** 해야 잡힘.
- innerHTML 인라인`<script>` 실행∅ → 핸들러서 직접 호출.
- Chart.js v4 커스텀 `generateLabels`는 `fontColor` 자동주입∅ → 다크서 범례 실종. 명시 !. 부호색쌍은 명도차 크게.
- `position:fixed`도 `backdrop-filter` 조상 안이면 viewport기준 ∅ → body portal + `getBoundingClientRect`.
- 단계별 독립분해 = grain별 부분합 비정합 → **최소grain 1회 분해 후 rollup**.
- 계층 드릴다운 단일키 그룹핑 = 상위 over-merge → 복합키(`ch│cmp│cr`).
- 살아있는CSV수식: centering은 finest에서만 성립(rollup은 children합). 셀수식 콤마(SUMIFS) → 컬럼분리 깨짐 → `+`합.
- 공용 `td{vertical-align:top}`은 `<th>`에 ∅ → 명시.
- 게이트 `requiresAny` 키는 정규키와 정확일치(단/복수) — 틀리면 silent 영구잠김. 복붙 !.
- **자동매핑·드롭다운은 도구별 필드로 스코프**. `cost`(효율)≠`spend`(creative) 별도키.
- `type="number"` 천단위콤마 ∅ → `type=text inputmode=numeric` + blur재포맷 + **모든 read서 콤마strip**. 하나라도 빠지면 분배0. NaN가드는 `==null`.
- 모델래퍼는 `.model.predict`지 `.predict` ∅ → `predictSafeCpr(wrap,cost)`. 직접호출 시 결과 전부0.
- 지표토글 추가 = 표+**차트 y변환·축라벨·캡션단위** 전부 분기.
- `<thead>` 없는표 = 헤더 center/셀 left 어긋남 → 명시 `text-align`(숫자=right).
- **FWL within-transform: 절편은 demean ∅, 제거 !**. 안하면 X'X 특이 → 전분석 n=0.
- **Gauss-Jordan inverse 절대pivot임계로 rank결손 못잡음** → `I·M≈단위` 검증(`maxErr>1e-6`→null→"추정불가").
- shift-share "비중"=**결과량 share**지 비용 ∅ → 라벨 "결과 비중" 명시(오독=신뢰붕괴).
- 차트데이터 `Math.round` ∅ (작은 ARPU 0으로 뭉갬) → 표시층서 자릿수 적응.
- 리텐션 = **모수가중**(`computeWeightedRetention`). 행별단순평균 ∅. 컬럼 max≤1→비율, 초과→인원수.
- Chart.js에 CSS `var(--x)` 리터럴 전달 ∅ (canvas가 못읽어 검정폴백) → `getCssVar()`.
- **조건부마운트 캔버스 = 최초 width 0** → `new Chart` 직후 `rAF(()=>resize())` 1회 !.
- preview 스샷은 초장문페이지서 아티팩트(빈화면) — 스샷 하나로 "깨졌다" 판정 ∅.
- 무거운 compute를 `useMemo(deps:매핑)`에 ∅ (10~20만행 멈춤) → **분석하기 게이트 뒤로만** + 순수함수 추출 + 더블rAF 디퍼(스피너 먼저 페인트). 파싱은 `Papa{worker:true}`.
- **필터 옵션생성 ↔ 비교의 trim 불일치 = "선택해도 0행"** → 양쪽 정규화 통일.
- 값으로 매핑하는 필드(source=광고/오가닉)는 `valueVocabulary`(헤더점수 무시, 값어휘≥0.6만).
- v2 SPA 소프트내비는 GA4 page_view 자동전송 ∅ → `GaPageviews.jsx`(usePathname). GTM 이중태깅 주의.

## 8. 통계 엄밀성
1) 순수함수 객체로 분리. 2) 합성데이터 유닛테스트 !. 3) **`Math.random` 절대∅**(결정론, byte-identical). 샘플=`seededNoise`. 4) 95% CI 자동표시. 5) 통계지식 없이 읽히게(색: 빨강부정/초록긍정/회색무유의) + `💡 쉽게 말하면` 평어. 6) **입증책임 비대칭**: "효과없음" 단정엔 강한증거, 모호=INCONCLUSIVE. 공선으로 추정≈0 = *증거없음*이지 *효과없음* ∅. 7) 한계효용=running max 단조보정. 8) shift-share mix는 **전체평균 대비 centering** `(cpāᵢ−C̄)·Δsᵢ` (합 항등식 불변+부호 해석가능).

## 9. 유저(Gondry) 패턴
선택지+트레이드오프 제시 선호("몇 줄?"이 결정에 영향). 데이터양 기반 자동추천. 즉시 시각피드백(무거우면 캐시요구). 최근성 우선정렬. 검증가능성 중시(재현 CSV export·console). 해석까지(차트로 안 끝남). 목표우선(CPI/CPA/ROAS 먼저). 메타-도구 사고(하네스 self-update 요구). 통계입력 보조(붙여넣기→자동계산). 결론-우선+평어, **절대인원 병기**("몇%"보다 "몇 명"). 정직성(공선이면 분해거부+대안). cohort-window 지표를 캘린더분석에 섞지 말 것. 비용큰 작업=`docs/*.md` 자체완결 스펙 먼저.

## 10. 응답
한글 기본(식별자 영어). 표 우선, 체크박스, 이모지 절제(✓ ❌ ⚠ ★), 코드는 `파일:줄`. PR머지후 자동제시: 배포시간(1~2분)·새화면·테스트법·다음옵션.

## 11. 안티패턴
∅ 새 라이브러리 무단추가 · 유저데이터 서버전송 · service_role 언급 · main직접push/`--no-verify`/force · 테스트 안돌리고 커밋 · `git add -A` · 모호결정 임의확정 · 요청외 기능 임의추가 · 한글응답을 영어로 · `Math.random`.

## 12. 레시피 (상세=`docs/*.md`·PR)
- **12.1 새도구**: `IA`추가 → required/optional 필드 → 컴포넌트 → routeMap slug → 게이트 → toolGuide → 골든+스모크.
- **12.2 새통계함수**: `*Math.js` 순수 export → 골든 테스트 1개+ → 통과후 커밋.
- **12.3 차트**: `.chart-container`>canvas → `chartCommonOpts()`+`CHART_THEME` → destroy후 생성 → rAF resize.
- **12.4 토글**: 캐시 사전계산 → lookup + `chart.update("none")`. full 재렌더 ∅.
- **12.5 분석게이트**: 매핑시그(`analyzedSig`)로 "▶분석하기" 후에만 결과. 시그=**매핑만**(토글 제외). 렌더층 전용→골든 불변.
- **12.6** 표시번호↔라우팅id 분리(§4.1).
- **12.7** 탭형 통합: 흡수도구=섹션함수화(게이트/셸 제거), host가 탭 상태보유, 구 id는 redirect.
- **12.8 데모**: fileName `demo_`. 실스냅샷 미접근·저장 no-op. 데이터=`seededNoise`. 데모 자동로드는 **광고게이트 없이 직접**.
- **12.9 5-18 MMM**: ①진단(카니발·추세·그랜저·변화점) ②기여분해(adstock·saturation) ③회귀+예측. **한 CSV+shared `mmmColMap`**(③이 별도업로드로 우회하던 버그 제거). 예측=`mmmForecast` 단일엔진(범용회귀는 trend·계절 없어 평평 → 제거). 밴드=**과거잔차 참고범위**지 예측CI ∅. 회귀=연관, 인과 ∅. 공선컬럼=`_nonRedundantCols`(Gram-Schmidt) 드롭. `buildPanelFromColMap` 타깃=**플랫폼 합산**(pick ∅). 패널라벨은 `dateLabel`+`dates`+`granularity` 세팅 !(안하면 x축이 t인덱스).
- **12.10 5-21 PVM**: 최소grain 1회 Bennet → rollup으로 §2→§3→§4 항등식. centering mix. §4 복합keyFn.
- **12.11** 셸: ⌘K 팔레트(전역), 랜딩. 전부 렌더층.
- **12.12 Forest plot**: `bar+indexAxis:y` floating(`[lo,hi]`) + `scatter` 점 overlay. 높이 `n*26+80`.
- **12.13 VOC**: 사이드바 상시 + 분석후 넛지(세션1회, 메모리플래그). `target=_blank rel=noopener`.
- **12.14 5-3 결론UX**: §0 진단(최악·기회·집중도 `topShare≥0.5 && ≥1.5/n`) 평어+절대값. eff 통일(ROAS=`1/ROAS`). 효율차<1.2면 억지처방 ∅ "재배분 여지 작음". §5 검증스트립(모드별 정합). 국가 단일강제(cross-grain 혼입방지). 라이브콤마(`input`=포맷만, 재계산은 `change`). de-jargon(우하향→"효율 거꾸로", ∩→"증액시 빗나감").
- **12.15 회귀⊕예측**: 변환은 **hist+future 결합 1회 후 슬라이스**(adstock 이월·스케일 일관). OS별 분리 기본.
- **12.16 5-22 포화도**: 5-3 곡선엔진 재사용(신규곡선 구현 ∅). 포화지수=한계CPA÷평균CPA(>1=다음1원이 평균보다 나쁨). 한계=현지출점 +10% finite-diff. **공유데모는 실신호 부여 !**(노이즈 크면 곡률 덮임).
- **12.17 쉬운말 우선**: 쉬운말 먼저 + 전문용어 괄호 뒤(`영향력 (β)`). 역순 ∅. 좁은곳=약어+`title`. 긴 방법론=`<details>` 접기.
- **12.18 전역 분모토글**(5-2): `installs|actions` 1토글로 CPI/CPA·CVR·ARPU·리텐션·LTV·퍼널 동시전환. 미매핑 자동폴백. 퍼널 절대값=로그스케일.
- **12.19 데이터×기능 연결표**: required/optional에서 **자동생성**(하드코딩표 ∅, 표류방지). 템플릿CSV=헤더만(BOM+CRLF).
- **12.20 v2 이관 패턴**: 엔진=verbatim+`export`만(수학불변, 골든이 오라클 — tolerance완화·엔진수정 0이면 충실). `getMappedRows`서 **cost↔spend 양쪽 채움**. mock·`Math.random` 전량제거, 컬럼부족=정직 빈상태. IA라벨↔라우트 정합 !.
- **12.21 디자인시스템**(SSOT `docs/design-system-baseline.md`): 신규도구 !: ①포맷=`utils/format.js` ②통화=전역 `store.displayCurrency`(도구별 통화state ∅) ③표=`ds/DataTable` ④업로드=`toolGuide.js`+`ds/CsvGuide` ⑤차트=`chartCommonOpts`+`CHART_THEME` ⑥엔진=순수`*Math.js`+골든.
- **12.22 5-23 증분**: 3방법(통제군 `INCR_MATH` / 신규켜기on / 종료off — ②③은 부호만 다른 한 엔진 `incrPrePostMath`). CSV그룹 독립. **무작위/DiD 아니면 인과단정 ∅**.
- **12.23 콘텐츠 9-x**: 엔진 수학불변·**라벨만 스왑**. SSOT=`utils/contentDomain.js`, `domain` prop 주입(복제 ∅). 실제 CSV필드명·매핑키는 불변(라벨만). **9-4 CMM 드롭 — 재시도 ∅**(MMM은 금액×수확체감 전제, 콘텐츠 편수=카운트라 근본불일치). 교훈: 리라벨 전 **엔진 스케일가정(금액 vs 카운트) 검증 !**. 도메인에 없는 지표는 라벨날조 ∅ → 매핑게이트로 정직제외. 탭 서브셋 노출시 공유 전역탭이 허용셋 밖이면 기본탭 강제.
- **12.24 블로그/용어사전**: `routeMap` **밖**, fs MD가 SSOT. 발행=`content/blog/<slug>.md` 추가. **EN 짝파일 필수**(`blog-en`·`glossary-en`). frontmatter: title≤40·description≤80·date·slug·keywords(콤마문자열)·tags(배열)·draft·ogImage. `_`프리픽스·`draft:true`=미발행. 통합(consolidation)=**6곳 동시**: 파일add/삭제 → `next.config.mjs` 301(ko·en 각각) → **레지스트리3종**(`contentToolRegistry`·`blogSeo`·`localizedHref`, `contentRegistry.test.js`가 강제) → 죽은 relatedPosts 재지정. 내부링크=KR 상대경로만(렌더러가 EN접두). `lib/blog.js`=**server전용**.
- **12.25 세그먼트 필터**: 매핑 role=segment → 값별 부분집합 재계산. **엔진·게이트 불변**, 세그먼트는 탐색이라 게이트시그 **밖**. `guessRole` 화이트리스트(오탐방지). 잔상방지=`validSeg`/파생값.
- **12.26 광고 인터스티셜**: `adGate`(휘발)+`requestAd(cb)`/`closeAd`. `adFree`=persist. 배선=분석버튼 `requestAd(()=>기존)`. 함정: persistPartialize 키추가시 `useDataStore.test.js` 골든키 갱신 !, 버튼누르는 스모크는 `adFree:true` seed. **정책**: 강제게이팅은 AdSense 위반소지(회색지대) — 계정리스크 사용자에 명시.
- **12.27 결론카드+다운로드허브**: `ds/ResultActionCard`(Decision Tape: 결론·근거·다음행동·연결분석) 결과 최상단 항상. `ds/DownloadHub`(단일 드롭다운). 실다운=`utils/download.js`(BOM+CRLF). **판정로직은 도구별 렌더유틸**(공용은 셸뿐) — WoW는 5-2류 시계열 전용. **다운로드는 "계산한 인사이트"만 — 업로드 원본 되돌려주기 ∅**(무가치). 미매핑지표 제외(정직). 채택: 5-2✅ 5-23✅ → 5-22→5-20→5-6→5-21→5-18. EN=`tr` !.
- **12.28 랜딩/홈**: `LandingHome`=히어로+CTA2(내데이터`/start`·데모)+`ProductPreview`(로테이션)+`ToolCarousel`(드래그, scroll-snap ∅ ∵뚝뚝)+블로그|SOP 허브. **전 페이지 공용셸 !**(Sidebar+Header+GlobalModals). 슬림헤더 재도입 ∅. 무주소 게이트 ∅(뒤로가기 깨짐) → `/guide`·`/start` 실라우트. `/start`=`startMyData()`(데모슬라이스만 비움, 실업로드 보존)+`demoDisabled` 휘발. 데모안내모달=세션1회. 유저수·로고 날조 ∅.

## 13. 참고파일
`v2-migration/ARCHITECTURE.md`=**v2 코드맵(큰작업 전 먼저 읽기)** · `docs/harness-detail.md`=함정·레시피 풀버전 · `docs/backlog.md` · `docs/design-system-baseline.md` · `docs/custom-metrics-data-config-spec.md` · `v2-migration/claude-ux.md`(§15.5) · `.claude/agents/mkt-engineer.md`(압축판, 같이 동기화).

## 14. PR 전 체크
- [ ] `test:all` + `lint` 통과 · [ ] 충돌마커 0 · [ ] PR에 Summary+Test plan · [ ] main직접push ∅ / `git add` 명시파일만 · [ ] 요청범위 안에서만 · [ ] 외부노출이면 EN 동반(§2.11)

## 15. Self-Update ⚙
태스크 완료시 본 파일+`.claude/agents/mkt-engineer.md` 갱신(같이). 트리거=PR머지·작업전환·검증된 새 안티패턴.
기록: 새함정(§7)·레시피(§12)·안티패턴(§11)·유저패턴(§9)·통계표준(§8)·원칙(§2). 기록∅: 평범적용·일회성·일반지식·"임시".
**v2 코드맵 동기화 !**: 새 도구·엔진·경로·상태 추가/이동/삭제 → `ARCHITECTURE.md` 같은 작업서 갱신(경로매핑만, ~200줄).
형식: 태스크당 ≤5줄, 간결. **용량규율 !**: 추가 = 압축 1회 동반. append-only 비대화 ∅ (상세는 `docs/harness-detail.md`로 내림).
작업 전후 "CLAUDE.md 압축·개선할까요?" 주도적으로 물음. 유저가 "self-update 하지마"→즉시중단(예외도 여기 메모). **§15 자체 삭제 ∅**.

## 15.5 UX 트리거 🎨
"유저친화적"·"너무복잡"·"이해안됨"·"전문용어많음"·"직관적이지않음"·"가독성" → **작업 전 `v2-migration/claude-ux.md` 먼저 읽고** 그 원칙대로. (결론먼저·근거접기 2층, 여정=질문프레임, 칸반 그룹핑, 평어 질문라벨, 배지↔상세 판정모순 방지, grid 균등, 맨밑 상세문서 탈출구, 통계정직·**엔진 불변**.)

## 16. 현재상태
v2 컷오버 완료(index.html·validate.js·루트 serve 삭제). Railway Root Directory=`v2-migration`.
규모: 공개라우트 37 · 도구 11 · 대시보드 8탭 · SOP 17 · 블로그 33(EN 32) · 용어 26(EN 25).
진행중: **전체 사이트 점검**(`docs/site-audit-2026-07.md`). 보류: 커스텀지표 registry를 5-3·5-6·5-18·5-21로 확장(도구당 1200~2500줄, 별도세션).

## 17. 토큰 규율 💰
파일 tool result=매턴 재전송(고정비).
1) 파일/함수 단위로만 읽기. 큰파일 `wc -l`→offset/limit. 코드맵으로 위치먼저. **이미 컨텍스트에 있으면 재Read ∅**.
2) 무거운 탐색만 서브에이전트(요약만 회수). 작은 셸/git은 직접.
3) `.claudeignore`=시그널일뿐 → 진짜 민감파일은 `.claude/settings.json` `permissions.deny`.
(운영=Gondry: `/compact` 기능종료마다, `/clear` 작업전환마다.)
