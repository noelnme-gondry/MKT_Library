"use client";
import InfoPopover from "./InfoPopover";

// 결과에 확인할 점이 있을 때만 보이는 빨간 "!" 하나(2026-09-24 사용자 결정).
// 예전에는 '실제 분석 범위·분모 확인'·'신뢰도·방법'·'실행 정보(엔진 버전·필터 JSON)'가 결과 아래에
// 늘 펼쳐져 있어, 문제가 없어도 읽을 거리가 쌓이고 문제가 있어도 어디인지 안 보였다.
// 이제 문제가 없으면 아무것도 그리지 않고, 있으면 마우스를 올리거나 누르면 어느 지점(기간·열·행 수)이
// 문제인지 목록으로 보인다. 같은 내용은 상세 워크북(XLSX)의 04_SCOPE·00_README에 그대로 남는다.
export default function IssueMark({ issues = [], locale = "ko", className = "" }) {
  const lines = issues.filter((line) => line != null && String(line).trim() !== "");
  if (!lines.length) return null;
  const en = locale === "en";
  const label = en ? `${lines.length} thing${lines.length === 1 ? "" : "s"} to check` : `확인할 점 ${lines.length}개`;
  return (
    <InfoPopover label={label} glyph="!" className={`issue-mark ${className}`.trim()}>
      <ul className="issue-mark__list">{lines.map((line, index) => <li key={index}>{line}</li>)}</ul>
    </InfoPopover>
  );
}
