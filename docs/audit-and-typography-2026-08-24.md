# 오딧 방법론 + 한글 타이포그래피 실행 스펙

> 2026-08-24 · **Codex 핸드오프 스펙** (AGENTS.md §9 "설계 스펙 먼저, 구현은 핸드오프")
> 대상: Growth Opt Playbook / `v2-migration/`
> 작성 시점 기준 **코드 변경 없음.** 본 문서는 자체완결 스펙이며, 아래 §0 결정이 채워지면 그대로 실행 가능하다.

---

# §0 미결정 4건 — 실행 전 여기부터 채울 것

**Codex는 이 표가 비어 있으면 PART 3(폰트 구현)을 시작하지 말 것.**
§2.7(모호한 결정 임의 확정 금지)에 해당하는 항목들이다.

| # | 항목 | 선택지 | 결정 |
|---|---|---|---|
| **D1** | 오딧 범위 | `A` L0~L2 + 신규도구 L3 **(추천)** / `B` A + 전 도구 L3 / `C` B + L4 재현 스크립트 / `D` 특정 PR만 | ☐ |
| **D2** | 오딧 산출 | `보고서만` / `발견을 바로 고쳐 PR까지` | ☐ |
| **D3** | 폰트 | `P` Pretendard **(추천)** / `I` IBM Plex Sans KR / `C` 응급 처치만 | ☐ |
| **D4** | mono 범위 | `ⓐ` 폴백만 추가(CSS 1줄) / `ⓑ` 한글 라벨을 sans로 이관 **(권장)** | ☐ |

**단, D3·D4가 미결정이어도 PART 3 §3.1 "응급 처치"는 단독 선행 가능하다** — 어떤 선택지에서도 되돌릴 필요가 없는 변경이다.

**의존 관계**: D4=ⓑ는 D3와 무관하게 독립 수행 가능. D3=P는 self-host 자산 추가가 선행된다.

---

# PART 1 — 웹사이트 오딧 방법론

AGENTS.md §6.2(감사 흐름) 기준. **위→아래로 갈수록 비용이 커진다. 위 계층에서 걸린 게 있으면 거기서 멈추고 보고할 것.**

## 1.1 대상 범위 — 커밋 #690~#722

| 영역 | 커밋 |
|---|---|
| 도치(Dochi) 워크벤치 | #712 · #717~#722 |
| 의미기반 CSV 매핑 엔진 V2 | #709 |
| 5-28 핵심 액션 생존 분석 | #712 · #713 |
| 계측·광고 호스트 게이트 | #703 · #704 |
| E2E·브라우저 품질 하네스 | #705 · #706 · #707 |
| 분석 라우터·운영 흐름 검증 | #711 · #714 |
| 홈 인덱스·도구 갈래 재구성 | #691~#700 |

## 1.2 5계층

| 계층 | 무엇을 보나 | 도구 | 잡히는 것 |
|---|---|---|---|
| **L0 기준선** | `test:all` · `lint` · `build` **실제 실행** | npm | 하네스가 지금 실제로 초록인지 (§16 수치가 낡았을 수 있음) |
| **L1 주장 검증** | PR 본문 vs 실제 diff | `git show` | "고쳤다"가 코드에 있는지, 가드가 진짜 가드인지 |
| **L2 배선 정합** | SSOT ↔ 파생 레지스트리 | grep 전수 | 신규 도구가 20~25곳 배선 중 빠뜨린 곳 |
| **L3 정직성** | 화면 숫자 = 실제 계산인가 | 재현 스크립트 | 거짓 숫자 · "미상→좋은 등급" · 무유의 단정 |
| **L4 실사용** | 실제 CSV로 업로드→매핑→분석 | node repro / e2e | 골든이 못 보는 render throw · 매핑 실패 |

## 1.3 계층별 검사 항목

### L0 — 기준선
```bash
cd v2-migration && npm run test:all && npm run lint && npm run build
```
> §16의 "276파일·2268 통과"는 2026-08-19 실측이다. **수치를 인용하지 말고 다시 돌려서 적을 것.**

### L1 — 주장 검증
- 새 가드 테스트가 **하드코딩 배열이 아니라 SSOT 파생**인지
  (§7 *"가드가 있다는 사실이 가드가 없다는 사실을 가린다"*)
- 테스트 안 `foo?.()` / 조건부 `if` 안의 단언 → **조용히 삭제된 검사**
- 소스를 `includes("X")`로 검사 → **주석·import 줄에 걸려 통과**하는 가짜 가드
  (§16에 한 세션 3회 재발 기록)

```bash
# 가짜 가드 후보 추출
grep -rn "?\.\(" v2-migration/src --include=*.test.js --include=*.test.jsx
grep -rn 'includes("' v2-migration/src --include=*.test.js | grep -i "source\|readFileSync"
```

### L2 — 배선 정합 (신규 도구가 있을 때 최우선)
- `TOOL_GROUP` ↔ store `csvGroups` ↔ `TEMPLATE_FAMILY` **3맵 파생 여부**
  → 미등록 = 업로드 소실(#603/#604) 또는 렌더 throw(#608/#610)
- **형제 id grep 전수** — §12.1의 10단계는 최소집합이지 전부가 아니다(실측 25곳)
  ```bash
  grep -rn "5-28" v2-migration/src | cut -d: -f1 | sort -u
  ```
- **KR/EN 대칭**(§2.11) — EN 짝파일 · `EN_*_SLUGS` 누락
- 가드 정규식이 새 id 형태를 건너뛰지 않는지 (`^(5|9)-\d+$` 류가 하이픈 id를 통째로 스킵한 전례)

### L3 — 정직성 (§8)
- 적합 실패를 좋은 값으로 접는 자리 (`r2=0 → VIF=1`, `null → "포화"`)
- **학습 오차 > OOS 오차** 부등식 → 적합값이 점예측이 아니라는 신호
- 계산해 놓고 판정에 안 쓰는 플래그 (§16 *"신호를 계산해 놓고 안 쓰는 자리"* 실측 3건)
- 무유의를 "효과 없음"으로 단정하지 않는지 / 데이터 없는 상태를 날조하지 않는지

### L4 — 실사용
- 데모 픽스처가 아니라 **실제 플랫폼 export 컬럼명**으로 자동매핑
  (§7 *"데모 픽스처가 표준키를 헤더로 쓰면 자동매핑은 검사된 적이 없다"*)
- 신규 화면(도치 워크벤치)의 **진입 경로 자체를 밟는** 스모크가 있는지
  → `beforeEach` 상태 주입은 `setCurrentRouteId` → 미러 스왑을 우회한다

## 1.4 보고 형식

발견은 **재현 가능한 형태로**: `입력 → 기대 → 실제`. 심각도 순 정렬. **추측은 추측이라고 명시.**

---

# PART 2 — 타이포그래피 진단 (코드 실측)

> 요청: *"데이터 보기가 너무 어지럽다, 특히 한글 폰트."*
> 결론: **폰트 선택이 아니라 스택 배선 문제다.**

## 2.1 캐스케이드 구조 — `:root`가 3곳, 레이어가 다르다

`globals.css:15` → `@layer reset, tokens, app;`

| 위치 | 레이어 | 승패 |
|---|---|---|
| `globals.css:19` `:root` | `tokens` (17행 시작) | ❌ **app 레이어에 짐 → 전체 사문화** |
| `globals.css:4796` `:root` | `app` (188행 시작) | △ mono만 실효 |
| `globals.css:8347` `:root` | `app` | ✅ sans·body·display 실효 (소스 순서 뒤) |

**실효값:**
```css
/* globals.css:8364-8366 */
--font-sans:    var(--font-dm-sans), var(--font-noto-sans-kr), system-ui, …
--font-body:    var(--font-sans);
--font-display: var(--font-space-grotesk), var(--font-noto-sans-kr), var(--font-dm-sans), …

/* globals.css:4860 — 8347 블록이 재정의하지 않아 여기가 실효 */
--font-mono:    var(--font-jetbrains-mono), ui-monospace, Menlo, monospace;
```

> ⚠ `globals.css:86-88`의 `--font-sans: "Inter", …`는 **`tokens` 레이어라 app에 지고, 게다가 Inter는 로드조차 되지 않는다.** 죽은 선언이다.
> §7 *"토큰 값을 대조할 땐 마지막 정의를 볼 것"* + 레이어까지 함께 봐야 하는 사례.

## 2.2 로드되는 폰트 4종 (`src/components/RootDocument.jsx:11-14`)

| 변수 | 폰트 | subset | 한글 글리프 |
|---|---|---|---|
| `--font-dm-sans` | DM Sans | `latin` | ❌ |
| `--font-space-grotesk` | Space Grotesk | `latin` | ❌ |
| `--font-jetbrains-mono` | JetBrains Mono | `latin` | ❌ |
| `--font-noto-sans-kr` | Noto Sans KR | (미지정) `preload:false` | ✅ |

**한글 글리프를 가진 폰트는 Noto Sans KR 하나뿐인데, 어느 토큰에서도 1순위가 아니다.**

## 2.3 ⚠ 원인 1 (핵심) — `--font-mono`에 한글 폴백이 없다

**사용량 실측** (2026-08-24, `globals.css`):

| 토큰 | 사용처 수 |
|---|---|
| `var(--font-mono)` | **399** |
| `var(--font-display)` | 71 |
| `var(--font-sans)` | 34 |

앱 텍스트의 압도적 다수가 mono인데, 그 체인 어디에도 한글이 없다.
mono가 걸린 셀렉터 — **전부 한글 라벨이다**:

```
table.data thead th          ← 모든 데이터 표 헤더
.kpi-card .label / .delta
.summary-label
.pill                        ← 칩·배지
.toc-title  .card-eyebrow  .nav-group-index  .brand-sub
.pvm-bridge .bl   .pvm-mover .mv
.phase-card-step / -tag / -meta
code.inline  pre
```

→ 이 한글은 전부 **OS 기본 고정폭 폰트**로 폴백한다.

| OS | 결과 |
|---|---|
| **Windows** | `ui-monospace`→Consolas에 한글 없음 → 시스템 폴백(맑은 고딕/굴림 계열). **가장 어지러운 조합** |
| **macOS** | `Menlo` → Apple SD Gothic Neo. 상대적으로 나음 |

> **개발 환경(맥)에서는 멀쩡해 보이고 실사용자(윈도우)에게만 깨진다.**
> 지금까지 안 잡힌 이유이자 "한글 폰트가 너무해"의 가장 유력한 정체.

## 2.4 ⚠ 원인 2 — 한 줄 안에서 폰트가 갈린다

`--font-display`(Space Grotesk)는 KPI 숫자·결과 카드 수치에 쓰인다:
- `globals.css:5126` `.kpi-card .value`
- `globals.css:5435` `.result-action-card__stats strong`

한 줄 안에서 **숫자·영문 → Space Grotesk / 한글 → Noto Sans KR**로 갈린다.
획 굵기·x-height·베이스라인이 서로 다르다 → **"촌스럽다"의 물리적 근거.**
Space Grotesk는 본래 헤드라인용 display face이지 데이터 표시용이 아니다.

## 2.5 ⚠ 원인 3 — 크기

`globals.css:8361-8362` → `--type-body: 13px` · `--type-meta: 10px`
Noto Sans KR은 x-height가 낮아 13px 이하 한글에서 획이 뭉갠다.
§12.30의 하한 9.5px 가드는 통과하지만 **통과하는 것과 읽히는 것은 다르다.**

## 2.6 ⚠ 원인 4 — `preload: false`

`RootDocument.jsx:14`의 Noto Sans KR이 `preload:false`라 **한글만 늦게 스왑**된다(FOUT).
첫 페인트는 시스템 폰트 → 잠시 후 Noto로 튐. 표가 많은 화면에서 레이아웃이 한 번 흔들린다.

> **요약: 폰트 하나를 바꾸는 문제가 아니라, 한글에 대해 4종 스택 전체가 설계되지 않은 상태다.**

---

# PART 3 — 실행 스펙 (Codex)

## 3.1 응급 처치 — **D3·D4와 무관하게 선행 가능**

어떤 폰트를 고르든 되돌릴 필요가 없다. **이 두 줄이 399곳을 고친다.**

**① `v2-migration/src/app/globals.css:4860`**
```css
/* before */
--font-mono: var(--font-jetbrains-mono), ui-monospace, Menlo, monospace;
/* after */
--font-mono: var(--font-jetbrains-mono), ui-monospace, Menlo, Consolas,
             var(--font-noto-sans-kr), monospace;
```

**② `v2-migration/src/components/RootDocument.jsx:14`**
```js
/* before */ preload: false
/* after  */ preload: true
```

**검증**: `npm run test:all` · `lint` · `build` + Windows Chrome에서 데이터 표 헤더 육안 확인.

---

## 3.2 D3 = `P` (Pretendard) 경로

| | |
|---|---|
| 라이선스 | SIL OFL (상업 이용·수정·재배포 가능, 폰트 단독 판매만 금지) |
| 굵기 | 9종 / Variable `45~920` |
| 설계 | **Inter**(라틴) + Source Han Sans(한글) + M PLUS 1p(일문) 기반 재설계 |
| 근거 | 라틴이 Inter 기반 = 데이터 대시보드 1순위 폰트의 판독성 + **한글이 같은 파일** |

**절차:**
1. `v2-migration/public/fonts/PretendardVariable.woff2` **self-host**
   (CDN 링크 금지 — 가용성·성능 리스크)
2. `RootDocument.jsx`에서 `next/font/local`로 로드, **`weight: "45 920"` 명시**
   > ⚠ 생략 시 **WebKit에서 굵기가 어긋나는 알려진 이슈**
3. `DM_Sans` · `Space_Grotesk` · `Noto_Sans_KR` import 제거 +
   `RootDocument.jsx:22`의 `<html className>` 변수 목록 동반 수정
4. **`globals.css`의 `:root` 3블록 전부** 갱신 — 19 · 4796 · 8347행
   > ⚠ 하나만 고치면 안 된다(§2.1). 19행 블록은 이 기회에 **삭제**가 맞다(사문화된 죽은 선언)
5. KR/EN 양쪽 확인 (§2.11)
6. `npm run test:all` + `lint` + **`build`**
   > §16 — 배선을 바꿨으면 build까지. 문자열만 보는 가드는 import 누락을 못 잡는다

**목표 스택:**
```css
--font-sans:    "Pretendard Variable", Pretendard, system-ui, -apple-system, sans-serif;
--font-body:    var(--font-sans);
--font-display: var(--font-sans);        /* Space Grotesk 제거 — 위계는 굵기로 */
--font-mono:    var(--font-jetbrains-mono), ui-monospace, Menlo, Consolas,
                "Pretendard Variable", Pretendard, monospace;
```

## 3.3 D3 = `I` (IBM Plex Sans KR) 경로 — 최소 비용

| | |
|---|---|
| 라이선스 | OFL |
| 굵기 | 7~8종, **Google Fonts 제공** |
| 근거 | UI 환경 전용 설계 + **`IBM Plex Mono`와 한 가족** → mono 399곳 페어링이 자동으로 맞음 |

`RootDocument.jsx` import 교체만. self-host 불필요.
```js
import { IBM_Plex_Sans_KR, IBM_Plex_Mono } from "next/font/google";
```
이후 §3.2의 4~6단계(토큰 3블록 · KR/EN · 검증)는 동일하게 수행.

## 3.4 D4 = `ⓑ` (mono 범위 축소) 경로

mono 399곳 중 상당수가 **숫자가 아니라 한글 라벨**이다.
고정폭은 숫자 정렬에는 맞지만 **한글 라벨에는 아무 이득이 없고 판독만 나빠진다.**

| 안 | 내용 | 규모 | 위험 |
|---|---|---|---|
| **ⓐ** | mono 체인에 한글 폴백만 추가 (= §3.1 ①) | CSS 1줄 | 없음 |
| **ⓑ** | 한글 라벨 셀렉터를 `--font-sans`로 이관, mono는 **숫자·코드 전용**으로 축소 | 수십 곳 | **폭 변화 → 레이아웃 회귀** |

**ⓑ 수행 시 — 목록을 손으로 적지 말고 파생할 것** (§7):
```bash
grep -n -B3 "var(--font-mono)" v2-migration/src/app/globals.css | grep "{"
```
→ 나온 셀렉터를 **"숫자/코드를 담는가"** 기준으로 분류.
- **mono 유지**: `pre` · `code.inline` · `table.data td .mono` · `.kpi-card .value` 등 숫자·코드
- **sans 이관**: `table.data thead th` · `.kpi-card .label` · `.pill` · `.toc-title` · `.card-eyebrow` 등 한글 라벨

**⚠ 필수 회귀 확인**: 폰트 폭이 바뀌면 `white-space: nowrap` + `min-width` 자리가 잘린다.
`.dashboard-top-stat`(`globals.css:7574`, `min-width:72px`)를 포함해 전수 확인.

## 3.5 공통 — 어느 경로든 반드시 함께

1. **`--font-display` 폐지.** 위계는 폰트가 아니라 **굵기(현재 이미 650~690 사용) + letter-spacing**으로.
2. **`--font-mono` 체인에 한글 폴백.** (원인 1)
3. **`font-variant-numeric: tabular-nums`** — 현재 **17곳**뿐이다.
   mono 399곳 중 숫자를 담는 자리에 전수 적용됐는지 확인.
4. **한글 라벨 최소 11~12px.** `--type-meta: 10px`은 한글에서 사실상 판독 불가.
   > ⚠ 인라인 `fontSize`가 jsx에 **600곳** 있다. `globals.css`만 고치면 우회로가 남는다(§12.30 전례).

---

# PART 4 — 채택 전 검증 (추정 금지)

| # | 확인 항목 | 방법 |
|---|---|---|
| 1 | **Pretendard `tnum` 실지원** | 실제 표에 `tabular-nums` 적용 후 자릿수 다른 숫자 정렬 육안 확인 |
| 2 | 13px 한글 판독 | `--type-body`로 데이터 표 렌더 후 **Windows Chrome**에서 확인 |
| 3 | 다크/라이트 양쪽 | 다크에서 굵기가 도드라짐 — 필요 시 `-webkit-font-smoothing` 조정 |
| 4 | 번들 증가 | variable woff2 self-host 시 초기 로드 증가량 실측 |
| 5 | 레이아웃 회귀 | `white-space:nowrap` + `min-width` 자리 잘림 전수 (§3.4) |

> ⚠ **#1은 미확인 사항이다.** Pretendard 공식 README에 `tnum` 지원이 **명시돼 있지 않다.**
> Inter 기반이라 있을 가능성이 높지만 **추정이며, 채택 전 실측이 필요하다**(§8 정직성).

---

# PART 5 — 결론

| 선택 | 언제 |
|---|---|
| **Pretendard** | "깔끔하고 촌스럽지 않게"가 목표라면. 한국 실무 표준 + Inter 기반 데이터 판독성. self-host 필요 |
| **IBM Plex Sans KR** | 변경 비용 최소화 + mono 페어링까지 한 가족으로 맞추고 싶다면 |
| **응급 처치만** | 폰트 교체는 나중에, 지금 어지러움만 줄이고 싶다면 (§3.1) |

> **어느 쪽이든 §3.5의 4가지가 실제 원인이다.
> 폰트 이름을 바꾸는 것만으로는 원인 1이 고쳐지지 않는다.**

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
