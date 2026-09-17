// 계정·결정 메모 현황을 읽기 전용으로 집계한다. 쓰기 쿼리는 없다.
//
// 이 보고서가 셀 수 없는 것을 먼저 밝힌다: "프로젝트 리뷰 저장"(saveProjectReview)은
// IndexedDB에만 기록되므로 서버에 흔적이 없다. 여기서 세는 것은 ① 저장 자격을 가진
// 계정(체험·결제)과 ② 사용자가 따로 동의하고 올린 계정 결정 메모뿐이다.
// 저장 실행 횟수는 GA4 `project_review_saved`로 본다(docs/ga4-product-events.md).
//
//   PAYMENTS_DATABASE_URL=... node scripts/account-usage-report.mjs
//   PAYMENTS_DATABASE_URL=... node scripts/account-usage-report.mjs --emails
//
// 이메일은 개인정보라 기본 출력에서 제외한다. `--emails`를 명시할 때만 나온다.
import pg from "pg";

const showEmails = process.argv.includes("--emails");
if (!process.env.PAYMENTS_DATABASE_URL) throw new Error("PAYMENTS_DATABASE_URL is required");

const client = new pg.Client({ connectionString: process.env.PAYMENTS_DATABASE_URL, connectionTimeoutMillis: 10000 });
await client.connect();
try {
  await client.query("BEGIN READ ONLY");
  const { rows } = await client.query(`
    SELECT
      count(*)::int AS accounts,
      count(*) FILTER (WHERE a.trial_started_at IS NOT NULL)::int AS trials_started,
      count(*) FILTER (WHERE gop_paid_until(a.id, 'live', NOW()) > NOW())::int AS paid_now,
      count(*) FILTER (WHERE a.service_reminders)::int AS reminder_consented,
      count(*) FILTER (WHERE a.created_at > NOW() - INTERVAL '30 days')::int AS new_30d
    FROM gop_accounts a`);
  const memo = await client.query(`
    SELECT
      count(DISTINCT account_id)::int AS accounts_with_memos,
      count(*)::int AS memos,
      count(*) FILTER (WHERE reminder_enabled)::int AS reminder_enabled,
      count(DISTINCT account_id) FILTER (WHERE updated_at > NOW() - INTERVAL '30 days')::int AS active_30d
    FROM gop_decision_memos`);

  console.log("# 계정 (gop_accounts)");
  console.table([rows[0]]);
  console.log("# 계정 결정 메모 (gop_decision_memos) — 별도 동의로 올린 사본만");
  console.table([memo.rows[0]]);

  if (showEmails) {
    const detail = await client.query(`
      SELECT a.email, a.locale, a.created_at, a.trial_started_at,
        gop_paid_until(a.id, 'live', NOW()) AS paid_until,
        count(m.id)::int AS memos, max(m.updated_at) AS last_memo_at
      FROM gop_accounts a LEFT JOIN gop_decision_memos m ON m.account_id = a.id
      GROUP BY a.id, a.email, a.locale, a.created_at, a.trial_started_at
      ORDER BY memos DESC, a.created_at DESC`);
    console.log("# 계정별 상세 (--emails)");
    console.table(detail.rows);
  }
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.end().catch(() => {});
}
