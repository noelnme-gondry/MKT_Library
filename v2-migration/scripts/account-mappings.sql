CREATE TABLE IF NOT EXISTS gop_account_mappings (
  account_id uuid PRIMARY KEY REFERENCES gop_accounts(id) ON DELETE CASCADE,
  rules jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(rules) = 'array' AND jsonb_array_length(rules) <= 200),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
