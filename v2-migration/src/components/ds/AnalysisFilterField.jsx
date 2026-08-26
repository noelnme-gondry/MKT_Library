"use client";

import React from "react";

/** 공용 분석 필터의 라벨·간격 계약. value/onChange가 있으면 select까지 소유한다. */
export default function AnalysisFilterField({ label, value, onChange, children }) {
  return <label className="mon-filter-item">
    <span className="mon-filter-label">{label}</span>
    {onChange
      ? <select className="mon-filter-select" value={value} onChange={onChange}>{children}</select>
      : children}
  </label>;
}
