"use client";
import { useSyncExternalStore } from "react";
import { isAnalyticsHost } from "@/lib/analyticsHost";

// 호스트는 마운트 이후에만 알 수 있는 값이라 서버 렌더에서는 항상 "꺼짐"이다.
// effect에서 setState하면 렌더를 한 번 더 돌리는 데다 §5(파생값으로)에 어긋나므로
// useSyncExternalStore로 스냅샷을 읽는다 — 서버/클라이언트 스냅샷이 갈리는
// 하이드레이션이 바로 이 훅이 다루라고 있는 경우다.
const subscribe = () => () => {};
const getServerSnapshot = () => false;
const getSnapshot = () => isAnalyticsHost(window.location.hostname);

export default function useAnalyticsEnabled() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
