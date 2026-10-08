"use client";
import { useId, useState } from "react";
import { Popover } from "radix-ui";
import { CalendarDays, ChevronDown } from "lucide-react";
import { periodProblem, periodDays, previousPeriod } from "@/lib/analysisPeriod";

// 날짜 자체가 조작 대상이다. Radix가 Escape·외부 클릭·포커스 복귀를 담당한다.
export default function ResultPeriodPicker({ label, range, onApply, previousOf, minDate, maxDate, locale = "ko" }) {
  const en = locale === "en";
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(range || { start: "", end: "" });
  const [error, setError] = useState("");
  const onOpenChange = (next) => {
    if (next) { setDraft(range || { start: "", end: "" }); setError(""); }
    setOpen(next);
  };
  const apply = (event) => {
    event.preventDefault();
    const problem = periodProblem(draft, { minDate, maxDate });
    if (problem) {
      setError(problem === "bounds"
        ? (en ? `Choose dates within the CSV period: ${minDate || "…"} – ${maxDate || "…"}.` : `CSV 기간 안에서 선택해 주세요: ${minDate || "…"} ~ ${maxDate || "…"}.`)
        : problem === "order"
        ? (en ? "The start date must not be after the end date." : "시작일이 종료일보다 늦을 수 없습니다.")
        : (en ? "Enter a valid start and end date." : "올바른 시작일과 종료일을 입력해 주세요."));
      return;
    }
    onApply(draft);
    setOpen(false);
  };
  return <div className="result-period-picker">
    <span id={`${id}-label`} className="result-period-picker__label">{label}</span>
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button type="button" className="result-period-picker__trigger" aria-labelledby={`${id}-label ${id}-value`}>
          <CalendarDays size={16} aria-hidden="true" />
          <span id={`${id}-value`}>{range?.start && range?.end ? <><time dateTime={range.start}>{range.start}</time><span aria-hidden="true"> – </span><time dateTime={range.end}>{range.end}</time></> : (en ? "Choose dates" : "날짜 선택")}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="result-period-picker__popover" align="start" sideOffset={8} collisionPadding={12} aria-label={label}>
          <form onSubmit={apply} noValidate>
            <div className="result-period-picker__fields">
              {[["start", en ? "Start date" : "시작일"], ["end", en ? "End date" : "종료일"]].map(([key, text]) => <label key={key}>
                <span>{text}</span><input type="date" min={minDate} max={maxDate} required value={draft[key] || ""} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => { setDraft((value) => ({ ...value, [key]: event.target.value })); setError(""); }} />
              </label>)}
            </div>
            {previousOf && !periodProblem(previousOf) && <button type="button" className="result-period-picker__previous" onClick={() => { setDraft(previousPeriod(previousOf)); setError(""); }}>{en ? "Use the previous equal-length period" : "직전 같은 길이로 맞추기"}</button>}
            {error && <p id={`${id}-error`} role="alert" className="result-period-picker__error">{error}</p>}
            <div className="result-period-picker__footer">
              <span>{periodDays(draft) != null ? (en ? `${periodDays(draft)} days` : `${periodDays(draft)}일`) : ""}</span>
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>{en ? "Cancel" : "취소"}</button>
              <button type="submit" className="btn primary">{en ? "Apply" : "적용"}</button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  </div>;
}
