# 계정 결정 보관 배포 점검

현재 코드는 비활성 기본값이다. 아래 조건을 확인하기 전 `ACCOUNTS_ENABLED=true`로 전환하지 않는다. CSV·프로젝트 전체 업로드 기능은 없다.

## 구성

- 기존 결제 PostgreSQL의 스키마 적용 후 `scripts/accounts-schema.sql`을 실행한다. 추가 테이블과 주문의 nullable 계정 FK만 도입하며 기존 주문·로컬 기록은 유지한다. 실행 전 DB 백업을 확보한다.
- 서버 환경 변수: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, 기존 `PAYMENTS_DATABASE_URL`. 비밀값은 호스팅 환경에만 설정하고 채팅·저장소에 기록하지 않는다.
- Google OAuth 웹 클라이언트의 callback: `https://growthoptplaybook.com/api/account/callback`. 개발 환경에서는 별도 클라이언트와 `ACCOUNTS_ORIGIN`을 사용한다. 기본 origin은 제품의 SITE_URL이다.
- 활성화 스위치: `ACCOUNTS_ENABLED=true`. 끄면 새 계정 요청이 차단되므로 기존 이용자의 메모 접근도 중단된다는 점에 유의한다. 장애 대응 시 데이터 삭제로 롤백하지 않는다.
- OAuth 로그인에는 state + PKCE + nonce + 서명 검증을 사용한다. 서버 세션 원문은 HttpOnly 쿠키에만, DB에는 토큰 해시만 저장한다. 만료 세션 정리 작업을 운영 DB에 구성한다.

## 체험·기존 구매

- Google `sub`별 최초 성공한 계정 메모 저장부터 서버 시각 기준 14일, 1회. 트랜잭션과 계정 행 잠금으로 실패·동시 요청에 의한 재시작을 방지한다.
- 무료 분석과 기존 로컬 보관은 유지한다. 계정 메모 쓰기는 활성 체험/유료 기간에만 허용하고, 기존 메모 읽기·CSV 내보내기·개별 삭제는 만료 후에도 제공한다. 계정당 최대 2,000건.
- 기존 보고서 이용권의 가격·비자동갱신 계약은 유지한다. 계정 기능 활성화 후 신규 구매는 로그인한 계정에 연결하며, 기존 구매는 기기의 검증된 이용권을 사용자가 명시적으로 연결한다. 다른 계정에 연결된 주문을 재이전하지 않는다.
- 로컬 기록 전체를 자동 전송하지 않는다. 사용자가 선택한 메모의 허용 필드만 확인·동의 후 전송한다. 원본 로컬 기록은 지우지 않는다.

## 활성화 전에 운영자 확정 필요

- Google OAuth 동의 화면·도메인 검증·테스트 사용자 또는 게시 상태.
- 실제 DB 호스팅·인증 제공자, 처리 국가, 위탁/국외이전 근거와 보유기간, 계정 삭제·권리 행사 절차를 개인정보처리방침 KO/EN에 확정 반영. 현재 안내 초안만으로 법적 검토가 완료된 것은 아니다.
- 계정 삭제 뒤 동일 Google 계정 재가입의 체험 재발급 방지와 개인정보 삭제 요구의 충돌을 해결할 최소 보존 근거·기간. 지금은 계정 삭제 셀프서비스를 제공하지 않으며 지원 요청으로 처리한다.
- SMTP 발송 코드와 기존 계정용 이메일 로그인은 구현돼 있지만 운영 발송은 미활성이다. 발송 제공자·발신 도메인·SPF/DKIM·반송 처리·안내 동의 범위를 확정한다. 메일은 실제 결제 안내·복원 로그인 링크·옵트인 검토/D-7 안내이며 메모 내용과 CSV는 포함하지 않는다. 마케팅 수신은 계정 생성과 분리한다.
- Google 실패 시 기존 계정만 등록 이메일로 10분·1회·요청 브라우저 한정 링크를 받을 수 있다. 이메일만으로 새 계정/체험을 발급하거나 다른 Google 계정을 병합하지 않는다. 익명 분석·로컬 보관·기존 구매 복원도 유지한다.
- 자동갱신 가격/결제 계약 변경은 별도 확정 대상이며 이번 코드에서 켜지지 않는다.

## 실제 환경 검증

1. KO/EN 블로그 업로드→차트→상세 분석: 네트워크에 CSV·파일명·열 값이 없는지 확인.
2. 분석을 열어 둔 채 Google 팝업 로그인 성공/취소/차단; 다른 Google 계정 전환 시 메모 격리.
3. 첫 저장·동시 두 요청·DB 쓰기 실패·14일 경계·재로그인에서 체험 시작일 불변.
4. 다른 기기에서 로그인하여 메모 읽기/내보내기, 만료 후 쓰기만 거부.
5. 기존 실결제 이용권 연결, 신규 구매 연결, 환불 반영, 타 계정 주문 연결 거부.
6. 로그아웃/만료 쿠키/다른 origin에서 쓰기 거부. 오류 응답·로그에 이메일·토큰·메모를 남기지 않는지 확인.

단위/스모크의 DB mock 검증은 실제 PostgreSQL·Google·Toss 통합 검증을 대체하지 않는다.

## 메일 작업 구성

- Resend 연결은 `SMTP_HOST=smtp.resend.com`·`SMTP_USER=resend`이면 HTTPS API를 사용한다. 기존 `SMTP_PASS`에 저장한 Resend 키를 재사용하며 새 키 입력은 필요 없다. Railway Pro 미만의 SMTP 차단을 피하기 위한 전송 방식이며, 다른 SMTP 제공자의 TLS 발송 경로는 유지한다. 수신처·본문·동의 범위는 바뀌지 않는다. API 수락은 받은편지함 도착을 뜻하지 않는다.
- 2026-09-11 운영 DB에 `scripts/accounts-schema.sql`을 단일 트랜잭션으로 적용했다(COMMIT 및 계정 테이블 6개 확인). 변경 전 pg_dump custom-format 백업은 DB 볼륨의 `/var/lib/postgresql/data/gop-pre-account-EJBGSH/database.dump`에 권한 600으로 생성했고 pg_restore 목록을 확인했다. 같은 볼륨이므로 재해 복구용 외부 백업이나 실제 복원 검증을 대체하지 않는다. Railway 기본 백업 기능은 현재 요금제에서 사용할 수 없다. DB 설정 화면의 기존 리전 `europe-west4-drams3a` 경고는 미해결이며 임의 이동하지 않았다.
- 2026-09-11 Resend `mail.growthoptplaybook.com`의 Tokyo(ap-northeast-1) 발송 도메인 인증을 완료했다. Porkbun의 기존 10개 레코드는 유지하고 TXT `resend._domainkey.mail`, CNAME `rsend.mail` → `rsend-apne1.forge.rmta.net`, CNAME `send.mail` → `send.forge.rmta.net`만 추가했다. 외부 DNS 조회와 Resend `Verified`를 확인했다. 메일·로그의 미국 저장 및 보관 기간을 SSOT와 KO/EN 개인정보처리방침에 반영했다. 운영 사이트 배포는 별도 확인해야 한다.
- Resend SMTP 설정: `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`. `SMTP_PASS`에는 해당 발송 도메인의 Sending access 키를 운영자가 직접 입력한다. `SMTP_FROM`은 인증된 `mail.growthoptplaybook.com` 아래 주소여야 한다. 키 생성·호스팅 입력·테스트 발송은 아직 미완료이며 DNS 인증만으로 앱 발송이 켜지지 않는다. 추적용 서브도메인은 구성하지 않았다.
- 서버에 `ACCOUNT_MAIL_ENABLED=true`, `SMTP_HOST`, `SMTP_PORT`(465 또는 587), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`을 설정한다. SMTP는 TLS를 요구하며 인증서 검증을 끄지 않는다. 활성화 전 등록한 운영자 주소로 실제 수신·반송을 검증한다.
- 32자 이상의 임의 `ACCOUNT_JOB_SECRET`을 서버와 작업 실행 환경에 설정한다. 비밀값을 URL이나 git에 넣지 않는다.
- 외부 스케줄러에서 15분마다 `node scripts/account-mail-job.mjs`를 실행한다. 작업 환경에는 `ACCOUNT_JOB_SECRET`과 HTTPS `ACCOUNTS_ORIGIN`만 있으면 된다. 스크립트는 POST `/api/account/jobs`를 호출하며 CSV·메일 본문·토큰을 로그에 남기지 않는다. 새 유료 스케줄러 서비스 생성은 별도 운영 선택이다.
- 작업은 한 번에 최대 20건, DB 행 lease로 동시 실행을 분리한다. 실패는 15분 후 최대 5회 재시도한다. `attempts>=5 AND sent_at IS NULL`은 운영 알림·수동 재처리 대상이다. SMTP 수락 직후 프로세스가 중단되면 같은 메일이 다시 갈 수 있으므로 exactly-once라고 주장하지 않는다. 고정 Message-ID를 사용한다.
- 발송 직전 옵트아웃·삭제·검토일 변경·Pro 만료·결제 취소 상태를 다시 확인한다. 24시간 이상 늦은 검토/D-7 안내는 보내지 않는다. 과거 `.txt` 복원 코드 자체는 메일/큐에 저장하지 않고 계정 로그인으로 복원한다.
- 현재 운영 확인: Railway MKT Library production의 서비스 변수에는 Sheets·DB·Toss 설정만 있고 OAuth·SMTP·계정 활성화 설정은 없다(2026-09-11, 변수 이름만 확인). 실제 DB 마이그레이션·발송·결제·OAuth 연결은 미실행이다.
