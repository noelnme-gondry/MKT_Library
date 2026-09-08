"use client";

import React, { useMemo, useState } from "react";
import CsvUploader from "@/components/CsvUploader";
import ToolPageShell from "@/components/ToolPageShell";
import DataTable from "@/components/ds/DataTable";
import ResultActionCard from "@/components/ds/ResultActionCard";
import DownloadHub from "@/components/ds/DownloadHub";
import { useAppStore } from "@/store/useDataStore";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { buildAsaKeywordRecommendations } from "@/utils/asaKeywordMath";
import { qualifyAsaRecommendations } from "@/utils/asaRecommendationQuality";
import { csvBody, downloadCsv } from "@/utils/download";

const money = (value, locale) => Number.isFinite(value) ? new Intl.NumberFormat(locale === "en" ? "en-US" : "ko-KR", { maximumFractionDigits: 0 }).format(value) : "—";
const pct = (value) => Number.isFinite(value) ? `${Math.round(value * 100)}%` : "—";

function actionCopy(code, locale) {
  if (code === "quality_held") return locale === "en" ? "Hold: check evidence" : "보류: 근거 확인";
  const ko = { raise: "CPT 증액", lower: "CPT 감액", hold_good: "유지 · 예산 검토", hold_underperforming: "증액 보류", hold: "유지", target_needed: "목표 입력 필요", budget_needed: "예산 입력 필요" };
  const en = { raise: "Raise CPT", lower: "Lower CPT", hold_good: "Hold · review budget", hold_underperforming: "Do not raise", hold: "Hold", target_needed: "Set target", budget_needed: "Set budget" };
  return (locale === "en" ? en : ko)[code] || code;
}

export default function AsaKeywordFinder({ locale = "ko" } = {}) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const csvData = useAppStore((state) => state.csvData);
  const analyzed = useAppStore((state) => state.isGroupAnalyzed("5-26"));
  const [settings, setSettings] = useState({ budget: "", cpa: "", cpt: "" });
  const [maturityDeclaration, setMaturityDeclaration] = useState(null);
  const maturity = maturityDeclaration?.raw === csvData.raw ? maturityDeclaration.value : "unknown";
  const rows = useMemo(() => getMappedRows(csvData), [csvData]);
  const recommendations = useMemo(() => analyzed ? qualifyAsaRecommendations(buildAsaKeywordRecommendations(rows, {
    globalDailyBudget: settings.budget,
    globalTargetCpa: settings.cpa,
    globalTargetCpt: settings.cpt,
  }), maturity) : [], [analyzed, rows, settings, maturity]);
  const qualityCopy = (status) => ({
    maturity_unknown: tr("전환 성숙도 미확인", "Conversion maturity unknown"), immature: tr("미성숙 전환 포함", "Includes immature conversions"),
    low_taps: tr("탭 8건 미만", "Fewer than 8 taps"), low_installs: tr("설치 3건 미만", "Fewer than 3 installs"), reviewable: tr("운영 검토 후보", "Ready for operating review"),
  })[status];
  const exact = recommendations.filter((row) => row.isExactCandidate);
  const negatives = recommendations.filter((row) => row.isNegativeCandidate);
  const raises = recommendations.filter((row) => row.action.code === "raise");
  const lowers = recommendations.filter((row) => row.action.code === "lower");
  const hasData = Boolean(csvData?.raw?.length);
  const isDemo = String(csvData?.fileName || "").startsWith("demo_");
  const set = (key) => (event) => setSettings((current) => ({ ...current, [key]: event.target.value }));

  const downloadActions = () => {
    const header = ["search_term", "country", "campaign", "adgroup", "match_type", "action", "recommended_cpt", "actual_cpt", "actual_cpa", "campaign_pace", "exact_candidate", "negative_candidate", "quality_status"];
    // 값 이스케이프·CRLF·BOM은 csvBody가 소유한다(§7). 도구마다 다시 조립하지 않는다.
    const rows = recommendations.map((row) => [row.term, row.country, row.campaign, row.adgroup, row.matchType, actionCopy(row.action.code, "en"), row.recommendedCpt ?? "", row.cpt ?? "", row.cpa ?? "", row.pace ?? "", row.isExactCandidate ? "yes" : "", row.isNegativeCandidate ? "yes" : "", row.qualityStatus]);
    downloadCsv(csvBody(header, rows), "asa_keyword_actions");
  };

  const columns = [
    { key: "qualityStatus", label: tr("판단 근거", "Evidence status"), fmt: qualityCopy },
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
      {hasData && <section className="block analysis-design-check">
        <label>{tr("업로드 기간의 전환 성숙도", "Conversion maturity of the uploaded period")}
          <select value={maturity} onChange={(e) => setMaturityDeclaration({ raw: csvData.raw, value: e.target.value })}>
            <option value="unknown">{tr("미확인", "Unknown")}</option>
            <option value="immature">{tr("아직 전환이 추가될 기간 포함", "Includes periods still accumulating conversions")}</option>
            <option value="mature">{tr("계정 전환 지연을 확인해 성숙 기간만 포함", "Confirmed conversion lag; only mature periods included")}</option>
          </select>
        </label>
        <p>{tr("일별 합계만으로 전환 지연을 복원할 수 없습니다. 계정의 전환 창·보고 기준을 확인하세요. 성숙도 미확인 또는 탭 8건·설치 3건 미만은 조치를 보류합니다. 이 표본 기준은 서비스 운영 휴리스틱이며 통계적 유의성을 뜻하지 않습니다.", "Daily totals cannot reconstruct conversion delay. Check your account's conversion window and reporting basis. Unknown maturity, fewer than 8 taps, or fewer than 3 installs holds actions. These service heuristics do not establish statistical significance.")}</p>
      </section>}

      {hasData && analyzed && (
        <>
          <div id="asa-summary"><ResultActionCard
            resultState={recommendations.some((row) => row.qualityStatus === "reviewable") ? "ready" : "insufficient"}
            tone={exact.length || raises.length ? "good" : lowers.length || negatives.length ? "bad" : "neutral"}
            title={tr("조치 요약", "Action summary")}
            headline={!recommendations.some((row) => row.qualityStatus === "reviewable") ? tr("근거 미확인: 키워드 조치를 보류합니다", "Evidence unconfirmed: keyword actions are held") : tr(`Exact 승격 ${exact.length}건 · CPT 증액 ${raises.length}건 · 감액 ${lowers.length}건 후보입니다.`, `${exact.length} Exact, ${raises.length} raise-CPT, and ${lowers.length} lower-CPT candidates are ready.`)}
            points={[{ text: tr(`근거 부족으로 조치 보류 ${recommendations.filter((row) => row.qualityStatus !== "reviewable").length}건`, `${recommendations.filter((row) => row.qualityStatus !== "reviewable").length} actions held for insufficient evidence`) }, { text: tr("권장안은 자동 적용이 아니라 Apple Ads 콘솔에서 하나씩 검토할 운영 후보입니다.", "These are review candidates, not automatic Apple Ads changes.") }]}
            stats={[
              { label: tr("Exact 승격", "Exact candidates"), value: String(exact.length), detail: tr("Broad·Search Match 후보", "Broad/Search Match candidates") },
              { label: tr("CPT 증액", "Raise CPT"), value: String(raises.length), detail: tr("저소진 + 목표 달성", "Under-paced + meets target") },
              { label: tr("CPT 감액", "Lower CPT"), value: String(lowers.length), detail: tr("과소진 + 목표 미달", "Over-paced + misses target") },
              { label: tr("제외 검토", "Review negatives"), value: String(negatives.length), detail: tr("고비용 저성과", "High-cost underperformance") },
            ]}
            workbookExport={() => ({
              calculationMode: "exact_after_preprocessing",
              calculationTables: [{
                name: "ASA_ACTIONS",
                title: tr("검색어별 CPT 계산", "CPT calculation by search term"),
                note: tr("검색어·캠페인 집계 입력 이후 pace·CPT·CPA·조정률·권장 CPT 수식", "Pacing, CPT, CPA, adjustment, and recommended-CPT formulas after search-term and campaign aggregation"),
                rows: [
                  ["search_term", "country", "campaign", "match_type", "cost_input", "taps_input", "installs_input", "expected_spend_input", "target_cpa_input", "target_cpt_input", "current_cpt_input", "pace", "actual_cpt", "actual_cpa", "meets_target", "action_pct", "recommended_cpt", "action_code", "exact_candidate", "negative_candidate", "quality_status"],
                  ...recommendations.map((row, index) => {
                    const excelRow = index + 2;
                    return [
                      row.term, row.country, row.campaign, row.matchType,
                      row.cost, row.taps, row.installs, row.expectedSpend, row.targetCpa, row.targetCpt, row.currentCpt,
                      { formula: `=IFERROR(E${excelRow}/H${excelRow},\"\")`, numberFormat: "0.0%" },
                      { formula: `=IFERROR(E${excelRow}/F${excelRow},\"\")` },
                      { formula: `=IFERROR(E${excelRow}/G${excelRow},\"\")` },
                      { formula: `=IF(I${excelRow}>0,--(AND(N${excelRow}>0,N${excelRow}<=I${excelRow})),IF(J${excelRow}>0,--(AND(M${excelRow}>0,M${excelRow}<=J${excelRow})),0))` },
                      { formula: `=IF(OR(U${excelRow}<>"reviewable",H${excelRow}<=0,AND(I${excelRow}<=0,J${excelRow}<=0)),0,IF(AND(L${excelRow}<0.7,O${excelRow}=1),IF(L${excelRow}<0.4,0.15,0.1),IF(AND(L${excelRow}>1.1,O${excelRow}=0),IF(L${excelRow}>1.4,-0.15,-0.1),0)))`, numberFormat: "0.0%" },
                      { formula: `=IF(U${excelRow}<>"reviewable","",IF(P${excelRow}=0,0,IF(K${excelRow}>0,K${excelRow},IF(J${excelRow}>0,J${excelRow},M${excelRow}))*(1+P${excelRow})))` },
                      row.action.code, row.isExactCandidate ? 1 : 0, row.isNegativeCandidate ? 1 : 0, row.qualityStatus,
                    ];
                  }),
                ],
              }],
              method: {
                name: "ASA pacing and CPT operating rules",
                version: "asa-keyword-rules-v1",
                assumptions: [tr("검색어 집계와 캠페인 예산 범위는 브라우저 분석 시점의 전처리 입력입니다.", "Search-term aggregation and campaign budget scope are preprocessing inputs from the browser analysis.")],
                limitations: [tr("Exact·제외 후보 플래그는 엔진 판정값이며 실제 Apple Ads 변경을 자동 실행하지 않습니다.", "Exact and negative-candidate flags are engine decisions and do not automatically change Apple Ads.")],
              },
            })}
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
            download={recommendations.length ? (
              <DownloadHub
                toolId="5-26"
                locale={locale}
                label={tr("결과 받기", "Get results")}
                items={[{
                  label: tr("권장 조치 (CSV)", "Recommended actions (CSV)"),
                  desc: tr("검색어별 Exact 승격·CPT 조정·제외 후보", "Exact promotion, CPT changes, and negative candidates by search term"),
                  icon: "⬇",
                  analyticsType: "asa_actions",
                  onSelect: downloadActions,
                }]}
              />
            ) : null}
          /></div>
          <section className="block" id="asa-actions">
            <div className="asa-tool__section-head"><div><h2 className="section-title">{tr("키워드별 권장 조치", "Recommended keyword actions")}</h2><p>{tr("Exact 승격은 기존 비-Exact 키워드를 멈추라는 뜻이 아닙니다. 중복 경합을 피하려면 승격 뒤 원래 타겟·네거티브 구조를 함께 확인하세요.", "Exact promotion does not mean pausing the original non-Exact target. After promotion, review the original target and negative structure to avoid overlap.")}</p></div></div>
            <DataTable columns={columns} rows={recommendations} rowKey={(row) => `${row.term}-${row.campaign}-${row.adgroup}-${row.matchType}`} emptyText={tr("판정할 검색어 행이 없습니다. 검색어·비용·탭·설치 매핑을 확인하세요.", "No searchable term rows. Check the search term, cost, taps, and installs mapping.")} />
          </section>
        </>
      )}
    </ToolPageShell>
  );
}
