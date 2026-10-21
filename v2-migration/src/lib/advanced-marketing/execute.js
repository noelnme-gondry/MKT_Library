import { runCustomerEconomics } from "@/utils/advanced-marketing/transactionMath";
import { runUserFunnel } from "@/utils/advanced-marketing/eventMath";
import { runCuped, runPromotion, runUplift } from "@/utils/advanced-marketing/experimentMath";
import { runPredictiveClv } from "@/utils/advanced-marketing/clvMath";
import { runGeoExperiment } from "@/utils/advanced-marketing/geoMath";
import { runB2bPipeline } from "@/utils/advanced-marketing/pipelineMath";
import { runConjoint } from "@/utils/advanced-marketing/conjointMath";
import { runBasketAssociation, runReachFrequency, runTrafficQuality } from "@/utils/advanced-marketing/commerceMath";
// Map lookup cannot resolve inherited Object members from an untrusted worker ID.
export const ADVANCED_ENGINES = new Map([
  ["5-32", runCustomerEconomics], ["5-33", runUserFunnel], ["5-34", runCuped], ["5-35", runPredictiveClv],
  ["5-36", runGeoExperiment], ["5-37", runUplift], ["5-38", runB2bPipeline], ["5-39", runConjoint],
  ["5-40", runPromotion], ["5-41", runBasketAssociation], ["5-42", runReachFrequency], ["5-43", runTrafficQuality],
]);
export function executeAdvanced(toolId, rows, options) {
  if (!ADVANCED_ENGINES.has(toolId)) throw new Error("unknown_analysis");
  const engine = ADVANCED_ENGINES.get(toolId);
  if (typeof engine !== "function") throw new Error("unknown_analysis");
  return engine(rows, options);
}
