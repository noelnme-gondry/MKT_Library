import { requireAccount, accountDatabase, accountSameOrigin, accountResponse, accountError } from "@/lib/account/accountServer";
import { accountEntitlement } from "@/lib/account/archiveContract";
import { accountMappingRule, MAX_ACCOUNT_MAPPING_RULES } from "@/lib/account/mappingContract";
import { admitPaymentRequest, paymentLimitResponse } from "@/lib/subscription/paymentRequestLimit";

async function readInput(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_MAPPING");
  let size = 0, text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 128000) { await reader.cancel(); throw new Error("INVALID_MAPPING"); }
      text += decoder.decode(part.value, { stream: true });
    }
    try { return JSON.parse(text + decoder.decode()); } catch { throw new Error("INVALID_MAPPING"); }
  } finally { reader.releaseLock(); }
}

export async function GET(request) {
  try {
    const owner = await requireAccount(request);
    const { rows } = await accountDatabase().query("SELECT rules,enabled FROM gop_account_mappings WHERE account_id=$1", [owner.id]);
    return accountResponse({ accountId: owner.id, rules: rows[0]?.rules || [], enabled: rows[0]?.enabled ?? true, canApply: !!accountEntitlement(owner) });
  } catch (error) { return accountError(error); }
}

async function mutate(request, deleting = false) {
  if (!admitPaymentRequest("account-mappings", request)) return paymentLimitResponse();
  let client;
  try {
    accountSameOrigin(request);
    const owner = await requireAccount(request);
    if (!deleting && !accountEntitlement(owner)) throw new Error("PRO_REQUIRED");
    const input = await readInput(request);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_MAPPING");
    const keys = Object.keys(input || {});
    if (keys.length !== 1 || !keys.every(key => (deleting ? ["name", "all"] : ["rules", "enabled"]).includes(key))) throw new Error("INVALID_MAPPING");
    if ("enabled" in input && typeof input.enabled !== "boolean") throw new Error("INVALID_MAPPING");
    if ("all" in input && input.all !== true) throw new Error("INVALID_MAPPING");
    if ("name" in input && (typeof input.name !== "string" || !input.name || input.name.length > 200)) throw new Error("INVALID_MAPPING");
    let incoming = [];
    if ("rules" in input) {
      if (!Array.isArray(input.rules) || input.rules.length > MAX_ACCOUNT_MAPPING_RULES) throw new Error("INVALID_MAPPING");
      incoming = input.rules.map(accountMappingRule);
    }
    client = await accountDatabase().connect();
    await client.query("BEGIN");
    // Serialize changes even before this account has its first mapping row.
    await client.query("SELECT id FROM gop_accounts WHERE id=$1 FOR UPDATE", [owner.id]);
    const { rows } = await client.query("SELECT rules,enabled FROM gop_account_mappings WHERE account_id=$1", [owner.id]);
    const rules = new Map((rows[0]?.rules || []).map(rule => [rule.normalizedColumnName, rule]));
    if (deleting) { if (input.all) rules.clear(); else rules.delete(input.name); }
    else for (const rule of incoming) rules.set(rule.normalizedColumnName, rule);
    if (rules.size > MAX_ACCOUNT_MAPPING_RULES) throw new Error("MAPPING_LIMIT");
    const enabled = input.enabled ?? rows[0]?.enabled ?? true;
    const result = [...rules.values()];
    await client.query("INSERT INTO gop_account_mappings(account_id,rules,enabled) VALUES($1,$2,$3) ON CONFLICT(account_id) DO UPDATE SET rules=EXCLUDED.rules,enabled=EXCLUDED.enabled,updated_at=NOW()", [owner.id, JSON.stringify(result), enabled]);
    await client.query("COMMIT");
    return accountResponse({ rules: result, enabled });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    return accountError(error);
  } finally { client?.release(); }
}
export const POST = request => mutate(request);
export const DELETE = request => mutate(request, true);
