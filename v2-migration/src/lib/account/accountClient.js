import { useAppStore } from "@/store/useDataStore";
import { hasPaidAccess } from "@/lib/subscription/entitlement";
export async function accountRequest(path, options) {
  const response = await fetch(`/api/account/${path}`, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "ACCOUNTS_UNAVAILABLE");
  if (typeof window !== "undefined" && options?.method && options.method !== "GET" && path !== "login") window.dispatchEvent(new Event("gop-account-changed"));
  return data;
}
// 마지막 세션 조회 결과. 이용권 없는 로그인 계정도 설정을 저장할 수 있어 entitlement로는 못 가른다.
let signedInAccount = false;
export async function refreshAccount() {
  let data;
  try { data = await accountRequest("session"); }
  catch (error) {
    if (error.message === "ACCOUNT_RESTRICTED" && useAppStore.getState().entitlement?.account) useAppStore.getState().setEntitlement(null);
    throw error;
  }
  const current = useAppStore.getState().entitlement;
  // Do not shorten an existing anonymous purchase while the owner links it.
  if (data.entitlement) {
    const samePurchase = current && ((!current.account && !current.accountId) || (current.payment && current.accountId === data.account?.id));
    if (!(samePurchase && hasPaidAccess(current) && current.expiresAt >= data.entitlement.expiresAt)) useAppStore.getState().setEntitlement(data.entitlement);
  } else if (current?.account) useAppStore.getState().setEntitlement(null);
  signedInAccount = Boolean(data.account);
  // 로그인 계정에 기억된 원본 통화가 이 브라우저의 마지막 선택보다 우선한다.
  if (data.account?.sourceCurrency) useAppStore.getState().setPreferredSourceCurrency(data.account.sourceCurrency);
  return data;
}
// 원본 데이터 통화를 고르면 다음 업로드의 기본값이 된다. 로그인했으면 계정에도 남겨
// 다른 기기에서 같은 기본값을 쓴다. 계정 저장 실패는 로컬 기억을 막지 않는다.
export function rememberSourceCurrency(currency) {
  const store = useAppStore.getState();
  store.setPreferredSourceCurrency(currency);
  if (!signedInAccount || !["KRW", "USD"].includes(currency)) return;
  fetch(`/api/account/preferences?sourceCurrency=${currency}`, { method: "POST", cache: "no-store" }).catch(() => {});
}
