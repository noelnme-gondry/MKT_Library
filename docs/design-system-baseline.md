# Design System Baseline — 전 도구 공용 규약 (v2)

> 목적: 지금까지 도구별로 복붙·표류하던 UI 규약을 **재사용 컴포넌트/유틸로 뽑아 전 도구·미래 도구가 강제로 상속**하게 한다. (사용자 결정 2026-07, 세션 대화)
>
> 원칙: **엔진(`*Math.js`) 불변 · 렌더층만 · claude-ux 준수 · 골든 byte-동일**. 채택은 도구 1개씩 검증(`test:all`+`lint`+`build`)하며 순차.

---

## 0. 결정 요약 (사용자)

- 기본화 대상: **테이블 · 통화/숫자 · 화면 골격 · 차트 + 브레드크럼 · 필터 · 토글 · 디자인 형식** 전부.
- **통화는 전역 1개**로 통일 (한 번 토글 → 전 도구 반영, store).
- 미래 도구가 **강제로 따르게** — CLAUDE.md/ARCHITECTURE에 규약 명문화(§15 self-update).
- 순서: **기반화 먼저 → 홀드아웃 신규 도구가 그 위에 올라탐**. 진행 내내 UX 감안.
- CSV 업로드 설명: 매핑 도구 위 **항상 보이는 1줄 요약 + 버튼 → 모달 팝업 상세**(하이브리드, 발견성+깔끔함).
- 홀드아웃: **소재·실험(06) 그룹의 3번째 독립 도구**(CSV 그룹 독립). 5-4는 A/B만.

---

## 1. 공용 프리미티브 (신규 모듈)

### 1.1 숫자·통화 포맷 — `src/utils/format.js` (순수)
- `fmtCurrency(value, {currency, precise})` — ₩/$ 기호 + 천단위 콤마 + 통화별 소수(₩ 0, $ 2). `precise`면 소액 적응 자릿수(§7 LTV 함정).
- `fmtPct(value, digits=1)` · `fmtNum(value, digits=0)` · `parseNum(str)` — 콤마 strip 후 parseFloat(§7 `parseFloat("72,341")=72` 함정 방지, null 반환).
- `fmtCompact(value)` — 1.2만·3.4억 등 축약(대형 축 라벨).
- 모든 도구는 자체 `toLocaleString`/수동 포맷 금지 → 이 유틸만.

### 1.2 전역 통화 — `useAppStore`
- `currency: "KRW" | "USD"` (기본 KRW) + `setCurrency`. 도구별 지역 통화 state 전부 제거 → 이 전역 구독.
- 헤더/툴셸에 **통화 토글 1개** → 전 도구 동시 반영.

### 1.3 공용 테이블 — `src/components/ds/DataTable.jsx`
- props: `columns[{key,label,align?,tooltip?,fmt?}]`, `rows`, `rowKey`, `stickyHeader?`.
- 규약 자동: `<thead>` 필수, 숫자열 `text-align:right`+`tnum`, 라벨열 left, 헤더 정렬=셀 정렬 일치(§7 thead 함정 근절), `vertical-align:top`.
- 매트릭스형(행헤더+셀)은 `variant="matrix"`.

### 1.4 CSV 설명 장치 — `src/components/ds/CsvGuide.jsx` + `TOOL_GUIDE`
- `TOOL_GUIDE[toolId]` = `{ when: string, needs: [{col,label,why,required}], prep: string[], example?: csvString }`.
- 렌더: 업로드 박스 위 **1줄 요약**(when + 핵심 컬럼) + 버튼 `📖 어떤 데이터가 왜 필요한가요?` → **모달**(when·컬럼별 why 표·준비팁·예시·템플릿 다운로드).
- CsvUploader + 커스텀 드롭존(5-18·5-20·홀드아웃) 공통 삽입.

### 1.5 툴 골격 — `src/components/ds/ToolShell.jsx`
- 슬롯: `hero`(질문형 제목+평어+칩), `breadcrumb`, `filters`(sticky 필터/토글 바), `upload`(CsvGuide+CsvUploader), `body`.
- 브레드크럼: `IA` 그룹 → 도구명 자동(라우트 id 기반). claude-ux 결론-먼저 hero 패턴 내장.

### 1.6 차트 — 기존 `chartUtils.js`/`CHART_THEME` 유지 + 강제
- `chartCommonOpts()` 미적용 도구 정리. 하드코딩 hex/rgba 금지 → `getCssVar`/`CHART_THEME`.

---

## 2. 홀드아웃/증분 신규 도구 (프리미티브 위에)

- 위치: IA 06(소재·실험) 3번째. 새 라우트 id(예 `5-23`, 불변 원칙 §4.1) + slug `/tools/incrementality`. **CSV 그룹 독립**(TOOL_GROUP 신규 키).
- 5-4: 홀드아웃 탭 제거 → **A/B(설계+판독)만**. 홀드아웃 엔진(`incrMath`)은 신규 도구로 이관.
- 3 방법 탭:
  | 탭 | 방법 | 신뢰도 | 데이터 |
  |---|---|---|---|
  | ① 통제군 (suppression) | 동시·무작위 노출 vs 차단 | ★★★ | holdout_group·전환·인원(+비용·매출) |
  | ② 신규 켜기 (on) | 시점 전후 off→on 상승분 | ★★ | date·metric·cutoff(+대조 group→DiD) |
  | ③ 종료 (off) | 시점 전후 on→off 하락분 | ★★ | date·metric·cutoff(+대조 group) |
- ②③ = 부호만 다른 한 엔진(pre/post 전후 비교 + 선택적 DiD), 신규 순수 엔진 `incrPrePostMath.js`(골든 필수). ① = 기존 `incrMath` 재사용.
- 뷰: 시계열 라인 + cutoff 마커 + baseline 추세연장 점선 → 간격=증분. 카드(전/후 평균·Δ·95%CI·(옵션)iROAS·증분CPA·유의성) + 평어 결론 + 정직성 노트(무작위/대조 아니면 인과 단정 X).
- 각 탭 CsvGuide 적용.

---

## 3. 실행 단계 (검증 게이트: 매 단계 test:all+lint+build GREEN)

- **P1 기반 (adoption 0, 순수 추가)**: `format.js` + 전역 통화 store + DataTable + CsvGuide/TOOL_GUIDE + ToolShell 스캐폴드 + 골든(format).
- **P2 채택**: 도구 1개씩 → format/통화/DataTable/CsvGuide 적용, 각 도구 검증 후 커밋. 순서: 5-2 대시보드 → 5-3 → 5-22 → 5-21 → 5-6 → 5-4 → 5-18 → 5-20.
- **P3 홀드아웃 신규 도구**: 프리미티브 위에 신설 + `incrPrePostMath` 골든 + 5-4 홀드아웃 제거.
- **P4 규약 명문화**: CLAUDE.md §5/§12 + ARCHITECTURE에 "신규 도구는 ds/* 프리미티브 필수" 규칙(§15).

---

## 4. 미래 도구 강제 규약 (P4에서 CLAUDE.md 반영)

신규 분석 도구는 반드시:
1. `<ToolShell>`로 감싸기 (hero+breadcrumb+filters+upload 슬롯).
2. 표는 `<DataTable>` (직접 `<table>` 금지).
3. 숫자·통화·%는 `format.js` 유틸만 (수동 포맷 금지) + 전역 `currency` 구독.
4. CSV 업로드부에 `TOOL_GUIDE[id]` 작성 → `<CsvGuide>` 자동.
5. 차트는 `chartCommonOpts()`+`CHART_THEME` (하드코딩 색 금지).
6. 엔진은 순수 `*Math.js` + 골든 테스트.
