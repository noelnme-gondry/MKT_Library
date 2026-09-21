# NICEPAY 개통 전 준비와 전환 절차

2026-09-20. 사용자 신청 진행 확인. **상점 개통·키 발급 모델·실제 카드 인증은 아직 미확인**이다. 현재 구현은 카드 일회 결제, JS SDK / Server 승인 / Basic 인증이다. MID/merchantKey 또는 Client 승인 계약이면 추가 개발이 필요하다. 자동 결제·정기 구독으로 전환하지 않는다.

## 전환 원칙

- 기존 Toss 주문과 이용권은 그대로 보존한다. 주문별 `provider`로 원래 PG를 조회한다. 기존 이용기간을 재계산하거나 거래를 NICEPAY로 이관하지 않는다.
- 새 주문만 `PAYMENTS_PROVIDER=nicepay`로 전환한다. 전환 전 발급된 주문은 원 PG로 완료한다. 결제 화면을 오래 열어 둔 경우 PG/모드가 바뀌면 새로고침을 안내하고 결제창 호출을 막는다.
- `PAYMENTS_LIVE_ENABLED=false`는 신규 실구매를 닫는다. **기존 주문 확인·이용권 복원·취소 웹훅은 계속 작동한다.** 진행 중인 기존 인증은 원래 키가 유효하면 완료할 수 있다. 전체 승인 중단 스위치로 해석하지 않는다.
- Toss 키·웹훅·관리자 접근은 기존 거래 조회/환불이 필요한 동안 유지한다. NICEPAY로 전환해도 Toss 계약을 즉시 해지하지 않는다.
- 되돌릴 때는 새 주문 선택만 Toss로 변경한다. NICEPAY 키·웹훅은 유지한다. 두 PG의 동일한 `live` 환경을 유지하며, 운영 DB에 sandbox 주문을 섞지 않는다.

## 지금 준비한 개발 경로

인증 POST → 서명 검사 → HttpOnly 반환 쿠키 → 주문 소유권·금액 검사 → 서버 승인 → 이용권 반영. 승인 재시도는 이미 기록한 거래를 조회하며, 승인 응답 유실 시 망취소를 시도한다. 웹훅 본문의 성공 주장을 믿지 않고 PG를 다시 조회한 뒤 `OK`를 반환한다. 취소·부분 취소는 해당 주문의 이용권을 회수한다. KR/EN 화면과 구매 분석 이벤트가 연결되어 있다.

비밀키나 결제 인증 토큰을 GA·페이지 URL에 넣지 않는다. 고객 CSV/분석 결과를 PG로 전송하지 않는다.

## 개통 전에 실행할 점검

애플리케이션 디렉터리 `v2-migration`에서, 비밀값이 설정된 환경으로 실행한다. 점검기는 키·DB 주소·개별 주문·고객 정보를 출력하지 않으며 DB는 읽기 전용이다.

```sh
node scripts/check-nicepay-readiness.mjs
node scripts/check-nicepay-readiness.mjs --database --expect-ready
```

- 첫 명령: 승인 모델·키 존재·DB 설정·로그인·환경 분리 확인. 키가 실제 유효한지는 입증하지 않는다.
- 두 번째: 주문 테이블·provider/기간 컬럼·기간 합산 함수 및 PG/모드별 주문 건수 확인. 기존 PG 키가 빠지면 차단 사유를 출력한다. 실제 결제 성공 여부를 `ready`로 위장하지 않는다.
- 스키마는 `npm start`에 명시된 startup migration을 사용한다. `provider`는 기본 `toss`로 추가된다. 배포 시작 로그에서 migration 성공을 확인한다. 수동으로 기존 주문의 provider를 변경하지 않는다.
- 로컬 sandbox는 분리한 DB와 테스트 키, `NICEPAY_MODE=test`, `PAYMENTS_PROVIDER=nicepay`, `PAYMENTS_LIVE_ENABLED=false`로 실행한다. `NODE_ENV=production`의 테스트 결제는 차단된다. 테스트 로그인 설정도 별도로 준비해야 한다.

## 상점 개통 후 남는 작업

1. 담당자에게 **Server 승인 / Basic 인증** 발급 모델 및 카드 사용 가능 여부를 확인한다. 운영 키는 Railway의 비밀 환경값에 직접 설정한다.
2. 아래 변수를 추가하되, 준비하는 동안 기존 Toss 신규 주문 선택은 유지한다. 현재 운영값을 확인한 뒤 적용하며 템플릿을 통째로 덮어쓰지 않는다.

| 변수 | 개통 후 값 |
|---|---|
| `NICEPAY_APPROVAL_MODEL` | `server-basic` |
| `NICEPAY_MODE` | `live` |
| `NICEPAY_CLIENT_KEY` / `NICEPAY_SECRET_KEY` | 동일 운영 상점의 발급 키 |
| `PAYMENTS_DATABASE_URL` | 기존 운영 DB 유지 |
| `TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` | 기존 값 유지 |
| `PAYMENTS_PROVIDER` | 전환 시에만 `nicepay` |
| `PAYMENTS_LIVE_ENABLED` | 최종 실결제 검증 준비 후 `true` |

3. NICEPAY에 도메인과 다음 URL을 등록한다.

| 용도 | URL |
|---|---|
| 구매 | https://growthoptplaybook.com/subscription |
| 인증 반환 KR | https://growthoptplaybook.com/api/payments/nicepay/return?locale=ko |
| 인증 반환 EN | https://growthoptplaybook.com/api/payments/nicepay/return?locale=en |
| 승인/취소 웹훅 | https://growthoptplaybook.com/api/payments/nicepay/webhook |
| 기존 Toss 웹훅 — 유지 | https://growthoptplaybook.com/api/payments/webhook |

4. 점검기 실행 → 새 주문 PG 전환 → 공개 설정에서 provider/mode/enabled 확인. Toss용 익명 심사 위젯은 NICEPAY 심사 증거가 아니다. NICEPAY 심사자는 로그인 후 실제 NICEPAY 결제창을 확인한다.
5. 카드 소유자가 5,900원 상품으로 PC·모바일 카드 인증을 수행한다. 승인·사용자 취소·실패·복귀·중복 확인을 점검한다. 결제 실행은 사람이 수행한다.
6. PG 관리자 승인 거래, DB 이용권 기간, 계정 로그인 복원, GA의 신규 거래 `purchase`를 대조한다. PG 관리자에서 환불한 뒤 외부 웹훅 `OK`·이용권 회수를 확인한다. 실패 시 다시 결제시키지 말고 원 주문 상태를 조회한다.

단계 1~6과 실제 외부 통보까지 통과해야 운영 연동 완료다. 키/상점이 없는 상태에서 이 절차를 완료했다고 표시하지 않는다. 이번 변경은 운영 변수나 계약을 변경하지 않는다.

## 운영 조회

```sql
-- 기존/신규 PG 주문 수. 원본 응답·인증 토큰은 조회하지 않는다.
SELECT provider, mode, status, COUNT(*) AS order_count
FROM gop_payment_orders GROUP BY provider, mode, status ORDER BY 1,2,3;

-- 확인 대기 주문: 자동 재결제·자동 승인 대상 목록이 아니다.
SELECT id, provider, mode, amount, created_at
FROM gop_payment_orders
WHERE status='pending' AND payment_key IS NOT NULL
ORDER BY created_at DESC LIMIT 100;
```

방문 경로 응답은 [별도 읽기 쿼리](source-survey-queries.sql) 또는 기존 `node scripts/source-survey-report.mjs --days 30`으로 확인한다. `entry_surface`는 첫 진입 화면 분류이며, 외부 유입 경로는 사용자가 쓴 `answer`다. 제출 수는 방문자 수가 아니다.

## English operational summary

Keep existing Toss orders, credentials and webhook active; change only the provider for new orders. Checkout closure must not block restoring paid passes or processing refunds. Previously issued orders settle through their original provider; stale browser configurations must refresh before submitting a new order. Run the read-only preflight with `--database --expect-ready` before cutover. Credential presence does not prove authentication, merchant activation, card flow, external webhook delivery or a real purchase/refund. Those require the issued merchant keys and an owner-operated live test after activation. No production credentials, provider selection or contracts are changed by this code preparation.

## 공식 연동 기준

- [Server 승인](https://github.com/nicepayments/nicepay-manual/blob/main/api/payment-window-server.md)
- [거래 조회](https://github.com/nicepayments/nicepay-manual/blob/main/api/status-transaction.md)
- [망취소](https://github.com/nicepayments/nicepay-manual/blob/main/api/cancel.md)
- [웹훅 OK 응답](https://github.com/nicepayments/nicepay-manual/blob/main/api/webhook/webhook-update.md)
