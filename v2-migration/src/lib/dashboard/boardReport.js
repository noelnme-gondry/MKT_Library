import { captureAnalysisCharts } from '@/lib/analysis-export/chartSnapshots';
import { resolveBlockFilter, scopeLabel } from './workspace';

// Capture the currently rendered, saved tab only. No reanalysis or source rows.
export async function captureBoardReport(root, { tab, config, common, inputSignature, locale, demo = false }) {
  if (!root || !inputSignature) throw Error('BOARD_NOT_READY');
  const result = [];
  for (const element of root.querySelectorAll('.dashboard-layout-block[data-block-id]')) {
    if (!element.getClientRects().length || element.dataset.hidden) continue;
    const id=element.dataset.blockId;
    const filter=resolveBlockFilter(common,config.blocks?.[id]?.scope).filter;
    const scope=Object.fromEntries(Object.entries(filter).map(([key,value])=>[key,value instanceof Set?[...value]:value]));
    const title=element.querySelector('h2,h3')?.textContent?.trim() || (locale==='en'?'Analysis':'분석');
    const scopeCaption=element.querySelector('.dashboard-block-scope')?.textContent?.trim() || scopeLabel(filter,config.blocks?.[id]?.scope,locale);
    const caption=[scopeCaption,demo?(locale==='en'?'Sample data':'예시 데이터'):''].filter(Boolean).join(' · ');
    const clone=element.cloneNode(true);
    clone.querySelectorAll('button,input,select,textarea,canvas,table,.dashboard-block-toolbar,h2,h3').forEach(node=>node.remove());
    const evidence=clone.textContent.replace(/\s+/g,' ').trim();
    const tables=[...element.querySelectorAll('table')].map(table=>({title,cells:[...table.rows].map(row=>[...row.cells].map(cell=>cell.textContent.trim()))}));
    if(tables.some(table=>table.cells.length>1000)) throw Error('BOARD_TOO_LARGE');
    const charts=(await captureAnalysisCharts(element)).map(chart=>({...chart,title:`${title} · ${caption}`}));
    result.push({schemaVersion:1,id:`5-2:${tab}:${id}:${inputSignature}`,toolId:'5-2',toolTitle:locale==='en'?'Dashboard board':'대시보드 보드',dataGroup:'efficiency',blockKind:'board',headline:title,points:[caption,evidence].filter(Boolean),stats:[],scope,inputSignature,locale,charts,tables});
  }
  if(!result.length)throw Error('BOARD_NOT_READY');
  if(JSON.stringify(result).length>12000000)throw Error('BOARD_TOO_LARGE');
  return result;
}
