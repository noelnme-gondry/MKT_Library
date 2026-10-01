"use client";
import { useCallback, useMemo, useRef, useState } from 'react';
import RecipeCommandInput from './RecipeCommandInput';
import { FOLLOWUP_TOOL_SPECS } from '@/lib/recipe/followupSpecs';
import { recipeVocabularyFor } from '@/lib/recipe/toolVocabulary';
import { snapshotFollowupInputs, followupOverrides } from '@/lib/recipe/followupInputs';
import { partitionForSync, foldSteps } from '@/lib/recipe/recipe';
import { useSavedToolInput } from '@/lib/analysis-settings/useSavedToolInput';
import { useAccountRecipes } from '@/lib/recipe/useAccountRecipes';
import { ToolRecipeContext } from '@/lib/recipe/ToolRecipeContext';
import { AnalysisExportProvider } from '@/lib/analysis-export/AnalysisExportContext';
import { figureExportSettings } from '@/lib/analysis-export/exportOptions';
import { toolIndexEntry } from '@/lib/toolIndex';
import { isDemoData } from '@/lib/dataOrigin';
import { useAppStore } from '@/store/useDataStore';

export default function ToolRecipeWorkspace(props) {
  return FOLLOWUP_TOOL_SPECS[props.toolId] ? <Workspace key={props.toolId} {...props}/> : props.children;
}
function Workspace({toolId,locale='ko',children}) {
  const spec=FOLLOWUP_TOOL_SPECS[toolId],vocabulary=recipeVocabularyFor(toolId);
  const [steps,setSteps]=useSavedToolInput(toolId,'recipeSteps',[]);
  const csv=useAppStore(s=>s.csvData);
  const ready=Boolean(csv?.headers?.length || toolId === "5-4");
  const [evidence,setEvidence]=useState(null);
  const liveInputs = useRef({});
  const [application, setApplication] = useState(null);
  const [applyError, setApplyError] = useState(false);
  const register = useCallback((key, value) => { liveInputs.current[key] = { source: csv?.raw, value }; }, [csv?.raw]);
  const applyPreset = incoming => {
    if (!presets.canApply) { setApplyError(true); return false; }
    try {
      const overrides = followupOverrides(toolId, incoming);
      // Validate the whole recipe before changing either inputs or visible blocks.
      if (foldSteps(incoming, vocabulary, spec).rejected.length) throw new Error('INVALID_RECIPE');
      setSteps(partitionForSync(incoming, vocabulary).syncable);
      setApplication({ overrides });
      setApplyError(false);
      return true;
    } catch { setApplyError(true); return false; }
  };

  const registerFigureContext=useCallback(context=>setEvidence(previous=>JSON.stringify(previous?.context)===JSON.stringify(context)&&previous?.csv===csv?previous:{csv,context}),[csv]);
  const presets=useAccountRecipes(toolId,vocabulary);
  const recipePresets = { ...presets, save: async (name, currentSteps) => {
    try {
      const values = Object.fromEntries(Object.entries(liveInputs.current).filter(([, entry]) => entry.source === csv?.raw).map(([key, entry]) => [key, entry.value]));
      return await presets.save(name, snapshotFollowupInputs(toolId, values, currentSteps));
    } catch (error) { return { ok: false, code: error.message === 'UNAPPLIED_ANALYSIS_INPUT' ? error.message : 'INVALID_ANALYSIS_INPUT' }; }
  }};
  const fold=useMemo(()=>foldSteps(steps,vocabulary,spec),[steps,vocabulary,spec]);
  const context=useMemo(()=>({toolSpec:spec,mappedFields:new Set(Object.values(csv?.mapping||{})),dimensions:[]}),[spec,csv?.mapping]);
  const title=toolIndexEntry(toolId,locale)?.name || toolId;
  const exports=figureExportSettings({options:fold.state.export,toolId,toolTitle:title,source:{importSource:isDemoData(csv)?'demo':csv?.importSource,fileName:isDemoData(csv)?'':csv?.fileName},...(evidence?.csv===csv?evidence.context:null)});
  return <ToolRecipeContext.Provider value={{toolId,exportOptions:fold.state.export,hidden:fold.state.view.hidden,registerFigureContext,inputs:{application,register}}}>
    <AnalysisExportProvider value={exports}>
      <div className="tool-autonomy" data-tool-id={toolId}>
        {ready && <section className="tool-recipe-controls" aria-label={locale==='en'?'Analysis and view settings':'분석·보기 설정'}>
          <RecipeCommandInput vocabulary={vocabulary} context={context} steps={steps} onStepsChange={setSteps} rejected={fold.rejected} presets={recipePresets} canSave onApplyPreset={applyPreset} isStepVisible={step => !step.id.startsWith("input.")} locale={locale} label={locale==='en'?'Analysis and view settings':'분석·보기 설정'}/>
          <p className="tool-recipe-controls__hint">{locale==='en'?'Save analysis options and view/download choices to your account. Budgets, dates, columns and data values stay in this device’s project settings. Loading a setup does not confirm study conditions.':'분석 방법·옵션과 보기·다운로드 선택을 계정에 저장합니다. 예산·날짜·열 이름·데이터 값은 이 기기의 프로젝트 설정에 남습니다. 실험 조건 확인은 불러오기로 대체하지 않습니다.'}</p>
          {applyError && <p role="alert">{locale === 'en' ? 'Setup was not applied. Check Pro access and whether the settings are valid for this tool.' : '설정을 적용하지 않았습니다. Pro 이용 상태와 이 도구에서 쓸 수 있는 설정인지 확인해 주세요.'}</p>}
        </section>}
        {children}
      </div>
    </AnalysisExportProvider>
  </ToolRecipeContext.Provider>;
}
