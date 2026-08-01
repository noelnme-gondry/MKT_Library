# Design System Baseline — 전 도구 공용 규약 (v2)

> 목적: 지금까지 도구별로 복붙·표류하던 UI 규약을 **재사용 컴포넌트/유틸로 뽑아 전 도구·미래 도구가 강제로 상속**하게 한다. (사용자 결정 2026-07, 세션 대화)
>
> 원칙: **결론 먼저 · 근거 둘째 · 방법론 마지막 · 엔진은 순수함수 · 골든 검증**. 신규 화면은 아래 공용 구조를 상속한다.
>
> 전체 화면의 시각 위계·객체·토글·필터·차트·표·UI text·모바일 규약은 [`frontend-tool-design-guide.md`](./frontend-tool-design-guide.md)를 따른다. 이 문서는 공용 컴포넌트 도입 기준선과 이행 기록을 보존한다.

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

### 1.5 툴 제목 골격 — `ToolPageShell.jsx` **또는** `ToolIntro.jsx`
- 두 컴포넌트는 대안이며 한 페이지에서 동시에 쓰지 않는다. 둘 다 그 페이지의 유일한 `h1`을 소유한다.
- `ToolPageShell`: 도구 내부의 compact sticky title·summary·본문·우측 TOC를 담당한다. 전역 sidebar/header와 CSV uploader는 담당하지 않는다.
- `ToolIntro`: 아직 `ToolPageShell`로 이관하지 않은 커스텀 도구에 라우터가 한 번 삽입한다. **무슨 질문에 답하는가 → 무엇을 받는가 → 어떤 데이터로 시작하는가**를 평어로 설명한다. MMM·회귀 같은 전문 방법명은 결과 이해에 필요할 때만 Advanced Lab과 세부 설명에 둔다.
- 업로드 전에는 입력 계약과 샘플/템플릿을, 분석 후에는 결과를 먼저 보여준다. 같은 데이터를 쓰는 도구는 `StartGate`의 `?tool=<id>` handoff와 group snapshot을 재사용한다.

### 1.6 결과 골격 — `src/components/ds/ResultActionCard.jsx`
- Decision Tape 4단: **결론 → 수치 근거 → 지금 할 행동 → 다음 분석**.
- 제목은 실제 `h2`, 전체는 이름 있는 `section` landmark다. 상태는 색만으로 표현하지 않고 문장·라벨을 병기한다.
- 후속 분석 링크는 장식이 아니라 현재 결과의 미해결 질문을 이어받아야 한다(PVM→소재 피로도/포화도, MMM→실험/예산 배분 등).

### 1.7 차트 — `chartUtils.js`/`CHART_THEME` 강제
- `chartCommonOpts()` 미적용 도구 정리. 하드코딩 hex/rgba 금지 → `getCssVar`/`CHART_THEME`.
- 테마 전환은 `refreshMountedChartThemes()`로 마운트된 Chart.js 인스턴스까지 즉시 동기화한다.

### 1.8 Operator Desk 시각 언어
- 다크: graphite 작업대 + chartreuse/cobalt 신호. 라이트: warm paper + cobalt 신호.
- body=`DM Sans`, display=`Space Grotesk`, 데이터=`JetBrains Mono`(`next/font` 변수).
- 랜딩 목업은 동일 카드 재배치가 아니라 실제 제품의 4개 상태(주간 브리핑·PVM·소재 피로·MMM)를 순환한다.
- 저대비 opacity로 상태를 표시하지 않는다. 모바일에서도 Cmd-K/Footer/templates로 전체 IA에 접근할 수 있어야 한다.

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

## 3. 채택 상태 (검증 게이트: 매 단계 test:all+lint+build GREEN)

- **채택됨**: `format.js`, 전역 통화, DataTable, CsvGuide/TOOL_GUIDE, ToolPageShell/ToolIntro, ResultActionCard, DownloadHub, 공용 chart theme.
- **채택됨**: 운영 대시보드·예산·포화·PVM·소재·A/B·증분·MMM/회귀·Aha·콘텐츠 분석 라우트.
- **채택됨**: 랜딩·블로그·글로서리·가이드·StartGate에 Operator Desk 내비게이션/타입/CTA 계층.
- **남은 원칙**: 새 도구나 신규 결과 탭은 기존 공용 컴포넌트를 확장하고, 예외가 필요하면 이 문서에 이유와 새 계약을 먼저 기록한다.

---

## 4. 미래 도구 강제 규약 (P4에서 CLAUDE.md 반영)

신규 분석 도구는 반드시:
1. `<ToolPageShell>`로 감싸거나 라우터의 `<ToolIntro>` 대상에 등록한다. 둘을 함께 쓰거나 자체 `h1`을 추가하지 않는다.
2. 표는 `<DataTable>` (직접 `<table>` 금지).
3. 숫자·통화·%는 `format.js` 유틸만 (수동 포맷 금지) + 전역 `currency` 구독.
4. CSV 업로드부에 `TOOL_GUIDE[id]` 작성 → `<CsvGuide>` 자동.
5. 차트는 `chartCommonOpts()`+`CHART_THEME` (하드코딩 색 금지).
6. 엔진은 순수 `*Math.js` + 골든 테스트.
7. 결과는 `<ResultActionCard>`로 결론·근거·행동·다음 분석을 제공한다.
8. KR/EN route metadata·UI copy·정적 링크를 함께 추가하고 `contentRegistry.test.js`의 공개 범위 계약을 지킨다.
