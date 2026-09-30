"use client";
import React, { useMemo, useState, useRef, useEffect, useId } from "react";
import { useAppStore } from "@/store/useDataStore";
import { effectiveDenomBasis, getMappedRows, hasUsableDenomBasis } from "@/utils/dashboardAggregator";
import { sourceCurrencyOf } from "@/utils/format";
import DateRangePicker from "@/components/ds/DateRangePicker";
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
    platform: "플랫폼",
    reset: "필터 초기화",
    all: "전체",
    selectedCount: (n) => `${n}개`,
    scope: "보는 범위",
    allDates: "전체 기간",
    change: "조건 바꾸기",
    close: "조건 닫기",
    basis: { installs: "설치 기준", actions: "가입 기준" },
    currency: { KRW: "원(₩)", USD: "달러($)" },
  },
  en: {
    filterTitle: "Filters",
    start: "Start",
    end: "End",
    country: "Country",
    channel: "Channel",
    source: "Source",
    platform: "Platform",
    reset: "Reset filters",
    all: "All",
    selectedCount: (n) => `${n} selected`,
    scope: "Viewing",
    allDates: "All dates",
    change: "Change settings",
    close: "Close settings",
    basis: { installs: "Installs basis", actions: "Actions basis" },
    currency: { KRW: "KRW (₩)", USD: "USD ($)" },
  },
};

function multiSelectValue(selected, T) {
  if (selected == null || selected.size === 0) return T.all;
  return selected.size === 1 ? String([...selected][0]) : T.selectedCount(selected.size);
}

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
  // 버튼이 이름과 걸린 값을 함께 말한다("채널 Meta AAP"). 예전에는 "세그먼트 1" 묶음 뒤에 값이 숨어 있었다(2026-09-29).
  const btnValue = multiSelectValue(selected, T);

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
    <div className="mon-filter-item">
      <div className="mon-multisel" ref={ref} style={{ position: "relative" }}>
        <button
          className={`mon-multisel-btn${isAll ? "" : " is-active"}`}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
        >
          <span className="mon-multisel-btn__label">{label}</span>
          <span className="mon-multisel-btn__value">{btnValue}</span>
          <span aria-hidden="true">{open ? "⌃" : "⌄"}</span>
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

// commandSlot: 도구가 붙이는 분석 설정 입력창(5-21). 필터와 한 자리에 두어 같은 조건을 두 곳에서
// 고르지 않게 한다 — 입력창의 "Meta만 분석" 같은 단어는 아래 필터 선택으로 들어간다.
export default function DashboardFilterBar({ locale = "ko", commandSlot = null }) {
  const T = FILTER_BAR_COPY[locale] || FILTER_BAR_COPY.ko;
  const csvData = useAppStore((state) => state.csvData);
  const dashboardFilter = useAppStore((state) => state.dashboardFilter);
  const setDashboardFilter = useAppStore((state) => state.setDashboardFilter);
  const denomBasis = useAppStore((state) => state.denomBasis);
  const [controlsOpen, setControlsOpen] = useState(false);
  const controlsId = useId();

  const { dates, platforms, countries, channels, sources, hasInstalls, hasActions } = useMemo(() => {
    if (!csvData || !csvData.raw || csvData.raw.length === 0)
      return { dates: [], platforms: [], countries: [], channels: [], sources: [], hasInstalls: false, hasActions: false };

    const rows = csvData.raw;
    const mappedRows = getMappedRows(csvData);
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
      dates: hasDate ? [...new Set(mappedRows.map((row) => row.date).filter(Boolean))].sort() : [],
      platforms: hasPlatform ? uniq(rows.map((r) => r[orig("platform")])) : [],
      countries: hasCountry ? uniq(rows.map((r) => r[orig("country")])) : [],
      channels: hasChannel ? uniq(rows.map((r) => r[orig("channel")])) : [],
      sources: hasSource ? uniq(rows.map((r) => r[orig("source")])) : [],
      hasInstalls: mapped.has("installs"),
      hasActions: mapped.has("actions"),
    };
  }, [csvData]);

  if (!dates.length && !platforms.length && !countries.length && !channels.length && !sources.length && !hasInstalls && !hasActions)
    return commandSlot ? <div className="dashboard-filter-bar"><div className="dashboard-filter-bar__command">{commandSlot}</div></div> : null;

  const minDate = dates[0] || "";
  const maxDate = dates[dates.length - 1] || "";

  let activeCount = 0;
  if (dashboardFilter.dateStart) activeCount++;
  if (dashboardFilter.dateEnd) activeCount++;
  if (dashboardFilter.compareEnabled) activeCount++;
  if (dashboardFilter.platforms && dashboardFilter.platforms.size > 0) activeCount++;
  if (dashboardFilter.countries && dashboardFilter.countries.size > 0) activeCount++;
  if (dashboardFilter.channels && dashboardFilter.channels.size > 0) activeCount++;
  if (dashboardFilter.sources && dashboardFilter.sources.size > 0) activeCount++;

  // 축마다 버튼 하나. 값이 하나뿐인 축은 거를 수 없으므로 숨긴다 — 단, 이미 걸려 있으면(도구 이동으로 넘어온 필터)
  // 걸린 사실이 보이도록 남긴다(2026-09-29).
  const dimensions = [
    { key: "platforms", label: T.platform, options: platforms },
    { key: "countries", label: T.country, options: countries },
    { key: "channels", label: T.channel, options: channels },
    { key: "sources", label: T.source, options: sources },
  ].map((dim) => ({ ...dim, selected: dashboardFilter[dim.key] && dashboardFilter[dim.key].size > 0 ? dashboardFilter[dim.key] : null }))
    .filter((dim) => dim.options.length >= 2 || dim.selected);

  const handleReset = () => {
    setDashboardFilter({
      dateStart: null,
      dateEnd: null,
      compareEnabled: false,
      comparisonStart: null,
      comparisonEnd: null,
      comparisonPreset: "previous",
      platforms: new Set(),
      countries: new Set(),
      channels: new Set(),
      sources: new Set(),
    });
  };

  // 폰에서는 컨트롤을 접고 지금 보는 범위를 한 줄로 말한다. 위에 고정되는 영역이 결과를 밀어내지 않게(2026-09-29).
  const period = dashboardFilter.dateStart || dashboardFilter.dateEnd
    ? `${dashboardFilter.dateStart || minDate} ~ ${dashboardFilter.dateEnd || maxDate}`
    : T.allDates;
  const basisKey = hasUsableDenomBasis(csvData, "installs") || hasUsableDenomBasis(csvData, "actions")
    ? (effectiveDenomBasis(csvData, denomBasis) === "actions" ? "actions" : "installs")
    : null;
  const summaryParts = [
    { text: period, active: Boolean(dashboardFilter.dateStart || dashboardFilter.dateEnd) },
    ...dimensions.filter((dim) => dim.selected).map((dim) => ({ text: `${dim.label} ${multiSelectValue(dim.selected, T)}`, active: true })),
    ...(basisKey ? [{ text: T.basis[basisKey], active: false }] : []),
    { text: T.currency[sourceCurrencyOf(csvData)] || sourceCurrencyOf(csvData), active: false },
  ];

  return (
    <div className="dashboard-filter-bar" data-active-filter-count={activeCount} data-controls-open={controlsOpen}>
      {commandSlot && <div className="dashboard-filter-bar__command">{commandSlot}</div>}
      <div className="dashboard-filter-bar__summary">
        <p>
          <span>{T.scope}</span>
          {summaryParts.map((part) => <React.Fragment key={part.text}> · {part.active ? <strong>{part.text}</strong> : part.text}</React.Fragment>)}
        </p>
        <button type="button" className="btn dashboard-filter-bar__toggle" aria-expanded={controlsOpen} aria-controls={controlsId} onClick={() => setControlsOpen((open) => !open)}>
          {controlsOpen ? T.close : T.change}
        </button>
        {activeCount > 0 && <button type="button" className="mon-filter-reset" onClick={handleReset}>{T.reset}</button>}
      </div>
      <div className="dashboard-filter-bar__controls" id={controlsId}>
        <AnalysisControlBar title={locale === "en" ? "Analysis scope" : "분석 범위"}>
          <div className="dashboard-filter-bar__scope" role="group" aria-label={locale === "en" ? "Date and segment filters" : "날짜와 세그먼트 필터"}>
            {dates.length > 0 && (
              <div className="dashboard-filter-bar__date-range">
                <DateRangePicker
                  locale={locale}
                  minDate={minDate}
                  maxDate={maxDate}
                  dateStart={dashboardFilter.dateStart}
                  dateEnd={dashboardFilter.dateEnd}
                  compareEnabled={dashboardFilter.compareEnabled}
                  comparisonStart={dashboardFilter.comparisonStart}
                  comparisonEnd={dashboardFilter.comparisonEnd}
                  comparisonPreset={dashboardFilter.comparisonPreset}
                  onApply={setDashboardFilter}
                />
              </div>
            )}
            {dimensions.map((dim) => (
              <MultiSelect
                key={dim.key}
                label={dim.label}
                options={dim.options}
                selected={dim.selected}
                onChange={(set) => setDashboardFilter({ [dim.key]: set || new Set() })}
                T={T}
              />
            ))}
            {activeCount > 0 && (
              <button type="button" className="mon-filter-reset" onClick={handleReset}>
                {T.reset}
              </button>
            )}
          </div>
          <div className="dashboard-filter-bar__display" role="group" aria-label={locale === "en" ? "Display settings" : "표시 설정"}>
            <BasisCurrencyToggleBar locale={locale} />
          </div>
        </AnalysisControlBar>
      </div>
    </div>
  );
}
