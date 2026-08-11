"use client";

import { useEffect } from "react";
import Link from "next/link";
import { trackProductEvent } from "@/lib/analytics";

export default function RouteErrorRecovery({ error, reset, locale = "ko", scope = "analysis" }) {
  const isEnglish = locale === "en";
  const isSiteWide = scope === "site";

  useEffect(() => {
    // 원자료·매핑 값은 오류 객체에 섞여 있을 수 있으므로 로그에는 식별용 digest와
    // 오류 타입만 남긴다. 분석 데이터는 브라우저 밖으로 내보내지 않는 계약을 지킨다.
    console.error("Route render failed", {
      digest: error?.digest || null,
      name: error?.name || "Error",
    });
    // 지금까지 크래시는 콘솔에만 남고 어디에도 전송되지 않아, "어떤 CSV가 앱을
    // 깨뜨리는가"를 영원히 알 수 없었다. 오류 메시지·스택에는 원자료가 섞일 수
    // 있으므로 절대 싣지 않고, 분류 가능한 범주형 값만 보낸다(§2.2).
    trackProductEvent("app_error", {
      scope,
      state: String(error?.name || "Error").slice(0, 40),
      section_id: String(error?.digest || "no_digest").slice(0, 40),
      locale,
    });
  }, [error, scope, locale]);

  return (
    <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: "40px 20px" }}>
      <section className="card" style={{ width: "min(100%, 540px)", padding: "28px", textAlign: "center" }}>
        <div aria-hidden="true" style={{ fontSize: "34px", marginBottom: "12px" }}>⚠</div>
        <h1 style={{ fontSize: "22px", margin: "0 0 10px" }}>
          {isSiteWide
            ? (isEnglish ? "This page could not be displayed" : "이 페이지를 표시하지 못했습니다")
            : (isEnglish ? "This analysis could not be displayed" : "이 분석 화면을 표시하지 못했습니다")}
        </h1>
        <p className="muted" style={{ margin: "0 auto 20px", maxWidth: "420px", lineHeight: 1.6 }}>
          {isSiteWide
            ? (isEnglish
                ? "Try loading the page again. If the issue continues, return home and choose the page you need."
                : "페이지를 다시 불러와 보세요. 계속되면 홈으로 돌아가 필요한 화면을 다시 선택해 주세요.")
            : (isEnglish
                ? "Your CSV stays in this browser. Try again first; if the issue continues, return to the analysis hub and reopen the tool."
                : "CSV는 이 브라우저 안에 그대로 있습니다. 먼저 다시 시도하고, 계속되면 분석 허브로 돌아가 도구를 다시 열어주세요.")}
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
          <button type="button" className="btn primary" onClick={reset}>
            {isEnglish ? "Try again" : "다시 시도"}
          </button>
          {!isSiteWide && (
            <Link href={isEnglish ? "/en/tools/marketing-response" : "/tools/marketing-response"} className="btn secondary">
              {isEnglish ? "Analysis hub" : "분석 허브로"}
            </Link>
          )}
          <Link href={isEnglish ? "/en" : "/"} className="btn secondary">
            {isEnglish ? "Home" : "홈으로"}
          </Link>
        </div>
      </section>
    </main>
  );
}
