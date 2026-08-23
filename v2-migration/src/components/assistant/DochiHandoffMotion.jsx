import DochiSprite from "@/components/assistant/DochiSprite";

export const DOCHI_HANDOFF_KEY = "dochi_analysis_handoff";

export function DochiChartBundle({ className = "" }) {
  return <div className={`dochi-chart-bundle ${className}`.trim()} aria-hidden="true">
    <div className="dochi-chart-bundle__card is-line">
      <svg viewBox="0 0 92 58"><path className="grid" d="M8 12h76M8 29h76M8 46h76" /><path className="signal" d="m8 43 16-13 14 5 17-22 13 9 16-16" /><circle cx="55" cy="13" r="3" /></svg>
    </div>
    <div className="dochi-chart-bundle__card is-bars">
      <svg viewBox="0 0 92 58"><path className="grid" d="M8 48h76" /><path className="signal-fill" d="M13 31h12v17H13zM31 20h12v28H31zM49 27h12v21H49zM67 10h12v38H67z" /></svg>
    </div>
    <div className="dochi-chart-bundle__card is-kpi">
      <span /><strong /><i /><b />
    </div>
  </div>;
}

export function DochiArrivalTransition({ active, locale = "ko" }) {
  if (!active) return null;
  return <div className="dochi-arrival" aria-hidden="true">
    <div className="dochi-arrival__grid" />
    <div className="dochi-arrival__runner"><DochiSprite pose="delivery" direction="left" /></div>
    <DochiChartBundle className="dochi-arrival__bundle" />
    <div className="dochi-arrival__presenter"><DochiSprite pose="results" /></div>
    <p>{locale === "en" ? "Placing the analysis map" : "분석 지도를 작업대에 놓는 중"}</p>
  </div>;
}
