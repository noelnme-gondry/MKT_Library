"use client";
import React, { useId, useMemo, useState } from "react";
import ToolPageShell from "@/components/ToolPageShell";
import ReportCsvInput from "@/components/data-import/ReportCsvInput";
import ResultActionCard from "@/components/ds/ResultActionCard";
import DataTable from "@/components/ds/DataTable";
import DownloadHub from "@/components/ds/DownloadHub";
import AnalysisFilterField from "@/components/ds/AnalysisFilterField";
import IsoDateInput from "@/components/ds/IsoDateInput";
import PillGroup from "@/components/ds/PillGroup";
import InfoPopover from "@/components/ds/InfoPopover";
import { useAppStore } from "@/store/useDataStore";
import { MULTITOUCH_FIELDS, multitouchCapabilities } from "@/lib/attributionReports/fields";
import { useReportAnalysis } from "@/lib/attributionReports/useReportAnalysis";
import { useReportViewState } from "@/lib/attributionReports/useReportViewState";
import { TOUCH_GAP_BUCKETS } from "@/utils/multitouchMath";
import { fmtNum as formatNumber, fmtPct } from "@/utils/format";
import { dateBoundProblem } from "@/lib/analysisPeriod";
import "./attribution/reports.css";
import { csvBody, downloadCsv } from "@/utils/download";
import { TouchFlowFigure } from "./attribution/ReportFigures";
const TOOL_ID = "5-30";
const fmtNum = (value, digits = 0) => formatNumber(value, typeof digits === "number" ? digits : 0);
const GAP_LABELS = { ko: ["순서 뒤바뀜", "5분 이내", "5–30분", "30분–1시간", "1–6시간", "6–12시간", "12–24시간", "1–3일", "3일 초과"], en: ["Reversed", "Within 5m", "5–30m", "30m–1h", "1–6h", "6–12h", "12–24h", "1–3d", "Over 3d"] };
export default function MultitouchMap({ locale = "ko" }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const csv = useAppStore(s => s.csvData), analyzed = useAppStore(s => s.isGroupAnalyzed(TOOL_ID));
  const [filters, setFilters] = useReportViewState("multitouch:filters", csv?.raw, { country: "", platform: "", start: "", end: "", excludeProbabilistic: false, splitPlacement: false, focus: "", campaignFocus: "", utcOffsetMinutes: 0 });
  const [search, setSearch] = useState(""), [minInstalls, setMinInstalls] = useState(0), [limit, setLimit] = useState(100);
  const [revision, setRevision] = useState(0);
  const startId = useId(), endId = useId(), utcOffsetId = useId();
  const [view, setView] = useState("media"), [gapPhase, setGapPhase] = useState("last-attributed"), [gapPair, setGapPair] = useState("All");
  const config = useMemo(() => ({ utcOffsetMinutes: filters.utcOffsetMinutes }), [filters.utcOffsetMinutes]);
  const capabilities = useMemo(() => multitouchCapabilities(csv?.mapping), [csv?.mapping]);
  const options = useMemo(() => ({ ...filters, excludeProbabilistic: capabilities.hasMatchType && filters.excludeProbabilistic, splitPlacement: capabilities.hasPlacement && filters.splitPlacement }), [filters, capabilities]);
  const validDates = !filters.start || !filters.end || filters.start <= filters.end;
  const { metadata, result, loading, error } = useReportAnalysis("multitouch", csv, analyzed && validDates, options, config, revision);
  const boundsInvalid = Boolean(metadata && ((filters.start && dateBoundProblem(filters.start, metadata)) || (filters.end && dateBoundProblem(filters.end, metadata))));
  const r = boundsInvalid ? null : result;
  const startMax = filters.end && !dateBoundProblem(filters.end, metadata) ? filters.end : metadata?.maxDate;
  const endMin = filters.start && !dateBoundProblem(filters.start, metadata) ? filters.start : metadata?.minDate;
  const change = (key, value) => setFilters(old => ({ ...old, [key]: value, focus: "", campaignFocus: "" }));
  const mediaFocus = name => { setFilters(old => ({ ...old, focus: name, campaignFocus: "" })); setView("overlap"); };
  const pct = value => value == null ? tr("비교 불가", "Unavailable") : fmtPct(value);
  const formatTime = value => value == null ? tr("계산 불가", "Unavailable") : value < 3600000 ? `${fmtNum(value / 60000, 1)} ${tr("분", "min")}` : `${fmtNum(value / 3600000, 1)} ${tr("시간", "h")}`;
  const campaigns = (r?.campaignRows || []).filter(row => row.installs >= minInstalls && (!search || `${row.media} ${row.campaign}`.toLowerCase().includes(search.trim().toLowerCase())));
  const cols = [
    { key: "installs", label: tr("설치", "Installs"), align: "right", fmt: fmtNum },
    { key: "rateIncluded", label: tr("포함 비율", "Including prob."), align: "right", fmt: value => <span className="report-rate"><strong>{pct(value)}</strong>{value != null && <span aria-hidden="true"><i style={{ width: `${value * 100}%` }} /></span>}</span> },
    { key: "rateExcluded", label: tr("제외 비율", "Excluding prob."), align: "right", fmt: value => <span className="report-rate report-rate--excluded"><strong>{pct(value)}</strong>{value != null && <span aria-hidden="true"><i style={{ width: `${value * 100}%` }} /></span>}</span> },
  ];
  const scopedHeatMedia = [...new Set((r?.heat || []).map(row => row.media))], heatChannels = [...new Set((r?.heat || []).map(row => row.channel))].sort();
  const heatRows = scopedHeatMedia.map(media => ({ media, ...Object.fromEntries(heatChannels.map((channel, n) => [`c${n}`, r.heat.find(row => row.media === media && row.channel === channel)])) }));
  const phaseLabels = { "first-second": tr("첫 접촉 → 둘째", "First → second"), "second-third": tr("둘째 → 셋째", "Second → third"), "last-attributed": tr("마지막 기여 → 귀속", "Last contributor → attributed"), "attributed-install": tr("귀속 → 설치", "Attributed → install") };
  const phaseGaps = (r?.gaps || []).filter(row => row.phase === gapPhase);
  const selectedGap = phaseGaps.find(row => row.name === gapPair) || phaseGaps.find(row => row.name === "All");
  const gapRows = selectedGap ? TOUCH_GAP_BUCKETS.map((key, n) => ({ key, label: GAP_LABELS[locale][n], count: selectedGap.counts[n], share: selectedGap.shares[n] })) : [];
  const scopeControls = analyzed && <section className="block report-scope" aria-label={tr("분석 범위", "Analysis scope")}>
        <h2 className="section-title">{tr("분석 조건", "Analysis conditions")}</h2>
        <div className="report-filters report-filters--primary">
          <AnalysisFilterField label={tr("국가", "Country")} value={filters.country} onChange={e => change("country", e.target.value)}><option value="">{tr("전체", "All")}</option>{metadata?.countries.map(value => <option key={value}>{value}</option>)}</AnalysisFilterField>
          <AnalysisFilterField label="OS" value={filters.platform} onChange={e => change("platform", e.target.value)}><option value="">{tr("전체", "All")}</option>{metadata?.platforms.map(value => <option key={value}>{value}</option>)}</AnalysisFilterField>
          <AnalysisFilterField label="Probabilistic" value={String(options.excludeProbabilistic)} onChange={e => change("excludeProbabilistic", e.target.value === "true")}><option value="false">{tr("포함", "Include")}</option><option value="true" disabled={!capabilities.hasMatchType}>{tr("제외 · 매칭 미기록도 제외", "Exclude · unlabelled also excluded")}</option></AnalysisFilterField>
          {metadata?.hasPlacement && <AnalysisFilterField label={tr("Meta·TikTok 지면", "Meta/TikTok placement")} value={String(filters.splitPlacement)} onChange={e => change("splitPlacement", e.target.value === "true")}><option value="false">{tr("합침", "Merged")}</option><option value="true">{tr("나눔", "Split")}</option></AnalysisFilterField>}
        </div>
        <div className="report-filters report-filters--period">
          <div className="mon-filter-item"><label className="mon-filter-label" htmlFor={startId}>{tr("시작일", "Start date")}</label><IsoDateInput id={startId} value={filters.start || metadata?.minDate || ""} min={metadata?.minDate} max={startMax} disabled={!metadata?.minDate} allowEmpty onChange={e => change("start", e.target.value)} locale={locale} aria-label={tr("설치 시작일", "Install start date")} /></div>
          <div className="mon-filter-item"><label className="mon-filter-label" htmlFor={endId}>{tr("종료일", "End date")}</label><IsoDateInput id={endId} value={filters.end || metadata?.maxDate || ""} min={endMin} max={metadata?.maxDate} disabled={!metadata?.maxDate} allowEmpty onChange={e => change("end", e.target.value)} locale={locale} aria-label={tr("설치 종료일", "Install end date")} /></div>
          <div className="mon-filter-item"><div className="mon-filter-label"><label htmlFor={utcOffsetId}>{tr("원본 시각 UTC 오프셋(분)", "Source UTC offset (minutes)")}</label><InfoPopover label={tr("원본 시각의 시간대", "Source timestamp time zone")}><p>{tr("시간대가 없는 원본 시각에 적용합니다. 0=UTC, 540=한국 시간. 원본에 Z/오프셋이 있으면 그대로 사용합니다.", "Applies to timestamps without a time zone: 0 = UTC, 540 = Korea. Explicit Z or timestamp offsets are retained.")}</p></InfoPopover></div><input id={utcOffsetId} type="number" min="-720" max="840" step="15" value={filters.utcOffsetMinutes} onChange={e => change("utcOffsetMinutes", Math.max(-720, Math.min(840, Number(e.target.value) || 0)))} /></div>
        </div>
        {!validDates && <p role="alert">{tr("종료일은 시작일 이후여야 합니다.", "End date must be on or after start date.")}</p>}
        {boundsInvalid && <p role="alert">{tr(`CSV의 분석 가능한 설치 기간 안에서 선택하세요: ${metadata.minDate} ~ ${metadata.maxDate}.`, `Choose dates within the CSV's usable installation period: ${metadata.minDate} – ${metadata.maxDate}.`)}</p>}
      </section>;
  const workbook = () => ({
    scope: { dateStart: r.dateStart, dateEnd: r.dateEnd, countries: filters.country ? [filters.country] : metadata.countries, platforms: filters.platform ? [filters.platform] : metadata.platforms, focusMedia: filters.focus, focusCampaign: filters.campaignFocus, probabilistic: options.excludeProbabilistic ? "excluded_with_unlabelled" : "included", sourceUtcOffsetMinutes: filters.utcOffsetMinutes },
    calculationMode: "hybrid_engine_output",
    calculationTables: [
      { name: "MEDIA", rows: [["media", "installs", "assisted_included", "assisted_excluded_known", "included_ratio", "excluded_known_ratio"], ...r.mediaRows.map((row, i) => [row.name, row.installs, row.withAssist, metadata.hasMatchType ? row.withAssistExcluded : "", { formula: `=C${i + 2}/B${i + 2}` }, metadata.hasMatchType ? { formula: `=D${i + 2}/B${i + 2}` } : "unavailable"])] },
      { name: "CAMPAIGNS", rows: [["media", "campaign", "installs", "assist_included", "assist_excluded_known"], ...r.campaignRows.map(row => [row.media, row.campaign, row.installs, row.withAssist, metadata.hasMatchType ? row.withAssistExcluded : "unavailable"])] },
      { name: "OVERLAP", rows: [["install_media", "contributor", "installs", "ratio"], ...r.heat.map(row => [row.media, row.channel, row.installs, row.share])] },
      { name: "ASSIST_CAMPAIGNS", rows: [["channel", "campaign", "installs"], ...r.assistCampaigns.map(row => [row.channel, row.campaign, row.installs])] },
      { name: "PATHS", rows: [["observed_path", "installs"], ...r.paths.map(row => [[...row.touches, row.media].join(" → "), row.installs])] },
      { name: "CTIT", rows: [["media_or_campaign", "installs", "valid_timestamp_pairs", "excluded_pairs", "median_ms", "within5m", "within1h", "within24h", "within3d"], ...r.ctit.map(row => [row.name, row.installs, row.valid, row.invalid, row.median ?? "", row.within5m ?? "", row.within1h ?? "", row.within24h ?? "", row.within3d ?? ""])] },
      { name: "GAPS", rows: [["phase", "pair", "valid_pairs", ...TOUCH_GAP_BUCKETS], ...r.gaps.map(row => [row.phase, row.name, row.valid, ...row.counts])] },
      { name: "SCOPE", rows: [["setting", "value"], ...Object.entries(options), ["duplicates_dropped", metadata.duplicates], ["invalid_rows", metadata.invalidRows], ["unknown_match_clicks", r.unknownMatches], ["unordered_multitouch_installs", r.unorderedInstalls], ["observed_contributor_slots", metadata.contributorSlots.join(",")]] },
    ],
    method: { name: "Observed click-contributor overlap", version: "multitouch-v1", limitations: [tr("최대 3개 contributor의 관측 경로이며 인과 기여율이 아닙니다.", "Up to three recorded contributors; not complete journeys or causal credit."), tr("CTIT 분모는 유효한 귀속 클릭→설치 시각 쌍입니다.", "CTIT denominators contain valid attributed-click/install timestamp pairs.")] },
  });
  return <ToolPageShell titleToolId={TOOL_ID} locale={locale} title={tr("멀티터치 맵", "Multi-touch map")} className="report-workspace tool-autonomy" stickyHeader={false}
    stickyFilter={<>
      <p className="report-deck">{tr("귀속 매체마다 함께 기록된 클릭 접촉을 비교하고, 경로와 설치까지 걸린 시간을 확인합니다.", "Compare recorded click contacts across install sources, then inspect their paths and time to install.")}</p>
      <ReportCsvInput toolId={TOOL_ID} fields={MULTITOUCH_FIELDS} locale={locale} onAnalyze={() => setRevision(n => n + 1)} />

    </>}>
    {loading && <p role="status">{tr("설치와 접촉을 집계하는 중…", "Aggregating installations and touches…")}</p>}
    {error && <p role="alert">{tr("분석하지 못했습니다. 입력을 확인하세요.", "Analysis failed. Check the input.")} {error}</p>}
    {analyzed && <div className="report-results">
      {r && <ResultActionCard toolId={TOOL_ID} locale={locale}
        headline={r.total ? tr(`추가 클릭 접촉이 기록된 설치 ${fmtNum(r.withAssist)}건`, `${fmtNum(r.withAssist)} installs with recorded contributing clicks`) : tr("선택한 범위에 유효한 클릭 귀속 설치가 없습니다", "No valid click-attributed installs in this scope")}
        stats={[
          { label: tr("관측 멀티터치 비율", "Observed multi-touch rate"), value: pct(r.rate), emphasis: "primary", detail: tr("현재 probabilistic 조건", "Current probabilistic setting") },
          { label: tr("클릭 귀속 설치", "Click-attributed installs"), value: fmtNum(r.total), detail: tr("선택한 국가·OS·기간", "Selected country, OS and dates") },
          { label: tr("추가 접촉 미기록", "No contributor recorded"), value: fmtNum(r.total - r.withAssist), detail: tr("실제 접촉이 없다는 뜻은 아닙니다", "Does not establish absence of contacts") },
        ]}
        points={[{ text: tr("최대 3개 contributor의 관측 기록입니다. 누락·매체 제한이 있을 수 있으며 인과 기여율이나 낭비의 판정이 아닙니다.", "Up to three recorded contributors. Missing or restricted data may hide contacts; this is not causal credit or a waste verdict.") }]}
        analysisBasis={false} controls={<InfoPopover className="report-data-check" glyph={tr("데이터 점검", "Data checks")} label={tr("원본 데이터 점검", "Source data checks")}><p>{tr(`파일 전체 중복 ${fmtNum(metadata.duplicates)}건 제거. ID·설치 시각 오류 ${fmtNum(metadata.invalidRows)}행, 클릭 외 귀속 ${fmtNum(metadata.nonClickInstalls)}건 제외. 관측 contributor 슬롯: ${metadata.contributorSlots.join(", ")}.`, `${fmtNum(metadata.duplicates)} file-wide duplicates removed; ${fmtNum(metadata.invalidRows)} invalid ID/timestamp rows and ${fmtNum(metadata.nonClickInstalls)} non-click attributions excluded. Observed contributor slots: ${metadata.contributorSlots.join(", ")}.`)}</p>{!metadata.hasAppId && <p>{tr("앱 ID가 없어 단일 앱으로 처리했습니다. 여러 앱의 파일이면 앱 ID를 매핑하세요.", "No App ID is mapped; this is treated as a single-app file. Map App ID when combining apps.")}</p>}</InfoPopover>}
        decisionReview={false} analysisKey={JSON.stringify(options)} workbookExport={workbook}
        download={<DownloadHub toolId={TOOL_ID} locale={locale} label={tr("결과 받기", "Download results")} items={[{ label: tr("매체별 CSV", "Media CSV"), analyticsType: "csv", onSelect: () => downloadCsv(csvBody(["media", "installs", "assist_included", "assist_excluded_known"], r.mediaRows.map(row => [row.name, row.installs, row.withAssist, metadata.hasMatchType ? row.withAssistExcluded : "unavailable"])), "multitouch_media") }]} />} />}
      {scopeControls}
      {r && (r.unknownMatches > 0 || r.unknownTouchTypes > 0) && <p className="report-note" role="status">{tr(`매칭 미기록 클릭 ${fmtNum(r.unknownMatches)}개 · 접촉 유형 미기록 ${fmtNum(r.unknownTouchTypes)}개. 제외 비교는 매칭 방식이 기록된 접촉만 사용합니다.`, `${fmtNum(r.unknownMatches)} unlabelled click matches and ${fmtNum(r.unknownTouchTypes)} unknown touch types. Exclusion comparisons use labelled matches only.`)}</p>}
      <div className="report-navigation">
        <PillGroup ariaLabel={tr("멀티터치 분석 보기", "Multi-touch analysis view")} className="report-tabs" value={view} onChange={value => { setView(value); if (value === "media") setFilters(old => old.focus || old.campaignFocus ? { ...old, focus: "", campaignFocus: "" } : old); }} options={[
          { value: "media", label: tr("매체·캠페인", "Media & campaigns") },
          { value: "overlap", label: tr("채널 겹침", "Channel overlap") },
          { value: "paths", label: tr("접촉 경로", "Touch paths") },
          { value: "timing", label: tr("전환 시간", "Conversion timing") },
        ]} />
      </div>
      {r && view !== "media" && <div className="report-focus">
        <AnalysisFilterField label={tr("귀속 매체", "Attributed media")} value={filters.focus} onChange={e => setFilters(old => ({ ...old, focus: e.target.value, campaignFocus: "" }))}><option value="">{tr("전체 매체", "All media")}</option>{r.mediaRows.map(row => <option key={row.name}>{row.name}</option>)}</AnalysisFilterField>
        {filters.focus && <AnalysisFilterField label={tr("캠페인", "Campaign")} value={filters.campaignFocus} onChange={e => setFilters(old => ({ ...old, campaignFocus: e.target.value }))}><option value="">{tr("전체 캠페인", "All campaigns")}</option>{r.campaignRows.filter(row => row.media === filters.focus).map(row => <option key={row.name}>{row.campaign}</option>)}</AnalysisFilterField>}
        {filters.focus && <button className="btn ghost" onClick={() => setFilters(old => ({ ...old, focus: "", campaignFocus: "" }))}>{tr("대상 초기화", "Clear focus")}</button>}
      </div>}
      {r && view === "media" && <>
        <section className="block report-panel">
          <header className="report-section-head"><div><h2 className="section-title">{tr("매체별 접촉 기록 비교", "Compare recorded contacts by media")}</h2><p>{tr("비율의 분모는 각 매체의 전체 클릭 귀속 설치입니다. 매체를 선택하면 함께 기록된 채널을 볼 수 있습니다.", "Rates use all click-attributed installs for each media source. Select a source to inspect its recorded contributors.")}</p></div></header>
          <div className="report-comparison-key"><span><i />{tr("포함: 모든 클릭 contributor", "Including: all click contributors")}</span><span><i />{tr("제외: probabilistic·미기록 제외", "Excluding: no probabilistic or unlabelled matches")}</span></div>
          <DataTable className="report-media-table" emptyText={tr("데이터 없음", "No data")} ariaLabel={tr("매체별 멀티터치", "Multi-touch by media")} columns={[
            { key: "name", label: tr("귀속 매체", "Attributed media"), fmt: name => <button className="report-row-button" onClick={() => mediaFocus(name)}>{name}</button> },
            ...cols,
            { key: "topContributors", label: tr("주요 기여 채널", "Top contributors"), fmt: list => <span className="report-contributors">{list.length ? list.map(c => <span key={c.channel}>{c.channel}<small>{fmtNum(c.installs)}{tr("건", " installs")}</small></span>) : tr("기록 없음", "None recorded")}</span> },
          ]} rows={r.mediaRows} rowKey={row => row.name} />
          {metadata.hasPlacement && <p className="report-note">{tr("귀속 지면 구성: ", "Attributed placement mix: ")}{r.placements.map(p => `${p.media} / ${p.placement} ${fmtNum(p.installs)}`).join(" · ")}</p>}
        </section>
        <section className="block report-panel">
          <header className="report-section-head"><div><h2 className="section-title">{tr("캠페인별로 좁혀 보기", "Compare campaigns")}</h2><p>{tr("캠페인을 선택하면 해당 캠페인과 함께 기록된 채널·경로를 확인할 수 있습니다.", "Select a campaign to inspect its recorded contributing channels and paths.")}</p></div></header>
          <div className="report-filters report-filters--search">
            <AnalysisFilterField label={tr("캠페인 검색", "Campaign search")}><input type="search" value={search} placeholder={tr("매체 또는 캠페인 이름", "Media or campaign name")} onChange={e => { setSearch(e.target.value); setLimit(100); }} /></AnalysisFilterField>
            <AnalysisFilterField label={tr("최소 설치", "Minimum installs")}><input type="number" min="0" value={minInstalls} onChange={e => { setMinInstalls(Math.max(0, Number(e.target.value) || 0)); setLimit(100); }} /></AnalysisFilterField>
          </div>
          <DataTable ariaLabel={tr("캠페인별 멀티터치", "Multi-touch by campaign")} columns={[{ key: "media", label: tr("매체", "Media") }, { key: "campaign", label: tr("캠페인", "Campaign"), fmt: (name, row) => <button className="report-row-button" onClick={() => { setFilters(old => ({ ...old, focus: row.media, campaignFocus: name })); setView("overlap"); }}>{name}</button> }, ...cols]} rows={campaigns.slice(0, limit)} rowKey={row => row.name} emptyText={tr("조건에 맞는 캠페인이 없습니다.", "No campaigns match.")} />
          {campaigns.length > limit && <button className="btn ghost" onClick={() => setLimit(n => n + 100)}>{tr("캠페인 더 보기", "Show more campaigns")} ({fmtNum(campaigns.length - limit)})</button>}
        </section>
      </>}
      {r && view === "overlap" && <>
        <section className="block report-panel">
          <header className="report-section-head"><div><h2 className="section-title">{tr("어떤 채널의 클릭이 함께 기록됐나요?", "Which channels were recorded together?")}</h2><p>{tr("행은 설치 귀속 매체, 열은 기여 클릭 채널입니다. 비율의 분모는 해당 행·선택 캠페인의 전체 설치이며 여러 채널이 기록되면 행 합은 100%를 넘을 수 있습니다.", "Rows are install sources; columns are contributing click channels. Shares use all installs in the row and selected campaign. Multiple contributors can make row sums exceed 100%.")}</p></div></header>
          <DataTable ariaLabel={tr("설치 매체 × 기여 채널", "Install media × contributor channel")} className="report-heat-table" columns={[{ key: "media", label: tr("설치 매체", "Install media") }, ...heatChannels.map((channel, n) => ({ key: `c${n}`, label: channel, align: "right", fmt: value => value ? <span className="report-heat-cell" style={{ background: `color-mix(in srgb, var(--chart-primary) ${Math.round(value.share * 35)}%, var(--surface-container-lowest))` }}><strong>{pct(value.share)}</strong><small>{fmtNum(value.installs)}{tr("건", " installs")}</small></span> : "—" }))]} rows={heatRows} rowKey={row => row.media} emptyText={tr("기록된 클릭 contributor가 없습니다.", "No recorded click contributors.")} />
          <p className="report-note">{tr("진한 셀일수록 기록된 설치 비율이 높습니다. 지면을 나눠도 contributor 채널은 나누지 않습니다.", "Darker cells have a higher recorded-install share. Placement splits apply to install sources only.")}</p>
        </section>
        <section className="block report-panel">
          <header className="report-section-head"><div><h2 className="section-title">{tr("기여 캠페인 상위 20개", "Top 20 contributing campaigns")}</h2><p>{tr("선택한 귀속 매체·캠페인의 설치에 기록된 클릭 contributor입니다.", "Click contributors recorded on installations in the selected source and campaign.")}</p></div></header>
          <DataTable emptyText={tr("데이터 없음", "No data")} ariaLabel={tr("기여 캠페인 순위", "Contributing campaign ranking")} columns={[{ key: "channel", label: tr("채널", "Channel") }, { key: "campaign", label: tr("캠페인", "Campaign") }, { key: "installs", label: tr("기록된 설치", "Recorded installs"), align: "right", fmt: fmtNum }]} rows={r.assistCampaigns.slice(0, 20)} rowKey={row => row.name} />
        </section>
      </>}
      {r && view === "paths" && <section className="block report-panel">
        <header className="report-section-head"><div><h2 className="section-title">{tr("기록된 클릭 접촉의 흐름", "Recorded click-contact flow")}</h2><p>{tr(`시각 순서를 확인할 수 있는 멀티터치 설치 ${fmtNum(r.pathInstalls)}건을 표시합니다. 시각 부족·동률 ${fmtNum(r.unorderedInstalls)}건은 경로에서 제외했습니다.`, `Shows ${fmtNum(r.pathInstalls)} multi-touch installs with ordered timestamps. ${fmtNum(r.unorderedInstalls)} installs with missing or tied times are excluded from the flow.`)}</p></div></header>
        {r.paths.length > 0 ? <TouchFlowFigure paths={r.paths} locale={locale} context={{ source: { importSource: csv.importSource }, scope: { dateStart: r.dateStart, dateEnd: r.dateEnd, caption: `${filters.country || metadata.countries.join(", ")} · ${filters.platform || metadata.platforms.join(", ")} · ${filters.focus || tr("전체 매체", "All media")}${filters.campaignFocus ? " · " + filters.campaignFocus : ""} · ${options.excludeProbabilistic ? tr("probabilistic·미기록 제외", "probabilistic/unlabelled excluded") : tr("probabilistic 포함", "probabilistic included")}` } }} /> : <p className="report-note">{tr("시각 순서를 확인할 수 있는 기여 접촉 기록이 없습니다.", "No recorded contributors have usable ordered timestamps.")}</p>}
        <p className="report-note">{tr("클릭 contributor는 시간순, 귀속 매체는 마지막 열입니다. ‘없음’은 앞선 경로별로 나눠 표시하며 모든 실제 접촉을 복원한 그림은 아닙니다.", "Contributors are ordered by time; the install source is shown last. Missing slots are separated by preceding history. This does not reconstruct every actual contact.")}</p>
        <h3 className="report-subheading">{tr("상위 접촉 경로 15개", "Top 15 recorded paths")}</h3>
        <DataTable emptyText={tr("데이터 없음", "No data")} ariaLabel={tr("상위 접촉 경로", "Top recorded paths")} columns={[{ key: "name", label: tr("경로", "Path"), fmt: (_, row) => <span className="report-path">{[...row.touches, row.media].map((name, n) => <React.Fragment key={n}>{n > 0 && <span aria-hidden="true"> → </span>}<span>{name}</span></React.Fragment>)}</span> }, { key: "installs", label: tr("설치", "Installs"), align: "right", fmt: fmtNum }]} rows={r.paths.slice(0, 15)} rowKey={row => row.name} />
      </section>}
      {r && view === "timing" && <>
        <section className="block report-panel">
          <header className="report-section-head"><div><h2 className="section-title">{tr("귀속 클릭 후 설치까지 · CTIT", "Attributed click to install · CTIT")}</h2><p>{tr("Probabilistic 선택과 무관하게 대상의 전체 설치를 사용합니다. 누적 비율의 분모는 음수가 아닌 유효 시각 쌍입니다.", "Uses all installations in focus regardless of the probabilistic choice. Cumulative shares use valid non-negative timestamp pairs.")}</p></div></header>
          <DataTable emptyText={tr("데이터 없음", "No data")} ariaLabel="CTIT" columns={[
            { key: "name", label: filters.focus ? tr("캠페인", "Campaign") : tr("매체", "Media"), fmt: (name, row) => <span className="report-table-label"><strong>{name}</strong><small>{fmtNum(row.valid)} / {fmtNum(row.installs)}{tr(" 유효 쌍 · ", " valid pairs · ")}{fmtNum(row.invalid)}{tr(" 제외", " excluded")}</small></span> },
            { key: "median", label: tr("중앙값", "Median"), align: "right", fmt: formatTime },
            ...[["within5m", tr("5분 이내", "≤5m")], ["within1h", tr("1시간 이내", "≤1h")], ["within24h", tr("24시간 이내", "≤24h")], ["within3d", tr("3일 이내", "≤3d")]].map(([key, label]) => ({ key, label, align: "right", fmt: pct })),
          ]} rows={r.ctit} rowKey={row => row.name} />
        </section>
        <section className="block report-panel">
          <header className="report-section-head"><div><h2 className="section-title">{tr("접촉 사이에 얼마나 걸렸나요?", "How long between contacts?")}</h2><p>{tr("멀티터치 설치에서 기록된 시각 쌍만 비교합니다. 접촉 구간과 채널 쌍을 선택하세요.", "Compare recorded timestamp pairs on multi-touch installs. Choose a phase and channel pair.")}</p></div></header>
          <PillGroup ariaLabel={tr("접촉 시간 구간", "Touch timing phase")} className="report-tabs report-tabs--phases" value={gapPhase} onChange={value => { setGapPhase(value); setGapPair("All"); }} options={Object.entries(phaseLabels).map(([value, label]) => ({ value, label }))} />
          <div className="report-focus">
            <AnalysisFilterField label={tr("채널 쌍", "Channel pair")} value={selectedGap?.name || "All"} onChange={e => setGapPair(e.target.value)}><option value="All">{tr("전체 채널 쌍", "All channel pairs")}</option>{phaseGaps.filter(row => row.name !== "All").map(row => <option key={row.name}>{row.name}</option>)}</AnalysisFilterField>
            <span className="report-observation">{tr("유효 시각 쌍 ", "Valid timestamp pairs: ")}<strong>{fmtNum(selectedGap?.valid || 0)}</strong></span>
          </div>
          <DataTable ariaLabel={tr("접촉 시간 간격", "Touch time gaps")} columns={[{ key: "label", label: tr("시간 간격", "Time gap") }, { key: "count", label: tr("시각 쌍", "Pairs"), align: "right", fmt: fmtNum }, { key: "share", label: tr("비율", "Share"), align: "right", fmt: value => <span className="report-rate report-rate--distribution"><strong>{pct(value)}</strong>{value != null && <span aria-hidden="true"><i style={{ width: `${value * 100}%` }} /></span>}</span> }]} rows={gapRows} rowKey={row => row.key} emptyText={tr("이 구간에는 유효한 시각 쌍이 없습니다.", "No valid timestamp pairs in this phase.")} />
          <p className="report-note">{tr("서로 겹치지 않는 구간이며 역순까지 합해 100%입니다. 기여 시각이 없거나 동률이면 앞의 세 구간을 계산하지 않습니다. 귀속→설치는 기여 시각과 독립적으로 계산합니다.", "Bins are mutually exclusive and sum to 100%, including reversals. Missing or tied contributor times exclude the first three phases. Attributed-to-install gaps remain independent of contributor chronology.")}</p>
        </section>
      </>}
    </div>}
  </ToolPageShell>;
}
