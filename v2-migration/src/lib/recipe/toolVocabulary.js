import { followupWords } from "./followupInputs";
import { FOLLOWUP_TOOL_SPECS } from "./followupSpecs";
import { DASHBOARD_WORDS } from "@/lib/vocabulary/tools/dashboardWords";
import { ALLOCATION_WORDS } from "@/lib/vocabulary/tools/allocationWords";
import { COMMON_WORDS } from "@/lib/vocabulary/commonWords";
import { PVM_WORDS } from "@/lib/vocabulary/tools/pvmWords";
import { SATURATION_WORDS } from "@/lib/vocabulary/tools/saturationWords";
import { buildVocabulary } from "@/lib/vocabulary/vocabulary";

// 도구별 명령 입력창 단어 사전 — 도구 화면과 마이페이지(저장한 설정 목록)가 같은 사전을 쓴다.
// 레시피를 붙인 도구는 여기에 한 줄을 더한다(§12.32).
const VOCABULARIES = {
  ...Object.fromEntries(Object.keys(FOLLOWUP_TOOL_SPECS).map(id => [id, buildVocabulary([...COMMON_WORDS.filter(entry => entry.id === "view.hide" || (entry.kind === "export" && !entry.id.startsWith("export.format.") && entry.id !== "export.caveats.exclude")), ...followupWords(id)])])),
  "5-2": buildVocabulary([...COMMON_WORDS.filter(entry => entry.id === "view.hide" || (entry.kind === "export" && !entry.id.startsWith("export.format.")) || ["filter.only.analysis", "filter.exclude.analysis"].includes(entry.id)), ...DASHBOARD_WORDS]),
  "5-3": buildVocabulary([...COMMON_WORDS.filter(entry => entry.id === "view.hide" || (entry.kind === "export" && !entry.id.startsWith("export.format."))), ...ALLOCATION_WORDS]),
  "5-21": buildVocabulary([...COMMON_WORDS, ...PVM_WORDS]),
  "5-22": buildVocabulary([
    ...COMMON_WORDS.filter((entry) => entry.kind !== "period"
      && entry.id !== "level.dimensionAbove" && !entry.id.startsWith("view.only.")),
    ...SATURATION_WORDS,
  ]),
};

export const RECIPE_TOOL_IDS = Object.freeze(Object.keys(VOCABULARIES));

export function recipeVocabularyFor(toolId) {
  return VOCABULARIES[toolId] || null;
}
