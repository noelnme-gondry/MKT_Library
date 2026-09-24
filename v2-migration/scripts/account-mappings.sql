CREATE TABLE IF NOT EXISTS gop_account_mappings (
  account_id uuid PRIMARY KEY REFERENCES gop_accounts(id) ON DELETE CASCADE,
  rules jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(rules) = 'array' AND jsonb_array_length(rules) <= 200),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- 원본 데이터 통화 선택(KRW|USD)만 계정에 기억한다. 금액·파일 정보는 없다.
ALTER TABLE gop_accounts ADD COLUMN IF NOT EXISTS source_currency text CHECK (source_currency IN ('KRW', 'USD'));
