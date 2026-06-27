# 알려진 함정 (Pitfalls) — 상세

> CLAUDE.md §7 요약 테이블의 상세 버전. 새 함정 발견 시 여기에 추가.

---

## number-comma
**`type="number"`는 천단위 콤마 표시 불가**

금액 입력은 `type="text" inputmode="numeric"` + blur 재포맷(`allocFmtNum`=toLocaleString) + **모든 read 사이트에서 콤마 strip**(`allocParseNum`=`replace(/[,\s]/g,'')` 후 parseFloat). `parseFloat("72,341,057")=72` 함정 — 입력 핸들러·검증·셀 핸들러 전부 교체 필수(하나라도 빠지면 분배 0 버그). NaN가드는 `==null`(allocParseNum이 null 반환, isNaN(null)=false). 5-3 예산/§5 cost 셀 적용.

---

## csv-comma
**CSV 콤마 파싱**

`"2,488"` 쌍따옴표 안 콤마. PapaParse 사용(직접 split 금지). **dynamicTyping 없이** → 모든 값 문자열, `parseFloat`.

---

## csv-download
**CSV 다운로드 = CRLF + BOM**

`lines.join("\n")`는 Excel에서 한 행으로 뭉침(RFC4180 위반). **`\r\n` 조인 + BOM(`﻿`) + `text/csv;charset=utf-8`**. 콤마는 따옴표 이스케이프(`q()`). 날짜 문자열 컬럼은 `parseFloat`가 연도만 추출하므로 원본 라벨 별도 보존(`weekLabel`).

---

## leap-year
**윤년**

`dayOfYear()` 1~366 반환 → 배열 길이 367 보장.

---

## tdz
**const 초기화식 자기 참조 = TDZ throw**

`const sel = ... arr.some(x=>x.k===sel)`처럼 자신을 참조하면 callback 실행 시 ReferenceError. `&&` 단락 기본 경로는 멀쩡, 조건 truthy 되는 순간(다른 채널 클릭) render throw → 탭 멈춤. 상태 의존 분기는 **전 상태값(전 채널·전 토글)으로 repro**해야 잡힘.

---

## inline-script
**innerHTML 인라인 `<script>` 미실행**

innerHTML로 주입한 인라인 `<script>`는 실행 안 됨. 표준은 `bindXxxHandlers`에서 `renderXxxChart()` 직접 호출.

---

## chart-dark-legend
**Chart.js v4 다크모드 범례 안 보임**

커스텀 `generateLabels`는 per-item `fontColor` 자동 주입 X → 다크모드 범례 텍스트 안 보임. legend item에 `fontColor: CHART_THEME.text` 명시. 차트 색/텍스트는 항상 `CHART_THEME` getter(하드코딩 hex 금지, 다크/라이트 양쪽 확인). 부호 색쌍은 명도차 크게.

---

## chart-png-transparent
**Chart.js transparent → PNG**

dark 배경 명시 합성 후 export.

---

## fixed-backdrop
**`position:fixed` + `backdrop-filter` 조상**

`position:fixed`도 `backdrop-filter` 조상 안에선 viewport 기준 아님 → 드롭다운 body portal. `document.body.appendChild`로 portal + `getBoundingClientRect` 정렬, navigate마다 orphan 제거.

---

## cross-page-handler
**공유 CSS 클래스 + 전역 핸들러 = cross-page 점프 버그**

구 페이지의 `querySelectorAll(".shared-class")` 전역 핸들러가 신규 동일 클래스에도 바인딩. 신규 핸들러는 페이지 전용 `data-*`로 스코프 한정.

---

## dead-renderer
**페이지 제거 = renderer 통째 삭제**

IA·redirect만 비활성화하면 죽은 renderer 안의 중복 id·공유 클래스가 cross-page 버그 불씨. 흡수 시 redirect만 남기고 본문 통째 삭제.

---

## render-throw
**render throw는 골든이 못 잡음**

골든은 순수함수만 검증. navigate가 단일 render throw에 통째로 죽어("분석하기 무반응"·"탭 멈춤") P0. `/tmp` repro 필수(Chart 스텁+`afterDatasetsDraw` 직접 실행). 검증은 **주입식 harness**(`code+inject`로 내부 const 접근).

---

## gate-key-mismatch
**게이트 `requiresAny` 키 불일치**

`STANDARD_FIELDS` 정규키와 정확히 일치(단/복수) — 추측 말고 복붙. `["click"]` vs 정규키 `clicks` → 데모인데 영구 잠김(silent).

---

## csv-mapping-scope
**CSV 자동매핑·드롭다운 스코프**

전역 `autoMapHeaders`/전체 `STANDARD_FIELDS`는 안 쓰는 필드까지 매핑 → "매핑됐는데 못 씀". `toolFieldKeySet`(`TOOL_REQUIRED_FIELDS` oneOf 포함 + `TOOL_OPTIONAL_FIELDS`)으로 제한. 형제 CSV 이어받을 때도 본인 기준 재매핑. 표준필드 겹침 0이면 null→전체 폴백. `cost`(효율)≠`spend`(Creative) 별도 키.

---

## navigate-scroll
**navigate 재렌더 스크롤 리셋**

navigate 진입 시 `prevScrollY`+`prevHash` 캡처 → 끝에서 같은 페이지면 `scrollTo(prevScrollY)`, 다른 페이지면 top.

---

## grain-decomposition
**단계 독립 분해 = grain별 부분합 비정합**

채널/캠페인/소재 단계마다 따로 Bennet 분해하면 합산 grain이 달라 §2 Σ ≠ §3 Σ. 최소 grain(채널×캠페인×소재×일)에서 한 번만 분해 후 `rollup`(단순 합산).

---

## hierarchy-overmerge
**계층 드릴다운 단일레벨 키 = 상위 over-merge**

"캠페인 전체"인데 `keyFn=f=>f.crKey`로 묶으면 서로 다른 캠페인의 동일 소재가 한 행으로 병합. 상위 "전체"면 복합키(`cmp│cr`·`ch│cmp│cr`), finest 합산이라 Σ 불변, children[0]로 대표키.

---

## csv-formula
**CSV 살아있는 수식 2함정**

① centering 공식은 **finest에서만** 성립 — rollup mix는 Σ children → "하위 cell 합" 수식 노출. ② 셀 수식에 **콤마(SUMIFS 등)** 쓰면 CSV 컬럼 분리로 깨짐 → 명시 셀 `+`합으로 회피.

---

## td-th-valign
**공용 `td{vertical-align:top}`은 `<th>`엔 안 먹음**

행헤더 `<th>`에 명시적 `vertical-align` 지정.

---

## verdict-first
**전문 진단은 결론 뒤로 접기**

마케터 대상 도구는 §0 평어 결론·액션 카드(`computeAllocSummary` 재사용) 맨 위 + 산점도·추세선 진단은 `<details>` 기본 접힘. 알림 다발은 한 줄 칩(`⚠ N건 — 보기`)으로 fold. `<details>` 안 canvas는 펼칠 때 `chart.resize()` 필요. 전문 용어는 평어+title 툴팁.

---

## log-space
**로그-스페이스 수치 underflow**

큰 파라미터 Beta PDF 등 underflow → log-space 계산 후 max 빼고 exp 정규화.

---

## localstorage
**localStorage 영속 금지**

요청 시에만 사용. 새로고침 리셋이 기본.
