import { analysisCatalogEntry } from "./analysisCatalog";
import { blockerFieldLabels, blockersText } from "./blockerText";
import { dataSourceForTool } from "@/lib/dataSources";

/* ============================================================
 * 데이터 준비 — 올린 파일로 무엇이 되는지를 세 칸으로(product-ssot §1.1c 3단계).
 *
 *   ready  바로 가능      자격이 있고, 돌려 봐도 판정을 냈다.
 *   near   조금만 더      이 파일이 요구 열 대부분을 이미 갖고 있고 열 한두 개만
 *                         빠졌거나, 열은 다 있는데 행·기간·비교 대상이 모자라다.
 *   other  다른 파일 필요  요구 열 대부분이 없다 — 다른 출처의 파일이어야 한다.
 *
 * 판정은 새로 하지 않는다. evaluateAnalysisEligibility의 결과(blockers·missing)와
 * 실제로 돌려 본 분석의 판정 불가 사유를 나눌 뿐이다. 문구는 blockerText와 같은
 * 라벨을 쓴다 — 같은 파일에 대해 화면마다 다른 이유를 말하지 않게.
 * ============================================================ */

const FIELD_BLOCKERS = new Set(["missing_fields", "missing_tool_owned_role"]);
const DATA_BLOCKERS = new Set(["min_rows", "min_periods", "min_valid_episodes"]);
// "열 하나만 더"의 경계: 빠진 열이 둘 이하이고, 이미 있는 요구 열이 빠진 것 이상이며 둘 이상.
const NEAR_MAX_MISSING = 2;
const NEAR_MIN_PRESENT = 2;

function requiredCount(toolId) {
  const entry = analysisCatalogEntry(toolId);
  if (!entry) return 0;
  // 5-18 계열은 역할 세 개(시간·성과·채널)로 판정한다(evaluateAnalysisEligibility).
  if (toolId.startsWith("5-18-")) return 3;
  return entry.requiredFieldGroups.length + entry.toolOwnedRoles.filter((role) => role.required).length;
}

function addColumnsText(labels, locale) {
  const shown = labels.join(", ");
  return locale === "en" ? `Add ${shown} to open this.` : `${shown} 열을 더하면 열립니다.`;
}

/** 막힌 분석 하나가 "조금만 더"인지. 아니면 null. */
export function nearReason(result, locale = "ko") {
  const blockers = result?.blockers || [];
  if (!blockers.length) return null;
  if (blockers.every((blocker) => DATA_BLOCKERS.has(blocker.code))) {
    return { kind: "data", text: blockersText(result, locale) };
  }
  // 데이터 단위(grain)는 매핑된 열에서 판정한다 — 열이 빠져서 단위가 달라 보이는 경우는
  // 그 열을 더하면 함께 풀린다. 열 외의 막힘이 섞여 있으면 "조금만 더"가 아니다.
  const fieldBlockers = blockers.filter((blocker) => FIELD_BLOCKERS.has(blocker.code));
  if (!fieldBlockers.length || !blockers.every((blocker) => FIELD_BLOCKERS.has(blocker.code) || blocker.code === "grain_mismatch")) return null;
  const missing = fieldBlockers.length;
  const present = requiredCount(result.toolId) - missing;
  if (missing > NEAR_MAX_MISSING || present < NEAR_MIN_PRESENT || present < missing) return null;
  const labels = blockerFieldLabels(result, locale);
  // 라벨이 없는 키(내부 역할)만 빠졌다면 사람이 고칠 말을 만들 수 없다 — 다른 칸에 둔다.
  if (!labels.length) return null;
  // 그 열이 보통 어느 파일에 있는지 — "열을 더하라"만으로는 어디서 받아야 할지 모른다.
  const file = dataSourceForTool(result.toolId, locale)?.file || "";
  return { kind: "columns", labels, file, text: addColumnsText(labels, locale) };
}

/**
 * eligibility: evaluateAnalysisEligibility 결과 배열
 * notComputable: { toolId: 사유 } — 자격은 있었지만 돌려 보니 판정을 못 낸 분석
 * → { ready: [toolId], near: { toolId: { kind, text, labels? } }, other: [toolId] }
 */
export function classifyDataReadiness({ eligibility = [], notComputable = {}, locale = "ko" } = {}) {
  const ready = [];
  const near = {};
  const other = [];
  for (const result of eligibility) {
    const toolId = result.toolId;
    if (notComputable[toolId]) {
      // 이 파일로 실제로 돌렸다 — 열은 맞고 자료가 모자란 경우다.
      near[toolId] = { kind: "data", text: notComputable[toolId] };
    } else if (result.status !== "blocked") {
      ready.push(toolId);
    } else {
      const reason = nearReason(result, locale);
      if (reason) near[toolId] = reason;
      else other.push(toolId);
    }
  }
  return { ready, near, other };
}
