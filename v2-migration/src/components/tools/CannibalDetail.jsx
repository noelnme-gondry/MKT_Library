"use client";
import React, { useId, useMemo, useState } from "react";
import ToolPageShell from "@/components/ToolPageShell";
import ReportCsvInput from "@/components/data-import/ReportCsvInput";
import ResultActionCard from "@/components/ds/ResultActionCard";
import DownloadHub from "@/components/ds/DownloadHub";
import DataTable from "@/components/ds/DataTable";
import AnalysisFilterField from "@/components/ds/AnalysisFilterField";
import IsoDateInput from "@/components/ds/IsoDateInput";
import { useAppStore } from "@/store/useDataStore";
import { useReportAnalysis } from "@/lib/attributionReports/useReportAnalysis";
import { useReportViewState } from "@/lib/attributionReports/useReportViewState";
import { WEEKLY_MOVEMENT_FIELDS } from "@/lib/attributionReports/fields";
import { fmtNum as formatNumber, fmtPct as formatRatio } from "@/utils/format";
import { csvBody, downloadCsv } from "@/utils/download";
import CannibalViews from "./attribution/CannibalViews";
import { MovementFigure, CampaignMovementFigure } from "./attribution/ReportFigures";
const TOOL_ID = "5-18-cannibal-detail";
const num = value => formatNumber(value);
const fmtPct = value => formatRatio(value);
const hasTime = csv => { const keys = new Set(Object.values(csv?.mapping || {})); return keys.has("date") || keys.has("iso_year") && keys.has("iso_week"); };
export default function CannibalDetail({ locale = "ko" }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const csv = useAppStore(s => s.csvData), analyzed = useAppStore(s => s.isGroupAnalyzed(TOOL_ID));
  const [filters, setFilters] = useReportViewState("cannibal:filters", csv?.raw, () => ({ country: "", platform: "", outcomeType: "", minWeeks: 4, channelMinShare: 0.1, missingAsZero: false, cutoffDate: new Date().toISOString().slice(0, 10) }));
  const [kind, setKind] = useState(""), [selectedId, setSelectedId] = useState(""), [channel, setChannel] = useState(""), [campaign, setCampaign] = useState("");
  const [revision, setRevision] = useState(0);
  const cutoffId = useId();
  const [curation, setCuration] = useReportViewState("cannibal:curation", csv?.raw, { raw: null, excluded: [] });
  const { metadata, result: r, loading, error } = useReportAnalysis("cannibal", csv, analyzed, filters, undefined, revision);
  const excluded = curation.raw === csv?.raw ? curation.excluded : [];
  const stretches = (r?.stretches || []).filter(s => (!kind || s.kind === kind) && !excluded.includes(s.id)).map((s, n) => ({ ...s, displayNumber: n + 1 }));
  const selected = stretches.find(s => s.id === selectedId) || stretches[0];
  const rows = (selected?.campaigns || []).filter(row => !channel || row.channel === channel);
  const chosenCampaign = rows.find(row => row.name === campaign), mix = chosenCampaign ? selected.campaignMix[chosenCampaign.name] : channel && selected?.channelMix[channel] ? selected.channelMix[channel] : selected?.mix || [];
  const change = (key, value) => { setFilters(old => ({ ...old, [key]: value })); setSelectedId(""); setChannel(""); setCampaign(""); };
  const choose = id => { setSelectedId(id); setChannel(""); setCampaign(""); };
  const remove = id => { setCuration({ raw: csv.raw, excluded: [...excluded, id] }); setSelectedId(""); setChannel(""); setCampaign(""); };
  const move = value => value == null ? tr("미확인", "Unknown") : `${value > 0 ? "+" : ""}${num(value)}`;
  const kindLabel = value => value === "sign" ? tr("부호 반대", "Opposite signs") : tr("기준 대비 반대", "Opposite to baseline");
  const scopeControls = analyzed && <section className="block">
      <h2 className="section-title">{tr("같은 성과 정의로 비교할 범위", "Scope with a consistent outcome definition")}</h2>
      <div className="report-filters report-filters--primary">
        <AnalysisFilterField label={tr("국가", "Country")} value={filters.country} onChange={e => change("country", e.target.value)}><option value="">{tr("전체 · 국가별 분리", "All · separate countries")}</option>{metadata?.countries.map(value => <option key={value}>{value}</option>)}</AnalysisFilterField>
        <AnalysisFilterField label="OS" value={filters.platform} onChange={e => change("platform", e.target.value)}><option value="">{tr("전체 · OS별 분리", "All · separate OS")}</option>{metadata?.platforms.map(value => <option key={value}>{value}</option>)}</AnalysisFilterField>
        <AnalysisFilterField label={tr("기준 연도", "Selected year")} value={filters.year || metadata?.years.at(-1) || ""} onChange={e => change("year", Number(e.target.value))}>{metadata?.years.map(value => <option key={value}>{value}</option>)}</AnalysisFilterField>
        <AnalysisFilterField label={tr("성과 종류", "Outcome type")} value={filters.outcomeType} onChange={e => change("outcomeType", e.target.value)}><option value="">{tr("전체 종류 합산", "Sum all types")}</option>{metadata?.outcomeTypes.map(value => <option key={value}>{value}</option>)}</AnalysisFilterField>
      </div>
      <div className="report-filters report-filters--period">
        <AnalysisFilterField label={tr("최소 연속 주", "Minimum consecutive weeks")}><input type="number" min="4" max="52" value={filters.minWeeks} onChange={e => change("minWeeks", Math.max(4, Math.min(52, Number(e.target.value) || 4)))} /></AnalysisFilterField>
        <AnalysisFilterField label={tr("채널 최소 몫(%)", "Minimum channel share (%)")}><input type="number" min="0" max="100" value={filters.channelMinShare * 100} onChange={e => change("channelMinShare", Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100)} /></AnalysisFilterField>
        <div className="mon-filter-item"><label className="mon-filter-label" htmlFor={cutoffId}>{tr("관측 종료일", "Observation end date")}</label><IsoDateInput id={cutoffId} value={filters.cutoffDate} onChange={e => change("cutoffDate", e.target.value)} locale={locale} aria-label={tr("완료 주차의 관측 종료일", "Observation cutoff for complete weeks")} /></div>
      </div>
      <label className="report-checkbox"><input type="checkbox" checked={filters.missingAsZero} onChange={e => change("missingAsZero", e.target.checked)} />{tr("모든 채널·캠페인이 포함된 파일이며 미기록 단위는 0으로 읽습니다", "The export includes every channel/campaign; interpret absent entities as zero")}</label>
      <p className="muted">{tr("주 자체의 누락은 항상 비교에서 제외합니다. Organic을 포함하고 가입·재활성 등 합산한 성과 종류를 확인하세요. 종료일까지 완료된 주만 비교합니다.", "Missing weeks are always excluded. Include Organic and check which outcome types, such as registration and reactivation, are summed. Only weeks completed by the cutoff are compared.")}</p>
    </section>;
  const workbook = () => ({
    scope: { currentYear: r.year, previousYear: r.year == null ? null : r.year - 1, countries: filters.country ? [filters.country] : metadata.countries, platforms: filters.platform ? [filters.platform] : metadata.platforms, outcomeType: filters.outcomeType || metadata.outcomeTypes.join(", "), cutoffDate: filters.cutoffDate, minWeeks: filters.minWeeks, missingAsZero: filters.missingAsZero, excludedStretches: excluded },
    calculationMode: "hybrid_engine_output",
    calculationTables: [
      { name: "WEEKLY", rows: [["country", "platform", "year", "iso_week", "paid", "organic", "previous_paid", "previous_organic", "paid_delta", "organic_delta"], ...r.segments.flatMap(segment => segment.points.map(p => [segment.country, segment.platform, r.year, p.week, p.paid, p.organic, p.paidPrevious, p.organicPrevious, p.paidDelta, p.organicDelta]))] },
      { name: "STRETCHES", rows: [["country", "platform", "kind", "week_start", "week_end", "paid_move", "organic_move", "paid_baseline", "organic_baseline", "removed"], ...r.stretches.map(s => [s.country, s.platform, s.kind, s.start, s.end, s.paidMove, s.organicMove, s.paidBase, s.organicBase, excluded.includes(s.id)])] },
      { name: "CHANNELS", rows: [["stretch", "channel", "move", "paid_move", "share", "co_moving_weeks"], ...stretches.flatMap(s => s.channels.map(row => [`#${s.displayNumber} ${s.country} ${s.platform}`, row.name, row.move ?? "unknown", s.paidMove, row.share ?? "unknown", row.coMovingWeeks]))] },
      { name: "CAMPAIGNS", rows: [["stretch", "channel", "campaign", "move", "paid_move", "share", "co_moving_weeks"], ...stretches.flatMap(s => s.campaigns.map(row => [`#${s.displayNumber} ${s.country} ${s.platform}`, row.channel, row.campaign, row.move ?? "unknown", s.paidMove, row.share ?? "unknown", row.coMovingWeeks]))] },
      { name: "MIX", rows: [["scope", "axis", "overlap", "group", "paid_move_share", "organic_move_share"], ...stretches.flatMap(s => [["Paid", s.mix], ...Object.entries(s.channelMix), ...Object.entries(s.campaignMix)].flatMap(([scope, axes]) => axes.flatMap(axis => axis.groups.length ? axis.groups.map(g => [s.id + " " + scope, axis.axis, axis.overlap ?? "unknown", g.name, g.paidShare, g.organicShare]) : [[s.id + " " + scope, axis.axis, "unknown", axis.reason || "", "", ""]]))) ] },
      { name: "SCOPE", rows: [["setting", "value"], ...Object.entries(filters), ["kind_filter", kind], ["selected_channel", channel], ["selected_campaign", chosenCampaign?.campaign || ""], ["invalid_rows", metadata.invalidRows], ["excluded_weeks", r.excludedWeeks]] },
    ],
    method: { name: "Descriptive ISO-week YoY stretch scan", version: "cannibal-detail-v1", limitations: [tr("기간·채널·캠페인의 다중 탐색이며 잠식 인과효과를 추정하지 않습니다.", "A descriptive scan over stretches, channels and campaigns; it does not estimate causal displacement."), tr("추세 구간은 시작 전 8주 중앙값을 고정해 같은 표·그림 기준으로 사용합니다.", "Trend stretches use a fixed preceding-eight-week median for both tables and figures.")] },
  });
  const plotted = selected?.points.map(p => ({ ...p, paidDelta: p.paidDelta - selected.paidBase, organicDelta: p.organicDelta - selected.organicBase })) || [];
  return <ToolPageShell titleToolId={TOOL_ID} locale={locale} title={tr("잠식 상세", "Cannibalization detail")} className="report-workspace tool-autonomy" stickyHeader={false}
    stickyFilter={<><p className="report-deck">{tr("전년 같은 ISO 주차에서 Paid·Organic이 반대로 움직인 구간을 찾고, 채널·캠페인·고객 구성을 비교합니다.", "Find opposite Paid/Organic moves in matching ISO weeks, then compare channels, campaigns and audience composition.")}</p>
      <CannibalViews detail locale={locale} />
      <ReportCsvInput toolId={TOOL_ID} fields={WEEKLY_MOVEMENT_FIELDS} locale={locale} validate={hasTime} onAnalyze={() => setRevision(n => n + 1)} />
    </>}
    toc={r ? [{ id: "report-stretches", title: tr("반대 움직임 구간", "Opposite-movement stretches") }, ...(selected ? [{ id: "report-moves", title: tr("채널·캠페인 변화", "Channel & campaign moves") }, { id: "report-audience", title: tr("고객 구성", "Audience mix") }] : [])] : []}>
    {loading && <p role="status">{tr("주간 구간과 캠페인을 집계하는 중…", "Aggregating stretches and campaigns…")}</p>}
    {error && <p role="alert">{tr("입력을 확인하세요.", "Check the input.")} {error}</p>}
    {analyzed && <div className="report-results">
      {r && <ResultActionCard toolId={TOOL_ID} locale={locale} headline={!r.comparedWeeks ? tr("전년과 올해의 비교 가능한 Paid·Organic 주차가 없습니다", "No comparable Paid/Organic weeks across both years") : stretches.length ? tr(`반대 움직임 구간 ${num(stretches.length)}개에서 채널·캠페인을 확인하세요`, `Inspect channels and campaigns in ${num(stretches.length)} opposite-movement stretches`) : tr("현재 설정에서 연속 반대 움직임 구간이 확인되지 않았습니다", "No consecutive opposite-movement stretch identified under these settings")}
        stats={[{ label: tr("비교한 국가·OS 주차", "Compared country/OS weeks"), value: num(r.comparedWeeks) }, { label: tr("비교 제외 주차", "Excluded weeks"), value: num(r.excludedWeeks) }, { label: tr("직접 제외한 구간", "Manually excluded stretches"), value: num(excluded.length) }]}
        points={[{ text: tr("Paid는 Organic 외 모든 채널입니다. 원인 확정 없이 움직임과 고객 구성의 일치를 비교합니다.", "Paid includes every non-Organic channel. Compare moves and demographic alignment without a causal verdict.") }, { text: tr(`숫자·주차 오류 ${num(metadata.invalidRows)}행, 여성 건수 오류 ${num(metadata.invalidFemaleRows)}행, 연령 건수 오류 ${num(metadata.invalidAgeRows)}행. 부호 반대와 기준 대비 반대 구간은 겹칠 수 있습니다.`, `${num(metadata.invalidRows)} invalid count/week rows; ${num(metadata.invalidFemaleRows)} invalid female-count rows; ${num(metadata.invalidAgeRows)} invalid age-count rows. Sign and baseline stretches may overlap.`) }]}
        decisionReview={false} analysisKey={JSON.stringify({ filters, excluded, kind })} workbookExport={workbook}
        download={<DownloadHub toolId={TOOL_ID} locale={locale} label={tr("결과 받기", "Download results")} items={[{ label: tr("구간 CSV", "Stretch CSV"), analyticsType: "csv", onSelect: () => downloadCsv(csvBody(["country", "platform", "kind", "start_week", "end_week", "paid_move", "organic_move"], stretches.map(s => [s.country, s.platform, s.kind, s.start, s.end, s.paidMove, s.organicMove])), "cannibal_detail_stretches") }]} />} />}
      {scopeControls}
      {r && <section className="block report-panel" id="report-stretches">
        <h2 className="section-title">{tr("반대 움직임 구간", "Opposite-movement stretches")}</h2>
        <AnalysisFilterField label={tr("구간 기준", "Stretch criterion")} value={kind} onChange={e => { setKind(e.target.value); choose(""); }}><option value="">{tr("두 기준 모두", "Both criteria")}</option><option value="sign">{kindLabel("sign")}</option><option value="trend">{kindLabel("trend")}</option></AnalysisFilterField>
        <DataTable ariaLabel={tr("탐지 구간", "Detected stretches")} rows={stretches} rowKey={s => s.id} emptyText={tr("비교 주차·연속 길이·Organic 포함 여부를 확인하세요.", "Check comparable weeks, stretch length and Organic coverage.")} columns={[{ key: "displayNumber", label: tr("구간", "Stretch"), fmt: (_, s) => <button className="report-row-button" onClick={() => choose(s.id)}>#{s.displayNumber} · {s.country} · {s.platform} · W{s.start}–{s.end}</button> }, { key: "kind", label: tr("기준", "Criterion"), fmt: kindLabel }, { key: "paidMove", label: tr("Paid 변화", "Paid move"), align: "right", fmt: move }, { key: "organicMove", label: tr("Organic 변화", "Organic move"), align: "right", fmt: move }, { key: "id", label: tr("선별", "Curate"), fmt: id => <button className="btn ghost" onClick={() => remove(id)}>{tr("구간 제외", "Exclude stretch")}</button> }]} />
        {excluded.length > 0 && <button className="btn ghost" onClick={() => setCuration({ raw: csv.raw, excluded: [] })}>{tr("직접 제외한 구간 모두 복원", "Restore manually excluded stretches")}</button>}
      </section>}
      {r && selected && <>
        <section className="block report-panel" id="report-moves">
          <h2 className="section-title">#{selected.displayNumber} · {selected.country} · {selected.platform} · {r.year - 1} → {r.year} · W{selected.start}–{selected.end}</h2>
          <MovementFigure points={plotted} title={tr("주별 변화 · 선택 구간의 같은 기준", "Weekly moves · same selected-stretch baseline")} locale={locale} context={{ source: { importSource: csv.importSource }, scope: { caption: `${selected.country} · ${selected.platform} · ${r.year - 1} → ${r.year} · W${selected.start}–${selected.end} · ${kindLabel(selected.kind)}` } }} />
          <p>{selected.kind === "trend" ? tr(`직전 8주 중앙값(Paid ${move(selected.paidBase)}, Organic ${move(selected.organicBase)})을 뺀 변화입니다. 표와 그림이 같은 기준을 사용합니다.`, `Changes subtract the preceding-eight-week medians (Paid ${move(selected.paidBase)}, Organic ${move(selected.organicBase)}). Tables and figure share this baseline.`) : tr("전년 동주차 대비 건수 변화입니다. 반대 방향의 크기와 지속 기간을 확인하세요.", "Count changes against the same ISO week last year. Inspect opposite movement magnitude and duration.")}</p>
          <h3 className="report-subheading">{tr("채널별 움직임", "Channel moves")}</h3>
          <DataTable emptyText={tr("데이터 없음", "No data")} ariaLabel={tr("채널 변화량", "Channel moves")} rows={selected.channels} rowKey={row => row.name} columns={[{ key: "name", label: tr("채널", "Channel"), fmt: name => <button className="report-row-button" onClick={() => { setChannel(name); setCampaign(""); }}>{name}</button> }, { key: "move", label: tr("변화량", "Move"), align: "right", fmt: move }, { key: "share", label: tr("Paid 변화의 몫", "Share of Paid move"), align: "right", fmt: fmtPct }, { key: "coMovingWeeks", label: tr("동행 주", "Co-moving weeks"), align: "right", fmt: num }]} />
          <p className="muted">{tr("동행 주는 채널이 Paid 전체 방향, Organic 반대 방향으로 움직인 주입니다. 미기록 단위의 변화량은 설정이 없으면 미확인입니다. 다른 단위의 반대 움직임 때문에 몫이 100%를 넘을 수 있습니다.", "Co-moving weeks put the channel in Paid’s direction and opposite to Organic. Absent entities remain unknown unless zero interpretation is selected. Shares can exceed 100% when other entities move the other way.")}</p>
          <h3 className="report-subheading">{tr("캠페인별 움직임", "Campaign moves")}{channel ? ` · ${channel}` : ""}</h3>
          <CampaignMovementFigure campaigns={rows} points={plotted} locale={locale} context={{ source: { importSource: csv.importSource }, scope: { caption: `${selected.country} · ${selected.platform} · ${r.year - 1} → ${r.year} · W${selected.start}–${selected.end} · ${kindLabel(selected.kind)} · ${channel || tr("전체 채널", "All channels")}` } }} />
          <p className="muted">{tr("상위 5개 캠페인의 변화량만 쌓은 그림입니다. 전체 Paid 합계와 다를 수 있으며 미확인 캠페인은 그림에 넣지 않습니다. 전체 목록은 아래 표에 있습니다.", "The bars stack only the top five campaign moves, so they may differ from total Paid. Unknown campaign moves are omitted from the figure and retained in the table.")}</p>
          {channel && <button className="btn ghost" onClick={() => { setChannel(""); setCampaign(""); }}>{tr("모든 채널 보기", "Show all channels")}</button>}
          <DataTable emptyText={tr("데이터 없음", "No data")} ariaLabel={tr("캠페인 변화량", "Campaign moves")} rows={rows} rowKey={row => row.name} columns={[{ key: "channel", label: tr("채널", "Channel") }, { key: "campaign", label: tr("캠페인", "Campaign"), fmt: (name, row) => <button className="report-row-button" onClick={() => setCampaign(row.name)}>{name}</button> }, { key: "move", label: tr("변화량", "Move"), align: "right", fmt: move }, { key: "share", label: tr("Paid 변화의 몫", "Share of Paid move"), align: "right", fmt: fmtPct }, { key: "coMovingWeeks", label: tr("동행 주", "Co-moving weeks"), align: "right", fmt: num }]} />
        </section>
        <section className="block report-panel" id="report-audience">
          <h2 className="section-title">{tr("변화한 고객 구성", "Audience composition of the move")} · {chosenCampaign ? chosenCampaign.campaign : channel || "Paid"}</h2>
          <p>{tr("같은 방향으로 움직인 그룹의 변화량 비중을 Organic과 비교합니다. 겹침은 작은 비중의 합이며 잠식 판정 임계값이 없습니다.", "Compare same-direction group-change shares with Organic. Overlap sums the smaller shares and has no causal pass/fail threshold.")}</p>
          {mix.map(axis => <div key={axis.axis} className="report-mix-section"><h3>{axis.axis === "gender" ? tr("성별", "Gender") : tr("연령", "Age")} · {axis.overlap == null ? (axis.reason === "no_same_direction_move" ? tr("비교 불가 · 같은 방향의 변화량이 없습니다", "Unavailable · no same-direction move") : tr("비교 불가 · 구성이 없거나 불완전합니다", "Unavailable · missing or incomplete composition")) : `${tr("겹침", "Overlap")} ${fmtPct(axis.overlap)}`}</h3>
            <DataTable ariaLabel={axis.axis === "gender" ? tr("성별 변화 구성", "Gender change mix") : tr("연령 변화 구성", "Age change mix")} columns={[{ key: "name", label: tr("고객 그룹", "Audience group") }, { key: "organicShare", label: tr("Organic 변화 비중", "Organic move share"), align: "right", fmt: value => fmtPct(value) }, { key: "paidShare", label: tr("대상 변화 비중", "Selected move share"), align: "right", fmt: value => fmtPct(value) }]} rows={axis.groups} rowKey={row => row.name} emptyText={tr("추정 불가", "Not estimable")} />
          </div>)}
        </section>
      </>}
    </div>}
  </ToolPageShell>;
}
