-- Payment data only. Never store CSVs, analysis results, project names or uploaded filenames.
-- Apply once to the PostgreSQL database configured by PAYMENTS_DATABASE_URL.
CREATE TABLE IF NOT EXISTS gop_payment_orders (
  id text PRIMARY KEY,
  access_hash text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  product_id text NOT NULL,
  idempotency_key uuid NOT NULL UNIQUE,
  mode text NOT NULL CHECK (mode IN ('test', 'live')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'revoked')),
  payment_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  approved_at timestamptz,
  expires_at timestamptz,
  verified_at timestamptz
);
