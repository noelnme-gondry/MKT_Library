# 타이포그래피 폰트 리서치 — 한글 데이터 UI 가독성

> 2026-08-24 · 요청: "데이터 보기가 어지럽다, 특히 한글 폰트". 웹서치 + 코드 실측 대조.
> **본 문서는 리서치·제안이며 코드는 아직 변경하지 않았다.** 채택 시 §5 실행안 참조.

---

## 1. 진단 — 지금 무슨 일이 일어나고 있나 (코드 실측)

### 1.1 로드되는 폰트 4종 (`src/components/RootDocument.jsx:11-14`)

| 변수 | 폰트 | subset | 한글 글리프 |
|---|---|---|---|
| `--font-dm-sans` | DM Sans | `latin` | ❌ 없음 |
| `--font-space-grotesk` | Space Grotesk | `latin` | ❌ 없음 |
| `--font-jetbrains-mono` | JetBrains Mono | `latin` | ❌ 없음 |
| `--font-noto-sans-kr` | Noto Sans KR | (미지정) `preload:false` | ✅ 있음 |

**한글 글리프를 가진 폰트는 Noto Sans KR 하나뿐인데, 어느 토큰에서도 1순위가 아니다.**

### 1.2 토큰 실효값 — `:root`가 3번 정의됨 (19행 · 4796행 · 8347행, **마지막이 이김**)

```css
/* globals.css:8364 — 실효 정의 */
--font-sans:    var(--font-dm-sans), var(--font-noto-sans-kr), system-ui, …
--font-display: var(--font-space-grotesk), var(--font-noto-sans-kr), var(--font-dm-sans), …
/* globals.css:4860 — 8347 블록에 없어서 여기가 실효 */
--font-mono:    var(--font-jetbrains-mono), ui-monospace, Menlo, Consolas, monospace;
```

### 1.3 ⚠ 핵심 원인 — `--font-mono`에 **한글 폴백이 없다**

`--font-mono` 사용처 **399곳** (`--font-sans` 34곳 · `--font-display` 71곳). 즉 앱 텍스트의 압도적 다수가 mono다. 그런데 그 체인 어디에도 한글 폰트가 없다.

실제로 mono가 걸린 셀렉터(한글이 들어가는 라벨들):

```
table.data thead th   ← 모든 데이터 표 헤더
.kpi-card .label      ← KPI 카드 라벨
.kpi-card .delta
.summary-label
.pill                 ← 칩·배지
.toc-title  .card-eyebrow  .nav-group-index  .brand-sub
.pvm-bridge .bl  .pvm-mover .mv  .phase-card-step/-tag/-meta
```

→ 이 한글은 전부 **OS 기본 고정폭 폰트**로 떨어진다.
- Windows: Consolas에 한글 없음 → 시스템 폴백(맑은 고딕/굴림 계열). **가장 어지러운 조합.**
- macOS: Menlo → Apple SD Gothic Neo. 상대적으로 나음.
→ **개발 환경(맥)에서는 멀쩡해 보이고 실사용자(윈도우)에게만 깨진다.** 이게 "너무해"의 정체일 가능성이 가장 높다.

### 1.4 두 번째 원인 — 한 줄 안에서 폰트가 갈린다

`--font-display`(Space Grotesk)는 KPI 숫자·결과 카드 수치에 쓰인다(`globals.css:5126`, `:5435`).
- 숫자·영문 → Space Grotesk (기하학적 display face, 특유의 `1`·`2`·`7`)
- 같은 줄의 한글 → Noto Sans KR

→ **획 굵기·x-height·베이스라인이 서로 다른 두 폰트가 한 줄에 섞인다.** "촌스럽다"는 감각의 물리적 근거. Space Grotesk는 본래 헤드라인용이지 데이터 표시용이 아니다.

### 1.5 세 번째 — 크기가 작다

`--type-body: 13px` · `--type-meta: 10px` (`globals.css:8360-8362`).
Noto Sans KR은 x-height가 낮은 편이라 13px 이하 한글에서 획이 뭉갠다. 같은 13px이라도 Pretendard 쪽이 눈에 띄게 크게 보인다.

### 1.6 네 번째 — `preload:false`

Noto Sans KR이 `preload:false`라 한글은 **매번 늦게 스왑된다**(FOUT). 첫 페인트에서 시스템 폰트 → 잠시 후 Noto로 튐. 표가 많은 화면에서 레이아웃이 한 번 흔들린다.

**요약: 폰트 하나를 바꾸는 문제가 아니라, 한글에 대해 4종 스택 전체가 설계되지 않은 상태다.**

---

## 2. 후보 폰트 — KO/EN 통합 (실무 채택률 순)

**전제**: 데이터 UI 폰트의 요건은 ① 작은 크기 판독 ② 숫자 정렬(tabular figures) ③ 한글·영문 한 파일 → 혼합 렌더링 제거 ④ 중립적(브랜드 주장 없음).

### ★ A. Pretendard — **1순위 추천**

| | |
|---|---|
| 라이선스 | SIL OFL (상업 이용·수정·재배포 가능, 폰트 단독 판매만 금지) |
| 굵기 | 9종 / Variable `45~920` |
| 설계 | **Inter**(라틴) + Source Han Sans(한글) + M PLUS 1p(일문)를 기반으로 재설계 |
| 배포 | variable woff2, subset(동적 서브셋 92분할), CDN, npm |

- 한국 IT 실무에서 사실상 표준(토스·당근·카카오 계열 다수). **"system-ui 대체"를 목표로 설계**돼 UI 밀도에 맞다.
- **라틴이 Inter 기반**이라는 점이 결정적이다 — §1의 웹서치에서 데이터 대시보드 1순위로 꼽히는 게 Inter다. 즉 **Inter의 데이터 판독성을 그대로 가지면서 한글이 같은 파일에 들어있다.**
- Noto Sans KR 대비 자간·행간이 정돈돼 장시간 열람 피로가 적다는 평가.
- ⚠ **확인 필요**: `tnum`(tabular figures) 지원 여부가 공식 README에 명시돼 있지 않다. Inter 기반이라 있을 가능성이 높지만 **추정이다** — §4 검증 절차로 확인할 것.
- ⚠ Google Fonts에 없다 → `next/font/local` + self-host 필요(§5).

### B. IBM Plex Sans KR — 2순위

| | |
|---|---|
| 라이선스 | OFL |
| 굵기 | 7~8종 (Thin~ExtraBold), Google Fonts 제공 |
| 설계 | IBM 기업 서체의 한글판. **UI 환경 전용으로 설계** |

- **`next/font/google`로 바로 붙는다** — 지금 구조 그대로, import 한 줄 교체로 끝난다. 도입 비용 최저.
- 라틴 IBM Plex Sans는 데이터 대시보드 추천 3강(Inter·Roboto·IBM Plex Sans) 중 하나. `IBM Plex Mono`와 한 가족이라 **mono 페어링이 자동으로 맞는다** — mono 399곳을 쓰는 이 앱에 구조적으로 유리하다.
- 성격이 Pretendard보다 뚜렷하다(약간의 기술적/기업적 인상). 중립성만 놓고 보면 Pretendard가 낫다.

### C. Noto Sans KR (현행 유지, 순서만 승격) — 최소 변경안

- 이미 로드 중. `--font-mono`에 폴백 추가 + `preload:true`만 해도 §1.3 문제는 해소된다.
- 다만 Noto는 본문 밀도 UI에서 다소 무겁고 x-height가 낮아 13px에서 불리하다. **"덜 나쁘게"는 되지만 "깔끔"까지는 안 간다.**

### D. SUIT — 참고

- 무료, 한글 UI 폰트. 가독성 중심 추천에 자주 등장하지만 Pretendard 대비 실무 채택 폭과 문서화가 얇다. 굳이 선택할 이유가 없다.

### 비추천

| 폰트 | 이유 |
|---|---|
| **Space Grotesk** (현행 display) | 헤드라인용 display face. 데이터 수치에 부적합 + 한글 없음 → 혼합 렌더링 원인 |
| **DM Sans** (현행 sans) | 라틴 전용. 기하학적 숫자라 표 정렬에서 Inter 계열보다 불리 |
| Spoqa Han Sans | 숫자 표현에 강하다는 평이 있으나 업데이트가 오래 멈춤 |

---

## 3. 권고안

### 3.1 폰트 스택 (Pretendard 채택 기준)

```css
:root {
  /* 한글·라틴 한 파일 → 혼합 렌더링 소멸 */
  --font-sans:    "Pretendard Variable", Pretendard, system-ui, -apple-system, sans-serif;
  --font-body:    var(--font-sans);

  /* display를 별도 face로 두지 않는다 — 같은 가족의 굵기·자간으로 위계를 준다 */
  --font-display: var(--font-sans);

  /* mono에도 반드시 한글 폴백 (§1.3) */
  --font-mono:    var(--font-jetbrains-mono), ui-monospace, Menlo, Consolas,
                  "Pretendard Variable", Pretendard, monospace;
}
```

**핵심 3가지:**
1. **`--font-display`를 없앤다** — Space Grotesk 제거. 위계는 폰트가 아니라 **굵기(650~690, 이미 그렇게 쓰고 있다) + letter-spacing**으로 준다. 한 줄 안 폰트 갈림이 사라진다.
2. **`--font-mono` 체인 끝에 한글 폰트를 반드시 붙인다.** 이것만으로 §1.3(399곳)이 해소된다.
3. **숫자에는 `font-variant-numeric: tabular-nums`** — 이미 17곳에 있으나, mono 399곳 중 숫자를 담는 자리에 전수 적용됐는지 별도 확인 필요.

### 3.2 mono를 계속 쓸 것인가 — 별도 결정 필요

mono 399곳 중 상당수가 **숫자가 아니라 한글 라벨**이다(`table.data thead th`·`.kpi-card .label`·`.pill`). 고정폭은 숫자 정렬에는 맞지만 **한글 라벨에는 아무 이득이 없고 판독만 나빠진다.**

| 안 | 내용 | 규모 |
|---|---|---|
| **가 (최소)** | mono 체인에 한글 폴백만 추가. 라벨은 계속 mono | CSS 1줄 |
| **나 (권장)** | 한글 라벨 셀렉터는 `--font-sans`로 이관, mono는 **숫자·코드 전용**으로 축소 | 셀렉터 수십 곳 |

→ **이건 §2.7(모호한 결정 임의 확정 금지)에 해당하므로 Gondry님 결정이 필요하다.** "촌스럽지 않게"를 제대로 달성하려면 (나)지만, 변경 면적이 크고 회귀 위험이 있다.

### 3.3 크기 하한

`--type-meta: 10px`은 한글에서 사실상 판독 불가에 가깝다. §12.30의 타이포 하한 9.5px 가드는 통과하지만 **가드를 통과하는 것과 읽히는 것은 다르다.** 한글 라벨 최소 11~12px 권고.

---

## 4. 채택 전 검증 절차 (추정 금지)

| # | 확인 항목 | 방법 |
|---|---|---|
| 1 | Pretendard `tnum` 실지원 | 실제 표에 `font-variant-numeric: tabular-nums` 적용 후 자릿수 다른 숫자 정렬 육안 확인 |
| 2 | 13px 한글 판독 | `--type-body`로 실제 데이터 표 렌더 후 Windows Chrome에서 확인 |
| 3 | 다크/라이트 양쪽 | Pretendard는 다크에서 굵기가 도드라짐 — 필요 시 `-webkit-font-smoothing` 조정 |
| 4 | 번들 증가 | variable woff2 self-host 시 초기 로드 증가량 실측 |
| 5 | 기존 레이아웃 | 폰트 폭이 바뀌면 `white-space: nowrap` + `min-width` 자리(`.dashboard-top-stat` 등)에서 잘림 발생 가능 — 전수 확인 |

---

## 5. 실행안 (승인 시)

### 5.1 Pretendard 채택 경로 (권장)

1. `v2-migration/public/fonts/PretendardVariable.woff2` self-host (**CDN 링크 금지** — 외부 요청 = §2.2 데이터 원칙과 무관하지만 가용성·성능 리스크)
2. `RootDocument.jsx`에서 `next/font/local`로 로드, `weight: "45 920"` 명시 (**WebKit에서 굵기가 안 맞는 알려진 이슈**)
3. `DM_Sans`·`Space_Grotesk`·`Noto_Sans_KR` import 제거
4. `globals.css` **3개 `:root` 블록 전부** 토큰 갱신 (§7 "마지막 정의를 볼 것" — 하나만 고치면 안 됨)
5. KR/EN 양쪽 확인 (§2.11)
6. `npm run test:all` + `lint` + `build`

### 5.2 IBM Plex Sans KR 경로 (최소 비용)

`RootDocument.jsx`의 import 교체만으로 끝난다. self-host 불필요.

```js
import { IBM_Plex_Sans_KR, IBM_Plex_Mono } from "next/font/google";
```

### 5.3 즉시 적용 가능한 응급 처치 (폰트 교체와 무관하게 지금 해도 되는 것)

```css
/* globals.css:4860 — mono 한글 폴백. 이 한 줄이 399곳을 고친다 */
--font-mono: var(--font-jetbrains-mono), ui-monospace, Menlo, Consolas,
             var(--font-noto-sans-kr), monospace;
```
+ `RootDocument.jsx:14` `preload: false` → `true` (FOUT 제거)

**폰트 선택 논의가 길어지더라도 이 두 줄은 먼저 넣을 가치가 있다.**

---

## 6. 결론

| 선택 | 언제 |
|---|---|
| **Pretendard** | "깔끔하고 촌스럽지 않게"가 목표라면. 한국 실무 표준 + Inter 기반 데이터 판독성. self-host 필요 |
| **IBM Plex Sans KR** | 변경 비용을 최소화하고 mono 페어링까지 한 가족으로 맞추고 싶다면 |
| **응급 처치만** | 폰트 교체는 나중에, 지금 당장 어지러움만 줄이고 싶다면 (§5.3) |

**어느 쪽이든 §3.1의 3가지(display face 제거 · mono 한글 폴백 · tabular-nums)는 공통이며, 그게 실제 원인이다. 폰트 이름을 바꾸는 것만으로는 §1.3이 안 고쳐진다.**

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
