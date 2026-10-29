"use client";
import { useSyncExternalStore } from "react";
import { CONSENT_CHANGE_EVENT } from "@/lib/consent";
import { currentPartnerAdMode } from "@/lib/partnerAds";

const subscribe = notify => {
  window.addEventListener(CONSENT_CHANGE_EVENT, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(CONSENT_CHANGE_EVENT, notify); window.removeEventListener("storage", notify); };
};
const getServerSnapshot = () => "off";
export default function usePartnerAdMode() {
  return useSyncExternalStore(subscribe, currentPartnerAdMode, getServerSnapshot);
}
