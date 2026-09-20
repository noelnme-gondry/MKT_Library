# NICEPAY 전환 준비 — 2026-09-19

> 2026-09-20 후속 개발·전환·점검 절차는 [개통 전환 운영서](nicepay-cutover-runbook.md)를 따른다. 아래는 최초 구현 시점의 기록이며 현재 배포 상태와 구분한다.

## 구현 범위와 운영 상태

NICEPAY JS SDK의 **Server 승인 + Basic 인증** 모델로 카드 1회 결제를 준비했다. 현재 운영 환경 변경·실결제·배포는 하지 않았다. 가맹점 계약 상태와 발급 키의 승인 모델은 미확인이다. Client 승인·Bearer 인증·구형 MID 방식은 이 구현과 다르므로 해당 계약이면 그대로 켜면 안 된다.

- 신규 주문의 PG는 `PAYMENTS_PROVIDER=toss|nicepay`로 선택. 미지정은 기존 Toss, 알 수 없는 값은 구매 차단.
- 주문에 `provider`를 저장한다. 기존 주문의 기본값은 `toss`이며 신규 PG로 전환해도 원래 PG에서 조회한다.
- NICEPAY 인증 결과는 POST로 받는다. 서명을 검사하고 HttpOnly 쿠키로 전달한 뒤 식별정보 없는 구독 페이지로 이동한다. 같은 출처 승인 요청에서 주문 소유자·금액·모드를 다시 검사한 후 서버 승인한다.
- 승인 응답의 주문·금액·통화·TID·서명을 검사한다. 카드 전액 승인만 이용권으로 인정한다. 부분/전체 취소는 회수한다.
- 승인 시도는 먼저 DB에 기록한다. 재시도는 상태 조회만 한다. 응답 유실 때 무조건 재승인하지 않는다. 승인 네트워크 오류는 망취소를 시도하며, 확인 불가 상태는 운영자 재조회 대상이다.
- 웹훅은 알림 본문의 결제 성공 주장을 믿지 않고 저장된 거래를 PG에서 재조회한다. 처리 성공 시 NICEPAY가 요구하는 평문 `OK`를 반환한다.
- 테스트 구매는 기존 `test_purchase`, 실구매는 서버 확인 후 `purchase`. 카드 인증 완료 자체는 구매 이벤트가 아니다.
- 한/영 결제 안내와 개인정보 문구를 함께 반영했다. CSV·분석 결과는 PG에 보내지 않는다.

## 필요한 설정

사업자 신청부터 개통까지의 순서·준비서류·비용 확인·담당자 문의문은 [Gondry용 도입 체크리스트](nicepay-owner-checklist-2026-09-19.md)를 따른다.

비밀키는 채팅·소스·로그에 넣지 않고 배포 환경의 비밀값으로 설정한다.

| 설정 | 값/의미 |
|---|---|
| `PAYMENTS_PROVIDER` | `nicepay` |
| `NICEPAY_APPROVAL_MODEL` | `server-basic` — 실제 발급 모델 확인 필요 |
| `NICEPAY_MODE` | `test`는 `sandbox-api.nicepay.co.kr`, `live`는 `api.nicepay.co.kr`. 키와 주문의 환경이 일치해야 함 |
| `NICEPAY_CLIENT_KEY` | 해당 환경의 클라이언트 키 |
| `NICEPAY_SECRET_KEY` | 같은 가맹점·환경의 Basic 시크릿 키 |
| `PAYMENTS_DATABASE_URL` | 기존 결제 DB |
| `PAYMENTS_LIVE_ENABLED` | 검증 전 `false`, 운영 전환 시에만 `true` |

운영 빌드에서는 테스트 구매를 차단한다. 테스트는 별도 테스트 환경에서 한다. 기존 Toss 거래가 남아 있으면 기존 Toss 키도 유지한다. 기존 주문을 NICEPAY 거래로 바꾸지 않는다. `scripts/payment-periods.sql`의 additive migration을 **새 주문 코드보다 먼저** 적용한다(기존 시작 스크립트에 포함된 파일).

## 가맹점 관리자 설정과 검증

1. 디지털 이용권 판매 계약·카드사 심사 및 Server 승인/Basic 키 발급 여부 확인.
2. 가맹점에 실제 서비스 도메인과 상품/금액/사업자/환불 안내 등록·확인.
3. 인증 반환 URL: `https://growthoptplaybook.com/api/payments/nicepay/return?locale=ko` (EN은 `locale=en`).
4. 웹훅: `https://growthoptplaybook.com/api/payments/nicepay/webhook`. 카드 승인·취소 통보 설정 및 `OK` 검증.
5. 테스트 키로 PC·모바일 카드 인증, 취소, 실패, 만료, 승인 응답 유실, 중복 반환, 로그아웃/다른 계정, 금액 변조를 검증.
6. 기존 Toss 이용권 복원·기간 합산·취소 회수 검증. 두 PG의 실환경 키를 모두 유지한 상태에서 전환.
7. 실환경 소액 결제·환불은 소유자가 수행하고, 서버 이용권 및 GA `purchase`의 거래번호/금액을 대조한다. 가맹점 심사 완료만으로 이 단계를 통과했다고 보지 않는다.

환불 실행은 각 PG 가맹점 관리자에서 처리하고 웹훅/조회로 이용권 회수를 확인한다. 이 변경은 관리자가 임의 환불할 새 HTTP API를 추가하지 않는다. NICEPAY 승인 시도 후 상태 조회마저 실패하면 주문을 새로 결제시키지 말고 가맹점 관리자에서 기존 주문을 먼저 확인한다.

롤백은 신규 PG 선택을 Toss로 되돌리는 방식이다. 이미 만들어진 NICEPAY 거래 조회를 위해 NICEPAY 설정을 지우지 않는다. DB의 `provider` 컬럼은 그대로 유지한다.

## 아직 실측하지 못한 부분

실제 NICEPAY 테스트/운영 키, 카드사 앱 복귀, 실제 DB migration, 가맹점 통보 도달 및 결제·취소는 미검증이다. 로컬 가짜 PG 응답으로 검증한 것은 승인 계약·권한·중복 방지·화면 분기이며, 실제 PG 연동 완료를 뜻하지 않는다.

## 공식 근거

- [Server 승인 결제창과 인증 서명](https://github.com/nicepayments/nicepay-manual/blob/main/api/payment-window-server.md)
- [Basic 인증](https://github.com/nicepayments/nicepay-manual/blob/main/common/api.md)
- [거래 조회와 응답 서명](https://github.com/nicepayments/nicepay-manual/blob/main/api/status-transaction.md)
- [망취소](https://github.com/nicepayments/nicepay-manual/blob/main/api/cancel.md)
- [웹훅 등록과 OK 응답](https://github.com/nicepayments/nicepay-manual/blob/main/api/webhook/webhook-update.md)
