import { trackProductEvent } from "./analytics";

const STEPS = new Set(["entry_view", "example_open", "file_selected", "mapping_success", "result_view", "result_blocked", "evidence_open", "action_open"]);

export function trackDiagnosis(step, source, locale) {
  if (!STEPS.has(step) || !["upload", "demo", "direct", "blog", "tool"].includes(source)) return;
  trackProductEvent(`diagnosis_${step}`, {
    tool_id: "campaign-diagnosis", source, locale: locale === "en" ? "en" : "ko",
  });
}
