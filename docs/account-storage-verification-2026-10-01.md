# 레시피·보드 계정 저장 검증 — 2026-10-01

## 상태

사용자 요청 “2까지 진행”에 따라 실제 PostgreSQL과 HTTP 인증·저장 API를 연결한 로컬 통합 검증을 수행했다. **운영 DB 적용 및 운영 계정의 기기 간 검증은 미완료**다. 로컬 통과를 운영 성공으로 간주하지 않는다.

- 운영 `/api/account/session`: 200, 계정 기능 활성, 비로그인 상태.
- 운영 `/api/account/recipes`: 401 `LOGIN_REQUIRED`.
- 운영 `/api/account/boards`: **404**. 보드 API가 아직 배포되지 않았다.
- 작업 환경에 운영 DB 접속 설정이 없고 Railway 브라우저는 로그인 화면이다. 운영 데이터·계정·권한·배포는 변경하지 않았다.

## 실제로 검증한 경로

`v2-migration/scripts/verify-account-storage.mjs`는 기존 DB 주소를 받지 않는다. 매번 임시 PostgreSQL 클러스터를 새로 만들고, 기존 결제·계정 스키마와 레시피·보드 SQL을 적용한다. 별도 포트의 production Next 서버와 별도 Chromium 세션을 사용한다. API 응답·DB·권한을 mock하지 않는다.

임시 합성 계정은 기존 비밀번호 로그인 API로 로그인한다. 두 세션은 서로 다른 HttpOnly 세션 쿠키를 발급받는다. Google OAuth, 실제 결제, 이메일 발송은 이 검증 범위가 아니다. Pro 판정에는 실제 서버의 체험 만료 로직을 사용한다.

통합 검증 **12개 통과**:

1. 저장 데이터가 있는 상태에서 SQL을 다시 적용해도 보드·레시피 보존.
2. 실제 로그인·계정·Pro 판정과 독립 세션 발급.
3. KO 화면에서 A 브라우저의 보드 저장 → B 브라우저 복원·편집 저장.
4. KO 화면에서 생존 분석 시간 단위 저장 → B 브라우저 실제 컨트롤 복원.
5. EN 화면에서 동일 보드 저장·복원.
6. EN 화면에서 동일 분석 설정 저장·복원.
7. 보드 동시 6건 저장 유실 없음, 다른 계정 격리, 계정 ID 주입·다른 Origin·원본 데이터 거절.
8. 레시피 동시 6건 저장 및 같은 접근/데이터 계약 확인.
9. PostgreSQL 보드 20건 상한 초과 거절과 rollback 후 원래 데이터 보존.
10. PostgreSQL 레시피 100건 상한 초과 거절과 rollback 후 원래 데이터 보존.
11. Pro 만료 후 열람·개별 삭제 가능, 추가 저장 402.
12. 로그아웃한 세션만 무효화, 같은 계정의 다른 세션은 유지.

서버 DB의 실제 JSON도 확인했다. 사용자 차트 제목·원본 행·CSV 파일명·대상 값이 포함되지 않았다. UI는 양쪽에서 각각 예시 CSV를 로드하며 CSV 자체가 이동한 것이 아니다. 별도 브라우저 세션 검증이며 물리적으로 다른 기기 검증은 아니다.

첫 실행에서 테스트의 서베이 초기화가 외부 프레임의 localStorage에 접근해 오류를 냈다. 초기화를 테스트 앱 Origin으로 한정한 뒤 재실행해 페이지 오류 없이 통과했다. 제품 코드의 저장 오류는 발견되지 않았다.

기본 검증도 재실행했다: `npm run test:all` **4,975 passed / 4 skipped**, `npm run lint` 통과(0 error / 0 warning), `git diff --check` 통과. 이번 변경은 검증 스크립트·기록뿐이므로 build는 다시 수행하지 않고 직전 성공한 production build를 사용했다.

## 재실행

앱 디렉터리에서 production build와 Chromium이 준비된 상태로 실행한다.

```sh
PG_BIN=/opt/homebrew/opt/postgresql@17/bin node scripts/verify-account-storage.mjs
```

일반 PostgreSQL 설치는 `PG_BIN` 대신 PATH로 실행할 수 있다. 임시 서버·클러스터·비밀번호 파일은 종료 시 제거한다. 실제 서버·DB 주소를 인자로 받는 기능은 없다.

이번 실행 환경: Node 24.14.0, PostgreSQL 17.11, 기존 production build. 검증을 위해 PostgreSQL을 로컬에 설치했으며 Homebrew의 누락된 버전별 share/lib 링크만 보완했다. 상시 DB 서비스는 등록하지 않았다. 검증 후 임시 DB·앱 서버를 종료했다. 사용자 확인용 3100 서버는 DB 설정 없이 별도로 실행한다.

## 운영에서 남은 단계

1. Railway 프로젝트 로그인 후 운영 DB의 레시피·보드 테이블/제약과 적용 이력을 읽기 전용으로 확인.
2. 미적용 보드 SQL은 `scripts/account-boards.sql`의 추가 테이블만 대상으로 기존 백업·트랜잭션·잠금 정책에 맞춰 적용. 결제 데이터나 기존 저장 행을 수정하지 않는다.
3. 보드 API와 이번 레시피 변경의 배포가 필요하다. 현재 전체 변경은 미커밋이며 자동으로 main에 반영하지 않았다.
4. 승인된 운영 검증 계정으로 브라우저 두 곳에서 이름이 구별되는 합성 설정을 저장·복원하고, 만든 설정만 정리한다. 운영 Google 로그인·실제 결제 권한·물리적 기기 확인은 별도 결과로 기록한다.

브랜치 `codex/result-autonomy-pilot-fixes`는 upstream과 동일(0/0), origin/main과는 1 behind / 15 ahead다. 새 원격 커밋은 블로그 변경이다. 기존 사용자 변경·미추적 파일은 모두 유지했고 pull/rebase/commit/push/배포하지 않았다.
