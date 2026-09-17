// 유입 경로 서베이(주관식) 답변을 읽기 전용으로 내려받는다. 쓰기 쿼리는 없다.
//
//   PAYMENTS_DATABASE_URL=... node scripts/source-survey-report.mjs
//   PAYMENTS_DATABASE_URL=... node scripts/source-survey-report.mjs --days 14
//   PAYMENTS_DATABASE_URL=... node scripts/source-survey-report.mjs --csv > 유입경로.csv
//
// 답변은 사람이 쓴 자유 문장이라 자동 분류하지 않는다. 기계가 묶으면 "네이버 검색"과
// "네이버 블로그 보고"가 같은 칸에 들어가는데 둘은 완전히 다른 유입이다 — 눈으로
// 읽는 것이 여기서는 정확도가 더 높다. 진입면 집계만 참고로 함께 낸다.
import pg from "pg";

const argv = process.argv.slice(2);
const asCsv = argv.includes("--csv");
const daysIndex = argv.indexOf("--days");
const days = daysIndex === -1 ? 90 : Number(argv[daysIndex + 1]);
if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error("--days must be an integer between 1 and 3650");
if (!process.env.PAYMENTS_DATABASE_URL) throw new Error("PAYMENTS_DATABASE_URL is required");

// CSV 조립 규칙은 앱과 같다 — BOM + CRLF + 값 안의 콤마·따옴표 이스케이프.
// 이게 없으면 엑셀에서 한글이 깨지고 답변 안의 콤마가 열을 밀어낸다.
const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const client = new pg.Client({ connectionString: process.env.PAYMENTS_DATABASE_URL, connectionTimeoutMillis: 10000 });
await client.connect();
try {
  await client.query("BEGIN READ ONLY");
  const { rows } = await client.query(
    `SELECT created_at, locale, entry_surface, answer
       FROM gop_source_survey
      WHERE created_at > NOW() - ($1 || ' days')::interval
      ORDER BY created_at DESC`,
    [String(days)],
  );

  if (asCsv) {
    const header = ["submitted_at", "locale", "entry_surface", "answer"];
    process.stdout.write("﻿" + [header, ...rows.map((row) => [row.created_at.toISOString(), row.locale, row.entry_surface, row.answer])]
      .map((line) => line.map(cell).join(",")).join("\r\n") + "\r\n");
  } else {
    console.log(`최근 ${days}일 답변 ${rows.length}건`);
    if (!rows.length) {
      // 0건을 "유입이 없다"로 읽지 않도록 무엇이 0인지 분명히 한다.
      console.log("답변이 아직 없습니다. 표가 비었을 뿐 유입이 없다는 뜻은 아닙니다.");
    } else {
      const bySurface = new Map();
      for (const row of rows) bySurface.set(row.entry_surface, (bySurface.get(row.entry_surface) || 0) + 1);
      console.log("진입면:", [...bySurface].sort((a, b) => b[1] - a[1]).map(([key, count]) => `${key} ${count}`).join(" · "));
      console.log("");
      for (const row of rows) {
        console.log(`${row.created_at.toISOString().slice(0, 10)} [${row.locale}/${row.entry_surface}] ${row.answer}`);
      }
    }
  }
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.end();
}
