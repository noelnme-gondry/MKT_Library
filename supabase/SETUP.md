# Supabase 셋업 가이드

Ops Dashboard(5-1, 5-2) 접근 제어를 위한 Supabase 프로젝트 구축 절차.

---

## 1. 프로젝트 생성

1. [supabase.com](https://supabase.com) → **Sign up** (GitHub 계정 연동 권장)
2. 좌상단 **New project** 클릭
3. 입력:
   - **Name**: `mkt-library-auth`
   - **Database Password**: 강력한 비밀번호 (안전한 곳에 백업)
   - **Region**: `Northeast Asia (Seoul)` 권장
   - **Plan**: Free
4. 프로젝트 생성 완료까지 약 2분 대기

---

## 2. 스키마 적용

1. 좌측 메뉴 → **SQL Editor** → **New query**
2. 먼저 pgcrypto 확장 활성화:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```
   `RUN` 클릭
3. `supabase/schema.sql` 내용 전체를 복사해서 붙여넣고 `RUN`
4. **성공 메시지** 확인: `access_keys` 테이블 생성, `validate_access_key` 함수 생성

---

## 3. API URL · Anon Key 확보

1. 좌측 메뉴 → **Project Settings** (톱니바퀴) → **API**
2. 두 값을 복사:
   - **Project URL**: `https://xxxxxxxxxxxx.supabase.co`
   - **anon public** key: `eyJhbGciOiJIUzI1NiIs...` (긴 JWT 형식 문자열)
3. 두 값을 클로드에게 알려주세요. 클라이언트 코드에 반영합니다.
   - ⚠️ **service_role key는 절대 알려주지 마세요** — 그건 admin 권한이라 클라이언트에 노출되면 안 됩니다.

---

## 4. 첫 키 발급

SQL Editor에서 다음을 실행:

```sql
DO $$
DECLARE
  plain TEXT := encode(gen_random_bytes(16), 'hex');
  hash  TEXT := encode(digest(plain, 'sha256'), 'hex');
BEGIN
  INSERT INTO access_keys (key_label, key_hash, expires_at, notes)
  VALUES (
    '본인 테스트 키',          -- key_label: 누구에게 줬는지 식별
    hash,
    NOW() + INTERVAL '30 days', -- 30일 만료
    '셋업 검증용 첫 키'
  );
  RAISE NOTICE '🔑 PLAIN KEY (지금 한 번만 표시됨, 즉시 복사하세요): %', plain;
END
$$;
```

`RAISE NOTICE`에서 출력된 평문 키를 복사 (예: `4f8a2c91d3b75ea6...`).  
이 키를 Ops Dashboard 입력란에 넣으면 30일간 접근 가능합니다.

---

## 5. 키 관리 (운영 시)

좌측 **Table Editor → access_keys**에서 GUI로 모두 가능:

| 작업 | 방법 |
|------|------|
| 키 발급 | SQL Editor에서 위 DO 블록 실행 (라벨/기간 조정) |
| 키 revoke | Table Editor → 해당 row → `revoked` 컬럼을 `true`로 |
| 만료 연장 | Table Editor → 해당 row → `expires_at` 컬럼 편집 |
| 마지막 사용 시각 확인 | `last_used` 컬럼 |
| 키 목록 조회 | SQL: `SELECT key_label, expires_at, last_used, revoked FROM access_keys ORDER BY created_at DESC;` |

---

## 6. 비용

- Free 티어: 500MB DB / 무제한 API 요청 / 50,000 monthly active users
- access_keys 1개당 ~1KB → 100,000개 키 저장해도 100MB 수준
- 이 용도로는 영구 무료 운영 가능

---

## 7. 보안 모델 정리

| 자산 | 어디에 노출되나 | 안전한가 |
|------|----------------|---------|
| `service_role` key | Supabase 콘솔에서만 | ✓ (절대 외부 노출 X) |
| `anon` key | 클라이언트 JS 코드 | ✓ (RLS로 직접 SELECT 차단됨) |
| `access_keys.key_hash` | DB에만 | ✓ (anon은 직접 SELECT 불가) |
| 평문 키 (`plain`) | 발급 시 1회만 표시 | ✓ (DB에 저장 안 됨, 라벨 보유자만 분실 시 재발급) |
| `validate_access_key(hash)` RPC | anon에게 노출 | ✓ (해시 입력 필요, 통과 시 만료/라벨만 반환) |

anon key가 코드에 노출되어도 RLS와 RPC 게이트로 인해 키 목록 자체는 못 빼냅니다.
