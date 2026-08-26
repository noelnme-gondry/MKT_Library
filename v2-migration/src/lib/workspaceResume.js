import { isRoutePublished, ROUTES } from "@/lib/routeMap";
import { TOOL_GROUP } from "@/lib/toolGroups";

/**
 * 저장 그룹을 사용자가 다시 시작할 수 있는 대표 화면에 연결한다.
 * 효율 CSV는 도치 라우터, response CSV는 공유 매퍼를 먼저 거쳐야 하므로
 * 두 그룹만 준비 화면을 우선한다. 나머지는 공개 라우트 목록에서 파생한다.
 */
export function workspaceResumeRouteId(group) {
  if (group === "efficiency") return "start-gate";
  if (group === "response") return "5-18";
  return ROUTES.find((route) => isRoutePublished(route) && TOOL_GROUP[route.id] === group)?.id || null;
}
