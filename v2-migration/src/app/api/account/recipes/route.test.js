import { beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
const state = vi.hoisted(() => ({ owner: null, saved: null, calls: [] }));
vi.mock("@/lib/account/accountServer", () => {
  const query = async (sql, args) => {
    state.calls.push([sql, args]);
    if (sql.startsWith("SELECT recipes")) return { rows: state.saved ? [state.saved] : [] };
    if (sql.startsWith("INSERT INTO")) state.saved = { recipes: JSON.parse(args[1]) };
    return { rows: [] };
  };
  return {
    requireAccount: async () => { if (!state.owner) throw new Error("LOGIN_REQUIRED"); return state.owner; },
    accountDatabase: () => ({ query, connect: async () => ({ query, release() {} }) }),
    accountSameOrigin: (request) => { if (request.headers.get("origin") !== "https://growthoptplaybook.com") throw new Error("INVALID_ORIGIN"); },
    accountResponse: (body) => Response.json(body),
    accountError: (error) => Response.json({ error: error.message }, { status: ({ LOGIN_REQUIRED: 401, INVALID_ORIGIN: 403, PRO_REQUIRED: 402, INVALID_RECIPE: 400, RECIPE_LIMIT: 409 })[error.message] || 503 }),
  };
});
vi.mock("@/lib/subscription/paymentRequestLimit", () => ({ admitPaymentRequest: () => true, paymentLimitResponse: () => Response.json({}, { status: 429 }) }));
import { GET, POST, DELETE } from "./route";
import { MAX_ACCOUNT_RECIPES } from "@/lib/account/recipeContract";

const request = (body, origin = "https://growthoptplaybook.com") => new Request(`${origin}/api/account/recipes`, { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const weekly = { toolId: "5-21", name: "주간 보고용", steps: [{ id: "level.pvm.channelCampaign", params: {} }, { id: "period.lookback.1", params: {} }] };
beforeEach(() => { state.owner = { id: "owner-a", paid_until: new Date(Date.now() + 86400000).toISOString() }; state.saved = null; state.calls = []; });

it("로그인 전·다른 출처의 쓰기는 저장소에 닿기 전에 막는다", async () => {
  state.owner = null;
  expect((await POST(request({ recipe: weekly }))).status).toBe(401);
  expect((await POST(request({ recipe: weekly }, "https://attacker.example"))).status).toBe(403);
  expect(state.calls).toEqual([]);
});

it("도구·이름·단어 목록만 로그인한 계정에 저장하고, 같은 이름은 덮어쓴다", async () => {
  expect((await POST(request({ recipe: weekly }))).status).toBe(200);
  await POST(request({ recipe: { ...weekly, name: " 주간  보고용 ", steps: [{ id: "view.top.5", params: {} }] } }));
  await POST(request({ recipe: { ...weekly, name: "월간" } }));
  const body = await (await GET(request({}))).json();
  expect(body.recipes.map((recipe) => recipe.name)).toEqual(["주간 보고용", "월간"]);
  expect(body.recipes[0].steps).toEqual([{ id: "view.top.5", params: {} }]);
  expect(Object.keys(body.recipes[0]).sort()).toEqual(["name", "steps", "toolId", "updatedAt"]);
  expect(state.calls.filter(([sql]) => sql.startsWith("INSERT INTO")).every(([, args]) => args[0] === "owner-a")).toBe(true);
});

it("데이터 값이 든 단계·원본·계정 id 주입·모르는 도구는 거절한다", async () => {
  const payloads = [
    null, [], { recipe: weekly, accountId: "other" },
    { recipe: { ...weekly, steps: [{ id: "filter.only.analysis", params: { field: "channel", values: ["Meta"] } }] } },
    { recipe: { ...weekly, rows: [{ spend: 1 }] } },
    { recipe: { ...weekly, toolId: "no-such-tool" } },
    { recipe: { ...weekly, name: "" } },
    { recipe: { ...weekly, name: "가".repeat(41) } },
    { recipe: { ...weekly, steps: [] } },
  ];
  for (const payload of payloads) expect((await POST(request(payload))).status, JSON.stringify(payload)?.slice(0, 60)).toBe(400);
  expect(state.saved).toBeNull();
});

it("계정당 상한을 넘기면 저장하지 않는다", async () => {
  state.saved = { recipes: Array.from({ length: MAX_ACCOUNT_RECIPES }, (_, i) => ({ ...weekly, name: `r${i}` })) };
  expect((await POST(request({ recipe: { ...weekly, name: "하나 더" } }))).status).toBe(409);
  expect(state.saved.recipes).toHaveLength(MAX_ACCOUNT_RECIPES);
});

it("만료 후에도 열람·삭제는 되고 저장은 막는다", async () => {
  state.saved = { recipes: [weekly] };
  state.owner.paid_until = "2020-01-01";
  expect(await (await GET(request({}))).json()).toMatchObject({ canApply: false, recipes: [weekly] });
  expect((await POST(request({ recipe: weekly }))).status).toBe(402);
  expect((await DELETE(request({ toolId: "5-21", name: "주간 보고용" }))).status).toBe(200);
  expect(state.saved.recipes).toEqual([]);
});

it("시작 마이그레이션이 레시피 테이블을 만든다", () => {
  const migrate = readFileSync(new URL("../../../../../scripts/migrate-payment-periods.mjs", import.meta.url), "utf8");
  expect(migrate).toContain("./account-recipes.sql");
  const sql = readFileSync(new URL("../../../../../scripts/account-recipes.sql", import.meta.url), "utf8");
  expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS gop_account_recipes/);
  // 화면·계약 상한과 DB CHECK가 같은 값이어야 한다(한쪽만 고치면 저장이 서버에서 튕긴다).
  expect(sql).toContain(`jsonb_array_length(recipes) <= ${MAX_ACCOUNT_RECIPES}`);
});
