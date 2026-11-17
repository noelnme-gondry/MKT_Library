"use client";
import Link from "next/link";
import { useAppStore } from "@/store/useDataStore";
import { isDemoData } from "@/lib/dataOrigin";
import { hasPaidAccess } from "@/lib/subscription/entitlement";
import { evaluateAlert } from "@/lib/performance-alerts/rules";

export default function PerformanceAlertNotice({ locale = "ko" }) {
  const en = locale === "en";
  const project = useAppStore(state => state.projects.find(item => item.id === state.activeProjectId));
  const enabled = useAppStore(state => state.decisionPersistenceEnabled && hasPaidAccess(state.entitlement));
  const check = useAppStore(state => state.performanceAlertCheck);
  const data = useAppStore(state => state.csvGroups.efficiency);
  const ready = useAppStore(state => state.activeDataGroup === "efficiency" && state.isGroupAnalyzed("5-31"));
  const rules = (project?.performanceAlerts || []).filter(rule => rule.enabled);
  if (!ready || isDemoData(data) || !rules.length) return null;
  const currentCheck = check?.projectId === project.id && check.raw === data.raw ? check.status : "checking";
  const error = currentCheck === "error";
  const triggered = rules.filter(rule => evaluateAlert(rule).status === "triggered").length;
  const unavailable = rules.filter(rule => evaluateAlert(rule).status === "unavailable").length;
  return <aside className="performance-alerts__notice no-print" aria-label={en ? "Project alert checks" : "프로젝트 알림 확인"} role="status"><strong>{en ? "Project alerts" : "프로젝트 성과 알림"}</strong><span>{!enabled ? (en ? "Checks paused. Active Pro and device storage are required." : "자동 확인이 중지되어 있습니다. 유효 Pro와 기기 저장이 필요합니다.") : error ? (en ? "Could not save this check. Check device storage and analyze again." : "이번 판정을 저장하지 못했습니다. 기기 저장 상태를 확인하고 다시 분석하세요.") : currentCheck === "checking" ? (en ? "Checking saved conditions…" : "저장한 조건을 확인하고 있습니다…") : en ? `${triggered} met · ${unavailable} unavailable · ${rules.length} enabled` : `${triggered}개 충족 · ${unavailable}개 확인 불가 · 활성 ${rules.length}개`}</span><Link href={`${en ? "/en" : ""}/projects#performance-alerts`}>{en ? "Review conditions" : "조건 확인"}</Link></aside>;
}

