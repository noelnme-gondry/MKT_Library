"use client";
import React from "react";
import IssueMark from "@/components/ds/IssueMark";

// 결과의 신뢰도·방법 표시. 예전에는 지표·해석 범위·표본·실행 정보(방법·엔진 버전·필터 JSON)를
// 결과 아래에 늘 펼쳐 두었는데, 사용자가 쓸 수 없는 정보였다(2026-09-24 사용자 결정으로 제거).
// 이제 경고가 있을 때만 빨간 "!" 하나를 그리고, 누르면 무엇을 확인할지 목록으로 보인다.
// 방법·버전 같은 재현 정보는 상세 워크북(XLSX)이 소유한다. 이 컴포넌트는 표시층만 담당한다.
function hasValue(value) {
  return value != null && String(value).trim() !== "";
}

export default function AnalysisDetails({
  locale = "ko",
  statusLabel = "",
  statusTone = "neutral",
  warnings = [],
}) {
  const lines = (warnings || []).filter(hasValue);
  if ((statusTone === "bad" || statusTone === "warning") && hasValue(statusLabel) && !lines.length) lines.push(statusLabel);
  return <IssueMark issues={lines} locale={locale} />;
}
