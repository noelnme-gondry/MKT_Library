"use client";
import React, { useMemo, useState } from "react";
import ToolPageShell from "@/components/ToolPageShell";
import ReportCsvInput from "@/components/data-import/ReportCsvInput";
import ResultActionCard from "@/components/ds/ResultActionCard";
import DataTable from "@/components/ds/DataTable";
import DownloadHub from "@/components/ds/DownloadHub";
import AnalysisFilterField from "@/components/ds/AnalysisFilterField";
import IsoDateInput from "@/components/ds/IsoDateInput";
import { useAppStore } from "@/store/useDataStore";
import { MULTITOUCH_FIELDS, multitouchCapabilities } from "@/lib/attributionReports/fields";
import { useReportAnalysis } from "@/lib/attributionReports/useReportAnalysis";
import { useReportViewState } from "@/lib/attributionReports/useReportViewState";
import { TOUCH_GAP_BUCKETS } from "@/utils/multitouchMath";
import { fmtNum as formatNumber, fmtPct } from "@/utils/format";
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
  const config = useMemo(() => ({ utcOffsetMinutes: filters.utcOffsetMinutes }), [filters.utcOffsetMinutes]);
  const capabilities = useMemo(() => multitouchCapabilities(csv?.mapping), [csv?.mapping]);
  const options = useMemo(() => ({ ...filters, excludeProbabilistic: capabilities.hasMatchType && filters.excludeProbabilistic, splitPlacement: capabilities.hasPlacement && filters.splitPlacement }), [filters, capabilities]);
  const validDates = !filters.start || !filters.end || filters.start <= filters.end;
  const { metadata, result: r, loading, error } = useReportAnalysis("multitouch", csv, analyzed && validDates, options, config, revision);
  const change = (key, value) => setFilters(old => ({ ...old, [key]: value, focus: "", campaignFocus: "" }));
  const mediaFocus = name => setFilters(old => ({ ...old, focus: name, campaignFocus: "" }));
  const pct = value => value == null ? tr("비교 불가", "Unavailable") : fmtPct(value);
  const formatTime = value => value == null ? tr("계산 불가", "Unavailable") : value < 3600000 ? `${fmtNum(value / 60000, 1)} ${tr("분", "min")}` : `${fmtNum(value / 3600000, 1)} ${tr("시간", "h")}`;
  const campaigns = (r?.campaignRows || []).filter(row => row.installs >= minInstalls && (!search || `${row.media} ${row.campaign}`.toLowerCase().includes(search.trim().toLowerCase())));
  const cols = [
    { key: "installs", label: tr("설치", "Installs"), align: "right", fmt: fmtNum },
    { key: "rateIncluded", label: tr("포함 비율", "Including prob."), align: "right", fmt: pct },
    { key: "rateExcluded", label: tr("제외 비율", "Excluding prob."), align: "right", fmt: pct },
  ];
  const scopedHeatMedia = [...new Set((r?.heat || []).map(row => row.media))], heatChannels = [...new Set((r?.heat || []).map(row => row.channel))].sort();
  const heatRows = scopedHeatMedia.map(media => ({ media, ...Object.fromEntries(heatChannels.map((channel, n) => [`c${n}`, r.heat.find(row => row.media === media && row.channel === channel)])) }));
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
  return <ToolPageShell toolId={TOOL_ID} locale={locale} title={tr("멀티터치 맵", "Multi-touch map")} summary={<p>{tr("설치 raw에서 귀속 매체와 클릭 contributor의 겹침을 비교합니다. 파일의 최초 설치를 앱×AppsFlyer ID로 집계합니다.", "Compare attributed install media and recorded click contributors, counting the earliest installation per app × AppsFlyer ID in the file.")}</p>}>
    <ReportCsvInput toolId={TOOL_ID} fields={MULTITOUCH_FIELDS} locale={locale} onAnalyze={() => setRevision(n => n + 1)} />
    {analyzed && <section className="block">
      <h2 className="section-title">{tr("분석 범위", "Analysis scope")}</h2>
      <div className="report-filters">
        <AnalysisFilterField label={tr("국가", "Country")} value={filters.country} onChange={e => change("country", e.target.value)}><option value="">{tr("전체", "All")}</option>{metadata?.countries.map(value => <option key={value}>{value}</option>)}</AnalysisFilterField>
        <AnalysisFilterField label={tr("OS", "OS")} value={filters.platform} onChange={e => change("platform", e.target.value)}><option value="">{tr("전체", "All")}</option>{metadata?.platforms.map(value => <option key={value}>{value}</option>)}</AnalysisFilterField>
        <AnalysisFilterField label="Probabilistic" value={String(options.excludeProbabilistic)} onChange={e => change("excludeProbabilistic", e.target.value === "true")}><option value="false">{tr("포함", "Include")}</option><option value="true" disabled={!capabilities.hasMatchType}>{tr("제외 · 매칭 미기록도 제외", "Exclude · unlabelled also excluded")}</option></AnalysisFilterField>
        {metadata?.hasPlacement && <AnalysisFilterField label={tr("Meta·TikTok 지면", "Meta/TikTok placement")} value={String(filters.splitPlacement)} onChange={e => change("splitPlacement", e.target.value === "true")}><option value="false">{tr("합침", "Merged")}</option><option value="true">{tr("나눔", "Split")}</option></AnalysisFilterField>}
        <AnalysisFilterField label={tr("시작일", "Start date")}><IsoDateInput value={filters.start} allowEmpty onChange={e => change("start", e.target.value)} locale={locale} aria-label={tr("설치 시작일", "Install start date")} /></AnalysisFilterField>
        <AnalysisFilterField label={tr("종료일", "End date")}><IsoDateInput value={filters.end} allowEmpty onChange={e => change("end", e.target.value)} locale={locale} aria-label={tr("설치 종료일", "Install end date")} /></AnalysisFilterField>
        <AnalysisFilterField label={tr("원본 시각 UTC 오프셋(분)", "Source UTC offset (minutes)")}><input type="number" min="-720" max="840" step="15" value={filters.utcOffsetMinutes} onChange={e => change("utcOffsetMinutes", Math.max(-720, Math.min(840, Number(e.target.value) || 0)))} /></AnalysisFilterField>
      </div>
      <p className="muted">{tr("시간대가 없는 원본 시각은 선택한 오프셋으로 읽습니다. 0=UTC, 540=한국 시간. 원본에 Z/오프셋이 있으면 그대로 사용합니다.", "Timestamps without a zone use this offset: 0 = UTC, 540 = Korea. Explicit Z or timestamp offsets are retained.")}</p>
      {!validDates && <p role="alert">{tr("종료일은 시작일 이후여야 합니다.", "End date must be on or after start date.")}</p>}
    </section>}
    {loading && <p role="status">{tr("설치와 접촉을 집계하는 중…", "Aggregating installations and touches…")}</p>}
    {error && <p role="alert">{tr("분석하지 못했습니다. 입력을 확인하세요.", "Analysis failed. Check the input.")} {error}</p>}
    {r && <div className="report-results">
      <ResultActionCard toolId={TOOL_ID} locale={locale} headline={r.total ? tr(`클릭 귀속 설치 ${fmtNum(r.total)}건 중 ${fmtNum(r.withAssist)}건에 클릭 contributor가 기록됐습니다`, `${fmtNum(r.withAssist)} of ${fmtNum(r.total)} click-attributed installs have recorded click contributors`) : tr("선택한 범위에 유효한 클릭 귀속 설치가 없습니다", "No valid click-attributed installs in this scope")}
        stats={[{ label: tr("관측 멀티터치 비율", "Observed multi-touch rate"), value: pct(r.rate) }, { label: tr("파일 전체 중복 제거", "File-wide duplicates removed"), value: fmtNum(metadata.duplicates) }, { label: tr("유효 경로 설치", "Installs with ordered paths"), value: fmtNum(r.pathInstalls) }]}
        points={[{ text: tr("누락·매체 제한 때문에 관측되지 않은 접촉이 있을 수 있습니다. 중복은 인과 기여나 낭비의 판정이 아닙니다.", "Missing or restricted data may hide contacts. Recorded overlap is not a causal credit or waste verdict.") }, { text: tr(`ID·설치 시각 오류 ${fmtNum(metadata.invalidRows)}행, 클릭 외 귀속 ${fmtNum(metadata.nonClickInstalls)}건 제외. 관측 contributor 슬롯: ${metadata.contributorSlots.join(", ")}.`, `${fmtNum(metadata.invalidRows)} invalid ID/timestamp rows and ${fmtNum(metadata.nonClickInstalls)} non-click attributions excluded. Observed contributor slots: ${metadata.contributorSlots.join(", ")}.`) }]}
        decisionReview={false} analysisKey={JSON.stringify(options)} workbookExport={workbook}
        download={<DownloadHub toolId={TOOL_ID} locale={locale} label={tr("결과 받기", "Download results")} items={[{ label: tr("매체별 CSV", "Media CSV"), analyticsType: "csv", onSelect: () => downloadCsv(csvBody(["media", "installs", "assist_included", "assist_excluded_known"], r.mediaRows.map(row => [row.name, row.installs, row.withAssist, metadata.hasMatchType ? row.withAssistExcluded : "unavailable"])), "multitouch_media") }]} />} />
      {(r.unknownMatches > 0 || r.unknownTouchTypes > 0 || r.unorderedInstalls > 0) && <p className="required-banner">{tr(`매칭 미기록 클릭 ${fmtNum(r.unknownMatches)}개 · 접촉 유형 미기록 ${fmtNum(r.unknownTouchTypes)}개 · 경로 시각 부족·동률 ${fmtNum(r.unorderedInstalls)}설치. 제외 비교는 매칭 방식이 기록된 접촉만 사용합니다.`, `${fmtNum(r.unknownMatches)} unlabelled click matches · ${fmtNum(r.unknownTouchTypes)} unknown touch types · ${fmtNum(r.unorderedInstalls)} installs with missing or tied touch times. Exclusion comparisons use only labelled matches.`)}</p>}
      <section className="block">
        <h2 className="section-title">{tr("먼저 볼 매체 · 설치 500건 이상", "Media to inspect · 500+ installs")}</h2>
        <div className="report-media-grid">{r.mediaRows.filter(row => row.installs >= 500).map(row => <button className="report-media-card" key={row.name} onClick={() => mediaFocus(row.name)}><strong>{row.name}</strong><span>{pct(row.rateIncluded)} → {pct(row.rateExcluded)}</span><small>{fmtNum(row.installs)}{tr("설치 · 포함 → 제외", " installs · include → exclude")}</small><small>{row.topContributors.map(c => `${c.channel} ${fmtNum(c.installs)}`).join(" · ") || tr("기록된 클릭 contributor 없음", "No recorded click contributors")}</small></button>)}</div>
        {metadata.hasPlacement && <p className="muted">{tr("귀속 지면 구성: ", "Attributed placement mix: ")}{r.placements.map(p => `${p.media} · ${p.placement} ${fmtNum(p.installs)}`).join(" / ")}</p>}
        {!metadata.hasAppId && <p className="required-banner">{tr("앱 ID가 없어 파일을 단일 앱으로 처리했습니다. 여러 앱의 파일이면 앱 ID를 매핑하세요.", "No App ID is mapped; the file is treated as one app. Map App ID when combining apps.")}</p>}
        <h2 className="section-title">{tr("1. 매체·캠페인별 멀티터치", "1. Multi-touch by media and campaign")}</h2>
        <DataTable emptyText={tr("데이터 없음", "No data")} ariaLabel={tr("매체별 멀티터치", "Multi-touch by media")} columns={[{ key: "name", label: tr("귀속 매체", "Attributed media"), fmt: name => <button className="report-row-button" onClick={() => mediaFocus(name)}>{name}</button> }, ...cols]} rows={r.mediaRows} rowKey={row => row.name} />
        <div className="report-filters">
          <AnalysisFilterField label={tr("캠페인 검색", "Campaign search")}><input type="search" value={search} onChange={e => { setSearch(e.target.value); setLimit(100); }} /></AnalysisFilterField>
          <AnalysisFilterField label={tr("최소 설치", "Minimum installs")}><input type="number" min="0" value={minInstalls} onChange={e => { setMinInstalls(Math.max(0, Number(e.target.value) || 0)); setLimit(100); }} /></AnalysisFilterField>
        </div>
        <DataTable ariaLabel={tr("캠페인별 멀티터치", "Multi-touch by campaign")} columns={[{ key: "media", label: tr("매체", "Media") }, { key: "campaign", label: tr("캠페인", "Campaign"), fmt: (name, row) => <button className="report-row-button" onClick={() => setFilters(old => ({ ...old, focus: row.media, campaignFocus: name }))}>{name}</button> }, ...cols]} rows={campaigns.slice(0, limit)} rowKey={row => row.name} emptyText={tr("조건에 맞는 캠페인이 없습니다.", "No campaigns match.")} />
        {campaigns.length > limit && <button className="btn ghost" onClick={() => setLimit(n => n + 100)}>{tr("캠페인 더 보기", "Show more campaigns")} ({fmtNum(campaigns.length - limit)})</button>}
      </section>
      <section className="block">
        <h2 className="section-title">{tr("2. 함께 기록된 채널과 캠페인", "2. Recorded contributing channels and campaigns")}</h2>
        <div className="report-input__actions"><strong>{tr("대상: ", "Focus: ")}{filters.focus || tr("전체", "All")}{filters.campaignFocus ? ` · ${filters.campaignFocus}` : ""}</strong>{filters.focus && <button className="btn ghost" onClick={() => setFilters(old => ({ ...old, focus: "", campaignFocus: "" }))}>{tr("대상 초기화", "Clear focus")}</button>}</div>
        <p>{tr("셀 비율의 분모는 해당 행·선택 캠페인의 전체 설치입니다. 같은 설치에 여러 채널이 기록될 수 있어 행 합은 100%를 넘을 수 있습니다. 지면은 귀속 쪽만 나눕니다.", "Each cell uses all installations in its row and selected campaign as the denominator. Multiple channels can appear on one install, so row shares may exceed 100%. Placement splits apply only to the attributed source.")}</p>
        <DataTable ariaLabel={tr("설치 매체 × 기여 채널", "Install media × contributor channel")} columns={[{ key: "media", label: tr("설치 매체", "Install media") }, ...heatChannels.map((channel, n) => ({ key: `c${n}`, label: channel, align: "right", fmt: value => value ? <span className="report-heat-cell" style={{ background: `color-mix(in srgb, var(--chart-primary) ${Math.round(value.share * 35)}%, var(--surface-container-lowest))` }}>{pct(value.share)}<small>{fmtNum(value.installs)}</small></span> : "—" }))]} rows={heatRows} rowKey={row => row.media} emptyText={tr("기록된 클릭 contributor가 없습니다.", "No recorded click contributors.")} />
        <h3>{tr("기여 캠페인 상위 20개", "Top 20 contributing campaigns")}</h3>
        <DataTable emptyText={tr("데이터 없음", "No data")} ariaLabel={tr("기여 캠페인 순위", "Contributing campaign ranking")} columns={[{ key: "channel", label: tr("채널", "Channel") }, { key: "campaign", label: tr("캠페인", "Campaign") }, { key: "installs", label: tr("기록된 설치", "Recorded installs"), align: "right", fmt: fmtNum }]} rows={r.assistCampaigns.slice(0, 20)} rowKey={row => row.name} />
      </section>
      <section className="block">
        <h2 className="section-title">{tr("3. 관측 경로와 시간", "3. Observed paths and timing")}</h2>
        {r.paths.length > 0 && <TouchFlowFigure paths={r.paths} locale={locale} context={{ source: { importSource: csv.importSource }, scope: { dateStart: r.dateStart, dateEnd: r.dateEnd, caption: `${filters.country || metadata.countries.join(", ")} · ${filters.platform || metadata.platforms.join(", ")} · ${filters.focus || tr("전체 매체", "All media")}${filters.campaignFocus ? " · " + filters.campaignFocus : ""} · ${options.excludeProbabilistic ? tr("probabilistic·미기록 제외", "probabilistic/unlabelled excluded") : tr("probabilistic 포함", "probabilistic included")}` } }} />}
        <p>{tr("시각이 유효한 클릭 contributor만 시간순으로 배치합니다. 귀속 매체 열은 마지막으로 표시하며, 전체 실제 접촉 순서를 복원한 것이 아닙니다.", "Only contributors with valid timestamps enter the ordered flow. The attributed source is shown last; this is not a reconstruction of every actual contact.")}</p>
        <DataTable emptyText={tr("데이터 없음", "No data")} ariaLabel={tr("상위 접촉 경로", "Top recorded paths")} columns={[{ key: "name", label: tr("경로", "Path"), fmt: (_, row) => [...row.touches, row.media].join(" → ") }, { key: "installs", label: tr("설치", "Installs"), align: "right", fmt: fmtNum }]} rows={r.paths.slice(0, 15)} rowKey={row => row.name} />
        <h3>{tr("CTIT · 귀속 클릭 → 설치", "CTIT · attributed click → install")}</h3>
        <p>{tr("Probabilistic 선택과 무관하게 대상의 전체 설치를 사용합니다. 누적 비율의 분모는 음수가 아닌 유효 시각 쌍이며, 누락·역순은 제외 건수에 표시합니다.", "This table uses all installations in focus regardless of the probabilistic choice. Cumulative shares use valid non-negative time pairs; missing and reversed pairs are reported as excluded.")}</p>
        <DataTable emptyText={tr("데이터 없음", "No data")} ariaLabel="CTIT" columns={[{ key: "name", label: filters.focus ? tr("캠페인", "Campaign") : tr("매체", "Media") }, { key: "installs", label: tr("설치", "Installs"), align: "right", fmt: fmtNum }, { key: "valid", label: tr("유효 쌍", "Valid pairs"), align: "right", fmt: fmtNum }, { key: "invalid", label: tr("제외 쌍", "Excluded pairs"), align: "right", fmt: fmtNum }, { key: "median", label: tr("중앙값", "Median"), align: "right", fmt: formatTime }, ...[["within5m", tr("5분 이내", "≤5m")], ["within1h", tr("1시간 이내", "≤1h")], ["within24h", tr("24시간 이내", "≤24h")], ["within3d", tr("3일 이내", "≤3d")]].map(([key, label]) => ({ key, label, align: "right", fmt: pct }))]} rows={r.ctit} rowKey={row => row.name} />
        <h3>{tr("터치 사이 간격 · 멀티터치 설치만", "Touch gaps · multi-touch installations only")}</h3>
        <p>{tr("각 행은 유효한 접촉 쌍의 상호 배타 구간이며 역순까지 합해 100%입니다. 기여 접촉 시각이 없거나 동률이면 앞의 세 구간을 계산하지 않습니다. 귀속→설치 간격은 기여 시각과 독립적으로 계산합니다.", "Each row partitions valid time pairs into exclusive bins summing to 100%, including reversals. Missing or tied contributor times exclude the first three phases. Attributed-to-install gaps remain independent of contributor chronology.")}</p>
        <DataTable emptyText={tr("데이터 없음", "No data")} ariaLabel={tr("접촉 시간 간격", "Touch time gaps")} columns={[{ key: "phase", label: tr("구간", "Phase"), fmt: value => ({ "first-second": tr("첫 → 둘째", "First → second"), "second-third": tr("둘째 → 셋째", "Second → third"), "last-attributed": tr("마지막 기여 → 귀속", "Last contributor → attributed"), "attributed-install": tr("귀속 → 설치", "Attributed → install") })[value] }, { key: "name", label: tr("채널 쌍", "Channel pair"), fmt: value => value === "All" ? tr("전체", "All") : value }, { key: "valid", label: tr("유효 쌍", "Valid pairs"), align: "right", fmt: fmtNum }, ...TOUCH_GAP_BUCKETS.map((key, n) => ({ key, label: GAP_LABELS[locale][n], align: "right", fmt: (_, row) => pct(row.shares[n]) }))]} rows={r.gaps.filter(row => row.name === "All" || r.gaps.filter(x => x.phase === row.phase && x.name !== "All").indexOf(row) < 10)} rowKey={row => `${row.phase}:${row.name}`} />
      </section>
    </div>}
  </ToolPageShell>;
}
