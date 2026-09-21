import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ owner: null, saved: null, calls: [] }));
vi.mock("@/lib/account/accountServer", () => {
  const query = async (sql, args) => {
    state.calls.push([sql, args]);
    if (sql.startsWith("SELECT rules")) return { rows: state.saved ? [state.saved] : [] };
    if (sql.startsWith("INSERT INTO")) state.saved = { rules: JSON.parse(args[1]), enabled: args[2] };
    return { rows: [] };
  };
  return {
    requireAccount: async () => { if (!state.owner) throw new Error("LOGIN_REQUIRED"); return state.owner; },
    accountDatabase: () => ({ query, connect: async () => ({ query, release() {} }) }),
    accountSameOrigin: request => { if (request.headers.get("origin") !== "https://growthoptplaybook.com") throw new Error("INVALID_ORIGIN"); },
    accountResponse: body => Response.json(body),
    accountError: error => Response.json({ error: error.message }, { status: ({ LOGIN_REQUIRED: 401, INVALID_ORIGIN: 403, PRO_REQUIRED: 402, INVALID_MAPPING: 400, MAPPING_LIMIT: 409 })[error.message] || 503 }),
  };
});
vi.mock("@/lib/subscription/paymentRequestLimit", () => ({ admitPaymentRequest: () => true, paymentLimitResponse: () => Response.json({}, { status: 429 }) }));
import { GET, POST, DELETE } from "./route";
const request = (body, origin = "https://growthoptplaybook.com") => new Request(`${origin}/api/account/mappings`, { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { state.owner = { id: "owner-a", paid_until: new Date(Date.now() + 86400000).toISOString() }; state.saved = null; state.calls = []; });
it("rejects signed-out and foreign-origin writes before touching stored rules", async () => {
  state.owner = null;
  expect((await POST(request({ rules: [] }))).status).toBe(401);
  expect((await POST(request({ rules: [] }, "https://attacker.example"))).status).toBe(403);
  expect(state.calls).toEqual([]);
});
it("stores just names and rules under the authenticated owner, merging later edits", async () => {
  expect((await POST(request({ rules: [{ normalizedColumnName: "My Spend", canonicalKey: "media_spend" }] }))).status).toBe(200);
  await POST(request({ rules: [{ normalizedColumnName: "Day", canonicalKey: "date" }] }));
  expect((await (await GET(request({}))).json()).rules).toHaveLength(2);
  const writes = state.calls.filter(([sql]) => sql.startsWith("INSERT INTO"));
  expect(writes.every(([, args]) => args[0] === "owner-a")).toBe(true);
  expect(Object.keys(state.saved.rules[0]).sort()).toEqual(["canonicalKey", "normalizedColumnName"]);
});
it("rejects source data, malformed payloads and account-id injection", async () => {
  for (const payload of [null, [], { rules: [], accountId: "other" }, { rules: [{ normalizedColumnName: "x", canonicalKey: "date", raw: ["secret"] }] }]) expect((await POST(request(payload))).status).toBe(400);
  expect(state.saved).toBeNull();
});
it("preserves read/export/delete after expiry but denies changes and application", async () => {
  state.saved = { rules: [{ normalizedColumnName: "x", canonicalKey: "date" }], enabled: true };
  state.owner.paid_until = "2020-01-01";
  expect(await (await GET(request({}))).json()).toMatchObject({ canApply: false, rules: state.saved.rules });
  expect((await POST(request({ enabled: false }))).status).toBe(402);
  expect((await DELETE(request({ name: "x" }))).status).toBe(200);
  expect(state.saved.rules).toEqual([]);
});
