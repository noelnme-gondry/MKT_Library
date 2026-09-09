"use client";

import { requirePaidExport } from "@/lib/subscription/paidExport";
import { useState } from "react";
import { CAMPAIGN_STATUS, campaignComparisonCsv, formatReviewMetric } from "@/lib/weekly-review/workspaceEvidence";
import { downloadCsv } from "@/utils/download";

export default function WeeklyEvidencePanel({ evidence, review, locale = "ko", onChooseCampaign }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const en = locale === "en";
  const format = (value, metric = evidence.metric) => formatReviewMetric(value, metric, evidence.currency, locale);
  const campaigns = evidence.campaigns.filter(row => row.label.toLowerCase().includes(query.toLowerCase()) && (filter !== "zero" || row.withoutResults) && (filter !== "unknown" || ["unknown", "new", "absent"].includes(row.status)));
  return <section className="wr-card wr-evidence" aria-labelledby="wr-evidence-title">
    <div className="wr-section-heading"><div><h2 id="wr-evidence-title">{en ? "Where to focus this week" : "이번 주 확인할 지점"}</h2><p>{en ? "Start with spend without conversions, then review the largest active campaigns." : "전환 없는 지출을 먼저 확인하고, 현재 지출이 큰 캠페인을 검토하세요."}</p></div>
      <button type="button" className="btn" onClick={() => requirePaidExport() && downloadCsv(campaignComparisonCsv(evidence, review, locale), "weekly_campaign_comparison")}>{en ? "Download full comparison CSV" : "전체 캠페인 비교 CSV"}</button></div>
    <div className="wr-evidence-summary">
      <div className="wr-target-readout">
        <h3>{en ? "Observed gap to target" : "목표 대비 관측 차이"}</h3>
        {evidence.gap ? <><strong>{format(evidence.gap.actual)}</strong><p>{en ? "Target" : "목표"} {format(evidence.gap.target)} <span className="wr-screen__badge">{evidence.gap.met ? (en ? "Target met" : "목표 범위 충족") : (en ? "Outside target" : "목표 범위 이탈")}</span></p><p>{en ? "Observed − target" : "관측 − 목표"}: {format(evidence.gap.delta)}</p></> : <><strong>{format(review.metrics.current[evidence.metric])}</strong><p>{en ? "Set a valid project target to compare it with the observed KPI." : "프로젝트 목표를 설정하면 관측 KPI와의 차이를 함께 확인할 수 있습니다."}</p><a href="#wr-project">{en ? "Review project settings" : "프로젝트 기준 확인"}</a></>}
        <p className="wr-note">{en ? "This is an observed gap to your target, not an estimate of savings or causal impact." : "목표와의 관측 차이이며, 절감 가능액이나 인과효과의 추정이 아닙니다."}</p>
      </div>
      <dl className="wr-scope-ledger">
        <div><dt>{en ? "Campaigns observed" : "관측 캠페인"}</dt><dd>{evidence.previousCount} → {evidence.currentCount}</dd></div>
        <div><dt>{en ? "Spend with zero conversions" : "전환 0인 캠페인의 지출"}</dt><dd>{format(evidence.zeroResultSpend, "cost")}</dd></div>
        <div><dt>{en ? "Comparison source" : "지난 기간 데이터"}</dt><dd>{review.previousSource === "snapshot" ? (en ? "Saved aggregate" : "저장된 집계") : (en ? "Uploaded rows" : "업로드한 데이터")}</dd></div>
        <div><dt>{en ? "Comparable history" : "변동성 비교 이력"}</dt><dd>{review.historyWeeks} {en ? "periods" : "기간"}</dd></div>
      </dl>
    </div>
    <div className="wr-table-controls">
      <label className="wr-field"><span>{en ? "Find a campaign" : "캠페인 찾기"}</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label className="wr-field"><span>{en ? "Show" : "표시 범위"}</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">{en ? "All campaigns" : "전체 캠페인"}</option><option value="zero">{en ? "Spend, no conversions" : "전환 없는 지출"}</option><option value="unknown">{en ? "Check comparability" : "비교 조건 확인 필요"}</option></select></label>
      <span role="status">{campaigns.length} / {evidence.campaigns.length} {en ? "campaigns" : "캠페인"}</span>
    </div>
    <div className="table-wrap wr-tablewrap" role="region" aria-label={en ? "Campaign comparison, scroll horizontally" : "캠페인 비교표, 가로 스크롤"} tabIndex={0}>
      <table className="data wr-campaign-table"><caption><strong>{en ? "Campaign performance comparison" : "캠페인별 성과 비교"}</strong><span>{en ? "Sorted by spend without conversions, then current spend" : "전환 없는 지출을 먼저, 이후 이번 비용순으로 표시합니다"}</span></caption><thead><tr>
        <th scope="col">{en ? "Campaign / status" : "캠페인 / 관측 상태"}</th><th scope="col">{en ? "Previous spend" : "지난 비용"}</th><th scope="col">{en ? "Current spend" : "이번 비용"}</th><th scope="col">{en ? "Conversions" : "이번 전환"}</th><th scope="col">{evidence.metric.toUpperCase()} {en ? "previous → current" : "지난 → 이번"}</th><th scope="col">{en ? "Next decision" : "다음 결정"}</th>
      </tr></thead><tbody>{campaigns.map(row => <tr key={row.key}><th scope="row"><strong>{row.label}</strong><small>{CAMPAIGN_STATUS[locale][row.status]}</small></th><td className="num">{format(row.previous?.cost, "cost")}</td><td className="num">{format(row.current?.cost, "cost")}</td><td className="num">{format(row.current?.conversions, "conversions")}</td><td className="num">{format(row.previous?.[evidence.metric])} → {format(row.current?.[evidence.metric])}</td><td><button type="button" className="btn" disabled={!row.current} aria-label={`${en ? "Record decision for" : "결정 기록"}: ${row.label}`} onClick={() => onChooseCampaign(row.label)}>{en ? "Record decision" : "결정 기록"}</button></td></tr>)}</tbody></table>
    </div>
    {campaigns.length === 0 && <p role="status">{en ? "No campaigns match. Clear the search or change the filter." : "해당 캠페인이 없습니다. 검색어나 표시 범위를 바꿔주세요."}</p>}
    <p className="wr-note">{en ? "An unobserved period is shown as —, not zero. Zero-conversion spend is observed spend, not proof of waste; check attribution delay and conversion definitions. The export always includes all campaigns." : "관측되지 않은 기간은 0 대신 —로 표시합니다. 전환 없는 지출이 곧 낭비라는 뜻은 아닙니다. 귀속 지연과 전환 정의를 확인하세요. 다운로드에는 전체 캠페인이 포함됩니다."}</p>
  </section>;
}
