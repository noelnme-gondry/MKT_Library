# 머지 코드 감사 — #812~#844 (2026-09-10)

감사 대상: `main` 기준 `dcf7854`(#812) ~ `94ce862`(#844), 총 21개 PR.
감사자: Claude(§6.2 감사 역할). 구현은 Codex.
감사 시점 head: `94ce862` · 실측 환경: 원격 컨테이너(Node 22.22.2, 저장소 clean checkout).

---

## 1. 실제로 돌린 검증

| 항목 | 결과 |
|---|---|
| `npm ci` | 성공. **단 `package.json`은 Node >=24 요구, 실행 환경은 22.22.2**(EBADENGINE 경고) |
| `npm run test:all` (`12509a6`, #832 시점) | 410 files / **3,365 통과, 0 실패** — PR #831이 적은 "로컬 3,371개(미추적 6개 포함)"와 정확히 일치 |
| `npm run test:all` (`94ce862`, 현재 head) | 411 files / 3,375 통과 / **1 실패** (§5 참조) |
| `npm run lint` (양쪽 시점) | errors 0 |
| `npm run build` · `test:e2e` | **미실행** |
| 운영 사이트 실측(`/api/payments/config` 등) | **불가** — 이 세션은 외부 네트워크가 차단됨 |

읽은 diff: 158파일 +4,286/−760 (#825~#832), 73파일 +1,466/−295 (#833~#844).

---

## 2. 심각도 요약

| # | 등급 | 발견 | 위치 |
|---|---|---|---|
| A-1 | **P1** | 결제 미구성 시 전 사용자 다운로드 봉쇄 + 구매 경로 없음 | `src/lib/subscription/paidExport.js:6` |
| C-1 | **P1** | 하네스·Supabase 문서가 배포와 반대 진술 | `AGENTS.md:61,97` · `supabase/SETUP.md:3` |
| D-1 | **P1** | 한글 가변 폰트 2종(3.35 MB) 동시 preload | `src/components/RootDocument.jsx:19,27` |
| B-1 | P2 | 모든 결제 오류가 `503 PAYMENT_UNAVAILABLE`로 뭉개짐 | `paymentServer.js:135` |
| B-2 | P2 | `/api/payments/order` 무인증·무제한, 웹훅 서명 검증 없음 | `api/payments/order`,`/webhook` |
| B-3 | P2 | DB 트랜잭션 안에서 최대 30초 외부 HTTP(pool max 4) | `paymentServer.js` `confirmPayment` |
| B-4 | P2 | 이용권이 복원 코드+쿠키에만 묶임(재발급 경로 없음) | `paymentServer.js` `readPaymentAccess` |
| D-2 | P2 | 홈 미리보기가 모듈 최상위 계산 + 널가드 없음 | `landing/HomeResultPreview.jsx:7,12` |
| E-1 | P2 | 전체 스위트에서 재현되는 플래키 단언 | `AssistantWorkspace.smoke.test.jsx:80` |
| A-2 | P2 | 무료/유료 경계 불일치(운영 브리프 .md만 무료) | `WeeklyReview.jsx:555` |
| B-5 | P3 | 방문자 전원이 매 페이지 로드마다 `/api/payments/access` 호출 | `WorkspaceStorageBootstrap.jsx:16` |
| D-3 | P3 | §12.28 "히어로 예시 판단 카드 금지"와 새 샘플 미리보기 충돌 | 하네스 vs `HomeResultPreview` |
| D-4 | P3 | `library-workspace.css`가 `:root`/`light-mode`를 3곳에서 재선언 | `app/library-workspace.css:14,42,453` |
| F-1 | P3(사업) | 통신판매업 신고번호 미표시 상태 | `docs/product-ssot.md` §1.2 |

---

## 3. 상세

### A. 유료화 경계 (#831 · #832)

**A-1 (P1) — 결제가 구성되지 않으면 다운로드가 아무도 못 쓰는 상태가 된다**

`requirePaidExport`는 `hasPaidAccess(entitlement)`만 보고 `paymentConfiguration().enabled`는 보지 않는다.

```js
// src/lib/subscription/paidExport.js:6
if (hasPaidAccess(useAppStore.getState().entitlement)) return true;
useAppStore.setState({ purchasePrompt: { toolId, locale, format } });
```

TOSS 키·`PAYMENTS_DATABASE_URL`(라이브면 `PAYMENTS_LIVE_ENABLED`)이 없으면 흐름이 이렇게 끝난다:
다운로드 클릭 → 구매 모달 → `/subscription#purchase` → 결제 버튼이 렌더되지 않고 **"이용권 구매 가능 여부는 고객센터로 문의해 주세요"**(`SubscriptionCheckout.jsx:101`).
즉 어제까지 무료였던 산출물이 **살 수도 없는 채로** 막힌다.

- 다운로드 유료화 자체는 2026-09-09 사용자 결정이고 SSOT에 기록돼 있다(정책 문제 아님).
- 문제는 **구성 실패 시의 폴백이 없다**는 것. `#837`이 "Railway가 localhost로 구성한 요청 URL 때문에 출처 검증·리다이렉트가 실패"를 고친 걸 보면 운영 결제 배선이 진행 중이며, 그 사이 창(window)에서는 이 상태가 실제로 존재했을 가능성이 높다.
- 제안: `requirePaidExport`에서 `/api/payments/config`의 `enabled`가 false면 무료 통과(또는 명시적 "준비 중" 안내). 한 줄 수준.

**A-2 (P2) — 같은 화면에서 유·무료 경계가 갈린다**

`/weekly-review` 안에서 Word·인쇄·워크북은 유료인데, 같은 화면 결정 원장의 **'운영 브리프 .md' 다운로드는 무료**다(`WeeklyReview.jsx:555`). 결정 기록 이동을 무료로 두기로 한 계약과 보고서 유료화 사이에 걸쳐 있다 — 의도인지 누락인지 코드에서 구분되지 않는다(§7 "빠진 것과 의도적으로 뺀 것은 코드에서 구분돼야 한다").

**A-3 (참고) — 페이월은 전적으로 클라이언트 판정**

`hasPaidAccess(store.entitlement)` + localStorage 캐시라 우회가 가능하다. 브라우저 처리 원칙(§2.2)상 서버 강제는 불가능하므로 수용 가능한 트레이드오프다. 다음 방문 시 `/api/payments/access` 재검증이 위조 캐시를 지우는 구조라는 점은 확인했다.

### B. 결제 서버 (#831 · #837)

먼저 **잘 된 부분**을 기록한다. 이 코드는 대충 만든 결제가 아니다.

- 주문 소유권을 `sha256(token)` 저장 + `timingSafeEqual` 비교로 확인.
- 승인 결과를 `orderId`·`paymentKey`·`totalAmount`·`currency`·`status=DONE`·`cancels` 전부 대조(`verifiedPayment`).
- `FOR UPDATE` 잠금 + 영속 멱등키 재사용 → 응답 유실 시 이중 청구 방지.
- 웹훅 페이로드를 신뢰하지 않고 Toss에서 권위 상태를 재조회.
- 오류 응답에 provider payload·접속 문자열을 절대 싣지 않음.
- `#837`의 출처 처리: 정식 호스트일 때만 canonical origin으로 인정하고, 임의 forwarded host를 신뢰 출처로 바꾸지 않는다.

**B-1 (P2) 오류가 전부 503 하나로 뭉개진다** — `ALREADY_ACTIVE`·`INVALID_ORDER`·`PAYMENT_NOT_COMPLETED`·`PAYMENT_MISMATCH`가 모두 `paymentError()` 하나로 나간다(`paymentServer.js:135`). 화면 문구는 승인 실패 시 "다시 결제하지 말고 재시도"로 잘 쓰여 있지만, **어떤 실패였는지가 서버 로그에도 남지 않는다.** 최소한 서버 사이드 로깅으로 사유 코드를 남길 것.

**B-2 (P2) 주문 생성·웹훅에 문지기가 없다** — `/api/payments/order`는 무인증·레이트리밋 없음이라 쿠키 없이 반복 POST하면 `gop_payment_orders` 행이 무한 생성된다. `/api/payments/webhook`도 서명 검증 없이 누구나 호출할 수 있고, 호출마다 Toss API 조회를 유발한다(증폭). 검증 로직이 안전한 것과 요청을 무제한 받는 것은 다른 문제다.

**B-3 (P2) 트랜잭션 안의 외부 HTTP** — `confirmPayment`이 `FOR UPDATE` 잠금을 쥔 채 Toss 조회+승인(각 15초 타임아웃)을 수행한다. `pg.Pool({ max: 4 })`라 동시 결제 4건이면 나머지 요청이 대기한다.

**B-4 (P2) 이용권 복구 경로가 하나뿐** — 복원 코드(=베어러 토큰)와 쿠키가 전부다. 코드를 잃으면 재발급 경로가 없고, 유출되면 타인이 그대로 쓴다(화면 문구에 경고는 있음). 유료 상품인 만큼 이메일 기반 재발급이나 최소한 고객센터 대응 절차가 필요하다.

**B-5 (P3)** 라이선스 캐시가 없는 방문자도 페이지 로드마다 `/api/payments/access`를 호출한다(`WorkspaceStorageBootstrap.jsx:16`). 쿠키가 없으면 DB는 안 타지만, 정적 프리렌더 사이트에 매 페이지 서버 왕복이 붙는다.

### C. 문서·하네스 정합 (P1)

배포된 코드와 **정면으로 반대되는 문장**이 세 곳에 남아 있다.

| 파일 | 현재 문장 | 실제 |
|---|---|---|
| `AGENTS.md:61` | "접근키·Pro 페이월은 제거됨" | Pro 이용권 + 다운로드 페이월 존재 |
| `AGENTS.md:97` | "전 도구 free(티어·페이월 없음)" | 분석은 무료, 결과 다운로드는 유료 |
| `supabase/SETUP.md:3` | "현재는 …관심 확인 단계로 **결제를 받지 않습니다**" | Toss 결제창·주문/승인 API 구현 완료 |

`docs/product-ssot.md`만 갱신됐다. §15 "틀린 규칙은 없는 규칙보다 해롭다" — 다음 세션의 에이전트가 이 문장을 근거로 페이월을 지우는 사고가 가능하다.

### D. 홈·워크스페이스 리뉴얼 (#833 · #838 · #843 · #844)

**D-1 (P1) 한글 가변 폰트 2종을 동시에 preload한다**

```js
// src/components/RootDocument.jsx:14-29
pretendard  … preload: true   // public/fonts/PretendardVariable.woff2   2,057,688 B
wantedSans  … preload: true   // public/fonts/WantedSansVariable.woff2   1,289,292 B
```

첫 페인트 전에 **3.35 MB**를 받는다. 주 시장이 KR 모바일이고 §7에 "터치 기기·데스크톱 사이트 모드" 사고가 두 번 기록된 화면이다. 서브셋(한글 상용 + latin)으로 줄이거나, 본문 1종만 preload하고 제목용은 `preload:false`로 내릴 것. (Lighthouse는 PR에서도 "미실측"으로 남아 있다.)

**D-2 (P2) 홈 미리보기에 널가드가 없다**

```js
// src/components/landing/HomeResultPreview.jsx:6-12
const sample = buildDemoCsv("efficiency");
const result = compareSamplePerformance(sample.raw);   // 14일 미만이면 null
…
const lead = result.channels[0];                        // 가드 없음
```

모듈 최상위 실행이라, 공유 데모 픽스처(§12.16에서 이미 한 번 손댄 자산)가 14일 미만이 되거나 채널 구성이 바뀌면 **홈이 프리렌더 단계에서 통째로 죽는다.** 계산을 컴포넌트 안으로 옮기고 `result == null`이면 미리보기를 생략할 것.

**D-3 (P3) 하네스 규칙과의 충돌** — §12.28은 "히어로에 예시 판단 카드·장식 차트를 다시 넣지 말 것"이라고 못 박고 있고, `HomeResultPreview`는 그 자리에 판단 카드를 다시 놓는다. 다만 수치는 **데모 픽스처에서 실제로 계산**하고 "체험용 데이터 · 기간"을 함께 표기하므로 §8 정직성(가짜 수치 금지)은 지킨다. 규칙을 갱신하거나, 예외 사유를 §12.28에 남길 것 — 지금은 규칙과 코드가 말이 다르다.

**D-4 (P3)** `library-workspace.css`가 `@layer app` 안에 있는 점은 §7 규칙대로다. 다만 `:root`/`body.light-mode`를 14·42·453줄 세 곳에서 재선언한다 — §7 "토큰이 두 벌이면 도구도 사람도 앞엣것을 읽는다"의 재발 소지.

**잘 된 부분**: `mobileNavigation.js`가 `(pointer: coarse) and (max-width:1100px)`를 쓰고 `useSyncExternalStore`로 구현돼 §7의 두 함정을 모두 피했다. 블로그 표를 `role="region" tabindex="0"` 스크롤 컨테이너로 감싼 것, 차트 축 라벨을 `muted`→`text`로 올린 것도 접근성 개선이다.

### E. 테스트 (P2)

현재 head의 clean checkout에서 `test:all`이 **1건 실패**한다.

```
FAIL src/components/assistant/AssistantWorkspace.smoke.test.jsx
  > checks detailed recommendation quality on demand and resets it after input changes (ko)
  expected [...] to have a length of 5 but got 4
```

```js
// AssistantWorkspace.smoke.test.jsx:80
await waitFor(() => expect(screen.getAllByText(en ? "Complete" : "완료")).toHaveLength(5));
```

같은 파일을 **단독 실행하면 22개 전부 통과**한다 → 부하에 따라 갈리는 플래키다. §7에 이미 적혀 있는 함정("정착 전 중간 상태를 단언하면 DOM이 조금만 무거워져도 깨진다 — '완료' 4건을 기다리던 스모크")의 정확한 재발이다. 큐 종료 자체(대기열 길이 0 / 마지막 항목 상태)를 단언하도록 바꿀 것.

### F. 사업 표시 (P3)

`docs/product-ssot.md` §1.2에 판매자 정보가 들어갔고 **통신판매업 신고번호는 "미제공"으로 정직하게 비워** 두었다(임의 생성 안 함 — 옳다). 다만 실결제를 라이브로 켜기 전에는 신고번호 표시가 전자상거래법상 필요하다. 주소도 "용두동 39-463"으로 시·구가 빠져 있다.

---

## 4. 정직성 점검 — 통과

- 요금제 비교 페이지에 **날조된 성과 수치·후기 없음**. 가격은 `SUBSCRIPTION.monthlyKrw`에서 파생.
- `llms.txt`는 브랜드 사실을 `claim + detail`로 함께 내보내므로, "모든 분석 도구가 무료" 인용에 유료 범위 단서가 따라간다.
- 템플릿 CSV·매뉴얼 PDF·결정 기록 CSV/ICS·프로젝트 백업은 실제로 무료 유지 — PR 본문 주장과 코드가 일치한다.
- Excel 네이티브 차트·수식은 실제 OOXML을 직접 쓰고, 독립 파서로 셀 수식과 `dispBlanksAs="gap"`(미관측을 0으로 채우지 않음)까지 단언한다.
- `scoreDecision`의 '유지 목표 자동 합격 금지'는 판정을 보류하면서 가드레일 관측은 보존하도록 고쳐졌고, 화면도 판정 없이 관측값만 보여준다.
- 프로젝트 백업 파서는 프로토타입 오염·깊이·크기·그룹 중복·로고 MIME/치수를 모두 검사하고, **백업으로 권한을 가져오지 않는다.**
- 결제·집계 경로 어디에도 CSV 원본·파일명·캠페인명을 보내는 코드가 없다(§2.2 유지).

---

## 5. 사용자 확인 필요

1. **Railway에 `TOSS_CLIENT_KEY`/`TOSS_SECRET_KEY`/`PAYMENTS_DATABASE_URL`이 설정돼 있습니까?** (라이브면 `PAYMENTS_LIVE_ENABLED=true`) — 미설정이면 A-1이 지금 운영에서 발생 중이다. 이 세션은 외부 네트워크가 막혀 확인하지 못했다.
2. A-2(운영 브리프 무료)는 의도입니까, 누락입니까?
3. D-3(히어로 샘플 카드)에 맞춰 §12.28을 갱신할까요?

## 6. 제안 착수 순서

1. A-1 폴백(결제 미구성 시 다운로드 무료) — 한 줄 + 가드 테스트.
2. C-1 문서 3곳 정합.
3. D-1 폰트 서브셋/preload 축소.
4. E-1 플래키 단언 교체.
5. B-2 주문 생성 레이트리밋.

## 7. 하지 않은 검증

`npm run build`, `npm run test:e2e`, 실기기(iOS/Android), Lighthouse, 실제 Toss 결제·환불, 운영 도메인 응답. 이 문서의 어떤 문장도 위 항목을 통과했다는 뜻으로 쓰지 않았다.
