import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FOLLOWUP_TOOL_SPECS } from './followupSpecs';
import { recipeVocabularyFor } from './toolVocabulary';
import { foldSteps, partitionForSync, serializeRecipe, parseRecipe } from './recipe';
import { TOOL_INPUT_KEYS } from '@/lib/analysis-settings/toolInputs';
import { ROUTES } from '@/lib/routeMap';

describe('follow-up view recipes',()=>{
  it.each(Object.entries(FOLLOWUP_TOOL_SPECS))('%s preserves analysis inputs and required evidence',(id,spec)=>{
    const vocabulary=recipeVocabularyFor(id);
    const defaults=foldSteps([],vocabulary,spec).state;
    expect(TOOL_INPUT_KEYS[id]).toContain('recipeSteps');
    const route=ROUTES.find(r=>r.id===id);expect(route).toBeTruthy();
    for(const locale of ['(ko)/[[...slug]]','(en)/en/[...slug]']) {
      const page=readFileSync(new URL(`../../app/${locale}/PageClient.jsx`,import.meta.url),'utf8');
      expect(page).toContain(`<ToolRecipeWorkspace toolId="${id}"`);
    }
    for(const block of spec.blocks){
      const result=foldSteps([{id:'view.hide',params:{block:block.id}}],vocabulary,spec);
      expect(result.state.data).toEqual(defaults.data);
      if(block.locked){expect(result.state.view.hidden).not.toContain(block.id);expect(result.rejected[0].code).toBe('LOCKED_BLOCK');}
      else expect(result.state.view.hidden).toContain(block.id);
    }
    const steps=[{id:'export.png.title',params:{}},{id:'export.report.hide',params:{section:'charts'}}];
    const result=foldSteps(steps,vocabulary,spec);
    expect(result.rejected).toEqual([]);expect(result.state.data).toEqual(defaults.data);
    expect(result.state.export.pngHeader).toBe('title');
    expect(partitionForSync(steps,vocabulary).syncable).toEqual(steps);
    expect(parseRecipe(serializeRecipe({toolId:id,steps}),{toolId:id}).ok).toBe(true);
  });
});
