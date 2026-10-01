import { requireAccount, accountDatabase, accountSameOrigin, accountResponse, accountError } from "@/lib/account/accountServer";
import { accountEntitlement } from "@/lib/account/archiveContract";
import { validatePortableBoard, BOARD_LIMIT } from "@/lib/dashboard/boardContract";
const boardKey = name => name.normalize("NFKC").trim().toLowerCase();
import { admitPaymentRequest, paymentLimitResponse } from "@/lib/subscription/paymentRequestLimit";

// 값 없는 보드 배치. 기기 전용 대상·날짜·계산 결과는 계약에서 거절한다:
// 저장·변경은 유효 Pro, 만료 후에도 열람·삭제는 유지, 원본 데이터는 받지 않는다.
async function readInput(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_BOARD");
  let size = 0, text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 128000) { await reader.cancel(); throw new Error("INVALID_BOARD"); }
      text += decoder.decode(part.value, { stream: true });
    }
    try { return JSON.parse(text + decoder.decode()); } catch { throw new Error("INVALID_BOARD"); }
  } finally { reader.releaseLock(); }
}

export async function GET(request) {
  try {
    const owner = await requireAccount(request);
    const { rows } = await accountDatabase().query("SELECT boards FROM gop_account_boards WHERE account_id=$1", [owner.id]);
    return accountResponse({ accountId: owner.id, boards: rows[0]?.boards || [], canApply: !!accountEntitlement(owner) });
  } catch (error) { return accountError(error); }
}

async function mutate(request, deleting = false) {
  if (!admitPaymentRequest("account-boards", request)) return paymentLimitResponse();
  let client;
  try {
    accountSameOrigin(request);
    const owner = await requireAccount(request);
    if (!deleting && !accountEntitlement(owner)) throw new Error("PRO_REQUIRED");
    const input = await readInput(request);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_BOARD");
    const keys = Object.keys(input);
    if (deleting) {
      const valid = (keys.length === 1 && input.all === true) || (keys.length === 1 && keys[0] === "name" && typeof input.name === "string" && input.name.length <= 40);
      if (!valid) throw new Error("INVALID_BOARD");
    } else if (keys.length !== 1 || keys[0] !== "board") throw new Error("INVALID_BOARD");
    const incoming = deleting ? null : { ...validatePortableBoard(input.board), updatedAt: new Date().toISOString() };
    client = await accountDatabase().connect();
    await client.query("BEGIN");
    // 첫 저장 전에도 같은 계정의 동시 변경을 줄 세운다.
    await client.query("SELECT id FROM gop_accounts WHERE id=$1 FOR UPDATE", [owner.id]);
    const { rows } = await client.query("SELECT boards FROM gop_account_boards WHERE account_id=$1", [owner.id]);
    const boards = new Map((rows[0]?.boards || []).map((board) => [boardKey(board.name), board]));
    if (deleting) { if (input.all) boards.clear(); else boards.delete(boardKey(input.name)); }
    else boards.set(boardKey(incoming.name), incoming);
    if (boards.size > BOARD_LIMIT) throw new Error("BOARD_LIMIT");
    const result = [...boards.values()];
    await client.query("INSERT INTO gop_account_boards(account_id,boards) VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET boards=EXCLUDED.boards,updated_at=NOW()", [owner.id, JSON.stringify(result)]);
    await client.query("COMMIT");
    return accountResponse({ boards: result });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    return accountError(error);
  } finally { client?.release(); }
}
export const POST = (request) => mutate(request);
export const DELETE = (request) => mutate(request, true);
