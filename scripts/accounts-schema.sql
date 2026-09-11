-- Additive migration; source CSVs and analysis datasets are never stored here.
CREATE TABLE IF NOT EXISTS gop_accounts (
  id uuid PRIMARY KEY,
  google_sub text UNIQUE NOT NULL,
  email text NOT NULL,
  trial_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS gop_account_sessions (
  token_hash text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES gop_accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS gop_oauth_attempts (
  state_hash text PRIMARY KEY,
  verifier text NOT NULL,
  nonce text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS gop_decision_memos (
  account_id uuid NOT NULL REFERENCES gop_accounts(id) ON DELETE CASCADE,
  id text NOT NULL,
  memo jsonb NOT NULL CHECK (jsonb_typeof(memo) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, id)
);
ALTER TABLE gop_payment_orders ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES gop_accounts(id);
CREATE INDEX IF NOT EXISTS gop_payment_account ON gop_payment_orders(account_id);
ALTER TABLE gop_accounts ADD COLUMN IF NOT EXISTS service_reminders boolean NOT NULL DEFAULT false;
ALTER TABLE gop_accounts ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'ko';
ALTER TABLE gop_decision_memos ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS gop_email_logins (
  token_hash text PRIMARY KEY,
  browser_hash text NOT NULL,
  account_id uuid NOT NULL REFERENCES gop_accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
-- Outbox stores identifiers only, never CSV rows, memo contents or bearer tokens.
CREATE TABLE IF NOT EXISTS gop_account_mail (
  id text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES gop_accounts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('receipt','review','expiry')),
  reference text NOT NULL,
  due_at timestamptz NOT NULL,
  sent_at timestamptz,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS gop_account_mail_due ON gop_account_mail(due_at) WHERE sent_at IS NULL;
