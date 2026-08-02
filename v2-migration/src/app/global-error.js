"use client";

import RouteErrorRecovery from "@/components/RouteErrorRecovery";

export default function GlobalError({ error, reset }) {
  const locale = typeof window !== "undefined" && window.location.pathname.startsWith("/en") ? "en" : "ko";
  return (
    <html lang={locale}>
      <body>
        <RouteErrorRecovery error={error} reset={reset} locale={locale} scope="site" />
      </body>
    </html>
  );
}
