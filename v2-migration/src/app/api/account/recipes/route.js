import { requireAccount, accountDatabase, accountSameOrigin, accountResponse, accountError } from "@/lib/account/accountServer";
import { accountEntitlement } from "@/lib/account/archiveContract";
import { accountRecipe, MAX_ACCOUNT_RECIPES, recipeKey } from "@/lib/account/recipeContract";
import { admitPaymentRequest, paymentLimitResponse } from "@/lib/subscription/paymentRequestLimit";

// 이름 붙여 저장한 분석 설정. 매핑 동기화(/api/account/mappings)와 같은 규칙:
// 저장·변경은 유효 Pro, 만료 후에도 열람·삭제는 유지, 원본 데이터는 받지 않는다.
async function readInput(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_RECIPE");
  let size = 0, text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 64000) { await reader.cancel(); throw new Error("INVALID_RECIPE"); }
      text += decoder.decode(part.value, { stream: true });
    }
    try { return JSON.parse(text + decoder.decode()); } catch { throw new Error("INVALID_RECIPE"); }
  } finally { reader.releaseLock(); }
}

export async function GET(request) {
  try {
    const owner = await requireAccount(request);
    const { rows } = await accountDatabase().query("SELECT recipes FROM gop_account_recipes WHERE account_id=$1", [owner.id]);
    return accountResponse({ accountId: owner.id, recipes: rows[0]?.recipes || [], canApply: !!accountEntitlement(owner) });
  } catch (error) { return accountError(error); }
}

async function mutate(request, deleting = false) {
  if (!admitPaymentRequest("account-recipes", request)) return paymentLimitResponse();
  let client;
  try {
    accountSameOrigin(request);
    const owner = await requireAccount(request);
    if (!deleting && !accountEntitlement(owner)) throw new Error("PRO_REQUIRED");
    const input = await readInput(request);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_RECIPE");
    const keys = Object.keys(input);
    if (deleting) {
      const valid = (keys.length === 1 && input.all === true) || (keys.length === 2 && keys.every((key) => ["toolId", "name"].includes(key)) && typeof input.toolId === "string" && typeof input.name === "string");
      if (!valid) throw new Error("INVALID_RECIPE");
    } else if (keys.length !== 1 || keys[0] !== "recipe") throw new Error("INVALID_RECIPE");
    const incoming = deleting ? null : { ...accountRecipe(input.recipe), updatedAt: new Date().toISOString() };
    client = await accountDatabase().connect();
    await client.query("BEGIN");
    // 첫 저장 전에도 같은 계정의 동시 변경을 줄 세운다.
    await client.query("SELECT id FROM gop_accounts WHERE id=$1 FOR UPDATE", [owner.id]);
    const { rows } = await client.query("SELECT recipes FROM gop_account_recipes WHERE account_id=$1", [owner.id]);
    const recipes = new Map((rows[0]?.recipes || []).map((recipe) => [recipeKey(recipe.toolId, recipe.name), recipe]));
    if (deleting) { if (input.all) recipes.clear(); else recipes.delete(recipeKey(input.toolId, input.name)); }
    else recipes.set(recipeKey(incoming.toolId, incoming.name), incoming);
    if (recipes.size > MAX_ACCOUNT_RECIPES) throw new Error("RECIPE_LIMIT");
    const result = [...recipes.values()];
    await client.query("INSERT INTO gop_account_recipes(account_id,recipes) VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET recipes=EXCLUDED.recipes,updated_at=NOW()", [owner.id, JSON.stringify(result)]);
    await client.query("COMMIT");
    return accountResponse({ recipes: result });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    return accountError(error);
  } finally { client?.release(); }
}
export const POST = (request) => mutate(request);
export const DELETE = (request) => mutate(request, true);
