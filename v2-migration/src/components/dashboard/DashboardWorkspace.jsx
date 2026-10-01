'use client';
import React, { useState, useMemo, useCallback, useRef } from 'react';
import DashboardBoardLibrary from './DashboardBoardLibrary';
import { applyPortableBoard } from '@/lib/dashboard/boardContract';
import Link from 'next/link';
import { isDemoData } from '@/lib/dataOrigin';
import { captureBoardReport } from '@/lib/dashboard/boardReport';
import { computeAnalyzeSig } from '@/store/useDataStore';
import { useAppStore } from '@/store/useDataStore';
import { comparisonWarnings } from '@/lib/analysisPeriod';
import { hasPaidAccess } from '@/lib/subscription/entitlement';
import { getMappedRows } from '@/utils/dashboardAggregator';
import { buildChartFieldOptions } from '@/utils/customChartConfig';
import { WORKSPACE_SCOPE, EMPTY_WORKSPACE, SCOPE_FIELDS, scopeError } from '@/lib/dashboard/workspace';
import { DashboardWorkspaceContext } from './DashboardWorkspaceContext';

export default function DashboardWorkspace({ tab, locale = 'ko', enabled = true, children }) {
  const en = locale === 'en', t = (ko, english) => en ? english : ko;
  const saved = useAppStore(s => s.viewConfig[WORKSPACE_SCOPE]) || EMPTY_WORKSPACE;
  const entitlement = useAppStore(s => s.entitlement);
  const csv = useAppStore(s => s.csvData);
  const metrics = useAppStore(s => s.customMetrics['5-2:viz-kpi']);
  const commit = useAppStore(s => s.saveDashboardWorkspace);
  const [defaultView, setDefaultView] = useState(false);
  const paid = hasPaidAccess(entitlement);
  const [draft, setDraft] = useState(null);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [panel, setPanel] = useState('layout');
  const [available, setAvailable] = useState([]);
  const [name, setName] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const reportRoot = useRef(null);
  const [message, setMessage] = useState('');
  const [liveControls, setLiveControls] = useState(() => saved.tabs?.[tab]?.controls || {});
  const editing = draft !== null && paid;
  const workspace = editing ? draft : defaultView ? EMPTY_WORKSPACE : saved;
  const config = workspace.tabs?.[tab] || {};
  const controls = editing ? config.controls || liveControls : liveControls;
  const setControl = useCallback((key, next, fallback) => {
    const update = previous => ({ ...previous, [key]: typeof next === 'function' ? next(Object.hasOwn(previous, key) ? previous[key] : fallback) : next });
    if (editing) setDraft(previous => previous ? { ...previous, tabs: { ...previous.tabs, [tab]: { ...previous.tabs?.[tab], controls: update(previous.tabs?.[tab]?.controls || {}) } } } : previous);
    else setLiveControls(update);
  }, [editing, tab]);
  // Removing a native canvas must also clean up its owner's effects. Remount only
  // on visibility / scope ownership transitions, not on typing or resizing.
  const mountKey = JSON.stringify(Object.entries(config.blocks || {}).filter(([, block]) => block.hidden || Object.keys(block.scope || {}).length).map(([id, block]) => [id, !!block.hidden, !!Object.keys(block.scope || {}).length]));
  const active = config.blocks?.[selected] || {};
  const custom = (config.charts || []).find(c => c.id === selected);
  const fields = buildChartFieldOptions(csv?.mapping, workspace.legacy?.customMetrics?.["5-2:viz-kpi"] ?? metrics, locale);
  const options = useMemo(() => {
    const rows = getMappedRows(csv);
    return Object.fromEntries(Object.entries(SCOPE_FIELDS).map(([key, field]) => [key, [...new Set(rows.map(r => String(r[field] ?? '').trim()).filter(Boolean))].sort()]));
  }, [csv]);
  const change = fn => {
    if (!hasPaidAccess(useAppStore.getState().entitlement) || !draft) return;
    setHistory(prev => [...prev.slice(-19), draft]);
    setDraft(fn(draft));
  };
  const mutateLegacy = (action, scope, first, second) => change(prev => {
    const kind = action.includes('Metric') ? 'customMetrics' : action.includes('Chart') ? 'customCharts' : 'viewConfig';
    const values = { ...prev.legacy?.[kind] };
    if (action === 'setViewConfig') values[scope] = { ...values[scope], ...first };
    else if (action === 'resetViewConfig') delete values[scope];
    else if (action.startsWith('add')) values[scope] = [...(values[scope] || []), { ...first, id: `custom-${crypto.randomUUID()}` }];
    else if (action.startsWith('remove')) values[scope] = (values[scope] || []).filter(item => item.id !== first);
    else values[scope] = (values[scope] || []).map(item => item.id === first ? { ...item, ...second, id: first } : item);
    return { ...prev, legacy: { ...prev.legacy, [kind]: values } };
  });
  const startEditing = () => {
    const state = useAppStore.getState();
    const onlyDashboard = map => Object.fromEntries(Object.entries(map || {}).filter(([key]) => key.startsWith('5-2:')));
    setDraft(structuredClone({ ...workspace, tabs: { ...workspace.tabs, [tab]: { ...workspace.tabs?.[tab], controls: liveControls } }, legacy: workspace.legacy || { viewConfig: onlyDashboard(state.viewConfig), customMetrics: onlyDashboard(state.customMetrics), customCharts: onlyDashboard(state.customCharts) } }));
    setHistory([]); setMessage(''); setDefaultView(false);
  };
  const patchTab = patch => change(prev => ({ ...prev, tabs: { ...prev.tabs, [tab]: { ...prev.tabs?.[tab], ...patch } } }));
  const patchBlock = (id, patch) => patchTab({ blocks: { ...config.blocks, [id]: { ...config.blocks?.[id], ...patch } } });
  const patchActive = patch => patchBlock(selected, patch);
  const patchChart = patch => patchTab({ charts: config.charts.map(c => c.id === selected ? { ...c, ...patch } : c) });
  const requiresComparison = ['s-score', 's-score-daily'].includes(selected);
  const patchScope = patch => patchActive({ scope: { ...active.scope, ...patch, ...(requiresComparison ? { compareEnabled: true } : {}) } });
  const create = () => {
    const id = `custom-${crypto.randomUUID()}`;
    patchTab({ charts: [...(config.charts || []), { id, name: t('채널별 비용', 'Cost by channel'), type: 'bar', dim: fields.availDims[0]?.key || 'channel', metric: fields.metricOptions[0]?.key || 'cost', palette: 'primary', legend: 'bottom', sort: 'label', topN: 20, interval: 'day' }] });
    setSelected(id); setPanel('data');
  };
  const save = () => {
    const invalid = Object.values(draft.tabs || {}).some(value => Object.values(value.blocks || {}).some(block => scopeError(block.scope)));
    if (invalid) { setMessage(t('개별 분석·비교 기간의 시작일과 종료일을 확인하세요.', 'Check the start and end dates of each independent period.')); return; }
    if (commit({ ...draft, tabs: { ...draft.tabs, [tab]: { ...draft.tabs?.[tab], controls } } })) { setLiveControls(controls); setDraft(null); setSelected(null); setMessage(t('보드 설정을 이 기기에 저장했습니다.', 'Board settings saved on this device.')); }
    else setMessage(t('편집 저장에는 유효한 Pro가 필요합니다.', 'An active Pro plan is required to save edits.'));
  };
  const remember = () => {
    if (!name.trim()) return;
    change(prev => ({ ...prev, boards: [...(prev.boards || []).slice(-19), { id: crypto.randomUUID(), name: name.trim().slice(0, 80), tabs: structuredClone({ ...prev.tabs, [tab]: { ...prev.tabs?.[tab], controls } }), legacy: structuredClone(prev.legacy || {}) }] }));
    setName('');
  };
  const collectReport = async () => {
    if (!hasPaidAccess(useAppStore.getState().entitlement) || editing || reportBusy) return;
    setReportBusy(true);
    try {
      const state=useAppStore.getState();
      const blocks=await captureBoardReport(reportRoot.current,{tab,config,common:state.dashboardFilter,inputSignature:computeAnalyzeSig(state.csvData),locale,demo:isDemoData(state.csvData)});
      blocks.forEach(block=>state.addReportBlock(block));
      setMessage(t(`현재 탭 ${blocks.length}개 구역을 보고서에 담았습니다.`, `Added ${blocks.length} blocks from this tab to the report.`));
    } catch { setMessage(t('보고서에 담지 못했습니다. 분석 결과나 화면 크기를 확인하세요.', 'Could not collect the report. Check the results or board size.')); }
    finally { setReportBusy(false); }
  };
  const supportsComparison = Boolean(custom || ['workbench', 's-score', 's-score-daily'].includes(selected));
  const title = custom?.name || available.find(b => b.id === selected)?.title || '';
  const value = { editing, config, locale, content: children, selected, select: id => { setSelected(id); setPanel('layout'); }, patchTab, patchBlock, setAvailable, controls, legacy: workspace.legacy, mutateLegacy,
    setControl };
  const selectField = (label, val, items, onChange) => <label className="dashboard-editor-field"><span>{label}</span><select value={val} onChange={e => onChange(e.target.value)}>{items.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
  if (!enabled) return children;
  return <DashboardWorkspaceContext.Provider value={value}>
    <div className="dashboard-workspace" data-editing={editing || undefined}>
      <div className="dashboard-workspace-toolbar">
        <div><strong>{editing ? t('대시보드 편집', 'Edit dashboard') : t('내 대시보드 구성', 'Your dashboard layout')}</strong><span>{editing ? t('구역을 선택해 조건과 배치를 바꾸세요. 저장 전까지 미리보기입니다.', 'Select a block to change scope and layout. Changes are a preview until saved.') : t('기본 분석을 유지하며 나만의 점검 화면을 구성하세요.', 'Arrange the analysis around your review workflow.')}</span></div>
        <div className="dashboard-workspace-actions">
          <button className="ab-pill" disabled={!paid || editing || reportBusy} onClick={collectReport}>{t("현재 탭을 보고서에 담기 · Pro", "Add this tab to report · Pro")}</button><Link className="ab-pill" href={en ? "/en/weekly-report" : "/weekly-report"}>{t("모은 보고서 보기", "View collected report")}</Link>
          <button className="ab-pill" onClick={() => setLibraryOpen(true)}>{t("보드 동기화·팀 공유", "Board sync / team sharing")}</button>
          {!editing && Object.keys(saved.tabs || {}).length > 0 && <button className="ab-pill" onClick={() => setDefaultView(!defaultView)}>{defaultView ? t("저장된 배치 보기", "View saved layout") : t("기본 배치 보기", "View default layout")}</button>}
          {editing ? <><button className="ab-pill" disabled={!history.length} onClick={() => { setDraft(history.at(-1)); setHistory(history.slice(0, -1)); }}>{t('되돌리기', 'Undo')}</button><button className="ab-pill" onClick={() => { setDraft(null); setSelected(null); setHistory([]); }}>{t('취소', 'Cancel')}</button><button className="btn primary" onClick={save}>{t('편집 저장', 'Save edits')}</button></> : <button className="ab-pill" onClick={() => paid ? (startEditing()) : setMessage(t('기본 분석은 무료입니다. 배치·차트별 조건 편집과 보드 저장은 Pro에서 사용할 수 있습니다.', 'Basic analysis is free. Layout editing, per-chart scope and saved boards require Pro.'))}>{t('대시보드 편집 · Pro', 'Edit dashboard · Pro')}</button>}
        </div>
      </div>
      {message && <p className="dashboard-workspace-notice" role="status">{message}{!paid && <> <a href={en ? '/en/subscription' : '/subscription'}>{t('Pro 안내', 'About Pro')}</a></>}</p>}
      {draft && !paid && <p className="dashboard-workspace-notice" role="status">{t('Pro 이용 기간이 종료되어 저장된 화면을 읽기 전용으로 표시합니다. 미저장 편집은 적용되지 않았습니다.', 'Pro has expired. The saved layout is read-only; unsaved edits have not been applied.')}</p>}
      <div className="dashboard-workspace-body">
        <div className="dashboard-workspace-content" key={mountKey} ref={reportRoot}>{children}</div>
        {editing && <aside className="dashboard-editor" aria-label={t('대시보드 편집 설정', 'Dashboard editor settings')}>
          <header><strong>{t('구성 편집', 'Customize')}</strong><button className="ab-pill" onClick={create} disabled={!fields.metricOptions.length}>{t('차트 추가', 'Add chart')}</button></header>
          {selectField(t('편집할 구역', 'Selected block'), selected || '', [['', t('구역 선택', 'Select a block')], ...available.map(b => [b.id, b.title]), ...(config.charts || []).map(c => [c.id, c.name])], setSelected)}
          {selected && <>
            <h3>{title}</h3>
            <div className="dashboard-editor-tabs" role="group" aria-label={t('편집 종류', 'Editor category')}>{[['data', t('데이터', 'Data')], ['appearance', t('모양', 'Appearance')], ['layout', t('배치', 'Layout')]].map(([key, label]) => <button className="ab-pill" key={key} aria-pressed={panel === key} onClick={() => setPanel(key)}>{label}</button>)}</div>
            {panel === 'layout' && <>
              {selectField(t('구역 폭', 'Block width'), active.width || 'full', [['third', t('1/3 폭', 'Third')], ['half', t('절반 폭', 'Half')], ['full', t('전체 폭', 'Full')]], width => patchActive({ width }))}
              {selectField(t('차트 높이', 'Chart height'), active.height || 'default', [['default', t('기본', 'Default')], ['260', t('낮게', 'Compact')], ['360', t('보통', 'Medium')], ['480', t('높게', 'Tall')]], height => patchActive({ height }))}
              <button className="ab-pill" onClick={() => patchActive({ hidden: !active.hidden })}>{active.hidden ? t('구역 다시 표시', 'Show block') : t('구역 숨기기', 'Hide block')}</button>
              {custom && <div className="dashboard-workspace-actions"><button className="ab-pill" onClick={() => { const id = `custom-${crypto.randomUUID()}`; patchTab({ charts: [...config.charts, { ...custom, id, name: `${custom.name} ${t('복사', 'copy')}` }], blocks: { ...config.blocks, [id]: structuredClone(active) } }); setSelected(id); }}>{t('복제', 'Duplicate')}</button><button className="ab-pill" onClick={() => { patchTab({ charts: config.charts.filter(c => c.id !== selected) }); setSelected(null); }}>{t('삭제', 'Delete')}</button></div>}
              <p className="muted">{t('구역 위의 이동 손잡이를 드래그하거나 위·아래 버튼으로 순서를 바꿀 수 있습니다.', 'Drag the block handle or use its Up / Down buttons to reorder.')}</p>
            </>}
            {panel === 'data' && <>
              {custom && <>
                <label className="dashboard-editor-field"><span>{t('차트 제목', 'Chart title')}</span><input value={custom.name} maxLength={80} onChange={e => patchChart({ name: e.target.value })} /></label>
                {selectField(t('지표', 'Metric'), custom.metric, fields.metricOptions.map(m => [m.key, m.label]), metric => patchChart({ metric }))}
                {custom.type !== 'scorecard' && selectField(t('묶을 기준', 'Group by'), custom.dim, fields.availDims.map(d => [d.key, d.label]), dim => patchChart({ dim }))}
                {custom.dim === 'date' && selectField(t('집계 간격', 'Date interval'), custom.interval || 'day', [['day', t('일', 'Day')], ['week', t('주 (월요일 시작)', 'Week (Monday)')], ['month', t('월', 'Month')]], interval => patchChart({ interval }))}
                {custom.type !== 'scorecard' && selectField(t('표시 개수', 'Top N'), String(custom.topN || 20), ['5', '10', '20', '50', '100'].map(n => [n, n]), topN => patchChart({ topN: Number(topN) }))}
                {selectField(t('정렬', 'Order'), custom.sort || 'label', [['label', t('이름·날짜 순', 'Label / date')], ['desc', t('큰 값부터', 'Largest first')], ['asc', t('작은 값부터', 'Smallest first')]], sort => patchChart({ sort }))}
              </>}
              <p className="muted">{t('대상 조건은 공통 필터 안에서 추가로 좁힙니다. 국가를 나란히 비교하려면 공통 국가를 전체로 두세요.', 'Block conditions narrow the shared filters. Set the shared country to All to compare countries side by side.')}</p>
              {Object.keys(SCOPE_FIELDS).map((key, index) => options[key].length > 0 && <fieldset key={key}><legend>{[t('국가', 'Country'), t('채널', 'Channel'), t('OS', 'Platform'), t('소스', 'Source')][index]}</legend><button className="ab-pill" aria-pressed={!active.scope?.[key]?.length} onClick={() => patchScope({ [key]: [] })}>{t('공통 대상', 'Shared scope')}</button><div className="dashboard-editor-options">{options[key].map(option => <label key={option}><input type="checkbox" checked={(active.scope?.[key] || []).includes(option)} onChange={e => patchScope({ [key]: e.target.checked ? [...(active.scope?.[key] || []), option] : active.scope[key].filter(v => v !== option) })} />{option}</label>)}</div></fieldset>)}
              {selectField(t('분석 기간', 'Analysis dates'), active.scope?.period || 'shared', [['shared', t('공통 기간 사용', 'Follow shared dates')], ['custom', t('이 구역의 기간 지정', 'Independent dates')]], period => patchScope({ period }))}
              {active.scope?.period === 'custom' && <><div className="dashboard-editor-dates">{[['dateStart', t('분석 시작일', 'Analysis start')], ['dateEnd', t('분석 종료일', 'Analysis end')]].map(([key, label]) => <label key={key}>{label}<input type="date" value={active.scope?.[key] || ''} onChange={e => patchScope({ [key]: e.target.value })} /></label>)}</div>{supportsComparison && <label><input type="checkbox" disabled={requiresComparison} checked={!!active.scope.compareEnabled} onChange={e => patchScope({ compareEnabled: e.target.checked })} />{t('비교 기간 지정', 'Use comparison dates')}</label>}{active.scope.compareEnabled && <div className="dashboard-editor-dates">{[['comparisonStart', t('비교 시작일', 'Comparison start')], ['comparisonEnd', t('비교 종료일', 'Comparison end')]].map(([key, label]) => <label key={key}>{label}<input type="date" value={active.scope?.[key] || ''} onChange={e => patchScope({ [key]: e.target.value })} /></label>)}</div>}{active.scope.compareEnabled && comparisonWarnings({ start: active.scope.dateStart, end: active.scope.dateEnd }, { start: active.scope.comparisonStart, end: active.scope.comparisonEnd }, locale).map(warning => <p className="muted" key={warning}>{warning}</p>)}{scopeError(active.scope) && <p role="status">{t('시작일·종료일을 순서대로 지정하세요.', 'Choose a valid start and end date.')}</p>}</>}
              {!custom && <p className="muted">{t('이 구역의 원래 분석식과 지표 정의는 유지합니다. 비교 기능이 있는 구역에서만 비교 날짜가 사용됩니다.', 'The original calculation and metric definitions are preserved. Comparison dates apply only to blocks that support comparison.')}</p>}
              <button className="ab-pill" onClick={() => patchActive({ scope: {} })}>{t('공통 조건으로 복귀', 'Reset to shared scope')}</button>
            </>}
            {panel === 'appearance' && <>
              {custom ? <>
                {selectField(t('차트 종류', 'Chart type'), custom.type, [['bar', t('세로 막대', 'Bar')], ['hbar', t('가로 막대', 'Horizontal bar')], ['line', t('선', 'Line')], ['pie', t('파이', 'Pie')], ['doughnut', t('도넛', 'Doughnut')], ['scorecard', t('단일 지표', 'Scorecard')]], type => patchChart({ type }))}
                {selectField(t('색상', 'Palette'), custom.palette || 'primary', [['primary', t('블루', 'Blue')], ['teal', t('그린', 'Green')], ['series', t('항목별 구분', 'By category')]], palette => patchChart({ palette }))}
                {selectField(t('범례', 'Legend'), custom.legend || 'bottom', [['bottom', t('아래', 'Bottom')], ['right', t('오른쪽', 'Right')], ['none', t('숨김', 'Hidden')]], legend => patchChart({ legend }))}
                <label><input type="checkbox" checked={!!custom.labels} onChange={e => patchChart({ labels: e.target.checked })} />{t('값 직접 표시', 'Show value labels')}</label>
              </> : <p className="muted">{t('이 분석은 기준선·분모·상태 색에 의미가 있어 차트 형태를 유지합니다. 폭·높이는 배치에서 변경하고, 다른 표현은 차트 추가로 구성하세요.', 'This analysis preserves its chart type because baselines, denominators and status colors have specific meanings. Change size in Layout or add a chart for another view.')}</p>}
            </>}
          </>}
          <footer>
            <strong>{t('보드 저장·복원', 'Saved boards')}</strong>
            <label className="dashboard-editor-field"><span>{t('보드 이름', 'Board name')}</span><input value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder={t('예: 주간 국가별 점검', 'e.g. Weekly country review')} /></label>
            <button className="ab-pill" disabled={!name.trim()} onClick={remember}>{t('현재 구성을 보드로 보관', 'Keep current layout as a board')}</button>
            {(workspace.boards || []).map(board => <div className="dashboard-workspace-actions" key={board.id}><button className="ab-pill" onClick={() => { change(prev => ({ ...prev, tabs: structuredClone(board.tabs), legacy: structuredClone(board.legacy || prev.legacy) })); }}>{board.name}</button><button className="ab-pill" aria-label={`${board.name} ${t('삭제', 'delete')}`} onClick={() => change(prev => ({ ...prev, boards: prev.boards.filter(b => b.id !== board.id) }))}>×</button></div>)}
            <button className="ab-pill" onClick={() => patchTab({ blocks: {}, order: [], charts: [] })}>{t('현재 탭 기본 배치 복원', 'Reset this tab')}</button>
            <small>{t('편집 저장을 눌러 확정합니다. 조건값과 보드는 이 기기에만 저장되며 프로젝트 저장에도 포함됩니다.', 'Confirm with Save edits. Boards and scope values stay on this device and are included in project settings.')}</small>
          </footer>
        </aside>}
      </div>
      {libraryOpen && <DashboardBoardLibrary workspace={workspace} paid={paid} locale={locale} onClose={() => setLibraryOpen(false)} onApply={board => { if (!hasPaidAccess(useAppStore.getState().entitlement)) return; setHistory(draft ? [...history.slice(-19), draft] : []); setDraft(applyPortableBoard(workspace, board, locale)); setSelected(null); setDefaultView(false); }} />}
    </div>
  </DashboardWorkspaceContext.Provider>;
}
