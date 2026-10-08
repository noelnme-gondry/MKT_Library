'use client';
import React, { useContext, useEffect } from 'react';
import { useAppStore } from '@/store/useDataStore';
import { DashboardWorkspaceContext, DashboardBlockContext } from './DashboardWorkspaceContext';
import { orderBlocks, moveBlock, resolveBlockFilter, scopeLabel } from '@/lib/dashboard/workspace';
import { AnalysisExportProvider, useAnalysisExport } from '@/lib/analysis-export/AnalysisExportContext';
import DashboardCustomBlock from './DashboardCustomBlock';

const flatten = children => React.Children.toArray(children).flatMap(child => child?.type === React.Fragment ? flatten(child.props.children) : [child]);
function heading(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!React.isValidElement(node)) return '';
  if (/^h[1-4]$/.test(node.type)) return flatten(node.props.children).map(headingText).join('');
  for (const child of flatten(node.props.children)) { const found = heading(child); if (found) return found; }
  return '';
}
const headingText = node => typeof node === 'string' || typeof node === 'number' ? String(node) : React.isValidElement(node) ? flatten(node.props.children).map(headingText).join('') : '';
const blockId = (node, i) => node.props?.id || node.props?.chartScope || (node.props?.className?.includes('dashboard-viz-workbench') ? 'workbench' : `section-${i}`);

function Block({ id, title, node, custom, order, workspace }) {
  const { config, editing, selected, select, patchBlock, patchTab, locale } = workspace;
  const block = config.blocks?.[id] || {};
  const common = useAppStore(s => s.dashboardFilter);
  const analysis = useAnalysisExport();
  const en = locale === 'en';
  const scoped = Boolean(block.scope && Object.keys(block.scope).length);
  const result = resolveBlockFilter(common, block.scope, workspace.observationBounds);
  if (block.hidden && !editing) return null;
  const content = result.conflict || result.error ? <section className="block dashboard-block-empty"><h2>{title}</h2><p role="status">{result.error ? (en ? 'Choose valid dates in the editor.' : '편집에서 분석·비교 날짜를 올바르게 지정하세요.') : (en ? 'The block conditions do not overlap with the shared scope. No matching data.' : '공통 대상과 이 구역의 조건이 겹치지 않습니다. 해당 데이터가 없습니다.')}</p></section>
    : custom ? <DashboardCustomBlock definition={custom} config={block} locale={locale} />
    : scoped ? <DashboardBlockContext.Provider value={{ id, config: block }}>{workspace.content}</DashboardBlockContext.Provider> : node;
  const offset = delta => patchTab({ order: moveBlock(order, id, delta) });
  const exportValue = scoped && analysis ? { ...analysis, figureContext: { ...analysis.figureContext, scope: { ...analysis.figureContext?.scope, ...result.filter, dateStart: result.filter.dateStart || analysis.figureContext?.scope?.dateStart, dateEnd: result.filter.dateEnd || analysis.figureContext?.scope?.dateEnd, caption: scopeLabel(result.filter, block.scope, locale) } } } : analysis;
  return <div className="dashboard-layout-block" data-block-id={id} data-width={block.width || 'full'} data-selected={editing && selected === id || undefined} data-hidden={block.hidden || undefined} style={block.height && block.height !== 'default' ? { '--dashboard-chart-height': `${block.height}px` } : undefined}>
    {editing && <div className="dashboard-block-toolbar"><button className="ab-pill" draggable onDragStart={e => e.dataTransfer.setData('application/dashboard-block', id)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const from = e.dataTransfer.getData('application/dashboard-block'); if (order.includes(from)) patchTab({ order: moveBlock(order, from, order.indexOf(id) - order.indexOf(from)) }); }} onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); offset(e.key === 'ArrowUp' ? -1 : 1); } }} aria-label={`${title}: ${en ? 'drag or arrow keys to move' : '드래그·방향키로 이동'}`}>⠿</button><button className="ab-pill" disabled={order.indexOf(id) === 0} onClick={() => offset(-1)} aria-label={`${title}: ${en ? 'move up' : '위로'}`}>↑</button><button className="ab-pill" disabled={order.indexOf(id) === order.length - 1} onClick={() => offset(1)} aria-label={`${title}: ${en ? 'move down' : '아래로'}`}>↓</button><button className="ab-pill" aria-pressed={selected === id} onClick={() => select(id)}>{en ? 'Edit block' : '구역 편집'}</button><button className="ab-pill" onClick={() => patchBlock(id, { hidden: !block.hidden })}>{block.hidden ? (en ? 'Show' : '표시') : (en ? 'Hide' : '숨김')}</button></div>}
    {scoped && <p className="dashboard-block-scope">{scopeLabel(result.filter, block.scope, locale)}</p>}
    <AnalysisExportProvider value={exportValue}>{content}</AnalysisExportProvider>
  </div>;
}

export default function DashboardTabLayout({ children, ...props }) {
  const workspace = useContext(DashboardWorkspaceContext);
  const isolated = useContext(DashboardBlockContext);
  const legacyCharts = useAppStore(state => state.customCharts);
  const nodes = flatten(children);
  const entries = nodes.filter(node => React.isValidElement(node) && !Object.hasOwn(node.props, 'open') && !node.props['data-dashboard-static'] && (!node.props.chartScope || (workspace?.legacy?.customCharts?.[node.props.chartScope] || legacyCharts[node.props.chartScope] || []).length)).map((node, i) => ({ id: blockId(node, i), title: heading(node) || node.props.title || (workspace?.locale === 'en' ? 'Analysis' : '분석'), node }));
  const signature = JSON.stringify(entries.map(({ id, title }) => ({ id, title })));
  const setAvailable = workspace?.setAvailable;
  useEffect(() => {
    if (!isolated && setAvailable) setAvailable(JSON.parse(signature));
  }, [signature, isolated, setAvailable]);
  if (!workspace) return <div {...props}>{children}</div>;
  if (isolated) return entries.find(entry => entry.id === isolated.id)?.node || <section className="block"><p role="status">{workspace.locale === 'en' ? 'No data available for this scope.' : '이 조건에서 표시할 데이터가 없습니다.'}</p></section>;
  const { config } = workspace;
  const customs = (config.charts || []).map(custom => ({ id: custom.id, title: custom.name, custom }));
  const all = [...entries, ...customs];
  const order = orderBlocks(all.map(entry => entry.id), config);
  return <div {...props} className={`${props.className || ''} dashboard-block-grid`}>
    {nodes.filter(node => node.props?.['data-dashboard-static']).map((node, i) => <div className="dashboard-layout-block dashboard-static-insight" key={`static-${i}`}>{node}</div>)}
    {order.map(id => <Block key={id} {...all.find(entry => entry.id === id)} order={order} workspace={workspace} />)}
    {nodes.filter(node => React.isValidElement(node) && Object.hasOwn(node.props, 'open'))}
  </div>;
}
