# 웹사이트 오딧 방법론 + 타이포그래피 리서치

> 2026-08-24 · 세션 산출물 통합본
> 대상: Growth Opt Playbook (`growthoptplaybook.com` / `v2-migration/`)
> **코드는 아직 변경하지 않았다.** 본 문서는 ① 오딧 방법론 제안 ② 폰트 진단·리서치 두 파트.

---

# PART 1 — 웹사이트 오딧 방법론

AGENTS.md §6.2(감사 흐름) 기준. **위→아래로 갈수록 비용이 커지므로, 위 계층에서 걸린 게 있으면 거기서 멈추고 보고**한다.

## 1.1 대상 범위

최근 개선 커밋 **#690~#722**. 주축:

| 영역 | 커밋 |
|---|---|
| 도치(Dochi) 워크벤치 | #712 · #717~#722 |
| 의미기반 CSV 매핑 엔진 V2 | #709 |
| 5-28 핵심 액션 생존 분석 | #712 · #713 |
| 계측·광고 호스트 게이트 | #703 · #704 |
| E2E·브라우저 품질 하네스 | #705 · #706 · #707 |
| 분석 라우터·운영 흐름 검증 | #711 · #714 |
| 홈 인덱스·도구 갈래 재구성 | #691~#700 |

## 1.2 5계층 오딧

| 계층 | 무엇을 보나 | 도구 | 잡히는 것 |
|---|---|---|---|
| **L0 기준선** | `test:all` · `lint` · `build` 실제 실행 | npm | 하네스가 지금 실제로 초록인지 (§16 수치가 낡았을 수 있음) |
| **L1 주장 검증** | PR 본문 vs 실제 diff | `git show` | "고쳤다"가 코드에 있는지, 가드가 진짜 가드인지 |
| **L2 배선 정합** | SSOT ↔ 파생 레지스트리 | grep 전수 | 신규 도구가 20~25곳 배선 중 빠뜨린 곳 |
| **L3 정직성** | 화면 숫자 = 실제 계산인가 | 재현 스크립트 | 거짓 숫자 · "미상→좋은 등급" · 무유의 단정 |
| **L4 실사용 경로** | 실제 CSV로 업로드→매핑→분석 | node repro / e2e | 골든이 못 보는 render throw · 매핑 실패 |

## 1.3 계층별 구체 검사 항목

### L1 — 주장 검증
- 새 가드 테스트가 **하드코딩 배열이 아니라 SSOT 파생**인지
  (§7 *"가드가 있다는 사실이 가드가 없다는 사실을 가린다"*)
- 테스트 안 `foo?.()` / 조건부 `if` 안의 단언 → **조용히 삭제된 검사**
- 소스를 `includes("X")`로 검사 → **주석·import 줄에 걸려 통과**하는 가짜 가드
  (§16에 한 세션 3회 재발 기록 있음)

### L2 — 배선 정합 (신규 도구가 있을 때 최우선)
- `TOOL_GROUP` ↔ store `csvGroups` ↔ `TEMPLATE_FAMILY` **3맵 파생 여부**
  → 미등록 = 업로드 소실(#603/#604) 또는 렌더 throw(#608/#610)
- 형제 id grep 전수: `IA` · `routeMap` · `toolIndex` · `TOOL_REQUIRED_FIELDS` ·
  `TOOL_GUIDE` · `sitemap` · `routeSeo` · `toolSearchContent` · `NEXT_TOOL_IDS` …
- **KR/EN 대칭**(§2.11) — EN 짝파일 · `EN_*_SLUGS` 누락
- 가드 정규식이 새 id 형태를 건너뛰지 않는지 (`^(5|9)-\d+$` 류)

### L3 — 정직성 (§8)
- 적합 실패를 좋은 값으로 접는 자리 (`r2=0 → VIF=1`, `null → "포화"`)
- **학습 오차 > OOS 오차** 부등식 → 적합값이 점예측이 아니라는 신호
- 계산해 놓고 판정에 안 쓰는 플래그 (§16 *"신호를 계산해 놓고 안 쓰는 자리"* — 실측 3건)
- 무유의를 "효과 없음"으로 단정하지 않는지 / 데이터 없는 상태를 날조하지 않는지

### L4 — 실사용
- 데모 픽스처가 아니라 **실제 플랫폼 export 컬럼명**으로 자동매핑
  (§7 *"데모 픽스처가 표준키를 헤더로 쓰면 자동매핑은 검사된 적이 없다"*)
- 신규 화면(도치 워크벤치)의 **진입 경로 자체를 밟는** 스모크가 있는지
  (`beforeEach` 상태 주입은 `setCurrentRouteId` → 미러 스왑을 우회한다)

## 1.4 범위 옵션 (미결정)

| | 범위 | 예상 분량 |
|---|---|---|
| **A (추천)** | L0~L2 + 신규 도구(5-28·도치)에 L3 집중 | 중간 |
| **B** | A + 전 도구 L3 정직성 전수 | 김 |
| **C** | B + L4 실 CSV 재현 스크립트 작성 | 매우 김, 별도 세션 권장 |
| **D** | 특정 PR만 (#709 매핑 V2 / #712·#717~#722 도치 / #703 계측) | 짧음 |

**추가 결정 필요**: 오딧 결과를 **보고서로만** 낼지, 발견을 **바로 고쳐 PR까지** 낼지
(§6.2는 발견 → 보고 후 §6.1로 전환).

---

# PART 2 — 타이포그래피 진단 · 폰트 리서치

> 요청: *"데이터 보기가 너무 어지럽다, 특히 한글 폰트."*
> 웹서치 + **코드 실측 대조** 결과, 원인은 폰트 선택이 아니라 스택 배선이었다.

## 2.1 진단 — 지금 무슨 일이 일어나고 있나

### 로드되는 폰트 4종 (`src/components/RootDocument.jsx:11-14`)

| 변수 | 폰트 | subset | 한글 글리프 |
|---|---|---|---|
| `--font-dm-sans` | DM Sans | `latin` | ❌ |
| `--font-space-grotesk` | Space Grotesk | `latin` | ❌ |
| `--font-jetbrains-mono` | JetBrains Mono | `latin` | ❌ |
| `--font-noto-sans-kr` | Noto Sans KR | (미지정) `preload:false` | ✅ |

**한글 글리프를 가진 폰트는 Noto Sans KR 하나뿐인데, 어느 토큰에서도 1순위가 아니다.**

### 토큰 실효값 — `:root`가 3번 정의됨 (19행 · 4796행 · 8347행, **마지막이 이김**)

```css
/* globals.css:8364 — 실효 정의 */
--font-sans:    var(--font-dm-sans), var(--font-noto-sans-kr), system-ui, …
--font-display: var(--font-space-grotesk), var(--font-noto-sans-kr), var(--font-dm-sans), …

/* globals.css:4860 — 8347 블록에 없어서 여기가 실효 */
--font-mono:    var(--font-jetbrains-mono), ui-monospace, Menlo, Consolas, monospace;
```

> §7의 *"토큰 값을 대조할 땐 마지막 정의를 볼 것"*이 그대로 적용되는 자리다.

---

### ⚠ 원인 1 (핵심) — `--font-mono`에 한글 폴백이 없다

**사용량 실측**: `--font-mono` **399곳** · `--font-display` 71곳 · `--font-sans` 34곳.
앱 텍스트의 압도적 다수가 mono인데, 그 체인 어디에도 한글 폰트가 없다.

mono가 걸린 셀렉터 — **전부 한글이 들어가는 라벨**:

```
table.data thead th     ← 모든 데이터 표 헤더
.kpi-card .label / .delta
.summary-label
.pill                   ← 칩·배지
.toc-title  .card-eyebrow  .nav-group-index  .brand-sub
.pvm-bridge .bl  .pvm-mover .mv
.phase-card-step / -tag / -meta
code.inline  pre
```

→ 이 한글은 전부 **OS 기본 고정폭 폰트**로 폴백한다.

| OS | 결과 |
|---|---|
| **Windows** | Consolas에 한글 없음 → 시스템 폴백(맑은 고딕/굴림 계열). **가장 어지러운 조합** |
| **macOS** | Menlo → Apple SD Gothic Neo. 상대적으로 나음 |

> **개발 환경(맥)에서는 멀쩡해 보이고 실사용자(윈도우)에게만 깨진다.**
> 지금까지 안 잡힌 이유이자, "한글 폰트가 너무해"의 가장 유력한 정체.

### ⚠ 원인 2 — 한 줄 안에서 폰트가 갈린다

`--font-display`(Space Grotesk)는 KPI 숫자·결과 카드 수치에 쓰인다
(`globals.css:5126` `.kpi-card .value`, `:5435` `.result-action-card__stats strong`).

- 숫자·영문 → **Space Grotesk** (기하학적 display face, 특유의 `1`·`2`·`7`)
- 같은 줄의 한글 → **Noto Sans KR**

→ 획 굵기·x-height·베이스라인이 다른 두 폰트가 한 줄에 섞인다.
**"촌스럽다"는 감각의 물리적 근거.** Space Grotesk는 본래 헤드라인용이지 데이터 표시용이 아니다.

### ⚠ 원인 3 — 크기가 작다

`--type-body: 13px` · `--type-meta: 10px` (`globals.css:8360-8362`).
Noto Sans KR은 x-height가 낮은 편이라 13px 이하 한글에서 획이 뭉갠다.
§12.30의 타이포 하한 9.5px 가드는 통과하지만 **통과하는 것과 읽히는 것은 다르다.**

### ⚠ 원인 4 — `preload: false`

Noto Sans KR이 `preload:false`라 **한글만 매번 늦게 스왑**된다(FOUT).
첫 페인트는 시스템 폰트 → 잠시 후 Noto로 튐. 표가 많은 화면에서 레이아웃이 한 번 흔들린다.

> **요약: 폰트 하나를 바꾸는 문제가 아니라, 한글에 대해 4종 스택 전체가 설계되지 않은 상태다.**

---

## 2.2 후보 폰트 — KO/EN 통합

**요건**: ① 작은 크기 판독 ② 숫자 정렬(tabular figures) ③ **한글·영문 한 파일**(혼합 렌더링 제거) ④ 중립적(브랜드 주장 없음)

### ★ A. Pretendard — 1순위 추천

| | |
|---|---|
| 라이선스 | SIL OFL (상업 이용·수정·재배포 가능, 폰트 단독 판매만 금지) |
| 굵기 | 9종 / Variable `45~920` |
| 설계 | **Inter**(라틴) + Source Han Sans(한글) + M PLUS 1p(일문) 기반 재설계 |
| 배포 | variable woff2, 동적 서브셋(92분할), CDN, npm |
| 형제 | Pretendard JP / Std / GOV |

- 한국 IT 실무 사실상 표준. **"system-ui 대체"를 목표로 설계**돼 UI 밀도에 맞다.
- **라틴이 Inter 기반**인 게 결정적 — 데이터 대시보드 폰트 1순위로 꼽히는 게 Inter다.
  즉 **Inter의 데이터 판독성을 그대로 가지면서 한글이 같은 파일에 있다.**
- Noto Sans KR 대비 자간·행간이 정돈돼 장시간 열람 피로가 적다는 평가.
- ⚠ **확인 필요**: `tnum`(tabular figures) 지원이 공식 README에 **명시돼 있지 않다.**
  Inter 기반이라 있을 가능성이 높지만 **추정이다** → §2.4 검증 절차.
- ⚠ Google Fonts에 없다 → `next/font/local` + self-host 필요.

### B. IBM Plex Sans KR — 2순위 (최소 비용)

| | |
|---|---|
| 라이선스 | OFL |
| 굵기 | 7~8종 (Thin~ExtraBold), **Google Fonts 제공** |
| 설계 | IBM 기업 서체 한글판. **UI 환경 전용으로 설계** |

- **`next/font/google`로 바로 붙는다** — 지금 구조 그대로 import 한 줄 교체면 끝.
- 라틴 IBM Plex Sans는 대시보드 추천 3강(Inter · Roboto · IBM Plex Sans) 중 하나.
- **`IBM Plex Mono`와 한 가족** → mono 페어링이 자동으로 맞는다.
  **mono 399곳을 쓰는 이 앱에 구조적으로 유리하다.**
- 성격이 Pretendard보다 뚜렷하다(기업적/기술적 인상). 중립성만 보면 Pretendard 우위.

### C. Noto Sans KR 유지 (순서만 승격) — 최소 변경안

- 이미 로드 중. `--font-mono` 폴백 추가 + `preload:true`만으로 원인 1·4가 해소된다.
- 다만 본문 밀도 UI에서 다소 무겁고 x-height가 낮아 13px에서 불리.
  **"덜 나쁘게"는 되지만 "깔끔"까지는 안 간다.**

### D. SUIT — 참고

무료 한글 UI 폰트. 가독성 추천에 자주 등장하나 Pretendard 대비 실무 채택 폭·문서화가 얇다. 굳이 선택할 이유가 없다.

### 비추천

| 폰트 | 이유 |
|---|---|
| **Space Grotesk** (현행 display) | 헤드라인용 display face. 데이터 수치에 부적합 + 한글 없음 → **원인 2의 장본인** |
| **DM Sans** (현행 sans) | 라틴 전용. 기하학적 숫자라 표 정렬에서 Inter 계열보다 불리 |
| Spoqa Han Sans | 숫자 표현에 강하다는 평이 있으나 업데이트가 오래 멈춤 |

---

## 2.3 권고안

### 폰트 스택 (Pretendard 채택 기준)

```css
:root {
  /* 한글·라틴 한 파일 → 혼합 렌더링 소멸 */
  --font-sans:    "Pretendard Variable", Pretendard, system-ui, -apple-system, sans-serif;
  --font-body:    var(--font-sans);

  /* display를 별도 face로 두지 않는다 — 같은 가족의 굵기·자간으로 위계를 준다 */
  --font-display: var(--font-sans);

  /* mono에도 반드시 한글 폴백 (원인 1) */
  --font-mono:    var(--font-jetbrains-mono), ui-monospace, Menlo, Consolas,
                  "Pretendard Variable", Pretendard, monospace;
}
```

**핵심 3가지 — 어느 폰트를 고르든 공통:**

1. **`--font-display`를 없앤다.** Space Grotesk 제거. 위계는 폰트가 아니라
   **굵기(650~690, 이미 그렇게 쓰고 있다) + letter-spacing**으로 준다. 한 줄 안 폰트 갈림이 사라진다.
2. **`--font-mono` 체인 끝에 한글 폰트를 반드시 붙인다.** 이것만으로 399곳이 해소된다.
3. **숫자에 `font-variant-numeric: tabular-nums`.** 현재 17곳에만 있다 —
   mono 399곳 중 숫자를 담는 자리에 전수 적용됐는지 별도 확인 필요.

### mono를 계속 쓸 것인가 — **결정 필요 (§2.7)**

mono 399곳 중 상당수가 **숫자가 아니라 한글 라벨**이다
(`table.data thead th` · `.kpi-card .label` · `.pill`).
고정폭은 숫자 정렬에는 맞지만 **한글 라벨에는 아무 이득이 없고 판독만 나빠진다.**

| 안 | 내용 | 규모 | 위험 |
|---|---|---|---|
| **ⓐ 최소** | mono 체인에 한글 폴백만 추가. 라벨은 계속 mono | CSS 1줄 | 없음 |
| **ⓑ 권장** | 한글 라벨 셀렉터를 `--font-sans`로 이관, mono는 **숫자·코드 전용**으로 축소 | 셀렉터 수십 곳 | 폭 변화 → 레이아웃 회귀 |

→ **"촌스럽지 않게"를 제대로 달성하려면 ⓑ지만, 변경 면적이 크고 회귀 위험이 있다.
§2.7(모호한 결정 임의 확정 금지)에 해당 — Gondry님 결정 필요.**

### 크기 하한

`--type-meta: 10px`은 한글에서 사실상 판독 불가에 가깝다. **한글 라벨 최소 11~12px 권고.**

---

## 2.4 채택 전 검증 절차 (추정 금지)

| # | 확인 항목 | 방법 |
|---|---|---|
| 1 | Pretendard `tnum` 실지원 | 실제 표에 `tabular-nums` 적용 후 자릿수 다른 숫자 정렬 육안 확인 |
| 2 | 13px 한글 판독 | `--type-body`로 데이터 표 렌더 후 **Windows Chrome**에서 확인 |
| 3 | 다크/라이트 양쪽 | 다크에서 굵기가 도드라짐 — 필요 시 `-webkit-font-smoothing` 조정 |
| 4 | 번들 증가 | variable woff2 self-host 시 초기 로드 증가량 실측 |
| 5 | 기존 레이아웃 | 폰트 폭 변화 → `white-space:nowrap` + `min-width` 자리(`.dashboard-top-stat` 등) 잘림 전수 확인 |

---

## 2.5 실행안 (승인 시)

### 경로 A — Pretendard (권장)

1. `v2-migration/public/fonts/PretendardVariable.woff2` **self-host**
   (CDN 링크 대신 self-host — 가용성·성능 리스크 회피)
2. `RootDocument.jsx`에서 `next/font/local`로 로드, **`weight: "45 920"` 명시**
   (WebKit에서 굵기가 안 맞는 알려진 이슈)
3. `DM_Sans` · `Space_Grotesk` · `Noto_Sans_KR` import 제거
4. `globals.css` **3개 `:root` 블록 전부** 토큰 갱신
   (§7 *"마지막 정의를 볼 것"* — 하나만 고치면 안 됨)
5. KR/EN 양쪽 확인 (§2.11)
6. `npm run test:all` + `lint` + **`build`** (§16 — 배선을 바꿨으면 build까지)

### 경로 B — IBM Plex Sans KR (최소 비용)

`RootDocument.jsx` import 교체만. self-host 불필요.

```js
import { IBM_Plex_Sans_KR, IBM_Plex_Mono } from "next/font/google";
```

### 경로 C — 즉시 적용 가능한 응급 처치

**폰트 선택 논의와 무관하게 지금 넣을 값어치가 있다.**

```css
/* globals.css:4860 — 이 한 줄이 399곳을 고친다 */
--font-mono: var(--font-jetbrains-mono), ui-monospace, Menlo, Consolas,
             var(--font-noto-sans-kr), monospace;
```
\+ `RootDocument.jsx:14` `preload: false` → `true` (한글 FOUT 제거)

---

## 2.6 결론

| 선택 | 언제 |
|---|---|
| **Pretendard** | "깔끔하고 촌스럽지 않게"가 목표라면. 한국 실무 표준 + Inter 기반 데이터 판독성. self-host 필요 |
| **IBM Plex Sans KR** | 변경 비용 최소화 + mono 페어링까지 한 가족으로 맞추고 싶다면 |
| **응급 처치만** | 폰트 교체는 나중에, 지금 어지러움만 줄이고 싶다면 (경로 C) |

> **어느 쪽이든 §2.3의 3가지(display face 제거 · mono 한글 폴백 · tabular-nums)가 실제 원인이다.
> 폰트 이름을 바꾸는 것만으로는 원인 1이 안 고쳐진다.**

---

# 미결정 사항 정리

| # | 항목 | 선택지 |
|---|---|---|
| 1 | 오딧 범위 | A(L0~L2+신규도구 L3, 추천) / B / C / D(특정 PR) |
| 2 | 오딧 산출 | 보고서만 / 발견을 바로 고쳐 PR까지 |
| 3 | 폰트 | Pretendard / IBM Plex Sans KR / 응급 처치만 |
| 4 | mono 범위 | ⓐ 폴백만 추가(1줄) / ⓑ 한글 라벨 sans 이관(수십 곳, 권장) |

---

## 참고 출처

- [Pretendard — GitHub (orioncactus/pretendard)](https://github.com/orioncactus/pretendard)
- [Best Fonts for Dashboards (Data-Legible UI)](https://madegooddesigns.com/best-fonts-for-dashboards/)
- [18 Best Fonts for UI Design — 2026 Guide](https://taqwah.agency/blog/best-fonts-for-ui-design)
- [IBM Plex Sans KR — Google Fonts](https://fonts.google.com/specimen/IBM+Plex+Sans+KR)
- [IBM Plex — Languages](https://www.ibm.com/plex/languages/)
- [프리텐다드 vs 노토산스 vs 스포카 vs 인터롭](https://brunch.co.kr/@smootart/9)
- [Pretendard 폰트 최적화 (velog)](https://velog.io/@shackstack/Pretendard-%ED%8F%B0%ED%8A%B8-%EC%B5%9C%EC%A0%81%ED%99%94)
- [한글 웹 폰트 용량 비교 (velog)](https://velog.io/@hyunbin/%ED%95%9C%EA%B8%80-%EC%9B%B9-%ED%8F%B0%ED%8A%B8-%EC%9A%A9%EB%9F%89-%EB%B9%84%EA%B5%90)
- [웹폰트 적용과 성능 — 한글 폰트 최적화](https://unwebs.co.kr/guide/design-webfont/)
