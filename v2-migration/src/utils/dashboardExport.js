// 운영 대시보드(5-2/9-7) 결과 데이터 export — 차트를 재현할 수 있는 원천 데이터
// (일별·채널별·캠페인별 집계 + 파생지표)를 CSV로 내보낸다. 요약 4행만 주던
// 부실 export를 보강. 렌더층 헬퍼(골든 아님) — dashboardAggregator 순수함수 재사용.
import { getMonFilteredRows, aggregateByKey } from "@/utils/dashboardAggregator";

const SUM_FIELDS = ["cost", "impressions", "clicks", "installs", "actions", "revenue_d7", "pu_d7"];

// 집계 행 → 파생지표. scorecard/viz와 동일 공식(렌더층).
function derive(a) {
  return {
    cpi: a.installs > 0 ? a.cost / a.installs : null,
    cpa: a.actions > 0 ? a.cost / a.actions : null,
    ctr: a.impressions > 0 ? a.clicks / a.impressions : null,
    cvr: a.clicks > 0 ? a.installs / a.clicks : null,
    roas: a.cost > 0 && a.revenue_d7 > 0 ? a.revenue_d7 / a.cost : null,
  };
}

const q = (s) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
const num = (v) => (v == null ? "" : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(4)) : String(v));

// 집계 배열 → BOM+CRLF CSV. keyLabel=첫 컬럼명(날짜/채널/캠페인).
function toCsv(rows, keyLabel) {
  const derivedCols = ["cpi", "cpa", "ctr", "cvr", "roas"];
  const head = [keyLabel, ...SUM_FIELDS, ...derivedCols];
  const lines = [head.map(q).join(",")];
  for (const r of rows) {
    const d = derive(r);
    lines.push(
      [q(r._key), ...SUM_FIELDS.map((f) => num(r[f] || 0)), ...derivedCols.map((c) => num(d[c]))].join(",")
    );
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

// 현재 필터 기준 일별/채널별/캠페인별 집계 CSV를 각각 반환(해당 차원 미매핑이면 null).
export function buildDashboardExports({ csvData, filterState = {}, locale = "ko" } = {}) {
  const L = (ko, en) => (locale === "en" ? en : ko);
  if (!csvData || !csvData.raw || csvData.raw.length === 0) {
    return { daily: null, byChannel: null, byCampaign: null };
  }
  const rows = getMonFilteredRows(csvData, filterState);
  const mapped = new Set(Object.values(csvData.mapping || {}));

  const daily = aggregateByKey(rows, "date", SUM_FIELDS)
    .sort((a, b) => (a._key > b._key ? 1 : -1));

  const byChannel = mapped.has("channel")
    ? aggregateByKey(rows.filter((r) => r.channel), "channel", SUM_FIELDS)
        .sort((a, b) => b.cost - a.cost)
    : null;

  const byCampaign = mapped.has("campaign")
    ? aggregateByKey(rows.filter((r) => r.campaign), "campaign", SUM_FIELDS)
        .sort((a, b) => b.cost - a.cost)
    : null;

  return {
    daily: daily.length ? toCsv(daily, L("날짜", "date")) : null,
    byChannel: byChannel && byChannel.length ? toCsv(byChannel, L("채널", "channel")) : null,
    byCampaign: byCampaign && byCampaign.length ? toCsv(byCampaign, L("캠페인", "campaign")) : null,
  };
}
