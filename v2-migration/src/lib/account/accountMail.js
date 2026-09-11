import nodemailer from "nodemailer";
import { createHash, timingSafeEqual } from "node:crypto";
import { SITE_URL } from "@/lib/routeMap";
import { accountDatabase } from "./accountServer";
import { accountEntitlement } from "./archiveContract";
export const mailEnabled = () => process.env.ACCOUNT_MAIL_ENABLED === "true" && Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);
export async function sendAccountMail(to, subject, text, messageId) {
  if (!mailEnabled()) throw new Error("MAIL_UNAVAILABLE");
  const port = Number(process.env.SMTP_PORT || 587);
  if (![465, 587].includes(port) || /[\r\n]/.test(to) || /[\r\n]/.test(process.env.SMTP_FROM)) throw new Error("MAIL_UNAVAILABLE");
  // Railway non-Pro plans block SMTP. Resend's SMTP password is already an API key.
  if (process.env.SMTP_HOST === "smtp.resend.com" && process.env.SMTP_USER === "resend") {
    try {
      const headers = { Authorization: `Bearer ${process.env.SMTP_PASS}`, "Content-Type": "application/json" };
      if (messageId) headers["Idempotency-Key"] = createHash("sha256").update(messageId).digest("hex");
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", headers, redirect: "error", signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ from: process.env.SMTP_FROM, to: [to], subject, text }),
      });
      if (!response.ok || typeof (await response.json())?.id !== "string") throw new Error("MAIL_UNAVAILABLE");
      return;
    } catch { throw new Error("MAIL_UNAVAILABLE"); }
  }
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, requireTLS: true, tls: { minVersion: "TLSv1.2", rejectUnauthorized: true }, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, logger: false, debug: false, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000, disableFileAccess: true, disableUrlAccess: true });
  try {
    const result = await transport.sendMail({ from: process.env.SMTP_FROM, to: { address: to, name: "" }, subject, text, messageId });
    if (!result.accepted?.length) throw new Error("MAIL_UNAVAILABLE");
  } finally { transport.close(); }
}
export function authorizeMailJob(request) {
  const secret = process.env.ACCOUNT_JOB_SECRET || "";
  const actual = request.headers.get("authorization") || "";
  if (secret.length < 32 || actual.length !== secret.length + 7 || !timingSafeEqual(Buffer.from(actual), Buffer.from(`Bearer ${secret}`))) throw new Error("INVALID_ORIGIN");
}
export function serviceMailCopy(kind, locale, { reference, amount, expiresAt } = {}) {
  const en = locale === "en", base = `${SITE_URL}${en ? "/en" : ""}`;
  const titles = en ? { review: "Your scheduled decision review", expiry: "Your Pro access ends in 7 days", receipt: "Your Growth Opt Playbook payment" } : { review: "예약한 결정 검토일 안내", expiry: "Pro 이용기간 종료 7일 전 안내", receipt: "Growth Opt Playbook 결제 안내" };
  const body = kind === "receipt" ? (en ? `Order: ${reference}\nAmount: KRW ${amount}\nAccess until: ${expiresAt}\nSign in with your account to restore access. Use the same account on another device; source CSV files are not synced.` : `주문번호: ${reference}\n결제금액: ${amount}원\n이용기간 종료: ${expiresAt}\n계정 로그인으로 이용권을 복원할 수 있습니다. 다른 기기에서도 같은 계정으로 로그인하세요. CSV 원본은 동기화하지 않습니다.`) : kind === "expiry" ? (en ? "Your current Pro period will end. There is no automatic charge. Existing memos remain readable and exportable." : "현재 Pro 이용기간이 종료될 예정입니다. 자동 결제되지 않으며 기존 메모는 계속 읽고 내보낼 수 있습니다.") : (en ? "Today is a review date you selected. Sign in to review your decision; no memo content is included in this email." : "직접 선택한 결정 검토일입니다. 로그인해 결정을 확인하세요. 메모 내용은 이 이메일에 포함하지 않습니다.");
  return { subject: titles[kind], text: `${body}\n\n${base}/subscription\n${en ? "Manage service reminders in your account archive. This is not a marketing newsletter." : "계정 보관함에서 서비스 알림을 해제할 수 있습니다. 마케팅 뉴스레터가 아닙니다."}` };
}
export async function dispatchAccountMail() {
  if (!mailEnabled()) throw new Error("MAIL_UNAVAILABLE");
  const db = accountDatabase();
  // Discover receipts from the authoritative live payment ledger, even after a webhook-only completion.
  await db.query(`INSERT INTO gop_account_mail(id,account_id,kind,reference,due_at) SELECT 'receipt:'||p.id,p.account_id,'receipt',p.id,NOW() FROM gop_payment_orders p WHERE p.account_id IS NOT NULL AND p.status='paid' AND p.mode='live' ON CONFLICT(id) DO NOTHING`);
  await db.query(`INSERT INTO gop_account_mail(id,account_id,kind,reference,due_at) SELECT 'expiry:'||a.id::text||':'||x.until::text,a.id,'expiry',x.until::text,x.until-INTERVAL '7 days' FROM gop_accounts a CROSS JOIN LATERAL (SELECT GREATEST(a.trial_started_at+INTERVAL '14 days',gop_paid_until(a.id,'live',NOW())) AS until) x WHERE a.service_reminders AND x.until>NOW() ON CONFLICT(id) DO NOTHING`);
  await db.query(`INSERT INTO gop_account_mail(id,account_id,kind,reference,due_at) SELECT 'review:'||m.account_id::text||':'||m.id||':'||(m.memo->>'reviewDate'),m.account_id,'review',m.id,((m.memo->>'reviewDate')||' 09:00:00+09')::timestamptz FROM gop_decision_memos m JOIN gop_accounts a ON a.id=m.account_id WHERE a.service_reminders AND m.reminder_enabled AND (m.memo->>'reviewDate')~'^\\d{4}-\\d{2}-\\d{2}$' AND COALESCE(m.memo->>'status','')<>'reviewed' ON CONFLICT(id) DO NOTHING`);
  let sent = 0, failed = 0;
  // Atomic row leases exclude concurrent workers. SMTP accepts may still duplicate on a crash after send.
  for (let index = 0; index < 20; index++) {
    const job = (await db.query(`UPDATE gop_account_mail SET lease_until=NOW()+INTERVAL '5 minutes',attempts=attempts+1 WHERE id=(SELECT id FROM gop_account_mail WHERE sent_at IS NULL AND attempts<5 AND due_at<=NOW() AND (lease_until IS NULL OR lease_until<NOW()) ORDER BY due_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`)).rows[0];
    if (!job) break;
    try {
      const owner = (await db.query("SELECT a.*,gop_paid_until(a.id,'live',NOW()) AS paid_until FROM gop_accounts a WHERE a.id=$1", [job.account_id])).rows[0];
      let details = { reference: job.reference }, eligible = Boolean(owner);
      if (job.kind === "receipt") {
        const order = (await db.query("SELECT amount,expires_at FROM gop_payment_orders WHERE id=$1 AND account_id=$2 AND status='paid' AND mode='live'", [job.reference, job.account_id])).rows[0];
        eligible &&= Boolean(order);
        details = { ...details, amount: order?.amount, expiresAt: order?.expires_at ? new Date(new Date(order.expires_at).getTime() + 9 * 3600000).toISOString().slice(0, 10) : "" };
      } else {
        eligible &&= Boolean(owner?.service_reminders);
        if (job.kind === "review") {
          const memo = (await db.query("SELECT memo,reminder_enabled FROM gop_decision_memos WHERE account_id=$1 AND id=$2", [job.account_id, job.reference])).rows[0];
          eligible &&= Boolean(accountEntitlement(owner) && memo?.reminder_enabled && memo.memo.status !== "reviewed" && job.id.endsWith(`:${memo.memo.reviewDate}`) && Date.now() - new Date(job.due_at).getTime() < 86400000);
        } else {
          const current = (await db.query("SELECT GREATEST(a.trial_started_at+INTERVAL '14 days',gop_paid_until(a.id,'live',NOW())) AS until FROM gop_accounts a WHERE a.id=$1", [job.account_id])).rows[0]?.until;
          eligible &&= Boolean(current && new Date(current).getTime() === new Date(job.reference).getTime() && Date.now() - new Date(job.due_at).getTime() < 86400000);
        }
      }
      if (eligible) {
        const copy = serviceMailCopy(job.kind, owner.locale, details);
        await sendAccountMail(owner.email, copy.subject, copy.text, `<${createHash("sha256").update(job.id).digest("hex")}@${new URL(SITE_URL).hostname}>`);
        sent++;
      }
      await db.query("UPDATE gop_account_mail SET sent_at=NOW(),lease_until=NULL WHERE id=$1", [job.id]);
    } catch {
      failed++;
      await db.query("UPDATE gop_account_mail SET lease_until=NOW()+INTERVAL '15 minutes' WHERE id=$1", [job.id]);
    }
  }
  await db.query("DELETE FROM gop_email_logins WHERE expires_at<NOW()");
  await db.query("DELETE FROM gop_account_sessions WHERE expires_at<NOW()");
  return { sent, failed };
}
