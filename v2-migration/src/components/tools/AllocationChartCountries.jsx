"use client";

export default function AllocationChartCountries({ countries, selected, onChange, locale = "ko" }) {
  const en = locale === "en";
  const count = countries.filter(country => selected == null || selected.has(country)).length;
  const toggle = country => {
    if (country === null) { onChange(count === countries.length ? new Set() : null); return; }
    const next = new Set(selected ?? countries);
    if (next.has(country)) next.delete(country); else next.add(country);
    onChange(next.size === countries.length ? null : next);
  };
  return <div className="allocation-linked-countries">
    <div className="allocation-chart-countries" role="group" aria-label={en ? "Linked chart countries" : "차트 공통 국가"}>
      <span>{en ? "Countries" : "국가"}</span>
      {[null, ...countries].map(country => {
        const pressed = country === null ? (count === countries.length ? true : count ? "mixed" : false) : selected == null || selected.has(country);
        const label = country === null ? (en ? "All" : "전체") : country || (en ? "Unspecified" : "국가 미지정");
        return <button key={country ?? "__all__"} type="button" className="btn secondary" aria-pressed={pressed} onClick={() => toggle(country)}><span aria-hidden="true">{pressed === "mixed" ? "−" : pressed ? "✓" : "+"}</span>{label}</button>;
      })}
    </div>
    <p>{en ? "Shared by budget shares, scenarios and response curves. Filters the view; your allocation stays unchanged." : "비중·예산 시나리오·응답곡선에 함께 적용됩니다. 차트만 골라 보며 예산 배분은 유지됩니다."}</p>
  </div>;
}
