"use client";

import DataTable from "@/components/ds/DataTable";

const copy = (locale, ko, en) => locale === "en" ? en : ko;

function statusLabel(status, locale) {
  if (status === "included") return copy(locale, "공동 적합에 포함", "Included in joint fit");
  if (status === "dropped-collinear") return copy(locale, "독립 변화 부족으로 제외", "Excluded: no independent variation");
  return copy(locale, "적합에 사용되지 않음", "Not used in fit");
}

function transformLabel(mode, locale) {
  if (mode === "log-relative") return copy(locale, "기준 대비 로그 변화", "Log change vs. reference");
  if (mode === "linear-relative") return copy(locale, "기준 대비 선형 변화", "Linear change vs. reference");
  return "—";
}

export default function MmmControlFitTable({ rows = [], locale = "ko" }) {
  return (
    <DataTable
      ariaLabel={copy(locale, "연속형 컨트롤 모델 적용 상태", "Continuous-control model status")}
      columns={[
        { key: "label", label: copy(locale, "컨트롤", "Control") },
        { key: "status", label: copy(locale, "모델 상태", "Model status"), fmt: (value) => statusLabel(value, locale) },
        { key: "transformMode", label: copy(locale, "변환", "Transform"), fmt: (value) => transformLabel(value, locale) },
      ]}
      rows={rows}
      rowKey={(row) => row.key}
      tableStyle={{ fontSize: "11.5px" }}
    />
  );
}
