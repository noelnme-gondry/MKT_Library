"use client";
import React, { useMemo, useState, useRef, useEffect, useId } from "react";
import { useAppStore } from "@/store/useDataStore";
import BasisCurrencyToggleBar from "./BasisCurrencyToggleBar";
import AnalysisControlBar from "./AnalysisControlBar";

const FILTER_BAR_COPY = {
  ko: {
    filterTitle: "필터",
    start: "시작",
    end: "종료",
    country: "국가",
    channel: "채널",
    source: "소스",
    reset: "초기화",
    all: (n) => `전체 (${n})`,
    selectedCount: (n) => `${n}개 선택됨`,
  },
  en: {
    filterTitle: "Filters",
    start: "Start",
    end: "End",
    country: "Country",
    channel: "Channel",
    source: "Source",
    reset: "Reset",
    all: (n) => `All (${n})`,
    selectedCount: (n) => `${n} selected`,
  },
};

// 다중 선택 드롭다운(체크박스) — index.html mon-multisel 이식.
// value=null → 전체(필터 미적용). value=Set → 선택 항목만.
function MultiSelect({ label, options, selected, onChange, T }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const isAll = selected == null || selected.size === 0;
  const btnLabel = isAll ? T.all(options.length) : T.selectedCount(selected.size);

  const toggle = (val) => {
    // selected===null은 "전체 선택" 의미 — 여기서 빈 Set으로 시작하면 클릭한 항목
    // 하나만 추가돼 "그것만 선택"으로 뒤집힘(반대 동작 버그). 전체 상태에선 전체
    // 옵션에서 시작해 클릭한 항목을 빼야 "그것만 해제"가 됨.
    const next = new Set(selected == null ? options : selected);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    // 전체 선택 = null(필터 해제)로 정규화 → 다른 필터와 동일 의미
    onChange(next.size === 0 || next.size === options.length ? null : next);
  };

  return (
    <div className="mon-filter-item" style={{ alignItems: "center", gap: "4px" }}>
      <span className="mon-filter-label">{label}</span>
      <div className="mon-multisel" ref={ref} style={{ position: "relative" }}>
        <button
          className="mon-multisel-btn"
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
        >
          {btnLabel} <span aria-hidden="true">{open ? "⌃" : "⌄"}</span>
        </button>
        {open && (
          <div className="mon-multisel-list" id={listId} role="listbox" aria-label={label} aria-multiselectable="true">
            {options.map((o) => (
              <label key={o} role="option" aria-selected={isAll || selected.has(o)}>
                <input
                  type="checkbox"
                  value={o}
                  checked={isAll || selected.has(o)}
                  onChange={() => toggle(o)}
                />{" "}
                {o}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardFilterBar({ locale = "ko" }) {
  const T = FILTER_BAR_COPY[locale] || FILTER_BAR_COPY.ko;
  const csvData = useAppStore((state) => state.csvData);
  const dashboardFilter = useAppStore((state) => state.dashboardFilter);
  const setDashboardFilter = useAppStore((state) => state.setDashboardFilter);

  const { dates, platforms, countries, channels, sources, hasInstalls, hasActions } = useMemo(() => {
    if (!csvData || !csvData.raw || csvData.raw.length === 0)
      return { dates: [], platforms: [], countries: [], channels: [], sources: [], hasInstalls: false, hasActions: false };

    const rows = csvData.raw;
    const mapping = csvData.mapping || {};
    const mapped = new Set(Object.values(mapping));

    const hasDate = mapped.has("date");
    const hasPlatform = mapped.has("platform");
    const hasCountry = mapped.has("country");
    const hasChannel = mapped.has("channel");
    const hasSource = mapped.has("source");

    // origHeader → standardKey 역맵으로 원본 헤더 조회
    const orig = (std) => Object.keys(mapping).find((k) => mapping[k] === std);
    // 옵션 값은 반드시 trim — getMonFilteredRows가 국가·채널·소스를 trim해서 비교하므로
    // 여기서 공백을 안 지우면 " Paid" 옵션이 "Paid"와 안 맞아 선택해도 0행이 되는 버그(paid=0).
    const uniq = (arr) => [...new Set(arr.map((v) => String(v ?? "").trim()).filter(Boolean))].sort();

    return {
      dates: hasDate ? [...new Set(rows.map((r) => r[orig("date")]).filter(Boolean))].sort() : [],
      platforms: hasPlatform ? uniq(rows.map((r) => r[orig("platform")])) : [],
      countries: hasCountry ? uniq(rows.map((r) => r[orig("country")])) : [],
      channels: hasChannel ? uniq(rows.map((r) => r[orig("channel")])) : [],
      sources: hasSource ? uniq(rows.map((r) => r[orig("source")])) : [],
      hasInstalls: mapped.has("installs"),
      hasActions: mapped.has("actions"),
    };
  }, [csvData]);

  const activeSegmentCount = [
    dashboardFilter.platforms,
    dashboardFilter.countries,
    dashboardFilter.channels,
    dashboardFilter.sources,
  ].filter((value) => value && value.size > 0).length;

  if (!dates.length && !platforms.length && !countries.length && !channels.length && !sources.length && !hasInstalls && !hasActions)
    return null;

  const minDate = dates[0] || "";
  const maxDate = dates[dates.length - 1] || "";

  let activeCount = 0;
  if (dashboardFilter.dateStart) activeCount++;
  if (dashboardFilter.dateEnd) activeCount++;
  if (dashboardFilter.platforms && dashboardFilter.platforms.size > 0) activeCount++;
  if (dashboardFilter.countries && dashboardFilter.countries.size > 0) activeCount++;
  if (dashboardFilter.channels && dashboardFilter.channels.size > 0) activeCount++;
  if (dashboardFilter.sources && dashboardFilter.sources.size > 0) activeCount++;
  const segmentFilterCount = [platforms, countries, channels, sources].filter((options) => options.length > 0).length;

  const handleReset = () => {
    setDashboardFilter({
      dateStart: null,
      dateEnd: null,
      platforms: new Set(),
      countries: new Set(),
      channels: new Set(),
      sources: new Set(),
    });
  };

  return (
    <AnalysisControlBar
      title={locale === "en" ? "Analysis scope" : "분석 범위"}
      activeCount={activeCount}
      hint={locale === "en" ? "Applies to this shared CSV" : "공유 CSV를 쓰는 도구에 적용"}
    >

        {dates.length > 0 && (
          <>
            <label className="mon-filter-item">
              <span className="mon-filter-label">{T.start}</span>
              <input
                type="date"
                className="mon-filter-input"
                lang={locale === "en" ? "en-US" : "ko-KR"}
                aria-label={T.start}
                value={dashboardFilter.dateStart || ""}
                min={minDate}
                max={maxDate}
                onChange={(e) => setDashboardFilter({ dateStart: e.target.value || null })}
              />
            </label>
            <label className="mon-filter-item">
              <span className="mon-filter-label">{T.end}</span>
              <input
                type="date"
                className="mon-filter-input"
                lang={locale === "en" ? "en-US" : "ko-KR"}
                aria-label={T.end}
                value={dashboardFilter.dateEnd || ""}
                min={minDate}
                max={maxDate}
                onChange={(e) => setDashboardFilter({ dateEnd: e.target.value || null })}
              />
            </label>
          </>
        )}

        {segmentFilterCount > 0 && (
          <details className="dashboard-filter-more" open={activeSegmentCount > 0}>
            <summary>
              {locale === "en" ? "Segments" : "세그먼트"}
              <span>{activeSegmentCount > 0 ? activeSegmentCount : segmentFilterCount}</span>
            </summary>
            <div className="dashboard-filter-more__body">
              {platforms.length > 0 && (
                <MultiSelect
                  label={locale === "en" ? "Platform" : "플랫폼"}
                  options={platforms}
                  selected={dashboardFilter.platforms && dashboardFilter.platforms.size > 0 ? dashboardFilter.platforms : null}
                  onChange={(set) => setDashboardFilter({ platforms: set || new Set() })}
                  T={T}
                />
              )}
              {countries.length > 0 && (
                <MultiSelect
                  label={T.country}
                  options={countries}
                  selected={dashboardFilter.countries && dashboardFilter.countries.size > 0 ? dashboardFilter.countries : null}
                  onChange={(set) => setDashboardFilter({ countries: set || new Set() })}
                  T={T}
                />
              )}
              {channels.length > 0 && (
                <MultiSelect
                  label={T.channel}
                  options={channels}
                  selected={dashboardFilter.channels && dashboardFilter.channels.size > 0 ? dashboardFilter.channels : null}
                  onChange={(set) => setDashboardFilter({ channels: set || new Set() })}
                  T={T}
                />
              )}
              {sources.length > 0 && (
                <MultiSelect
                  label={T.source}
                  options={sources}
                  selected={dashboardFilter.sources && dashboardFilter.sources.size > 0 ? dashboardFilter.sources : null}
                  onChange={(set) => setDashboardFilter({ sources: set || new Set() })}
                  T={T}
                />
              )}
            </div>
          </details>
        )}

        {activeCount > 0 && (
          <button className="copy-btn mon-filter-reset" onClick={handleReset} style={{ padding: "4px 8px", fontSize: "11px" }}>
            {T.reset}
          </button>
        )}
      <BasisCurrencyToggleBar locale={locale} />
    </AnalysisControlBar>
  );
}
