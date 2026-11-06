"use client";
import Link from "next/link";
import { useAppStore } from "@/store/useDataStore";
import { operationsDetailLinks, OPERATIONS_HUB_ID } from "@/lib/operationsFlow";
import { prepareDatasetForTool } from "@/lib/data-import/prepareDatasetForTool";
import { groupForRoute } from "@/lib/toolGroups";
import { isDemoData } from "@/lib/dataOrigin";
import { trackProductEvent } from "@/lib/analytics";

// 소재 분석(9-6)은 다른 CSV 그룹이다. 플래너 파일에 소재 열이 있으면 같은 파일을 소재 분석용으로 넘기되,
// 사용자가 이미 올린 소재 파일은 덮지 않는다(예시 데이터만 바꾼다). 분석 완료 표시는 하지 않는다 —
// 소재 분석의 필수 열이 모자라면 그 화면의 정직한 매핑 안내가 먼저 보여야 한다.
function handOffCreativeData(csvData) {
  const state = useAppStore.getState();
  const existing = state.csvGroups?.[groupForRoute("9-6")];
  if (!csvData?.raw?.length || (existing?.raw?.length && !isDemoData(existing))) return;
  const prepared = prepareDatasetForTool({ raw: csvData.raw, headers: csvData.headers, toolId: "9-6", source: "operations" });
  if (!Object.values(prepared.mapping || {}).includes("creative_id")) return;
  state.handoffCsvToRoute("9-6", { ...prepared, fileName: csvData.fileName || prepared.fileName, importSource: csvData.importSource, currency: csvData.currency }, { markAnalyzed: false });
}

/** 플래너 단계의 "자세히 보기" 줄. 같은 효율 CSV·필터를 쓰는 상세 도구로 이어진다(lib/operationsFlow). */
export default function OperationsDetailLinks({ step, locale = "ko" }) {
  const links = operationsDetailLinks(step, locale);
  const csvData = useAppStore(state => state.csvData);
  if (!links.length) return null;
  return <p className="ops-detail-links">
    <span>{locale === "en" ? "In detail" : "자세히 보기"}</span>
    {links.map(link => <Link key={link.id} href={link.href} onClick={() => {
      if (link.id === "9-6") handOffCreativeData(csvData);
      trackProductEvent("operations_detail_clicked", { tool_id: link.id, source_tool_id: OPERATIONS_HUB_ID, placement: step, locale });
    }}>{link.label} →</Link>)}
    {/* 두 화면의 엔진이 달라 같은 파일에서도 금액이 다를 수 있다 — 숫자가 갈리는 이유를 링크 옆에서 말한다. */}
    {step === "budget" && <small>{locale === "en" ? "Budget detail also models country/OS levels and weekdays, so its amounts can differ from this plan." : "예산 상세 설계는 국가·OS 계층과 요일까지 반영하므로 이 계획과 금액이 다를 수 있습니다."}</small>}
  </p>;
}
