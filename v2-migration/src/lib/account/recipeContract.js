import { decodeFollowupStep } from "@/lib/recipe/followupInputs";
import { sanitizeStep } from "@/lib/recipe/recipe";
import { publishedToolIds } from "@/lib/routeMap";

// 계정에 이름 붙여 저장하는 분석 설정(레시피) 계약. 서버·클라이언트가 같은 함수로 거른다.
// 담는 것: 도구 id · 이름 · 고른 단어 목록. 담지 않는 것: 원본 행·파일명·데이터 값.
// "Meta만 분석"처럼 값(params.values)을 가진 단계는 거절한다 — 클라이언트가
// partitionForSync로 먼저 빼고 보내지만, 서버도 믿지 않고 다시 막는다(2026-09-30 결정).
export const MAX_ACCOUNT_RECIPES = 100;
export const MAX_RECIPE_STEPS = 40;
export const MAX_RECIPE_NAME = 40;

export function normalizeRecipeName(value) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function recipeKey(toolId, name) {
  return `${toolId}\u001f${normalizeRecipeName(name).toLowerCase()}`;
}

export function accountRecipe(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_RECIPE");
  if (Object.keys(input).some((key) => !["toolId", "name", "steps", "updatedAt"].includes(key))) throw new Error("INVALID_RECIPE");
  const { toolId, steps } = input;
  const name = normalizeRecipeName(input.name);
  if (typeof toolId !== "string" || !publishedToolIds().includes(toolId)) throw new Error("INVALID_RECIPE");
  if (typeof input.name !== "string" || !name || name.length > MAX_RECIPE_NAME || /[\u0000-\u001f\u007f]/.test(name)) throw new Error("INVALID_RECIPE");
  if (!Array.isArray(steps) || !steps.length || steps.length > MAX_RECIPE_STEPS) throw new Error("INVALID_RECIPE");
  const clean = steps.map(sanitizeStep);
  if (clean.some((step) => !step || step.id.length > 80 || Object.hasOwn(step.params, "values"))) throw new Error("INVALID_RECIPE");
  for (const step of clean) if (step.id.startsWith("input.")) {
    try { decodeFollowupStep(toolId, step); } catch { throw new Error("INVALID_RECIPE"); }
  }
  const updatedAt = typeof input.updatedAt === "string" && !Number.isNaN(Date.parse(input.updatedAt)) ? input.updatedAt : null;
  return updatedAt ? { toolId, name, steps: clean, updatedAt } : { toolId, name, steps: clean };
}
