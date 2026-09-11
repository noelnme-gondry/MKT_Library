-- Additive, idempotent migration. Existing approval/expiry timestamps are preserved.
ALTER TABLE gop_payment_orders ADD COLUMN IF NOT EXISTS starts_at timestamptz;

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
