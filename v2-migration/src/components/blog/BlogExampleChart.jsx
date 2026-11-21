// 예시 결과 카드(시안 A)의 그림. 막대 하나만 강조색, 나머지는 회색 — 색은 한 곳에만 쓴다.
// 값은 `lib/blogExamples/data.json`(엔진 계산 사본)에서 오고, 여기서는 그리기만 한다.
export default function BlogExampleChart({ example, locale = "ko" }) {
  const en = locale === "en";
  const text = (value) => (value && typeof value === "object" ? value[en ? "en" : "ko"] : value);
  if (example?.spark?.length > 1) {
    const values = example.spark, min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${40 - ((v - min) / span) * 36 - 2}`).join(" ");
    return <svg className="blog-example__spark" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={en ? "Trend over the observed weeks" : "관측 기간의 추세"}>
      <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>;
  }
  const bars = example?.bars || [];
  if (!bars.length) return null;
  const max = example.scaleMax || Math.max(...bars.map((bar) => Math.abs(bar.value))) || 1;
  const diverging = bars.some(bar => bar.value < 0);
  return <>{example.scaleMax === 1 && <small className="blog-example__scale">{en ? "Rate · 0–100%" : "비율 · 0~100%"}</small>}
    <ul className={`blog-example__bars${diverging ? " blog-example__bars--signed" : ""}`} aria-label={en ? "Example result by item" : "항목별 예시 결과"}>
    {bars.map((bar) => <li key={text(bar.label)} className={bar.highlight ? "is-highlight" : undefined}>
      <span className="blog-example__label">{text(bar.label)}</span>
      <span className="blog-example__track" aria-hidden="true"><span style={{ width: `${Math.abs(bar.value) / max * (diverging ? 50 : 100)}%`, ...(diverging && (bar.value < 0 ? { right: "50%" } : { left: "50%" })) }} /></span>
      <span className="blog-example__value">{text(bar.display)}{bar.suffix ? ` (${bar.suffix})` : ""}</span>
      {bar.detail && <small className="blog-example__detail">{text(bar.detail)}</small>}
    </li>)}
  </ul></>;
}
