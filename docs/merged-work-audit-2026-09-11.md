# 머지 코드 감사 2차 — #845~#852 + 1차 지적 반영 확인 (2026-09-11)

1차 감사: `docs/merged-work-audit-2026-09-10.md`(#812~#844).
이번 대상: `94ce862`(#844) 이후 머지된 **#845~#852 8개 PR**, head `3aab6ac`.
감사자: Claude(§6.2). 구현: Codex.

---

## 1. 실제로 돌린 검증 (head `3aab6ac`)

| 항목 | 결과 |
|---|---|
| `npm run test:all` | 424 files / **3,411 통과 · 0 실패** (1차 때 실패하던 플래키 1건 해소) |
| `npm run lint` | errors 0 |
| 읽은 diff | 73파일 +1,386/−202 (`94ce862..3aab6ac`), 신규 파일 29개 전수 |
| `npm run build` · `test:e2e` · 실기기 · 실결제 · 운영 도메인 응답 | **미실행**(외부 네트워크 차단) |

---

## 2. 1차 지적 8건의 처리 상태

`#846`은 커밋 메시지에 "감사 지적 보완"이라고 명시돼 있고, 실제로 코드가 그렇게 바뀌었다.

| 1차 항목 | 상태 | 확인한 근거 |
|---|---|---|
| C-1 문서가 배포와 반대(하네스·SETUP) | **해결** | `AGENTS.md:61,97`이 "결제는 Toss+PostgreSQL, 다운로드는 Pro 범위"로 갱신. `supabase/SETUP.md:3`도 정정 |
| E-1 플래키 단언("완료" 5건 대기) | **해결** | `AssistantWorkspace.smoke.test.jsx:80`이 `data-queue-settled="true"` 정착 신호 단언으로 교체. 전체 스위트 0 실패 |
| D-2 홈 미리보기 널가드 부재 | **해결** | `HomeResultPreview.jsx:9,13` — `useMemo`로 컴포넌트 내부 계산 + `lead`·CPA 유한성 검사 후 `return null` |
| D-1 폰트 3.35 MB 동시 preload | **부분 해결** | `RootDocument.jsx:19` Pretendard `preload:false`. WantedSans 1.29 MB만 preload — 서브셋은 아직 없음 |
| B-1 오류가 503 하나로 뭉개짐 | **해결** | `paymentServer.js` `paymentError(error)`가 `INVALID_ORIGIN 403 / INVALID_ORDER 400 / ALREADY_ACTIVE·PAYMENT_NOT_COMPLETED·PAYMENT_MISMATCH 409 / PAYMENTS_NOT_CONFIGURED 503`으로 갈리고 `console.error("payment_request_failed", {code})` 기록 |
| B-2 주문 생성·웹훅 무제한 | **부분 해결** | `paymentRequestLimit.js` 추가(order 30/분, webhook 120/분) — 다만 §3 A-1 참조 |
| B-4 이용권 복구 경로가 하나뿐 | **해결(운영 절차로)** | `scripts/reissue-payment-pass.mjs` + `lib/subscription/reissuePass.js` + `docs/payment-pass-recovery.md`. 공개 API 없음, 소유권 확인은 코드 밖에서, 0600 파일로만 출력, 이전 해시 일치 시에만 UPDATE |
| A-1 결제 미구성 시 다운로드 봉쇄 | **부분 해결(안내만)** | `SubscriptionPurchasePrompt.jsx:14,25` — `/api/payments/config`를 조회해 "지금은 구매할 수 없습니다… 분석은 계속할 수 있습니다" + 고객센터 링크. **다운로드 차단 자체는 그대로** |
| A-2 운영 브리프 .md만 무료 | 미해결 | `WeeklyReview.jsx:555` 그대로 |
| B-3 트랜잭션 안 외부 HTTP | 미해결 | `paymentServer.js:94-106` 잠금 유지한 채 Toss 조회·승인 |
| B-5 매 페이지 로드 access 호출 | 미해결 | `WorkspaceStorageBootstrap.jsx` 그대로 |
| D-3 §12.28 규칙 충돌 | 미해결 | 하네스 문장 그대로 |
| F-1 통신판매업 신고번호 | 미해결(사업) | SSOT에 "미제공"으로 유지 |

---

## 3. 이번 배치의 새 발견

### A-1 (P2) 레이트리밋이 전역 카운터라 한 명이 전체 구매를 막을 수 있다

```js
// src/lib/subscription/paymentRequestLimit.js
const windows = new Map();               // 스코프 하나당 카운터 하나 — 호출자 구분 없음
const limit = scope === "order" ? 30 : 120;
```

IP·쿠키 구분 없이 **스코프 전체가 분당 30건**을 나눠 쓴다. 무한 DB 행 생성은 막혔지만, 익명 요청 30회/분이면 그 동안 **정상 구매자도 주문을 만들 수 없다**(429). 프로세스 내부 카운터라 다중 인스턴스에서는 상한이 배수로 늘어나는 점은 주석에 정직하게 적혀 있다.

제안: 쿠키/`x-forwarded-for` 단위 버킷을 1차로 두고 전역 상한은 훨씬 높게. 429는 결제 화면에서 사용자에게 보이는 오류이므로 문구도 필요하다.

### A-2 (P3) GA `purchase` 중복 방지가 sessionStorage에만 있다

`paymentAnalytics.js`가 `gop:ga:purchase:<orderId>` 키로 중복 전송을 막는데, 세션이 바뀐 뒤 `gop_payment_return` 쿠키(24시간)로 승인 확인을 다시 타면 **같은 주문의 `purchase`가 한 번 더 나갈 수 있다**. GA4는 `transaction_id`로 자동 합산 제거를 해주지 않으므로 매출이 이중 계상될 수 있다. 확인 성공 후 return 쿠키를 만료시키거나, 서버 응답에 "이미 활성" 표시를 실어 클라이언트가 재전송을 건너뛰게 할 것.

### A-3 (P3) `library-workspace.css`의 라이트 토큰 블록이 둘

`:root`는 8줄 한 곳으로 정리됐지만 `body.light-mode` 토큰 블록이 19·48줄 두 곳이다(§7 "정의가 두 벌이면 도구도 사람도 앞엣것을 읽는다"). 지금은 값이 충돌하지 않지만 다음 수정 때 앞 블록만 고치기 쉽다.

### 새로 들어온 것 중 잘 된 부분 (기록해 둘 가치가 있는 것)

- **결제 GA 계측(#845)**: `sanitizeProductEventParams(params, name)`가 e-commerce 파라미터를 **`begin_checkout`/`purchase`(및 test\_ 접두)에서만, 그것도 `PAYMENT_PRODUCT.id`·`KRW`·정수 금액·`items` 1개일 때만** 통과시킨다. `transaction_id`는 `gop_` UUID 패턴 검사를 통과할 때만 실린다. 결제 키·복원 코드·provider 메시지는 어디에도 실리지 않는다.
- **무료 샘플 보고서(#851)**: `sampleReport.js`가 **스토어에 접근하지 않고** 번들 데모만으로 Word/Excel을 만든다. 본문에 "고객 실적이 아닌 체험용 데이터", "관측 차이는 인과효과가 아님", "워크북 수식은 채널 집계값을 쓰며 원본 수정 시 자동 재집계하지 않음"을 명시한다 — §8 정직성을 지키면서 "사기 전에 뭘 받는지" 문제를 정면으로 푼 방식이다.
- **분석 설정 저장(#851·#852)**: `TOOL_INPUT_KEYS`가 도구별 **사용자 입력 옵션만** 화이트리스트로 잡고, 파일 첫 줄에 "결과·시그니처·승인 플래그는 절대 저장하지 않는다"고 못 박았다. 분석 게이트(§12.5) 계약이 보존된다. `validateSavedAnalyses`는 개수 20개·이름 120자·도구 1개 그룹·헤더 지문 64hex까지 검사한다.
- **복귀 경로(`paymentReturnPath.js`)**: `//` 시작 차단 + `resolvePathToId` 실재 확인 + 24시간 만료 — 오픈 리다이렉트가 막혀 있다.
- **재발급 절차 문서**: "주문번호·날짜·금액만으로 소유권을 확정하지 않는다", "영수증 이미지 하나로 승인하지 않는다", "오프라인 캐시가 최대 72시간 남으므로 즉시 전 기기 차단이라고 안내하지 않는다"까지 적혀 있다. 운영 문서로서 드물게 정직하다.

---

## 4. 지금 열려 있는 항목 (심각도 순)

| # | 등급 | 항목 | 위치 |
|---|---|---|---|
| 1 | P2 | 결제 미구성 시 결과 다운로드가 여전히 전면 차단(안내만 개선) | `lib/subscription/paidExport.js:7` |
| 2 | P2 | 전역 레이트리밋 — 한 명이 전체 주문 생성을 막을 수 있음 | `lib/subscription/paymentRequestLimit.js` |
| 3 | P2 | 결제 확정이 DB 잠금 보유 상태로 외부 HTTP 최대 30초(pool max 4) | `lib/subscription/paymentServer.js:94-106` |
| 4 | P3 | GA `purchase` 세션 간 재전송 가능(매출 이중 계상) | `lib/subscription/paymentAnalytics.js` |
| 5 | P3 | 무료/유료 경계: 운영 브리프 .md만 무료 | `components/WeeklyReview.jsx:555` |
| 6 | P3 | 방문자 전원 매 페이지 로드마다 `/api/payments/access` | `components/WorkspaceStorageBootstrap.jsx:16` |
| 7 | P3 | 폰트 총량 3.35 MB(서브셋 없음) | `public/fonts/` |
| 8 | P3 | §12.28 "히어로 예시 판단 카드 금지"와 홈 미리보기 충돌 | `AGENTS.md` §12.28 |
| 9 | P3 | `library-workspace.css` 라이트 토큰 블록 2벌 | `app/library-workspace.css:19,48` |
| 10 | P3(사업) | 통신판매업 신고번호 미표시 | `docs/product-ssot.md` §1.2 |

**1번에 대한 제안**: 구매 불가 상태에서 다운로드를 무료로 여는 폴백이 가장 단순하다. 그게 정책상 곤란하면, 최소한 구매 불가 안내에서 **고객센터가 아니라 무료 샘플 보고서(`/subscription`)로** 보내는 편이 사용자에게 남는 게 있다.

---

## 5. 정직성·데이터 계약 재점검 — 통과

- 결제·계측 어느 경로에도 CSV 원본·파일명·캠페인명이 실리지 않는다(§2.2).
- 유료 전환 이후에도 템플릿 CSV·매뉴얼 PDF·결정 기록 CSV/ICS·프로젝트 백업은 무료 유지.
- 저장된 분석 설정은 옵션만 담고 결과·게이트 상태를 담지 않는다.
- 요금제·샘플 보고서 어디에도 날조된 성과 수치나 후기가 없다.
- 백업 파서의 방어(프로토타입 오염·깊이·크기·그룹 중복·로고 MIME/치수)는 그대로 유지된다.

## 6. 확인 부탁

1. **Railway 결제 환경변수(`TOSS_CLIENT_KEY`/`TOSS_SECRET_KEY`/`PAYMENTS_DATABASE_URL`, 라이브면 `PAYMENTS_LIVE_ENABLED`)가 설정돼 있습니까?** 이 세션은 외부 네트워크가 막혀 `/api/payments/config`를 확인할 수 없다. 미설정이면 열린 항목 1번이 지금 운영에서 발생 중이다.
2. 운영 브리프 .md 무료 유지는 의도입니까?
3. §12.28을 홈 미리보기에 맞춰 갱신할까요?

## 7. 하지 않은 검증

`npm run build`, `npm run test:e2e`, 실기기(iOS/Android), Lighthouse, 실제 Toss 결제·환불·재발급 스크립트 실행, 운영 도메인 응답. 이 문서의 어떤 문장도 위 항목을 통과했다는 뜻으로 쓰지 않았다.
