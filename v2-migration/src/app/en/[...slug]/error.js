"use client";

import RouteErrorRecovery from "@/components/RouteErrorRecovery";

export default function EnglishRouteError({ error, reset }) {
  return <RouteErrorRecovery error={error} reset={reset} locale="en" />;
}
