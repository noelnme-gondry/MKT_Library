import { rememberPaymentReturn } from "./paymentReturnPath";
import { useAppStore } from "@/store/useDataStore";
import { hasPurchasedAccess } from "./entitlement";
import { trackProductEvent } from "@/lib/analytics";

export function requirePaidExport({ toolId = useAppStore.getState().currentRouteId, locale = typeof window !== "undefined" && /^\/en(?:\/|$)/.test(window.location.pathname) ? "en" : "ko", format = "report" } = {}) {
  if (hasPurchasedAccess(useAppStore.getState().entitlement)) return true;
  rememberPaymentReturn(toolId, locale);
  useAppStore.setState({ purchasePrompt: { toolId, locale, format } });
  trackProductEvent("subscription_gate_viewed", { tool_id: toolId, locale, source: "analysis_export", download_type: format });
  return false;
}
