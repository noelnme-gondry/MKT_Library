import { useAppStore } from "@/store/useDataStore";
import { hasPaidAccess } from "./entitlement";
import { trackProductEvent } from "@/lib/analytics";

export function requirePaidExport({ toolId = useAppStore.getState().currentRouteId, locale = typeof window !== "undefined" && /^\/en(?:\/|$)/.test(window.location.pathname) ? "en" : "ko", format = "report" } = {}) {
  if (hasPaidAccess(useAppStore.getState().entitlement)) return true;
  useAppStore.setState({ purchasePrompt: { toolId, locale, format } });
  trackProductEvent("subscription_gate_viewed", { tool_id: toolId, locale, source: "analysis_export", download_type: format });
  return false;
}
