// Run as a scheduled process (e.g. every 15 minutes). No CSV or secrets are logged.
const origin = process.env.ACCOUNTS_ORIGIN || "https://growthoptplaybook.com";
const secret = process.env.ACCOUNT_JOB_SECRET;
if (!secret || secret.length < 32 || new URL(origin).protocol !== "https:") throw new Error("Configure HTTPS ACCOUNTS_ORIGIN and ACCOUNT_JOB_SECRET");
const response = await fetch(new URL("/api/account/jobs", origin), { method: "POST", headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(600000) });
if (!response.ok) throw new Error(`Account mail job unavailable: HTTP ${response.status}`);
const result = await response.json();
console.log(JSON.stringify({ sent: result.sent, failed: result.failed }));
if (result.failed) process.exitCode = 1;
