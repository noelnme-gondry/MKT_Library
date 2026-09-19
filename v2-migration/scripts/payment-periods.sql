-- Additive, idempotent migration. Existing approval/expiry timestamps are preserved.
ALTER TABLE gop_payment_orders ADD COLUMN IF NOT EXISTS starts_at timestamptz;
-- Keep original provider identity after switching the checkout provider.
ALTER TABLE gop_payment_orders ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'toss';

-- Card-network review needs a plain id/password sign-in. Accounts provisioned that way
-- have no Google identity, so google_sub stops being required; it stays unique.
ALTER TABLE gop_accounts ADD COLUMN IF NOT EXISTS password_hash text;
-- No unique index on email: two Google identities may legitimately share an address
-- (see emailLogin), and adding one here would fail the startup migration on live data.
ALTER TABLE gop_accounts ALTER COLUMN google_sub DROP NOT NULL;

-- Reach only contiguous paid periods (or an active trial), never a refunded gap.
CREATE OR REPLACE FUNCTION gop_paid_until(owner_id uuid, payment_mode text, at_time timestamptz)
RETURNS timestamptz LANGUAGE sql STABLE AS $$
  WITH RECURSIVE coverage(until, purchased) AS (
    SELECT GREATEST(at_time, a.trial_started_at + INTERVAL '14 days'), false
    FROM gop_accounts a WHERE a.id=owner_id
    UNION
    SELECT p.expires_at, true FROM coverage c JOIN gop_payment_orders p
      ON COALESCE(p.starts_at,p.approved_at)<=c.until AND p.expires_at>c.until
    WHERE p.account_id=owner_id AND p.mode=payment_mode AND p.status='paid'
  ) SELECT max(until) FROM coverage WHERE purchased AND until>at_time
$$;
