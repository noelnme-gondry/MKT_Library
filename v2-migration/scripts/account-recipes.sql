-- 이름 붙여 저장한 분석 설정(레시피). 도구 id·이름·고른 단어 목록만 담는다.
-- "Meta만 분석"처럼 사용자 데이터 값이 들어간 단계는 계약에서 거절하므로 여기에 오지 않는다.
CREATE TABLE IF NOT EXISTS gop_account_recipes (
  account_id uuid PRIMARY KEY REFERENCES gop_accounts(id) ON DELETE CASCADE,
  recipes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(recipes) = 'array' AND jsonb_array_length(recipes) <= 100),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
