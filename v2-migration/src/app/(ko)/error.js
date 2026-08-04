"use client";

import RouteErrorRecovery from "@/components/RouteErrorRecovery";

export default function RootError({ error, reset }) {
  return <RouteErrorRecovery error={error} reset={reset} locale="ko" scope="site" />;
}
