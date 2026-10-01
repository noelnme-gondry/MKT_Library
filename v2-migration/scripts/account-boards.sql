-- Portable display settings only; no CSV values or analysis results.
CREATE TABLE IF NOT EXISTS gop_account_boards (
  account_id uuid PRIMARY KEY REFERENCES gop_accounts(id) ON DELETE CASCADE,
  boards jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(boards) = 'array' AND jsonb_array_length(boards) <= 20),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
