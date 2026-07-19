"use client";
const COPY = {
  ko: { ready: "가능", caution: "주의", blocked: "추가 데이터 필요", open: "분석 시작 →" },
  en: { ready: "Ready", caution: "Caution", blocked: "Needs data", open: "Open analysis →" },
};

export default function AnalysisEligibilityList({ results = [], getTitle, onOpen, locale = "ko" }) {
  const T = COPY[locale] || COPY.ko;
  return (
    <section className="block" style={{ marginTop: "1.2rem" }}>
      <h2 className="section-title">{locale === "en" ? "What you can analyze" : "이 데이터로 가능한 분석"}</h2>
      <div className="phase-grid">
        {results.map((result) => (
          <div key={result.toolId} className="phase-card" style={{ opacity: result.status === "blocked" ? 0.72 : 1 }}>
            <div className="phase-card-title">{getTitle(result.toolId)}</div>
            <div className={`map-status ${result.status === "ready" ? "ok" : ""}`} style={{ margin: "8px 0" }}>{T[result.status]}</div>
            {result.reasons[0] && <div className="phase-card-desc">{result.reasons[0]}</div>}
            {result.status !== "blocked" && <button className="ab-pill" onClick={() => onOpen(result.toolId)} style={{ marginTop: "10px" }}>{T.open}</button>}
          </div>
        ))}
      </div>
    </section>
  );
}
