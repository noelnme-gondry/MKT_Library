"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useDataStore";
import { idToSlug } from "@/lib/routeMap";
import { prepareDatasetForTool } from "@/lib/data-import/prepareDatasetForTool";
import { evaluateEligibility } from "@/lib/analysis-router/evaluateEligibility";
import { buildPvmQuickSummary } from "@/lib/analysis-results/pvmQuickSummary";

const CARD_STYLE = { border: "1px solid var(--border)", borderRadius: "10px", padding: "12px", background: "var(--surface-container-lowest)" };

export default function AnalysisPathway({ csvData, locale = "ko" }) {
  const router = useRouter();
  const handoffCsvToRoute = useAppStore((state) => state.handoffCsvToRoute);
  const plans = useMemo(() => {
    if (!csvData?.raw?.length) return [];
    const creativeData = prepareDatasetForTool({ raw: csvData.raw, headers: csvData.headers, toolId: "9-6", source: csvData.fileName || "dataset" });
    const creative = evaluateEligibility({ mapping: creativeData.mapping, canonicalData: creativeData.canonicalData, toolId: "9-6" });
    const pvm = buildPvmQuickSummary({ csvData });
    return [
      { id: "5-21", title: locale === "en" ? "Why did performance change?" : "왜 성과가 변했나", body: pvm.available ? (locale === "en" ? "The overview already calculated the largest contributor. Open the no-residual breakdown by channel, campaign, and creative." : "요약에서 가장 큰 기여를 계산했습니다. 채널·캠페인·소재별 무잔차 분해를 자세히 볼 수 있습니다.") : (locale === "en" ? "At least two comparable 7-day periods with date, channel, cost, and outcomes are needed." : "날짜·채널·비용·성과가 있는 비교 가능한 7일 구간 두 개가 필요합니다."), ready: pvm.available, action: locale === "en" ? "Open variance breakdown" : "성과 변동 자세히 보기" },
      { id: "9-6", title: locale === "en" ? "Which creatives need replacing?" : "어떤 소재를 교체해야 하나", body: creative.status === "ready" ? (locale === "en" ? "This same file includes the fields needed to diagnose fatigue and build a swap schedule." : "같은 파일에서 피로도·교체 우선순위·다음 테스트 후보까지 바로 계산할 수 있습니다.") : (locale === "en" ? "Add creative ID, date, channel, impressions, clicks, installs, and spend to unlock this." : "소재 ID·날짜·채널·노출·클릭·설치·비용을 매핑하면 피로도와 교체 순서를 계산합니다."), ready: creative.status === "ready", action: locale === "en" ? "Open creative analysis" : "소재 분석 열기", data: creativeData },
      { id: "5-22", title: locale === "en" ? "Where can budget still scale?" : "어디에 예산을 더 쓸 수 있나", body: locale === "en" ? "Check marginal efficiency before increasing spend." : "증액 전 한계 효율이 살아 있는 채널인지 확인합니다.", ready: true, action: locale === "en" ? "Check saturation" : "포화도 확인" },
      { id: "5-3", title: locale === "en" ? "How should the budget move?" : "예산을 어디로 옮길까", body: locale === "en" ? "Model a safer budget shift after reviewing the change driver." : "변동 원인을 확인한 뒤 더 안전한 예산 재배분을 시뮬레이션합니다.", ready: true, action: locale === "en" ? "Simulate allocation" : "예산 배분 보기" },
    ];
  }, [csvData, locale]);

  if (!plans.length) return null;
  const open = (plan) => {
    if (!plan.ready) return;
    if (plan.data) handoffCsvToRoute(plan.id, plan.data);
    router.push(idToSlug[plan.id]);
  };
  return <section className="block" aria-label={locale === "en" ? "Next analyses" : "다음 분석"}>
    <h2 className="section-title" style={{ marginBottom: "5px" }}>{locale === "en" ? "Next answers from this analysis" : "이 결과에서 바로 이어서 볼 답"}</h2>
    <p className="muted" style={{ marginTop: 0, fontSize: "12px" }}>{locale === "en" ? "Open a detail view without uploading the same file again. Data stays in this browser." : "같은 파일을 다시 올리지 않고 상세 분석으로 이어집니다. 데이터는 이 브라우저 안에만 남습니다."}</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
      {plans.map((plan) => <div key={plan.id} style={{ ...CARD_STYLE, opacity: plan.ready ? 1 : 0.68 }}>
        <strong style={{ display: "block", fontSize: "13px" }}>{plan.ready ? "✓ " : "○ "}{plan.title}</strong>
        <p style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: 1.55, minHeight: "54px" }}>{plan.body}</p>
        <button className="ab-pill" disabled={!plan.ready} onClick={() => open(plan)}>{plan.ready ? plan.action : (locale === "en" ? "Data needed" : "데이터 보완 필요")}</button>
      </div>)}
    </div>
  </section>;
}
