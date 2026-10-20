import { groupForRoute } from "@/lib/toolGroups";

// 도구 ID 목록을 복제하지 않는다. 그룹이 담당 모듈을 고르고 등록 여부는 그 모듈이 판단한다.
// import 실패를 캐시하지 않아 다음 명시적 실행에서 다시 받을 수 있다.
export async function loadAnalysisRunner(toolId) {
  switch (groupForRoute(toolId)) {
    case "efficiency": {
      const adapterModule = await import("./efficiencyAnalysisAdapters");
      return adapterModule.efficiencyAdapterFor(toolId) ? adapterModule.runEfficiencyAnalysis : null;
    }
    case "asa_keyword":
    case "collinearity": {
      const adapterModule = await import("./optimizationAnalysisAdapters");
      return adapterModule.optimizationAdapterFor(toolId) ? adapterModule.runOptimizationAnalysis : null;
    }
    case "response": {
      const adapterModule = await import("./responseAnalysisAdapters");
      return adapterModule.responseAdapterFor(toolId) ? adapterModule.runResponseAnalysis : null;
    }
    case "aso_store":
    case "creative": {
      const adapterModule = await import("./specialAnalysisAdapters");
      return adapterModule.specialAdapterFor(toolId) ? adapterModule.runSpecialAnalysis : null;
    }
    case "subscription_survival": {
      const adapterModule = await import("./subscriptionAnalysisAdapters");
      return adapterModule.subscriptionAdapterFor(toolId) ? adapterModule.runSubscriptionAnalysis : null;
    }
    default:
      return null;
  }
}
