-- ============================================================
--  Performance Marketing Library - Access Key Schema
--  Supabase Postgres / Run in SQL Editor
-- ============================================================

-- 1) 키 저장 테이블
CREATE TABLE IF NOT EXISTS access_keys (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_label  TEXT NOT NULL,                          -- 식별용 라벨 (예: "Client A · 2026 Q2")
  key_hash   TEXT NOT NULL UNIQUE,                   -- SHA-256(plain_key), 평문 키는 저장하지 않음
  expires_at TIMESTAMPTZ NOT NULL,                   -- 만료 시각
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked    BOOLEAN     DEFAULT FALSE,              -- 강제 무효화 플래그
  last_used  TIMESTAMPTZ,                            -- 마지막 검증 통과 시각 (감사용)
  notes      TEXT
);

CREATE INDEX IF NOT EXISTS idx_access_keys_hash ON access_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_access_keys_expires ON access_keys(expires_at);

-- 2) RLS 활성화: anonymous는 직접 SELECT 불가, RPC만 허용
ALTER TABLE access_keys ENABLE ROW LEVEL SECURITY;

-- (모든 직접 접근 차단. 의도적 빈 정책)
DROP POLICY IF EXISTS "no_direct_access" ON access_keys;
CREATE POLICY "no_direct_access" ON access_keys FOR ALL USING (false);

-- 3) 키 검증 RPC (anonymous에게 노출되는 유일한 함수)
--    입력: SHA-256 해시된 키
--    출력: valid(boolean), expires_at, key_label
--    내부에서 last_used 자동 업데이트
CREATE OR REPLACE FUNCTION validate_access_key(input_hash TEXT)
RETURNS TABLE(valid BOOLEAN, expires_at TIMESTAMPTZ, key_label TEXT)
LANGUAGE plpgsql
SECURITY DEFINER       -- 함수 소유자(=Supabase admin) 권한으로 실행
SET search_path = public
AS $$
DECLARE
  v_record access_keys%ROWTYPE;
BEGIN
  SELECT * INTO v_record FROM access_keys WHERE key_hash = input_hash LIMIT 1;

  IF v_record.id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, NULL::TEXT;
    RETURN;
  END IF;

  -- 만료/revoke 체크
  IF v_record.expires_at <= NOW() OR v_record.revoked THEN
    RETURN QUERY SELECT FALSE, v_record.expires_at, v_record.key_label;
    RETURN;
  END IF;

  -- 통과: last_used 업데이트 후 반환
  UPDATE access_keys SET last_used = NOW() WHERE id = v_record.id;
  RETURN QUERY SELECT TRUE, v_record.expires_at, v_record.key_label;
END;
$$;

-- 함수 실행 권한을 anonymous 역할에 부여
GRANT EXECUTE ON FUNCTION validate_access_key(TEXT) TO anon;

-- ============================================================
--  키 발급 헬퍼 (admin이 SQL Editor에서 직접 실행)
-- ============================================================
--
-- 사용법:
--   plain_key는 클라이언트에 줄 평문. hash는 SHA-256(plain_key).
--   온라인 도구나 아래 PL/pgSQL로 생성 가능.
--
-- 예시 (PL/pgSQL로 키 + hash 동시 발급):
--
--   DO $$
--   DECLARE
--     plain TEXT := encode(gen_random_bytes(16), 'hex');  -- 32자 hex 평문
--     hash  TEXT := encode(digest(plain, 'sha256'), 'hex');
--   BEGIN
--     INSERT INTO access_keys (key_label, key_hash, expires_at, notes)
--     VALUES ('Client A · 2026 Q2', hash, NOW() + INTERVAL '90 days', '첫 발급');
--     RAISE NOTICE 'PLAIN KEY (한 번만 표시됨, 즉시 복사): %', plain;
--   END
--   $$;
--
--   ※ pgcrypto 확장 필요:
--   CREATE EXTENSION IF NOT EXISTS pgcrypto;
--
-- 키 revoke:
--   UPDATE access_keys SET revoked = TRUE WHERE key_label = 'Client A · 2026 Q2';
--
-- 만료 연장:
--   UPDATE access_keys SET expires_at = NOW() + INTERVAL '30 days'
--   WHERE key_label = 'Client A · 2026 Q2';
--
-- 활성 키 목록:
--   SELECT key_label, expires_at, last_used, revoked
--   FROM access_keys
--   ORDER BY created_at DESC;
