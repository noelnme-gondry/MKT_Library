"use client";

import RouteErrorRecovery from "@/components/RouteErrorRecovery";

export default function EnglishRootError({ error, reset }) {
  return <RouteErrorRecovery error={error} reset={reset} locale="en" scope="site" />;
}
