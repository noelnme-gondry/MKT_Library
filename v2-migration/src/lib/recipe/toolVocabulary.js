import { COMMON_WORDS } from "@/lib/vocabulary/commonWords";
import { PVM_WORDS } from "@/lib/vocabulary/tools/pvmWords";
import { buildVocabulary } from "@/lib/vocabulary/vocabulary";

// 도구별 명령 입력창 단어 사전 — 도구 화면과 마이페이지(저장한 설정 목록)가 같은 사전을 쓴다.
// 레시피를 붙인 도구는 여기에 한 줄을 더한다(§12.32).
const VOCABULARIES = {
  "5-21": buildVocabulary([...COMMON_WORDS, ...PVM_WORDS]),
};

export const RECIPE_TOOL_IDS = Object.freeze(Object.keys(VOCABULARIES));

export function recipeVocabularyFor(toolId) {
  return VOCABULARIES[toolId] || null;
}
