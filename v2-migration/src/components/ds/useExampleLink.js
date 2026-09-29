"use client";
import { useEffect, useRef } from "react";
import { isExampleUrl, stripExampleParam } from "@/lib/exampleLink";
import { resolvePathToId } from "@/lib/routeMap";
import { useAppStore } from "@/store/useDataStore";

/**
 * ?example=1로 들어오면 그 화면의 예시 버튼과 같은 run을 한 번 부른다(lib/exampleLink.js).
 * 예시 버튼을 그리는 세 곳(CsvGuide · PaidOrganicTrend · AbTestHoldout)이 같이 쓴다 — 도구마다
 * 예시 준비가 다르므로(5-23 기간 선언 등) 링크가 따로 준비하지 않고 버튼의 핸들러를 그대로 탄다.
 *
 * 두 가지가 끝난 뒤에만 부른다. ① 스토어의 현재 라우트가 이 페이지다 — 자식 effect는 부모(PageClient의
 * setCurrentRouteId)보다 먼저 돌아서, 바로 부르면 예시가 이전 라우트의 CSV 그룹에 써진다.
 * ② 기기 저장 부팅(WorkspaceStorageBootstrap → initializeProjects → 복원·프로젝트 설정 적용)이 끝났다 —
 * 부하가 있으면 부팅이 예시보다 늦게 끝나 방금 연 예시가 빈 화면으로 되돌아갔다(e2e에서 21개 중
 * 5~7개, 매번 다른 도구). 버튼은 사람이 누르는 사이 부팅이 끝나 드러나지 않았다.
 * 파라미터는 부르기 직전에 지운다: 새로고침하거나 주소를 복사해도 사용자가 올린 파일을 덮지 않는다.
 */
export default function useExampleLink(run) {
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current || typeof run !== "function" || typeof window === "undefined") return undefined;
    if (!isExampleUrl(window.location.search)) return undefined;
    const target = resolvePathToId(window.location.pathname);
    const ready = (state) => state.currentRouteId === target
      && useAppStore.persist.hasHydrated()
      && !state.projectSwitching
      && (state.decisionPersistenceEnabled !== true || state.projectsReady || Boolean(state.projectError));
    const fire = () => {
      if (ran.current) return;
      ran.current = true;
      window.history.replaceState(window.history.state, "", stripExampleParam(window.location.href));
      run("example_link");
    };
    if (ready(useAppStore.getState())) {
      fire();
      return undefined;
    }
    const unsubscribe = useAppStore.subscribe((state) => {
      if (!ready(state)) return;
      unsubscribe();
      // 이 set(라우트 전환·부팅 완료)이 끝난 다음 틱에 쓴다 — 같은 set 안에서 쓰면 섞인다.
      setTimeout(fire, 0);
    });
    return unsubscribe;
  }, [run]);
}
