"use client";
import { useSyncExternalStore } from "react";
import { CONSENT_CHANGE_EVENT, looksEeaVisitor, readStoredConsent } from "@/lib/consent";
import { partnerAdMode } from "@/lib/partnerAds";

const subscribe = notify => {
  window.addEventListener(CONSENT_CHANGE_EVENT, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(CONSENT_CHANGE_EVENT, notify); window.removeEventListener("storage", notify); };
};
const getServerSnapshot = () => "off";
const getSnapshot = () => {
  let timeZone = "";
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { /* 기존 동의 배너와 같은 언어 폴백 */ }
  return partnerAdMode({ hostname: window.location.hostname, environment: process.env.NODE_ENV, consent: readStoredConsent(), needsConsent: looksEeaVisitor(timeZone, navigator.language) });
};
export default function usePartnerAdMode() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
