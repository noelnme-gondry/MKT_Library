# UI/UX 감사 — 2026-08-26

> **범위**: `docs/product-ssot.md` §5(UX 계약)·§6(접근성 계약)·§7(컴포넌트 계약)과 `v2-migration/claude-ux.md`를
> 정본으로 두고 `v2-migration/src` 전체를 정적 대조했다. **기존 가드가 이미 막고 있는 항목은 제외**하고,
> 가드 밖에서 실제로 깨져 있는 것만 적는다.
>
> **성격**: 감사 기록(§6.2). 코드 변경은 포함하지 않는다. 각 항목은 `파일:줄 → 기대 → 실제` 형태로 재현 가능하다.
>
> **검증 한계**: 이 감사를 수행한 환경에 `node_modules`가 없어 `npm run test:all`·`lint`·`build`를 돌리지 못했다.
> 아래 수치는 전부 소스 정적 파싱 + WCAG 상대휘도 계산으로 산출했고, 계산 근거를 각 항목에 남겼다.
> 실제 수정 PR에서는 세 검증을 반드시 함께 돌린다.

---

## 0. 요약

| # | 심각도 | 항목 | 규모 | 계약 |
|---|---|---|---|---|
| 1 | **P0** | JSX 인라인 raw hex — 라이트 모드에서 상태 색 AA 미달 | 37곳 / 7파일 | §6.2 |
| 2 | **P1** | `data-tooltip` 이 어디에도 렌더되지 않음 | 4곳 | §5.4·§6.3·§7.1 |
| 3 | **P1** | 터치 타깃이 뷰포트 폭에만 묶임 (`pointer: coarse` 0건) | 전역 | §6.4 |
| 4 | **P1** | `--text-muted` 가 카드 밖 4개 표면에서 AA 미달 | 토큰 1개 / 사용 396곳 | §6.2 |
| 5 | P2 | 확장 행이 `<td onClick>` — 키보드 도달 불가 | 2줄 | §7.1 |
| 6 | P2 | `UiSemantics` 가 액션 버튼에 `aria-pressed` 를 찍음 | 148곳 영향 | §6.3 |
| 7 | P2 | 죽은 UI 코드 (`DmNudge`·`.tool-assist-rail`) | CSS 72줄 + 컴포넌트 1 + store 2 | — |
| 8 | P3 | 라벨 하나에 컨트롤 둘 — 종료일 입력 이름 없음 | 1곳 | §6.3 |
| 9 | P3 | `forced-colors` / `prefers-contrast` 미지원 | 전역 | §6.2 |
| 10 | P3 | `mobileTaskIntegrity` 가드가 손으로 쓴 배열을 돎 | 가드 1개 | §7 함정 |

**계약을 이미 지키고 있어 손댈 것이 없는 곳**(실측 확인): `<details>` 안 차트 rAF resize(위반 0건) ·
아이콘 전용 버튼 `aria-label` + `ICON_TOUCH_TARGET`(누락 0건) · placeholder 단독 라벨(0건) ·
`:focus-visible` 취소(0건) · 화면당 h1 중복(5-28·5-29 `titleLevel={0}` 으로 정리 완료) ·
`<canvas>` 접근 가능 이름(`ds/UiSemantics` 가 런타임에 `role="img"` + 인접 heading 라벨 부착) ·
`prefers-reduced-motion`(전역 블랭킷 `globals.css:6541`).

---

## 1. [P0] JSX 인라인 raw hex — 라이트 모드에서 판정 색이 사라진다

### 기대
§6.2: 본문·라벨 대비 4.5:1 이상, 라이트/다크 **각각** 검증. 판정 색은 `CHART_THEME` getter 또는
semantic 토큰(`--success`·`--warning`·`--danger`)에서 온다.

### 실제
`globals.css` 의 raw hex는 과거에 정리됐지만 **JSX 인라인 스타일은 한 번도 쓸린 적이 없다.**

```
grep -rnoE '(color|background|borderColor|backgroundColor):\s*"#[0-9a-fA-F]{3,8}"' src/components --include=*.jsx
→ 37건 / 7파일
```

대비 실측(마지막 정의 기준 — 라이트 `--bg-2:#ffffff`, 다크 `--bg-1:#0b1018`):

| 리터럴 | 라이트 #fff | 다크 #0b1018 | 사용처 |
|---|---|---|---|
| `#facc15` | **1.45** | 12.45 | `AhaMomentFinder.jsx:1555,1556,1607,1608,1707,1708` 범례 ● |
| `#9ece6a` | **1.73** | 10.43 | `LtvTab.jsx:475,515,545,581,603` 상태·범례 버튼·콜아웃 |
| `#5ad19a` | **1.81** | 10.01 | `BudgetAllocation.jsx:2137` |
| `#5DCAA5` | **1.90** | 9.49 | `MarketingResponse.jsx:3145,4352` |
| `#e0af68` | **1.90** | 9.53 | `MarketingResponse.jsx:4637` |
| `#38bdf8` | **2.03** | 8.90 | `MarketingResponse.jsx:4351` |
| `#f59e0b` | **2.04** | 8.88 | `AhaMomentFinder.jsx:1105` · `AhaColumnMapper.jsx:206` · `MarketingResponse.jsx:3851,4350,5517` |
| `#22c55e` | **2.16** | 8.37 | `AhaMomentFinder.jsx:246,1192` · `AbTestHoldout.jsx:61,63` |
| `#f0917e` | **2.20** | 8.22 | `BudgetAllocation.jsx:2073,2135` |
| `#7aa2f7` | **2.39** | 7.57 | `MarketingResponse.jsx:5506,6370` |
| `#94a3b8` | **2.43** | 7.44 | `MarketingResponse.jsx:1167` |
| `#7F77DD` | **3.56** | 5.07 | `marketingResponseModel.jsx:1013` |
| `#2563eb` | 4.90 | **3.14** | `MarketingResponse.jsx:1169,6276` — 반대 방향(다크 미달) |

### 재현
1. `AhaMomentFinder.jsx:1192` — 분석 완료 후 라이트 모드로 전환 → `✓ 분석 완료` 가 `#22c55e`(2.16:1).
2. `LtvTab.jsx:475` — LTV 탭 "실측" 범례 버튼이 `#9ece6a`(1.73:1). 흰 카드 위에서 사실상 읽히지 않는다.
3. `AbTestHoldout.jsx:61,63` — `p < 0.01` / `p < 0.05` 유의성 pill이 `#22c55e`. **유의/무유의를 가르는 신호**가
   라이트 모드에서만 흐려진다.

### 왜 미관 문제가 아닌가
전부 **판정 신호**(초록=좋음 / 노랑=주의)에 쓰이는 색이다. 라이트 사용자에게만 신호가 사라지므로
§6.2의 "색은 의미를 보조할 수 있지만 단독으로 상태를 전달하지 않는다"가 이중으로 깨진다.

### §7 예외에 해당하지 않음을 확인
§7이 인정하는 raw hex 예외 4종(브랜드색 / 영구 다크 표면 위 텍스트 / Chart.js 데이터셋 / 토큰 없는 색과 짝지은 값)을
각각 대조했다. `CHART_THEME`(`utils/chartUtils.js:3-39`)의 `colors`·`danger`·`warning`·`success` 어디에도
위 리터럴이 없고, `LtvTab` 의 `#9ece6a` 는 차트 데이터셋이 아니라 텍스트·콜아웃·상태 배지에만 쓰인다
(같은 파일 `:259` 의 데이터셋은 `color` 변수를 쓴다). **범례↔셀 짝지음 예외는 한 건도 성립하지 않는다.**

### 가드 부재
`app/buttonContrast.test.js` 는 `globals.css` 의 `--primary` **배경**만 본다. JSX 인라인 hex를 도는 검사는 없다.

### 제안
- 판정 색은 `CHART_THEME.success|.warning|.danger`(리터럴 hex 반환 — 알파 접합 그대로 가능),
  순수 텍스트는 `var(--success|--warning|--danger)`.
- 가드: `src/**/*.jsx` 의 인라인 `color|background` hex를 파싱해 라이트·다크 양쪽 표면과 대비를 계산하는
  파생 검사. 예외는 코드에 사유 표식이 있을 때만 통과시킨다(`ds/downloadEscape.test.js` 패턴).

---

## 2. [P1] `data-tooltip` 이 어디에도 렌더되지 않는다

### 기대
§5.4 매핑 검토 상태는 "자동 매핑 결과와 **누락·충돌 사유**"를 필수 설명으로 요구한다.
§6.3·§7.1: 도움말은 `ⓘ` 버튼 또는 inline. `title` 단독 금지.

### 실제
`data-tooltip` 속성이 JSX 4곳에 있는데 **`globals.css` 에 대응하는 CSS 규칙이 0개**다
(`src` 내 CSS 파일은 `globals.css` 하나뿐 — `find src -name '*.css'` 로 확인).

```
src/components/ds/EvidenceStatusBadge.jsx:47   data-tooltip={explanation}
src/components/ds/EvidenceStatusBadge.jsx:51   data-tooltip={explanation}
src/components/CsvUploader.jsx:1115            data-tooltip={assessment.reasons.join(" · ")}
src/components/tools/marketingResponseModel.jsx:1525  data-tooltip={label}
```

가장 나쁜 것은 `CsvUploader.jsx:1115`:

```jsx
<span className="data-confidence-hint" role="img" tabIndex={0}
      aria-label={T.colHeaderStatus}                   // "상태" — 사유가 아니다
      data-tooltip={assessment.reasons.join(" · ")}>ⓘ</span>
```

- 시각 사용자: hover해도 아무것도 뜨지 않는다(스타일 없음).
- 스크린리더: `"상태"` 만 낭독된다. 실제 사유(`assessment.reasons`)는 **전달 경로가 없다.**
- `role="img"` + `tabIndex={0}`: 포커스는 되는데 상호작용 역할이 없다. 유효하지 않은 조합.

`EvidenceStatusBadge` 는 같은 설명을 `aria-label` 에도 중복으로 넣어 두어 스크린리더는 살아 있으나,
**시각 사용자용 경로는 역시 없다.**

### 제안
`ds/HelpTip`(`<details>` 기반)으로 이관한다 — §7 컴포넌트 계약의 정본이고 키보드·터치·SR이 네이티브로 동작한다.
이관 후 `data-tooltip` 속성 자체를 금지하는 가드를 둔다(스타일 없는 설명 속성은 언제든 재발한다).

---

## 3. [P1] 터치 타깃이 입력 방식이 아니라 뷰포트 폭에 묶여 있다

### 기대
§6.4: 기본 타깃 **44×44 CSS px**(WCAG 2.2 AA의 24px보다 보수적인 제품 기준).

### 실제

기본값이 미달이다.

```
globals.css:3340  .ab-pill { min-height: 30px; font-size: 11px; }
globals.css:4995  .btn     { min-height: 36px; }
```

더 좁힌 곳:

| 위치 | 값 |
|---|---|
| `globals.css:5118` `.aha-scatter-actions .ab-pill` | **26px** / font-size 10px |
| `globals.css:5411` `.result-action-card__controls .ab-pill` | **26px** / font-size 10px / `color: var(--text-muted)` |
| `globals.css:6024` `.dashboard-tabs .ab-pill` | **29px** / `color: var(--text-muted)` |
| `globals.css:7944` `.dochi-result-workspace__global-controls .ab-pill` | **29px** |
| `globals.css:8880` `.dashboard-section-actions .ab-pill` | 34px |

44px 승격은 `@media (max-width: 760px)` 안의 **손으로 고른 4개 셀렉터**뿐이다:
`.dashboard-tabs .ab-pill`(9546) · `.dashboard-section-actions .ab-pill`(9555) ·
`.csv-preview-header .ab-pill`(9585) · `.analysis-control-bar :is(input,select,button)`(9541).

`.ab-pill` 사용처는 193곳(정적 148 + 토글 45)이므로 **320px 화면에서도 대부분 30px로 남는다.**

그리고 `pointer: coarse` 쿼리가 **파일 전체에 0건**이다.

```
grep -c 'pointer:\s*coarse' src/app/globals.css → 0
```

### 왜 문제인가
승격 신호가 "폭이 좁다"이지 "손가락으로 누른다"가 아니다. 터치 아이패드(1024px)·터치 노트북은
폭이 크다는 이유로 26~30px 타깃을 받는다. 계약이 요구하는 것은 입력 방식 기준이다.

### 부수 발견
`.result-action-card__controls .ab-pill` 과 `.dashboard-tabs .ab-pill` 이 `color: var(--text-muted)` 를 쓴다.
§6.2가 **"버튼 문구에 muted 금지"** 라고 명시한 자리다. 탭 라벨과 결론 카드 컨트롤은 둘 다 주요 UI다.

### 제안
1. `@media (pointer: coarse)` 로 `.ab-pill`·`.btn`·`button.chip` 전체를 44px로 올린다(폭과 무관하게).
2. `max-width: 760px` 의 셀렉터 4개짜리 손목록을 위 블랭킷으로 대체한다 — 목록으로 두면 새 컨트롤이 계속 빠진다.
3. 26px/10px 두 곳은 밀도가 이유라면 `pointer: fine` 에서만 유지하고, muted 글자색은 `--text-secondary` 로 올린다.

---

## 4. [P1] `--text-muted` 가 카드 밖 표면에서 AA에 미달한다

### 기대
§6.2: 본문·라벨 4.5:1 이상.

### 실제
실효 정의는 **파일의 마지막 정의**다(§7: `:root`·`body.light-mode` 가 파일에 여러 번 나온다).

```
globals.css:8410  body.light-mode { --text-muted: #65758a; }   ← 라이트 실효값
globals.css:4826  :root           { --text-muted: #71839a; }   ← 다크 실효값
```

표면별 대비:

| 표면 | 값 | 대비 | 판정 |
|---|---|---|---|
| 라이트 카드 `--bg-2` | `#ffffff` | 4.70 | ✓ |
| 라이트 `--surface-base` | `#f7f9fc` | **4.46** | ✗ |
| 라이트 페이지 배경 `--bg-1` | `#eef2f7` | **4.18** | ✗ |
| 라이트 `--surface-container` | `#e9eef5` | **4.03** | ✗ |
| 다크 페이지 배경 `--bg-1` | `#0b1018` | 4.92 | ✓ |
| 다크 카드 `--work-surface` | ≈`#141821` | 4.58 | ✓ |
| 다크 `--bg-2` | `#162131` | **4.18** | ✗ |

즉 라이트는 **흰 카드 위에서만 통과하도록 튜닝**돼 있고, 카드를 벗어나는 순간(섹션 설명·캡션·빈 상태·
open-ledger 구획) 미달한다. 노출 면적이 넓다:

```
className="muted"        209곳
var(--text-muted)        187곳
```

### 제안
토큰 하나를 조정하면 네 표면이 함께 통과한다(라이트 `#5c6b80` 선, 다크 `#7e90a8` 선이 후보 — 실제 값은
네 표면 전부에 대해 계산해 고를 것). 가드는 **표면 목록을 CSS에서 파생해** `--text-muted`·`--text-secondary`
대비를 라이트·다크 양쪽에서 검사한다. 표면을 손으로 나열하면 새 표면이 추가될 때 그대로 새어 나간다(§7).

---

## 5. [P2] 확장 행이 키보드로 열리지 않는다

### 기대
§7.1 절대 금지: `div`/`span` 클릭 핸들러로 버튼 · `title` 단독 도움말.

### 실제
`src/components/tools/AhaMomentFinder.jsx:1686-1687`

```jsx
<td style={{ cursor: "pointer", ... }} onClick={() => toggleExpand(r.action)}
    title={tr("달성률 구간별 상세", "Reach-bucket detail")}>{isExpanded ? "▾" : "▸"}</td>
<td style={{ cursor: "pointer" }} onClick={() => toggleExpand(r.action)}>…</td>
```

`<button>` 없음 · `tabIndex` 없음 · `aria-expanded` 없음 · 어포던스는 `title` 단독.
금지 항목 두 개에 동시에 걸린다.

### 범위 확인
코드베이스 전체에서 **남은 비네이티브 클릭 타깃은 여기 하나**다. `grep` 으로 잡힌 나머지 29건은
한 줄에 여러 요소가 있어 생긴 오탐이거나, `role="button" + tabIndex + onKeyDown` 을 갖춘 CSV 드롭존이다
(`Incrementality.jsx`·`BrandCampaignIncrementality.jsx`).

### 같은 파일 부수 발견
`AhaMomentFinder.jsx:1347` — 내부 라우팅 `<a href>` 가 `e.preventDefault()` 후 `router.push` 한다.
⌘/Ctrl+클릭·가운데 클릭으로 새 탭 열기가 죽는다. `<Link>` 로 바꾸면 된다.

---

## 6. [P2] `UiSemantics` 가 액션 버튼을 토글로 만든다

### 기대
§6.3: 역할을 상태와 동기화한다. 상태가 없는 버튼에 상태를 붙이지 않는다.

### 실제
`src/components/ds/UiSemantics.jsx:35-40`

```js
function enhanceToggle(button) {
  if (button.hasAttribute("aria-selected") || button.hasAttribute("aria-checked")) return;
  if (button.hasAttribute("aria-pressed") && !button.hasAttribute("data-ui-semantics-toggle")) return;
  button.setAttribute("data-ui-semantics-toggle", "true");
  button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
}
```

`button.ab-pill` **전부**에 `.active` 유무로 `aria-pressed` 를 찍는다. 그런데:

```
className="ab-pill"                     148곳  ← .active 를 토글하지 않는 정적 버튼
className={`ab-pill ... active`}         45곳  ← 실제 토글
```

148곳의 실제 내용: `✕`(4) · `⬇ PNG`(3) · `{T.reset}`(3) · `{T.cancel}`(3) · `🗑`(2) · `수정`(2) ·
`가져오기` · `내보내기` · `비우기` · `다시 분석` · `닫기` · `✏️` … **전부 일회성 액션**이다.

스크린리더는 "닫기, 토글 버튼, 눌리지 않음"으로 읽는다. 상태가 없는 버튼에 상태를 붙이는 것은
ARIA가 없느니만 못한 쪽이다 — §16이 "다중선택 그룹에 radiogroup을 씌우면 ARIA가 없느니만 못하다"로
기록한 것과 정확히 같은 형태이며, **판별식이 상태 변수가 아니라 className 이라는 점**까지 같다.

### 제안
마크업이 말하게 한다. 토글인 pill에 `data-toggle` 을 명시하고 `enhanceToggle` 은 그 표식이 있을 때만 동작한다
(`data-pillgroup="multi"` 로 단일/다중을 가른 것과 같은 방식). className 은 신호가 될 수 없다.

---

## 7. [P2] 죽은 UI 코드

| 대상 | 상태 | 근거 |
|---|---|---|
| `src/components/DmNudge.jsx` | **어디에도 마운트되지 않음** | `grep -rn 'DmNudge' src --include=*.jsx --include=*.js` 결과가 자기 자신·스모크 테스트·store 뿐 |
| store `dmNudgeDismissed` / `dismissDmNudge` | 소비처 없음 | `useDataStore.js:573` |
| `.dm-nudge*` CSS | 14줄, 도달 불가 | `globals.css:7685-7713` |
| `.tool-assist-rail*` CSS | **58줄**, JSX 참조 0건 | `grep -rn 'tool-assist-rail' src --include=*.jsx` → 0 |
| `globals.css:7770` | 이중으로 죽은 규칙 | `body:has(.dochi-assistant) > .dm-nudge` — 자식 결합자 `>` 라 `.dm-nudge` 가 body 직계가 아니면 애초에 매칭되지 않고, 대상 자체도 없다 |

`.dochi-assistant .tool-assist-rail--embedded` 계열(패널 안 임베드 레일) 스타일도 같이 죽어 있다.

### 하단 고정 영역은 문제 없음 — 하나만 빼고
`position: fixed` 20곳 중 하단 우측에 겹치는 것은 `.tool-assist-rail`(z:18, 죽음) ·
`.dm-nudge`(z:19, 죽음) · `.dochi-assistant`(z:24) · `.dochi-analysis-dock`(z:28) · `.consent-banner`(z:900)다.
실제로는 배타적으로 동작한다:

- `PageClient.jsx:92` `routeId === "home"` → `DochiAssistant`
- `PageClient.jsx:150` `routeId !== "home"` → `DochiAnalysisDock`
- `globals.css:7706-7708` `body:has(.consent-banner)` → 둘 다 숨김

남는 한 가지: `.dochi-analysis-dock`(`globals.css:7974`, `bottom:20px` + 높이 76px → 상단 96px)이
`.content { padding-bottom: 60px }`(`globals.css:6431`, ≤760px)보다 크다. 모바일에서 페이지 마지막 약 36px —
§12.30 기준 `ToolPageOutro` 의 "상세 문서 받기" 탈출구 영역 — 을 덮는다. §6.4 "하단 고정 CTA는 포커스·결과·
오류 메시지를 가리지 않음"에 걸린다. 데스크톱은 `padding-bottom: 80px` 이라 여유가 16px뿐이다.

---

## 8. [P3] 라벨 하나에 컨트롤 둘 — 종료일 입력에 이름이 없다

`src/components/WeeklyReport.jsx:87-90`

```jsx
<label>
  <span>{t.period}</span>
  <input type="date" value={draft.period?.start || ""} … />
  <input type="date" value={draft.period?.end   || ""} … />
</label>
```

암묵적 라벨은 **첫 labelable 자손 하나**에만 연결된다. 종료일 입력은 접근 가능한 이름이 없다.
코드베이스 전체에서 컨트롤 2개 이상을 감싼 `<label>` 은 이 한 곳뿐이다(전 `.jsx` 파싱으로 확인).

---

## 9. [P3] `forced-colors` / `prefers-contrast` 미지원

```
grep -c 'forced-colors'      src/app/globals.css → 0
grep -c 'prefers-contrast'   src/app/globals.css → 0
grep -c 'prefers-reduced-motion' src/app/globals.css → 10  (전역 블랭킷 :6541 포함)
```

Windows 고대비 모드에서 `background` 가 강제 치환되므로 `.ab-pill.active`(`globals.css:4993`,
`background: var(--selected-bg)` + `color: var(--primary)`)의 **선택 상태가 사라진다.**
선택 표시가 배경색 하나에만 의존하는 구조라 그렇다.

`prefers-reduced-motion` 이 전역 블랭킷까지 갖춘 것과 대비되는 공백이다.

### 제안
선택 상태에 `outline`·`::after` 표식 등 forced-colors 에서 살아남는 신호를 하나 더 얹는다.
(색 외 구분은 §6.2가 이미 요구하는 것이라, 이 수정은 고대비 모드만을 위한 것이 아니다.)

---

## 10. [P3] `mobileTaskIntegrity` 가드가 손으로 쓴 배열을 돈다

`src/app/mobileTaskIntegrity.test.js:24-31`

```js
const CORE_ACTIONS = [
  { pattern: /\.dc-action-route--primary\b/, why: "홈의 주 진입 행동" },
  { pattern: /\.result-action-card\b(?![-_])/, why: "결론 카드 — 결과 확인" },
  … 총 6개
];
```

§7이 "커버리지 가드가 손으로 쓴 배열을 돌면 가드가 아니다"로 기록한 형태다.
현재는 오탐·누락 없이 돌지만(모바일 `display:none` 32건을 전부 대조해 위반 0건 확인), 새 핵심 행동
클래스가 생기면 조용히 비켜간다. 가드가 있다는 사실이 가드가 없다는 사실을 가린다.

**지금 위반이 아닌 것으로 확인된 항목**(오해 방지용 기록):
`globals.css:9579` `.mapping-header--status { display: none }` 은 매핑 표가 3열로 리플로우될 때
**열 머리글 라벨만** 숨기는 것이고, 상태 셀 자체는 `:9578` 에서 `grid-column: 1 / -1` 로 보존된다.
정당한 축소이지 과업 삭제가 아니다.

---

## 11. 권장 착수 순서

| 순서 | 항목 | 층 | 골든 영향 | 동반 가드 |
|---|---|---|---|---|
| 1 | §1 인라인 raw hex 37곳 | 렌더 | 없음 | 인라인 hex 대비 스캐너(라이트·다크 파생) |
| 2 | §2 `data-tooltip` → `ds/HelpTip` | 렌더 | 없음 | `data-tooltip` 속성 금지 |
| 3 | §3 `pointer: coarse` + 44px 블랭킷 | CSS | 없음 | 컨트롤 셀렉터 파생 최소 높이 검사 |
| 4 | §4 `--text-muted` 재조정 | 토큰 | 없음 | 표면 목록을 CSS에서 파생한 대비 검사 |
| 5 | §5 `<td onClick>` → `<button aria-expanded>` | 렌더 | 없음 | 스모크(키보드 확장) |
| 6 | §6 `aria-pressed` 판별식 교체 | 렌더 | 없음 | 정적 pill에 `aria-pressed` 없음을 단언 |
| 7 | §7 죽은 코드 제거 | — | 없음 | — |

1~6 전부 렌더·토큰층이라 `src/utils/*Math.js` 는 건드리지 않는다(§2.11 / claude-ux §7 — 엔진 불변).
§1·§4는 외부 노출 색이므로 KR/EN 구분 없이 전역이지만, §2의 `HelpTip` 문구는 KO/EN을 같은 작업에서 채운다(§2.11).

각 항목의 가드는 **대상을 레지스트리·CSS에서 파생**해야 한다. 손으로 쓴 목록은 다음 도구가 추가될 때
그대로 새어 나가고, 그때 "가드가 있다"는 사실이 구멍을 가린다(§7).
