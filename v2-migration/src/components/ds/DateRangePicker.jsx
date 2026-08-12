"use client";

import React, { useMemo, useState } from "react";
import { Popover } from "radix-ui";

const DAY_MS = 86_400_000;

const COPY = {
  ko: {
    dateRange: "날짜 범위",
    allDates: "전체 기간",
    custom: "맞춤",
    thisWeek: "이번 주",
    last14: "최근 2주",
    thisMonth: "이번 달",
    lastMonth: "지난 달",
    start: "시작일",
    end: "종료일",
    compare: "비교",
    previous: "이전 기간",
    previousYear: "전년 동기",
    customCompare: "맞춤 기간",
    comparisonPeriod: "비교 기간",
    cancel: "취소",
    apply: "적용",
    previousMonths: "이전 달 보기",
    nextMonths: "다음 달 보기",
    weekdays: ["월", "화", "수", "목", "금", "토", "일"],
  },
  en: {
    dateRange: "Date range",
    allDates: "All dates",
    custom: "Custom",
    thisWeek: "This week",
    last14: "Last 2 weeks",
    thisMonth: "This month",
    lastMonth: "Last month",
    start: "Start date",
    end: "End date",
    compare: "Compare",
    previous: "Previous period",
    previousYear: "Same period last year",
    customCompare: "Custom period",
    comparisonPeriod: "Comparison period",
    cancel: "Cancel",
    apply: "Apply",
    previousMonths: "Show previous months",
    nextMonths: "Show next months",
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  },
};

function parseIso(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value, days) {
  const date = typeof value === "string" ? parseIso(value) : value;
  return isoDate(new Date(date.getTime() + days * DAY_MS));
}

function addMonths(value, months) {
  const date = typeof value === "string" ? parseIso(value) : value;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function clampDate(value, minDate, maxDate) {
  if (!value) return value;
  if (minDate && value < minDate) return minDate;
  if (maxDate && value > maxDate) return maxDate;
  return value;
}

function orderedRange(start, end) {
  return start <= end ? { start, end } : { start: end, end: start };
}

function previousYearDate(date) {
  const year = date.getUTCFullYear() - 1;
  const month = date.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return isoDate(new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay))));
}

export function buildDatePreset(preset, anchorDate, minDate, maxDate) {
  const anchor = parseIso(clampDate(anchorDate, minDate, maxDate));
  if (!anchor) return { start: minDate, end: maxDate };
  let start = anchorDate;
  let end = anchorDate;
  if (preset === "thisWeek") {
    const mondayOffset = (anchor.getUTCDay() + 6) % 7;
    start = addDays(anchor, -mondayOffset);
  } else if (preset === "last14") {
    start = addDays(anchor, -13);
  } else if (preset === "thisMonth") {
    start = isoDate(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1)));
  } else if (preset === "lastMonth") {
    start = isoDate(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1)));
    end = isoDate(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 0)));
  } else {
    return { start: minDate, end: maxDate };
  }
  return {
    start: clampDate(start, minDate, maxDate),
    end: clampDate(end, minDate, maxDate),
  };
}

export function buildComparisonRange(start, end, comparisonPreset, minDate, maxDate) {
  const ordered = orderedRange(start, end);
  const startDate = parseIso(ordered.start);
  const endDate = parseIso(ordered.end);
  if (!startDate || !endDate) return { start: null, end: null };
  let comparisonStart;
  let comparisonEnd;
  if (comparisonPreset === "previousYear") {
    comparisonStart = previousYearDate(startDate);
    comparisonEnd = previousYearDate(endDate);
  } else {
    const days = Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
    comparisonEnd = addDays(startDate, -1);
    comparisonStart = addDays(comparisonEnd, -(days - 1));
  }
  return {
    start: clampDate(comparisonStart, minDate, maxDate),
    end: clampDate(comparisonEnd, minDate, maxDate),
  };
}

function formatRange(start, end, locale) {
  if (!start || !end) return null;
  const formatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(parseIso(start))} – ${formatter.format(parseIso(end))}`;
}

function CalendarMonth({ month, minDate, maxDate, primary, comparison, onSelect, T, locale }) {
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const leading = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(month);
  const cells = [...Array(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  const isInRange = (value, range) => range.start && range.end && value >= range.start && value <= range.end;

  return (
    <section className="date-range-calendar" aria-label={monthLabel}>
      <h3>{monthLabel}</h3>
      <div className="date-range-calendar__weekdays" aria-hidden="true">
        {T.weekdays.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="date-range-calendar__days">
        {cells.map((day, index) => {
          if (!day) return <span key={`blank-${index}`} />;
          const value = isoDate(new Date(Date.UTC(year, monthIndex, day)));
          const isDisabled = value < minDate || value > maxDate;
          const isPrimary = isInRange(value, primary);
          const isComparison = isInRange(value, comparison);
          const isEndpoint = value === primary.start || value === primary.end;
          return (
            <button
              key={value}
              type="button"
              className={`${isPrimary ? "is-primary-range" : ""}${isComparison ? " is-comparison-range" : ""}${isEndpoint ? " is-endpoint" : ""}`.trim()}
              disabled={isDisabled}
              aria-label={value}
              aria-pressed={isPrimary}
              onClick={() => onSelect(value)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function DateRangePicker({
  locale = "ko",
  minDate,
  maxDate,
  dateStart,
  dateEnd,
  compareEnabled = false,
  comparisonStart,
  comparisonEnd,
  comparisonPreset = "previous",
  onApply,
}) {
  const T = COPY[locale] || COPY.ko;
  const today = isoDate(new Date());
  const anchorDate = clampDate(today, minDate, maxDate);
  const initialRange = { start: dateStart || minDate, end: dateEnd || maxDate };
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    ...initialRange,
    preset: dateStart || dateEnd ? "custom" : "all",
    compareEnabled,
    comparisonStart,
    comparisonEnd,
    comparisonPreset,
  });
  const [pickingEnd, setPickingEnd] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => addMonths(initialRange.end || anchorDate, 0));

  const comparison = useMemo(() => ({
    start: draft.compareEnabled ? draft.comparisonStart : null,
    end: draft.compareEnabled ? draft.comparisonEnd : null,
  }), [draft.compareEnabled, draft.comparisonEnd, draft.comparisonStart]);

  const syncDraft = () => {
    const nextRange = { start: dateStart || minDate, end: dateEnd || maxDate };
    setDraft({
      ...nextRange,
      preset: dateStart || dateEnd ? "custom" : "all",
      compareEnabled,
      comparisonStart,
      comparisonEnd,
      comparisonPreset,
    });
    setViewMonth(addMonths(nextRange.end || anchorDate, 0));
    setPickingEnd(false);
  };

  const handleOpenChange = (nextOpen) => {
    if (nextOpen) syncDraft();
    setOpen(nextOpen);
  };

  const updateComparison = (next, preset = draft.comparisonPreset) => {
    if (!next.compareEnabled || preset === "custom") return next;
    const range = buildComparisonRange(next.start, next.end, preset, minDate, maxDate);
    return { ...next, comparisonStart: range.start, comparisonEnd: range.end };
  };

  const selectPreset = (preset) => {
    const range = preset === "all"
      ? { start: minDate, end: maxDate }
      : buildDatePreset(preset, anchorDate, minDate, maxDate);
    setDraft((current) => updateComparison({ ...current, ...range, preset }));
    setViewMonth(addMonths(range.end, 0));
    setPickingEnd(false);
  };

  const selectDay = (value) => {
    setDraft((current) => {
      if (!pickingEnd) return updateComparison({ ...current, start: value, end: value, preset: "custom" });
      const range = orderedRange(current.start, value);
      return updateComparison({ ...current, ...range, preset: "custom" });
    });
    setPickingEnd((current) => !current);
  };

  const setComparisonEnabled = (enabled) => {
    setDraft((current) => {
      const next = { ...current, compareEnabled: enabled };
      return enabled ? updateComparison(next, current.comparisonPreset) : next;
    });
  };

  const selectComparisonPreset = (preset) => {
    setDraft((current) => {
      const next = { ...current, comparisonPreset: preset };
      return preset === "custom" ? next : updateComparison(next, preset);
    });
  };

  const triggerLabel = formatRange(dateStart, dateEnd, locale) || T.allDates;
  const presets = [
    ["thisWeek", T.thisWeek],
    ["last14", T.last14],
    ["thisMonth", T.thisMonth],
    ["lastMonth", T.lastMonth],
    ["all", T.allDates],
  ];

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button className="date-range-trigger" type="button" aria-label={T.dateRange}>
          <span aria-hidden="true">▦</span>
          <strong>{triggerLabel}</strong>
          <span aria-hidden="true">⌄</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="date-range-popover" align="start" sideOffset={8} collisionPadding={12}>
          <div className="date-range-layout">
            <aside className="date-range-presets" aria-label={T.dateRange}>
              <button type="button" className={draft.preset === "custom" ? "active" : ""} onClick={() => setDraft((current) => ({ ...current, preset: "custom" }))}>{T.custom}</button>
              {presets.map(([key, label]) => (
                <button key={key} type="button" className={draft.preset === key ? "active" : ""} onClick={() => selectPreset(key)}>{label}</button>
              ))}
              <div className="date-range-compare-toggle">
                <span>{T.compare}</span>
                <button type="button" role="switch" aria-label={T.compare} aria-checked={draft.compareEnabled} className={draft.compareEnabled ? "is-on" : ""} onClick={() => setComparisonEnabled(!draft.compareEnabled)}><span /></button>
              </div>
              {draft.compareEnabled && (
                <div className="date-range-compare-options">
                  {[["previous", T.previous], ["previousYear", T.previousYear], ["custom", T.customCompare]].map(([key, label]) => (
                    <button key={key} type="button" className={draft.comparisonPreset === key ? "active" : ""} onClick={() => selectComparisonPreset(key)}>{label}</button>
                  ))}
                </div>
              )}
            </aside>

            <div className="date-range-main">
              <div className="date-range-fields">
                <label><span>{T.start}</span><input type="date" min={minDate} max={maxDate} value={draft.start || ""} onChange={(event) => setDraft((current) => updateComparison({ ...current, start: event.target.value, preset: "custom" }))} /></label>
                <span aria-hidden="true">–</span>
                <label><span>{T.end}</span><input type="date" min={minDate} max={maxDate} value={draft.end || ""} onChange={(event) => setDraft((current) => updateComparison({ ...current, end: event.target.value, preset: "custom" }))} /></label>
              </div>
              {draft.compareEnabled && (
                <div className="date-range-fields date-range-fields--comparison">
                  <strong>{T.comparisonPeriod}</strong>
                  <label><span>{T.start}</span><input type="date" min={minDate} max={maxDate} value={draft.comparisonStart || ""} disabled={draft.comparisonPreset !== "custom"} onChange={(event) => setDraft((current) => ({ ...current, comparisonStart: event.target.value }))} /></label>
                  <span aria-hidden="true">–</span>
                  <label><span>{T.end}</span><input type="date" min={minDate} max={maxDate} value={draft.comparisonEnd || ""} disabled={draft.comparisonPreset !== "custom"} onChange={(event) => setDraft((current) => ({ ...current, comparisonEnd: event.target.value }))} /></label>
                </div>
              )}

              <div className="date-range-calendar-nav">
                <button type="button" aria-label={T.previousMonths} onClick={() => setViewMonth((month) => addMonths(month, -1))}>‹</button>
                <button type="button" aria-label={T.nextMonths} onClick={() => setViewMonth((month) => addMonths(month, 1))}>›</button>
              </div>
              <div className="date-range-calendars">
                {[addMonths(viewMonth, -1), viewMonth].map((month) => (
                  <CalendarMonth
                    key={`${month.getUTCFullYear()}-${month.getUTCMonth()}`}
                    month={month}
                    minDate={minDate}
                    maxDate={maxDate}
                    primary={{ start: draft.start, end: draft.end }}
                    comparison={comparison}
                    onSelect={selectDay}
                    T={T}
                    locale={locale}
                  />
                ))}
              </div>
            </div>
          </div>
          <footer className="date-range-footer">
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>{T.cancel}</button>
            <button type="button" className="btn primary" onClick={() => {
              const range = orderedRange(draft.start, draft.end);
              const comparisonRange = draft.comparisonStart && draft.comparisonEnd
                ? orderedRange(draft.comparisonStart, draft.comparisonEnd)
                : { start: null, end: null };
              onApply({
                dateStart: draft.preset === "all" ? null : range.start,
                dateEnd: draft.preset === "all" ? null : range.end,
                compareEnabled: draft.compareEnabled,
                comparisonStart: draft.compareEnabled ? comparisonRange.start : null,
                comparisonEnd: draft.compareEnabled ? comparisonRange.end : null,
                comparisonPreset: draft.comparisonPreset,
              });
              setOpen(false);
            }}>{T.apply}</button>
          </footer>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
