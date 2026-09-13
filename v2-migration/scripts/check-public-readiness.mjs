import { pathToFileURL } from "node:url";

// 공개 GET만 사용한다. 계정 생성·결제·메일 발송이나 운영 설정 변경은 하지 않는다.
export async function checkPublicReadiness({ origin = "https://growthoptplaybook.com", fetchImpl = fetch } = {}) {
  const read = async path => {
    try {
      const response = await fetchImpl(new URL(path, origin), { method: "GET", redirect: "error", signal: AbortSignal.timeout(15_000) });
      return response.ok ? await response.json() : null;
    } catch { return null; }
  };
  const [payment, account] = await Promise.all([read("/api/payments/config"), read("/api/account/session")]);
  const flag = value => typeof value === "boolean" ? value : null;
  // 공개 응답에도 로그인 정보가 추가될 수 있으므로 본문 전체를 출력하지 않는다.
  const observed = {
    paymentsEnabled: flag(payment?.enabled),
    paymentMode: ["live", "test"].includes(payment?.mode) ? payment.mode : null,
    accountsEnabled: flag(account?.enabled),
    signupRestricted: flag(account?.signupRestricted),
    mailConfigured: flag(account?.mailEnabled),
  };
  const unknown = Object.entries(observed).filter(([, value]) => value === null).map(([key]) => key);
  const publicConfigurationReady = unknown.length === 0 && observed.paymentsEnabled
    && observed.paymentMode === "live" && observed.accountsEnabled && !observed.signupRestricted && observed.mailConfigured;
  return { checkedAt: new Date().toISOString(), origin: new URL(origin).origin, observed, unknown,
    publicConfigurationReady, verified: ["public_configuration_only"],
    unverified: ["signup_and_login", "live_purchase", "pass_restore", "mail_delivery", "user_retention"] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await checkPublicReadiness();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.unknown.length || (process.argv.includes("--expect-public") && !result.publicConfigurationReady) ? 1 : 0;
}
