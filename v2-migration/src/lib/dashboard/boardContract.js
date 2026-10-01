import { METRIC_BY_ID } from '@/utils/metrics/metricRegistry';

// Versioned portable layout: never serialize CSV values, dates, file names or formula text.
export const BOARD_LIMIT = 20;
export const BOARD_MAX_BYTES = 128000;
const NATIVE_BLOCKS = {"funnel": ["s-funnel-wow", "s-funnel-ctl", "s-funnel-trend", "s-funnel-seg", "s-funnel", "5-2:funnel-charts"], "viz": ["s-cohort", "s-kpi", "s-charts", "s-custom-charts", "workbench"], "anomaly": ["s-anom", "5-2:anomaly-charts"], "ltv": ["s-ctl", "s-table", "s-ltv-curve", "s-mat", "5-2:ltv-charts"], "seasonality": ["s-seasonality"], "pacing": ["s-pace", "5-2:pacing-charts"], "scorecard": ["s-score", "s-score-daily"], "segment": ["s-matrix", "5-2:seg-charts"], "cohort": ["s-retention", "s-ret-segment", "s-ret-predict", "5-2:cohort-charts"]};
const TYPES = ['bar','hbar','line','pie','doughnut','scorecard'];
const DIMS = ['channel','country','platform','campaign_name','date'];
const enumValue = (value, choices, fallback) => choices.includes(value) ? value : fallback;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const nameOf = value => typeof value === 'string' ? value.normalize('NFKC').trim().slice(0,40).replace(/[\u0000-\u001f\u007f]/g,'') : '';
export function portableBoard(workspace, name) {
  const tabs = {};
  for (const [tab, native] of Object.entries(NATIVE_BLOCKS)) {
    const input = workspace?.tabs?.[tab]; if (!object(input)) continue;
    const ids = new Map(native.map(id=>[id,id]));
    const charts = (Array.isArray(input.charts)?input.charts:[]).filter(c=>c && METRIC_BY_ID[c.metric] && DIMS.includes(c.dim)).slice(0,30).map((c,index)=>{
      const id = `custom-${index}`; ids.set(c.id,id);
      return {id, type:enumValue(c.type,TYPES,'bar'), metric:c.metric, dim:c.dim, palette:enumValue(c.palette,['primary','teal','series'],'primary'), legend:enumValue(c.legend,['bottom','right','none'],'bottom'), sort:enumValue(c.sort,['label','asc','desc'],'label'), topN:enumValue(c.topN,[5,10,20,50,100],20), interval:enumValue(c.interval,['day','week','month'],'day'), labels:c.labels===true};
    });
    const blocks = {};
    for (const [id,b] of Object.entries(input.blocks || {})) if (ids.has(id) && object(b)) blocks[ids.get(id)]={width:enumValue(b.width,['full','half','third'],'full'),height:enumValue(String(b.height),['default','260','360','480'],'default'),hidden:b.hidden===true};
    tabs[tab]={order:[...new Set((Array.isArray(input.order)?input.order:[]).filter(id=>ids.has(id)).map(id=>ids.get(id)))],blocks,charts};
  }
  return {version:1,name:nameOf(name),tabs};
}
// Server and file imports reject unknown fields instead of silently accepting sensitive payloads.
export function validatePortableBoard(value) {
  if (!object(value) || value.version!==1 || !nameOf(value.name) || JSON.stringify(value).length>BOARD_MAX_BYTES) throw Error('INVALID_BOARD');
  const clean=portableBoard(value,value.name);
  const canonical = v => JSON.stringify(v, (_,x)=>object(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
  if(canonical(value)!==canonical(clean)) throw Error('INVALID_BOARD');
  return clean;
}
export function applyPortableBoard(workspace, input, locale='ko') {
  const board=validatePortableBoard(input);
  const tabs=Object.fromEntries(Object.entries(board.tabs).map(([tab,config])=>[tab,{...config,charts:config.charts.map(c=>({...c,name:`${locale==='en'?'Chart':'차트'} · ${c.metric}`}))}]));
  return {...workspace,tabs};
}
