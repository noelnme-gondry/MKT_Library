"use client";

import { useSyncExternalStore } from "react";

// Match the shared shell on narrow screens and phones requesting desktop sites.
export const MOBILE_NAV_QUERY = "(max-width: 768px), (pointer: coarse) and (max-width: 1100px)";
let open = false;
const listeners = new Set();
const serverSnapshot = () => false;
const readOpen = () => open;
const subscribeOpen = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
function readMobile() {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.(MOBILE_NAV_QUERY).matches);
}
function subscribeMobile(listener) {
  const media = window.matchMedia?.(MOBILE_NAV_QUERY);
  media?.addEventListener("change", listener);
  return () => media?.removeEventListener("change", listener);
}
export function setMobileNavigationOpen(value) {
  open = value;
  listeners.forEach((listener) => listener());
}
export function useMobileNavigation() {
  const isMobile = useSyncExternalStore(subscribeMobile, readMobile, serverSnapshot);
  const isOpen = useSyncExternalStore(subscribeOpen, readOpen, serverSnapshot);
  return { isMobile, isOpen };
}
