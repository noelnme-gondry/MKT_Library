// Server-only rollout setting. Unset preserves public mode; present but empty denies all.
export function accountEmailAllowed(email) {
  const configured = process.env.ACCOUNT_ALLOWED_EMAILS;
  if (configured === undefined) return true;
  if (typeof email !== "string" || !email.trim()) return false;
  return configured.split(",").map(value => value.trim().toLowerCase()).filter(Boolean).includes(email.trim().toLowerCase());
}
