# 로컬 작업공간 영속 + 사생활 통제 — 구현 스펙

> 확정: 2026-08-26 · 기준 커밋 `69f4dab` · 작성 Claude
> **자체완결 스펙**(§9). 이 문서만 보고 구현할 수 있게 파일·줄·옵션·함정·검증을 다 넣었다.
> 선행 계획: `docs/direction-2026-08-26-depth-and-return.md`

---

## 0. 확정된 결정

| # | 결정 |
|---|---|
| D1 | 결정 기록 영속 **기본 ON** |
| D2 | **원본 CSV까지 저장**한다 (결정 요약만이 아니라) |
| D3 | 보관 기간 **90일**. 기준은 `lastUsedAt`(마지막 사용일) |
| D4 | 저장소는 **IndexedDB**. 설정·요약은 localStorage 유지(2층) |
| D5 | 정체성 카피를 **"모아두는 서버가 없어서 만든 사람도 못 본다"**로 교체 |
| D6 | **사생활 통제 화면을 제품 기능으로 만든다** — 저장 기능과 동시 출고 |
| D7 | 성공 계측은 이번 범위 밖 |

**D6이 이 스펙의 절반이다.** 원본이 디스크에 남는 건 새로운 성질이라, 저장만 켜고 통제를 나중에 붙이면 그 사이가 구멍이다.

---

## 1. 만들려는 것

```
[이번 주 월요일]
  사이트 열기 → 지난주 데이터가 이미 있음 → 새 주차 CSV만 추가 → 분석
                        ↑
              IndexedDB (이 기기 안에만, 90일)

[언제든]
  "이 기기에 저장된 것" 화면 → 무엇이 남아 있는지 보고 → 골라 지우거나 전부 지우기
```

지금은 매주 파일 고르기 → 매핑 확인 → 분석 3단계다. 이걸 1단계로 줄이는 게 목적이고,
저장 기본 ON은 그 수단이지 목적이 아니다. **카피도 그렇게 쓴다** — "기록해 두세요"가 아니라
"매주 다시 안 올려도 돼요".

---

## 2. 저장 계층 설계

### 2.1 2층 분리

전부 IndexedDB로 옮기지 않는다. 비동기라서 첫 렌더 분기가 전부 로딩 상태를 타게 된다.

| 층 | 저장소 | 내용 | 현재 상태 |
|---|---|---|---|
| 설정 | localStorage `mkt_view_config` | `viewConfig`·`customMetrics`·`customCharts`·`analystMode`·`eventMarkers`·결정 기록 요약 | 이미 있음 (`persistPartialize`, `useDataStore.js:482`) |
| 데이터 | **IndexedDB `mkt_workspace`** | 원본 CSV 텍스트·헤더·매핑·파일명·타임스탬프 | **신규** |

**원본 CSV를 zustand `persist`의 `partialize`에 넣지 말 것.** 그 허용목록이 §2.2의 방어선이고,
거기 원본을 얹으면 방어선 자체가 사라진다. 게다가 storage 백엔드가 localStorage로 되돌아가는
순간 5MB 초과로 조용히 throw한다. **별도 모듈에서 명시적으로 load/save 한다.**

```
src/lib/workspace-storage/
  db.js            IndexedDB 열기·버전·실패 폴백
  datasets.js      save / load / list / remove / clear
  expiry.js        90일 판정·정리(순수 함수 + 골든)
  index.js         공개 API
```

### 2.2 스키마

DB `mkt_workspace` v1

**store `datasets`** — keyPath `group` (CSV 그룹 = `TOOL_GROUP`의 값)

| 필드 | 타입 | 비고 |
|---|---|---|
| `group` | string | `"efficiency"`·`"segment_composition"` … |
| `fileName` | string | 화면 표시용 |
| `csvText` | Blob | **원본 텍스트 그대로**. 파싱 결과 배열이 아님 — §2.3 |
| `headers` | string[] | 목록 화면에서 재파싱 없이 보여주기 위함 |
| `rowCount` | number | 표시용 |
| `byteSize` | number | 표시용 |
| `mapping` | object | `csvGroups[group].mapping` |
| `mappingBindingsV2` | object | 있으면 함께 |
| `savedAt` | number | epoch ms |
| `lastUsedAt` | number | **만료 기준**. 열 때마다 갱신 |

**store `meta`** — keyPath `key`. `{ key: "lastSweepAt", value }` 등.

### 2.3 왜 파싱 결과가 아니라 원본 텍스트인가

| | 원본 텍스트(Blob) | 파싱된 객체 배열 |
|---|---|---|
| 용량 | 작다 | 2~4배 (키 반복) |
| 쓰기 비용 | Blob 하나 | 20만 객체 구조화 복제 → **메인 스레드 정지** |
| 읽기 비용 | 재파싱 필요 (수 초) | 즉시 |

쓰기는 사용자가 분석을 끝낸 직후에 일어나고, 읽기는 진입 시 한 번이다.
**읽기 쪽에 비용을 몰고 이미 있는 워커 파싱 경로(`Papa {worker:true}`)와
`ds/AnalyzingOverlay`를 재사용한다.** 쓰기에서 화면이 멈추는 쪽이 훨씬 나쁘다.

### 2.4 90일 만료

- 기준은 `savedAt`이 아니라 **`lastUsedAt`**. 매주 쓰는 데이터가 90일에 사라지면 안 된다.
- 판정은 순수 함수로 분리하고 골든을 둔다(`Date.now()`를 인자로 받는다 — §8 결정론).

```js
// expiry.js — 시각을 주입받아 결정론을 지킨다
export const RETENTION_DAYS = 90;
export function isExpired(entry, now) { … }
export function partitionByExpiry(entries, now) { … }  // { keep, expired }
```

- **정리 시점**: 앱 부팅 후 idle 1회 + 저장 직전. 분석 중에는 절대 안 돈다.
- **조용히 지우지 않는다.** 지웠으면 다음 진입 때 1회 안내한다.
  > "90일 넘게 안 쓴 데이터 2건을 지웠어요."
- 남은 기간을 목록에 항상 표시한다("남은 기간 83일").

### 2.5 저장 대상 / 제외 대상

- 저장: **사용자가 직접 올린 CSV만**
- 제외: **데모 데이터**(`demoDisabled` 플래그로 구분), 공유 링크로 들어온 요약,
  `responseMappingSession` 같은 휘발 세션 상태
- `decisionSessionRecordIds`는 `Set`이라 구조화 복제는 되지만 **저장 대상이 아니다**(세션 전용)

---

## 3. 사생활 통제 기능 (D6)

**저장 기능과 같은 PR에서 나간다.** 여섯 개 전부 있어야 출고다.

### 3.1 "이 기기에 저장된 것" 화면

새 라우트 — `/storage` (KO) · `/en/storage` (EN). **무주소 게이트 금지**(§12.28), 상태로만 존재하는 화면으로 만들지 않는다.

```
이 기기에 저장된 것

  이 목록은 이 브라우저 안에만 있어요. 서버로 보내지 않아서 만든 사람도 볼 수 없어요.

  ┌────────────────────────────────────────────────────────┐
  │ 효율 데이터        2026-08 캠페인.csv                   │
  │ 12,480행 · 2.1MB · 마지막 사용 8월 24일 · 남은 기간 88일│
  │                                              [지우기]   │
  ├────────────────────────────────────────────────────────┤
  │ 구성 변화          세그먼트_8월.csv                     │
  │ 192행 · 41KB · 마지막 사용 8월 26일 · 남은 기간 90일    │
  │                                              [지우기]   │
  └────────────────────────────────────────────────────────┘

  [전부 지우기]

  □ 이 기기에 저장하기          ← 기본 켜짐. 끄면 위 목록도 즉시 전부 지워짐
```

접근 경로 넷 — 헤더, ⌘K, `/privacy` 페이지 본문 링크, 업로드 화면의 "저장됨" 표시.
**하나만 두면 아무도 못 찾는다**(§12.29의 "인바운드 링크가 하나뿐이면 사이트에 붙은 게 아니다").

### 3.2 여섯 통제 장치

| # | 장치 | 동작 |
|---|---|---|
| P1 | 한 번에 지우기 | `[전부 지우기]` → 확인 1회 → IndexedDB `datasets` 비우기 + 메모리 슬라이스 초기화 |
| P2 | 개별 지우기 | 그룹 단위. 그 그룹만 |
| P3 | 90일 자동 만료 | §2.4 |
| P4 | 저장 중 표시 | 목록 화면 + 업로드 화면 상단 한 줄("이 기기에 저장돼요 · 90일") |
| P5 | 끄기 | 기본 ON. 끄면 **즉시 전부 삭제**하고 이후 저장 안 함 |
| P6 | 실패 정직 고지 | 사생활 보호 모드·용량 부족·브라우저 자동 정리 → §3.3 |

### 3.3 저장이 안 되는 환경

조용히 실패하면 안 된다. **"저장했다고 믿었는데 없다"가 가장 나쁘다.**

| 상황 | 감지 | 화면 |
|---|---|---|
| IndexedDB 없음/차단 | `indexedDB` 접근 시 throw 또는 open onerror | "이 브라우저에서는 저장이 안 돼요. 분석은 그대로 됩니다." |
| 용량 부족 | `QuotaExceededError` | "기기 공간이 부족해 저장하지 못했어요. 지난 데이터를 지우면 됩니다." + 목록 링크 |
| 브라우저가 임의 삭제 | 진입 시 있어야 할 엔트리가 없음 | 없었던 것처럼 굴지 말고 "브라우저가 저장 공간을 정리한 것 같아요." |

`navigator.storage.persist()`는 **요청은 하되 결과에 의존하지 않는다.** 거부돼도 기능은 그대로 돌아야 한다.

---

## 4. 사실 계약 변경 (같은 PR)

**기본값을 뒤집는 순간 지금 공개된 문장 하나가 거짓이 된다.** 나눠서 배포하면 그 사이 배포분이 거짓말을 한다.

### 4.1 F-04 교체

`docs/product-ssot.md:68` — **여기를 먼저 고치고 코드를 그 사본으로 맞춘다**(§2.12).

```
기존  | F-04 | 새로고침하면 분석 데이터가 사라지는 것이 기본 동작입니다.
      |      | 서버·브라우저 저장소에 기본 보존하지 않음.

신규  | F-04 | 분석 데이터는 이 기기에만 저장되고, 90일 뒤 자동으로 지워집니다.
      |      | 서버로 전송·보관하지 않음. 사용자가 언제든 지울 수 있고 저장을 끌 수 있음.
      |      | "완전히 안전"·"절대 유출 없음" 같은 절대 보안 주장은 금지(F-03과 같은 이유).
```

### 4.2 `brandFacts.js` (`src/lib/brandFacts.js:57`)

```js
// 기존
ko: { claim: "새로고침하면 데이터가 사라집니다.",
      detail: "분석 결과를 서버나 브라우저 저장소에 남기지 않는 것이 기본 동작입니다." },

// 신규
ko: { claim: "데이터는 이 기기에만 저장돼요.",
      detail: "올린 파일은 이 브라우저 안에서 열리고 계산돼요. 인터넷으로 어디에도 보내지 않아서 만든 사람도 볼 수 없어요. 90일이 지나면 자동으로 지워지고, 언제든 직접 지울 수 있어요." },
en: { claim: "Your data is stored on this device only.",
      detail: "Your file is opened and calculated inside this browser. It is never sent anywhere, so not even we can see it. It is erased automatically after 90 days, and you can erase it yourself at any time." },
```

### 4.3 한 줄 정체성 (히어로·랜딩)

> **KO** — 데이터를 모아두는 서버가 없어요. 그래서 만든 사람도 여러분 파일을 볼 수 없어요.
> **EN** — There's no server collecting your data. Not even we can see your file.

**쓰면 안 되는 표현**: "100% 안전", "완벽한 보안", "절대 유출되지 않음".
제품이 보장할 수 있는 범위(전송 안 함·서버에 없음)를 넘는다. `brandFacts.js:50` 주석에 같은 이유가 이미 적혀 있다.

### 4.4 고칠 파일

1. `docs/product-ssot.md:68` — F-04 (**먼저**)
2. `src/lib/brandFacts.js:57` — `persistence`
3. `src/app/(ko)/privacy/page.js:31` "브라우저에 저장되는 정보" 절 — 저장 항목·90일·삭제 방법
4. `src/app/(en)/en/privacy/page.js` — 같은 절 (§2.11)
5. `src/app/llms.txt/route.js` — 파생이지만 스냅샷 테스트 갱신 확인
6. `utils/toolGuide.js` / `ds/CsvGuide` — 업로드 화면 안내
7. `AGENTS.md §7` — "localStorage 영속 금지. 새로고침 리셋이 기본." **틀린 규칙이 되므로 같은 작업에서 갱신**(§15)
8. 관련 테스트 — **문장을 테스트에 복사하지 말고 SSOT를 조회해 대조**(§12.29)

---

## 5. 배선 지점

| 파일:줄 | 지금 | 바꿀 것 |
|---|---|---|
| `store/useDataStore.js:19` | `APP_PERSIST_VERSION = 3` | `4` |
| `store/useDataStore.js:482` | `persistPartialize` | `decisionRecords` 조건 제거(항상 저장), 원본은 **넣지 않음** |
| `store/useDataStore.js:504` | `persistMigrate` | v4 규칙 — §5.1 |
| `store/useDataStore.js:588` | `decisionPersistenceEnabled: false` | `true` |
| `store/useDataStore.js:771` | `csvGroups: buildGroupMap(EMPTY_SLICE)` | 부팅 후 IndexedDB에서 복원(비동기) |
| `store/useDataStore.js:906` | 파싱 후 슬라이스 세팅 | 세팅 직후 `datasets.save(group, …)` |
| `store/useDataStore.js:834` | 그룹 비우기 | IndexedDB 엔트리도 함께 제거 |
| `routeMap.js` | — | `/storage` 라우트 추가 (+ `sitemap.js`는 **제외**, noindex) |

### 5.1 마이그레이션 규칙 (가장 놓치기 쉬운 자리)

지금 기본값이 `false`라서 **"명시적으로 끈 사람"과 "한 번도 안 물어본 사람"이 구분되지 않는다.**
구분 신호는 `decisionPersistencePromptSeen`이다.

```js
// v4 migrate
if (version < 4) {
  const declined = state.decisionPersistencePromptSeen === true
                && state.decisionPersistenceEnabled !== true;
  // 명시적으로 거절한 사람의 선택을 새 기본값이 덮지 않는다.
  state.decisionPersistenceEnabled = declined ? false : true;
}
```

이 한 줄이 없으면 **저장을 거부했던 사용자의 결정을 조용히 뒤집는다.** 골든으로 고정한다.

---

## 6. 미리 알려진 함정

- **zustand `persist`는 동기 storage를 전제로 설계돼 있다.** IndexedDB를 그 백엔드로 끼우면
  hydration 타이밍이 렌더 분기와 얽힌다 → §2.1대로 **별도 모듈**로 간다.
- **SSR/테스트 환경에 `indexedDB`가 없다.** `noopStorage`와 같은 형태의 폴백을 둔다
  (`useDataStore.js:500`에 선례 있음).
- **`Set`은 구조화 복제는 되지만 저장 대상이 아니다** — `decisionSessionRecordIds`.
- **데모 데이터를 저장하면 안 된다.** `/start`의 `startMyData()`가 `demoDisabled=true`로
  데모 슬라이스만 비우는 기존 흐름과 충돌하지 않게 할 것(§12.8).
- **다중 탭** — 한 탭에서 지우면 다른 탭은 모른다. 1차 범위에서는 다루지 않되,
  지우기 후 해당 탭의 메모리 슬라이스를 반드시 함께 비운다(화면과 저장소가 어긋나는 게 더 나쁘다).
- **만료 정리가 분석 중에 돌면 안 된다.** 부팅 idle 1회 + 저장 직전으로 못 박는다.
- **복원 시 매핑 계약 확인** — 저장된 `mapping`이 지금 코드의 필드 계약과 다를 수 있다
  (도구가 필드를 추가/개명한 경우). 복원 후 유효성 검사에서 걸러 **재매핑 화면으로 보낼 것**.
  조용히 깨진 매핑으로 분석하면 거짓 숫자가 나온다(§2.8).
- **가드는 대상 수를 grep으로 세서 만든다**(§7) — "저장 안내가 전부 붙었다"를 셀렉터로 선언하지 말 것.

---

## 7. PR 분할

| PR | 범위 | 왜 나누는가 |
|---|---|---|
| **B-1a** | 사실 계약 교체 + 결정 기록 기본 ON + 마이그레이션 규칙(§5.1) | 문서·카피·플래그. 리뷰 축이 "정직성" |
| **B-1b** | IndexedDB 계층 + 원본 저장/복원 + 90일 만료 | 리뷰 축이 "기술" |
| **B-1c** | `/storage` 화면 + 통제 6종 + 실패 고지 | 리뷰 축이 "UX·접근성" |

**셋은 순서대로 나가되, B-1b와 B-1c 사이를 배포로 벌리지 않는다.** 원본이 남는데 지우는
화면이 없는 배포분이 존재하면 안 된다. 부득이하면 B-1b에 임시 전체삭제 버튼이라도 함께 넣는다.

---

## 8. 검증 체크리스트

기본값을 뒤집는 작업이라 평소보다 많다.

- [ ] `npm run test:all` · `npm run lint` 0 · **`npm run build`** (배선 변경은 프리렌더가 잡는다 — §16)
- [ ] **마이그레이션 골든** — 명시적 거절자(`promptSeen=true, enabled=false`)가 v4에서도 `false`
- [ ] **만료 골든** — `isExpired`를 시각 주입으로. 89일/90일/91일 경계
- [ ] 저장 → 새로고침 → 복원 → 분석 결과가 저장 전과 **동일**
- [ ] 저장 끄기 → IndexedDB·localStorage **양쪽**이 비는지 (한쪽만 지우는 사고가 흔하다)
- [ ] 사생활 보호 모드에서 열기 — 저장 실패가 화면에 정직하게 뜨는지, 분석은 그대로 되는지
- [ ] 20만 행으로 저장·복원 — 저장 시 메인 스레드가 멈추지 않는지
- [ ] 데모 데이터가 저장되지 않는지
- [ ] `/storage` 접근 경로 4개 전부 실재하는지
- [ ] KO/EN 동시 반영(§2.11) — privacy 2개, `/storage` 2개, brandFacts 양 로케일
- [ ] `brandFacts` 소비처 전수 grep — 파생이 아닌 하드코딩 문장이 남아 있지 않은지
- [ ] `/storage`가 `sitemap.js`에 **없는지**(noindex 대상)

---

## 9. 아직 안 정한 것

- **B-1c 화면의 위치** — 독립 라우트 `/storage`로 스펙을 썼다. 설정 패널 안이 나을 수도 있는데,
  무주소 게이트 금지(§12.28)와 접근 경로 4개를 생각하면 라우트가 맞다고 본다. 착수 전 확정.
- **다중 탭 동기화** — 1차 범위 밖. 필요해지면 `BroadcastChannel`.
- **만료 안내 문구의 노출 위치** — 진입 토스트인지 `/storage` 배너인지.
