"use client";
import { useId, useState } from "react";
import { dateBoundProblem } from "@/lib/analysisPeriod";

// Keep the visible value ISO-formatted regardless of the browser's date locale.
export default function IsoDateInput({ value, min, max, step = 1, onChange, locale = "ko", allowEmpty = false, ...props }) {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(false);
  const id = useId();
  const label = props["aria-label"];
  const commit = next => {
    const valid = (allowEmpty && next === "") || !dateBoundProblem(next, { minDate: min, maxDate: max });
    if (!valid) { setDraft(next); setError(true); return; }
    onChange({ target: { value: next } });
    setDraft(null); setError(false);
  };
  const apply = () => { if (draft !== null) commit(draft); };
  return <div className="iso-date-field">
    <div className="iso-date-control">
      <input {...props} type="text" inputMode="numeric" placeholder="YYYY-MM-DD" value={draft ?? value} aria-invalid={error || undefined} aria-describedby={error ? id : undefined}
        onChange={event => { setDraft(event.target.value); setError(false); }} onBlur={apply}
        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); apply(); } if (event.key === "Escape") { setDraft(null); setError(false); } }} />
      <span className="iso-date-calendar"><span aria-hidden="true">▦</span><input type="date" disabled={props.disabled} value={value} min={min} max={max} step={step} aria-label={`${label} ${locale === "en" ? "calendar" : "달력"}`} onChange={event => commit(event.target.value)} /></span>
    </div>
    {error && <small id={id} role="alert">{locale === "en" ? `Enter a valid date as YYYY-MM-DD.${min || max ? ` Allowed: ${min || "…"} – ${max || "…"}.` : ""}` : `날짜를 YYYY-MM-DD로 입력하세요.${min || max ? ` 허용 범위: ${min || "…"} ~ ${max || "…"}.` : ""}`}</small>}
  </div>;
}
