import Link from "next/link";
import { idToSlug } from "@/lib/routeMap";

const TOOL_COPY = {
  "5-2": {
    ko: { label: "운영 대시보드", title: "읽은 내용을 이번 주 데이터에서 확인하세요", desc: "CPA·ROAS·예산 속도와 이상 신호를 한 화면에서 확인합니다.", cta: "내 데이터로 운영 점검" },
    en: { label: "Operations dashboard", title: "Check this in this week’s data", desc: "Review CPA, ROAS, budget pacing, and anomaly signals in one place.", cta: "Review my operations" },
  },
  "5-3": {
    ko: { label: "예산 배분", title: "다음 예산 이동을 숫자로 비교하세요", desc: "현재 효율과 한계 CPA를 기준으로 증액·감액 후보를 시뮬레이션합니다.", cta: "예산 배분 계산하기" },
    en: { label: "Budget allocation", title: "Compare the next budget move with data", desc: "Simulate scale-up and pull-back candidates from current efficiency and marginal CPA.", cta: "Plan budget allocation" },
  },
  "5-21": {
    ko: { label: "성과 변동 분석", title: "CPA 변화가 어디서 시작됐는지 보세요", desc: "채널·캠페인·소재의 기여도를 나눠 먼저 볼 원인을 정리합니다.", cta: "성과 변동 분석하기" },
    en: { label: "Performance variance", title: "See where the CPA change started", desc: "Break down channel, campaign, and creative contributions to focus the investigation.", cta: "Analyze performance change" },
  },
  "9-6": {
    ko: { label: "소재 피로도", title: "교체할 소재와 다음 제작을 정리하세요", desc: "성과 하락과 노출 피로 신호를 함께 보고 교체 우선순위를 만듭니다.", cta: "소재 피로도 분석하기" },
    en: { label: "Creative fatigue", title: "Plan what to replace and produce next", desc: "Use performance decline and fatigue signals together to set replacement priority.", cta: "Analyze creative fatigue" },
  },
};

function suggestedTool(term) {
  const slug = term?.slug || "";
  if (["marginal-cpa", "response-curve", "adstock", "roas"].includes(slug)) return "5-3";
  if (["cannibalization", "incrementality", "uplift"].includes(slug)) return "5-21";
  if (["ctr", "cvr", "cpc", "cpm"].includes(slug)) return "9-6";
  return "5-2";
}

export default function ContentActionPanel({ locale = "ko", toolId, term }) {
  const resolvedTool = TOOL_COPY[toolId] ? toolId : suggestedTool(term);
  const copy = TOOL_COPY[resolvedTool][locale === "en" ? "en" : "ko"];
  const href = `${locale === "en" ? "/en" : ""}${idToSlug[resolvedTool]}`;
  return <aside className="content-action-panel">
    <div>
      <span className="content-action-panel__eyebrow">{copy.label}</span>
      <h2>{copy.title}</h2>
      <p>{copy.desc}</p>
    </div>
    <Link href={href} className="content-action-panel__cta">{copy.cta} <span aria-hidden>→</span></Link>
  </aside>;
}
