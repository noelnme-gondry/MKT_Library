import { trackProductEvent } from "@/lib/analytics";
import { requirePaidExport } from "./paidExport";

/* ============================================================
 * 다운로드 계측 — 시도 · 결과 · 실패를 한 곳에서 센다.
 *
 * 고치기 전 실제 상태:
 *   ① 시도 이벤트가 없었다. 게이트에 막힌 것(`subscription_gate_viewed`)과
 *      성공한 것(`result_downloaded`)만 각각 찍혀서, 분모가 없으니
 *      "눌렀는데 못 받은 비율"을 계산할 방법이 없었다.
 *   ② 실패가 한 건도 안 찍혔다. DownloadHub와 WeeklyReport의 `catch`는
 *      화면에 문구만 띄우고 이벤트를 보내지 않았다 — 파일 생성이 터지는
 *      사용자가 있어도 지표에는 "시도조차 없음"으로 보인다.
 *   ③ 무료 항목의 성공은 `&& !item.free` 때문에 아예 안 세어졌다.
 *
 * 이제 모든 다운로드가 이 함수를 지난다. 표면마다 다시 적으면 같은 행동이
 * 표면 수만큼 다른 이름으로 갈린다(§16).
 *
 * `result_downloaded`의 의미 변경: 무료 성공도 포함하되 `state`로 가른다.
 * `state=paid`로 필터하면 종전 시계열과 정확히 같다 — 과거 데이터는 잃지 않는다.
 * ============================================================ */

// 결과는 열거형이다. 자유 문자열을 싣으면 GA 탐색이 쪼개진다.
export const DOWNLOAD_OUTCOMES = Object.freeze(["succeeded", "blocked", "declined", "failed"]);

// 실패 사유는 범주형만 싣는다 — 원문 메시지에는 파일명·컬럼명 같은
// 사용자 데이터가 섞일 수 있다(§2.2).
export function downloadFailureReason(error) {
  const name = String(error?.name || "");
  if (name === "QuotaExceededError") return "storage_full";
  if (/^(AbortError|TimeoutError)$/.test(name)) return "aborted";
  if (name === "RangeError") return "too_large";
  if (error instanceof TypeError) return "build_failed";
  return "unknown";
}

/**
 * 다운로드 한 번의 전 구간을 센다.
 * `run`은 기존 규약을 그대로 따른다 — `false`를 돌려주면 실제로 내려주지 않은 것.
 * 예외는 삼키지 않고 다시 던진다. 화면이 기존처럼 에러 문구를 띄워야 한다.
 */
export async function runGatedDownload({ toolId, locale = "ko", format = "report", source = "export", free = false, run }) {
  const base = { ...(toolId ? { tool_id: toolId } : {}), download_type: format, source, locale };
  trackProductEvent("result_download_attempted", { ...base, state: free ? "free" : "paid" });

  // 막힌 경우 `requirePaidExport`가 이미 `subscription_gate_viewed`를 찍는다.
  // 여기서 또 찍으면 같은 차단이 두 번 세어진다.
  if (!free && !requirePaidExport({ toolId, locale, format })) return "blocked";

  try {
    if (await run() === false) return "declined";
    trackProductEvent("result_downloaded", { ...base, state: free ? "free" : "paid" });
    return "succeeded";
  } catch (error) {
    trackProductEvent("result_download_failed", { ...base, state: downloadFailureReason(error) });
    throw error;
  }
}
