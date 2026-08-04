"use client";

import RouteErrorRecovery from "@/components/RouteErrorRecovery";

export default function KoreanRouteError({ error, reset }) {
  return <RouteErrorRecovery error={error} reset={reset} locale="ko" />;
}
