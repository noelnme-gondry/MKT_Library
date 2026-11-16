"use client";
import { useState } from "react";
import DataTable from "@/components/ds/DataTable";
import { fmtNum } from "@/utils/format";

export default function OperationsObservedQueue({ brief, selected, onSelect, metricName, locale = "ko", money, pct }) {
  const [expanded, setExpanded] = useState(false);
  const tr = (ko, en) => locale === "en" ? en : ko;
  const rows = expanded ? brief.campaigns : brief.campaigns.slice(0, 5);
  return <section className="operations-observed-queue" aria-labelledby="ops-observed-queue-title">
    <header><h4 id="ops-observed-queue-title">{tr("관측 검토 목록", "Observed review queue")}</h4>
      <p>{tr("직전 대비 단가 상승률 순입니다. 원인·목표 단가·중단 여부를 판정하지 않습니다.", "Ordered by observed CPR increase. This does not identify causes, target CPA or pause decisions.")}</p></header>
    <DataTable rows={rows} rowKey={row => row.id} ariaLabel={tr("대상별 관측 비교", "Observed comparison by entity")} emptyText={tr("검토할 대상이 없습니다.", "No entities to review.")} columns={[
      { key: "name", label: tr("대상·범위", "Entity and scope"), fmt: (value, row) => <span className="operations-brief__entity"><strong>{value || tr("대상 미지정", "Unspecified entity")}</strong><small>{row.context}</small></span> },
      { key: "current", label: tr(`직전 → 최근 ${metricName}`, `Prior → recent ${metricName}`), align: "right", fmt: (value, row) => <span>{money(row.previous.cpr)} → {money(value.cpr)}</span> },
      { key: "changePct", label: tr("관측 변화", "Observed change"), align: "right", fmt: pct },
      { key: "observedDays", label: tr("최근 관측일", "Recent observed days"), align: "right", fmt: value => `${fmtNum(value)} / ${brief.days == null ? "—" : fmtNum(brief.days)}` },
      { key: "id", label: tr("근거 확인", "Inspect evidence"), fmt: (value, row) => <button className="btn ghost" type="button" aria-label={tr(`${row.name || "대상 미지정"} 관측 근거 선택`, `Select observed evidence for ${row.name || "Unspecified entity"}`)}
        aria-pressed={selected === value} onClick={() => onSelect(value)}>{selected === value ? tr("선택됨", "Selected") : tr("분석", "Analyze")}</button> },
    ]} />
    <p className="operations-chart__caption">{tr("최근 관측일은 해당 기간에 데이터가 있는 날짜 수입니다. 기간 양쪽의 단가가 없으면 비교 불가로 남깁니다.", "Observed days count dates present in the period. Missing CPR on either side remains not comparable.")}</p>
    {brief.campaigns.length > 5 && <button className="btn ghost" type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
      {expanded ? tr("상위 5개만 보기", "Show first 5") : tr(`${fmtNum(brief.campaigns.length)}개 모두 보기`, `Show all ${fmtNum(brief.campaigns.length)}`)}</button>}
  </section>;
}
