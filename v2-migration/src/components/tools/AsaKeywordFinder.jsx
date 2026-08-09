"use client";

import React, { useMemo, useState } from "react";
import CsvUploader from "@/components/CsvUploader";
import ToolPageShell from "@/components/ToolPageShell";
import DataTable from "@/components/ds/DataTable";
import ResultActionCard from "@/components/ds/ResultActionCard";
import { useAppStore } from "@/store/useDataStore";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { buildAsaKeywordRecommendations } from "@/utils/asaKeywordMath";
import { downloadCsv } from "@/utils/download";

const money = (value, locale) => Number.isFinite(value) ? new Intl.NumberFormat(locale === "en" ? "en-US" : "ko-KR", { maximumFractionDigits: 0 }).format(value) : "—";
const pct = (value) => Number.isFinite(value) ? `${Math.round(value * 100)}%` : "—";

function actionCopy(code, locale) {
  const ko = { raise: "CPT 증액", lower: "CPT 감액", hold_good: "유지 · 예산 검토", hold_underperforming: "증액 보류", hold: "유지", target_needed: "목표 입력 필요", budget_needed: "예산 입력 필요" };
  const en = { raise: "Raise CPT", lower: "Lower CPT", hold_good: "Hold · review budget", hold_underperforming: "Do not raise", hold: "Hold", target_needed: "Set target", budget_needed: "Set budget" };
  return (locale === "en" ? en : ko)[code] || code;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export default function AsaKeywordFinder({ locale = "ko" } = {}) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const csvData = useAppStore((state) => state.csvData);
  const analyzed = useAppStore((state) => state.isGroupAnalyzed("5-26"));
  const [settings, setSettings] = useState({ budget: "", cpa: "", cpt: "" });
  const rows = useMemo(() => getMappedRows(csvData), [csvData]);
  const recommendations = useMemo(() => analyzed ? buildAsaKeywordRecommendations(rows, {
    globalDailyBudget: settings.budget,
    globalTargetCpa: settings.cpa,
    globalTargetCpt: settings.cpt,
  }) : [], [analyzed, rows, settings]);
  const exact = recommendations.filter((row) => row.isExactCandidate);
  const negatives = recommendations.filter((row) => row.isNegativeCandidate);
  const raises = recommendations.filter((row) => row.action.code === "raise");
  const lowers = recommendations.filter((row) => row.action.code === "lower");
  const hasData = Boolean(csvData?.raw?.length);
  const isDemo = String(csvData?.fileName || "").startsWith("demo_");
  const set = (key) => (event) => setSettings((current) => ({ ...current, [key]: event.target.value }));

  const downloadActions = () => {
    const header = ["search_term", "country", "campaign", "adgroup", "match_type", "action", "recommended_cpt", "actual_cpt", "actual_cpa", "campaign_pace", "exact_candidate", "negative_candidate"];
    const lines = recommendations.map((row) => [row.term, row.country, row.campaign, row.adgroup, row.matchType, actionCopy(row.action.code, "en"), row.recommendedCpt ?? "", row.cpt ?? "", row.cpa ?? "", row.pace ?? "", row.isExactCandidate ? "yes" : "", row.isNegativeCandidate ? "yes" : ""].map(csvCell).join(","));
    downloadCsv(`\uFEFF${header.join(",")}\r\n${lines.join("\r\n")}\r\n`, "asa_keyword_actions");
  };

  const columns = [
    { key: "term", label: tr("검색어", "Search term"), fmt: (value, row) => <><strong>{value}</strong><small className="asa-tool__sub">{[row.country, row.campaign, row.adgroup].filter(Boolean).join(" · ") || "—"}</small></> },
    { key: "matchType", label: tr("매치", "Match") },
    { key: "cost", label: tr("소진", "Spend"), align: "right", fmt: (value) => money(value, locale) },
    { key: "pace", label: tr("캠페인 예산 대비", "Campaign pacing"), align: "right", fmt: (value) => pct(value) },
    { key: "cpa", label: "CPA", align: "right", fmt: (value) => money(value, locale) },
    { key: "action", label: tr("CPT 조치", "CPT action"), fmt: (value, row) => <><strong className={`asa-tool__action asa-tool__action--${value.code}`}>{actionCopy(value.code, locale)}</strong>{row.recommendedCpt != null && <small className="asa-tool__sub">{tr("권장", "Target")} {money(row.recommendedCpt, locale)} ({value.pct > 0 ? "+" : ""}{Math.round(value.pct * 100)}%)</small>}</> },
  ];

  return (
    <ToolPageShell
      toolId="5-26"
      locale={locale}
      titleLevel={0}
      title={tr("ASA 키워드 발굴 · CPT 조정", "ASA Keyword Finder · CPT Actions")}
      summary={<p>{tr("Search Match·Broad 검색어를 Exact로 승격할 후보와, 예산 대비 소진률·목표 CPA를 함께 반영한 CPT 증감 제안을 만듭니다. 실제 변경 전에는 최근 검색어와 앱스토어 콘솔의 정책·입찰 한도를 확인하세요.", "Find Exact-promotion candidates from Search Match and Broad terms, then combine pacing and target CPA for CPT changes. Check recent terms, policy, and bid limits in the Apple Ads console before changing anything.")}</p>}
      toc={hasData && analyzed ? [{ id: "asa-summary", title: tr("조치 요약", "Action summary") }, { id: "asa-actions", title: tr("키워드별 조치", "Keyword actions") }] : []}
    >
      <section className="block asa-tool__setup" id="asa-setup">
        <h2 className="section-title">{tr("판정 기준", "Decision thresholds")}</h2>
        <p>{tr("CSV에 캠페인 일일 예산·목표 CPA·현재 CPT가 있으면 그대로 씁니다. 없다면 아래 공통값을 넣으세요. 예산 소진률은 캠페인 단위로 계산하고, 검색어 성과와 함께 CPT 조치에 반영합니다. 입력값은 이 화면에서만 사용됩니다.", "When campaign daily budget, target CPA, and current CPT are in the CSV, they are used directly. Otherwise enter shared values below. Pacing is calculated per campaign, then paired with each search term's performance for CPT actions. These inputs are used only in this screen.")}</p>
        <div className="asa-tool__inputs">
          <label>{tr("캠페인 일일 예산", "Campaign daily budget")}<input inputMode="decimal" value={settings.budget} onChange={set("budget")} placeholder={tr("선택", "Optional")} /></label>
          <label>{tr("목표 CPA", "Target CPA")}<input inputMode="decimal" value={settings.cpa} onChange={set("cpa")} placeholder={tr("권장", "Recommended")} /></label>
          <label>{tr("목표 CPT", "Target CPT")}<input inputMode="decimal" value={settings.cpt} onChange={set("cpt")} placeholder={tr("선택", "Optional")} /></label>
        </div>
        <p className="asa-tool__note">{tr("소진이 예산의 70% 미만이면서 목표를 달성하면 CPT를 +10%(40% 미만이면 +15%) 제안합니다. 110%를 넘겨 소진하면서 목표를 못 맞추면 −10%(140% 초과면 −15%)를 제안합니다. 목표가 없으면 임의로 입찰을 추천하지 않습니다.", "Below 70% pacing and meeting target: suggest +10% CPT (+15% below 40%). Above 110% pacing while missing target: suggest −10% (−15% above 140%). Without a target, the tool will not invent a bid recommendation.")}</p>
      </section>

      <CsvUploader toolId="5-26" locale={locale} />

      {hasData && analyzed && (
        <>
          <div id="asa-summary"><ResultActionCard
            tone={exact.length || raises.length ? "good" : lowers.length || negatives.length ? "bad" : "neutral"}
            title={tr("조치 요약", "Action summary")}
            headline={tr(`Exact 승격 ${exact.length}건 · CPT 증액 ${raises.length}건 · 감액 ${lowers.length}건 후보입니다.`, `${exact.length} Exact, ${raises.length} raise-CPT, and ${lowers.length} lower-CPT candidates are ready.`)}
            points={[{ text: tr("권장안은 자동 적용이 아니라 Apple Ads 콘솔에서 하나씩 검토할 운영 후보입니다.", "These are review candidates, not automatic Apple Ads changes.") }]}
            stats={[
              { label: tr("Exact 승격", "Exact candidates"), value: String(exact.length), detail: tr("Broad·Search Match 후보", "Broad/Search Match candidates") },
              { label: tr("CPT 증액", "Raise CPT"), value: String(raises.length), detail: tr("저소진 + 목표 달성", "Under-paced + meets target") },
              { label: tr("CPT 감액", "Lower CPT"), value: String(lowers.length), detail: tr("과소진 + 목표 미달", "Over-paced + misses target") },
              { label: tr("제외 검토", "Review negatives"), value: String(negatives.length), detail: tr("고비용 저성과", "High-cost underperformance") },
            ]}
            toolId="5-26"
            analysisType="asa_keyword"
            analysisKey={`${exact.length}:${raises.length}:${lowers.length}:${negatives.length}`}
            locale={locale}
            decisionPrefill={!isDemo ? {
              conclusion: tr(`Exact 승격 ${exact.length}건 · CPT 증액 ${raises.length}건 · 감액 ${lowers.length}건 후보입니다.`, `${exact.length} Exact, ${raises.length} raise-CPT, and ${lowers.length} lower-CPT candidates are ready.`),
              action: exact.length
                ? tr("Exact 승격 후보와 CPT 조치를 Apple Ads 콘솔에서 하나씩 검토한 뒤 제한적으로 적용한다", "Review Exact-promotion candidates and CPT actions one by one in Apple Ads, then apply a limited change")
                : tr("목표 CPA와 예산을 다시 확인한 뒤 다음 검색어 기간을 재분석한다", "Confirm target CPA and budget, then reanalyze the next search-term period"),
              metric: tr("ASA 권장 조치 건수", "ASA recommended actions"),
              baseline: String(exact.length + raises.length + lowers.length),
              targetDirection: "neutral",
              reviewQuestion: tr("변경한 검색어·CPT 조치가 목표 CPA를 지키면서 소진을 개선했는가?", "Did the changed search terms and CPT actions improve pacing while maintaining target CPA?"),
            } : null}
          /></div>
          <section className="block" id="asa-actions">
            <div className="asa-tool__section-head"><div><h2 className="section-title">{tr("키워드별 권장 조치", "Recommended keyword actions")}</h2><p>{tr("Exact 승격은 기존 비-Exact 키워드를 멈추라는 뜻이 아닙니다. 중복 경합을 피하려면 승격 뒤 원래 타겟·네거티브 구조를 함께 확인하세요.", "Exact promotion does not mean pausing the original non-Exact target. After promotion, review the original target and negative structure to avoid overlap.")}</p></div><button type="button" className="asa-tool__download" onClick={downloadActions}>{tr("CSV로 받기", "Download CSV")}</button></div>
            <DataTable columns={columns} rows={recommendations} rowKey={(row) => `${row.term}-${row.campaign}-${row.adgroup}-${row.matchType}`} emptyText={tr("판정할 검색어 행이 없습니다. 검색어·비용·탭·설치 매핑을 확인하세요.", "No searchable term rows. Check the search term, cost, taps, and installs mapping.")} />
          </section>
        </>
      )}
    </ToolPageShell>
  );
}
