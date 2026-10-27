"use client";
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IA, computeAnalyzeSig } from "@/store/useDataStore";
import { idToSlug, hasEnVersion } from "@/lib/routeMap";
import { trItemTitle } from "@/lib/enNavCopy";
import { useAppStore } from "@/store/useDataStore";
import CsvUploader from "@/components/CsvUploader";
import { trackProductEvent, trackProductEventOnce, productEventKey } from "@/lib/analytics";
import { prepareDatasetForTool } from "@/lib/data-import/prepareDatasetForTool";
import AnalysisFinder from "@/components/finder/AnalysisFinder";
import { parseFinderFamily, parseFinderSituation } from "@/lib/finder/analysisFinder";
import { blockerFieldLabels, blockersText } from "@/lib/assistant/blockerText";
import JourneyProgress from "@/components/ds/JourneyProgress";
import AssistantWorkspace from "@/components/assistant/AssistantWorkspace";
import { DOCHI_HANDOFF_KEY } from "@/components/assistant/DochiHandoffMotion";
import DecisionDataUpdateGuide from "@/components/ds/DecisionDataUpdateGuide";
import { buildDatasetContinuitySnapshot, classifyDatasetContinuity, readDatasetContinuitySnapshot } from "@/lib/dataContinuity";
import { groupForRoute } from "@/lib/toolGroups";
import { START_PAGE_COPY as COPY } from "@/lib/startPageCopy";
import StartGateIntroduction from "./StartGateIntroduction";
import { isExampleUrl } from "@/lib/exampleLink";
import { summarizeUpload } from "@/lib/data-import/uploadSummary";

const hasPreparedDataOf = (data) => Boolean(data?.canonicalData?.records?.length);

// 분석 찾기(/start) — 상황으로 고르거나 파일을 놓아 분석을 찾는 한 화면(product-ssot §1.1c 결정 1).
// 예전의 "내 데이터로 시작"과 "분석 방법 둘러보기"(?view=methods)·/data-guide를 합쳤다.
// 진입 시 demoDisabled=true(세션) → 어느 도구로 가도 데모 자동로드 없이 빈 업로드
// 화면. ?view=methods(옛 둘러보기 주소)는 같은 화면이되 이미 열린 예시를 지우지 않는다.

function StartGateContent({ locale = "ko" }) {
  const C = COPY[locale] || COPY.ko;
  const router = useRouter();
  const searchParams = useSearchParams();
  const browseMethods = searchParams.get("view") === "methods";
  const [initialSituation] = useState(() => parseFinderSituation(searchParams.get("situation"), locale));
  const [initialFamily] = useState(() => parseFinderFamily(searchParams.get("file")));
  // 자식 CsvGuide가 먼저 예시를 열고 URL 파라미터를 지워도 최초 진입 의도는 유지한다.
  // 지연 로드된 부모 effect가 그 직후 startMyData로 샘플을 지우면 결과 화면이 비게 된다.
  const [isExampleEntry] = useState(() => isExampleUrl(searchParams.toString()));
  const [submittedInput, setSubmittedInput] = useState(null);
  const startMyData = useAppStore((s) => s.startMyData);
  const csvData = useAppStore((s) => s.csvData);
  const decisionRecords = useAppStore((s) => s.decisionRecords);
  const handoffCsvToRoute = useAppStore((s) => s.handoffCsvToRoute);
  const [eligibilitySnapshot, setEligibilitySnapshot] = useState(null);
  const workspaceRef = useRef(null);

  // 진입 = 내 데이터 의도 → 데모 자동로드 억제 + 이미 로드된 데모 슬라이스 비움.
  useEffect(() => {
    if (!browseMethods && !isExampleEntry) startMyData();
    try { window.sessionStorage.removeItem(DOCHI_HANDOFF_KEY); } catch { /* Optional legacy handoff marker. */ }
  }, [startMyData, browseMethods, isExampleEntry]);

  // 올린 파일 한 줄 — 파일 · 행 수 · 기간 · 확인된 내보내기 형식(product-ssot §1.1c 3단계).
  const uploadSummary = useMemo(() => (hasPreparedDataOf(csvData) ? summarizeUpload({ ...csvData, locale }) : null), [csvData, locale]);
  const goTool = (id) => router.push(locale === "en" && hasEnVersion(id) ? `/en${idToSlug[id] || ""}` : idToSlug[id] || "/");
  const hasPreparedData = Boolean(csvData.canonicalData?.records?.length);
  const hasSubmitted = hasPreparedData && submittedInput?.raw === csvData.raw && submittedInput?.mapping === csvData.mapping;
  const analyze = () => { setSubmittedInput({ raw: csvData.raw, mapping: csvData.mapping }); };
  // 사용자가 비교 방식이나 데이터 상태를 다시 판정할 필요 없도록, 같은 데이터
  // 그룹에서 가장 최근에 저장한 판단 하나를 현재 업로드와 먼저 대조한다. 원본 행은
  // 결정 기록에 남지 않으며, 이 비교도 날짜 범위와 비가역 지문만 사용한다.
  const continuity = useMemo(() => {
    if (!hasPreparedData) return null;
    const group = groupForRoute("start-gate");
    const previousRecord = [...decisionRecords]
      .filter((record) => readDatasetContinuitySnapshot(record.datasetSnapshot)?.dataGroup === group)
      .sort((left, right) => Date.parse(right.updatedAt || right.createdAt || 0) - Date.parse(left.updatedAt || left.createdAt || 0))[0];
    if (!previousRecord) return null;
    const current = buildDatasetContinuitySnapshot(csvData.canonicalData, { dataGroup: group, mapping: csvData.mapping });
    return classifyDatasetContinuity(previousRecord.datasetSnapshot, current);
  }, [csvData.canonicalData, csvData.mapping, decisionRecords, hasPreparedData]);
  // 업로드 뒤의 도구 목록은 도치 작업대와 같은 자격 판정을 쓴다. 이전 파일의
  // 판정이 새 파일 위에 잠깐 남으면 "지금 가능"이라는 약속이 거짓이 되므로,
  // 원본·헤더·매핑 참조가 모두 같은 판정만 표시한다.
  const isEligibilityCurrent = hasPreparedData
    && eligibilitySnapshot?.raw === csvData.raw
    && eligibilitySnapshot?.headers === csvData.headers
    && eligibilitySnapshot?.mapping === csvData.mapping;
  const eligibleIds = isEligibilityCurrent
    ? eligibilitySnapshot.ids
    : hasPreparedData ? [] : null;
  const rememberEligibility = useCallback((eligibility) => {
    if (!eligibility.some(result => result.status !== "blocked")) trackProductEventOnce("analysis_blocked", productEventKey("start", computeAnalyzeSig(csvData), "no_supported_analysis", locale), { source: "start", placement: "start", state: "no_supported_analysis", count: 0, locale });
    setEligibilitySnapshot({
      raw: csvData.raw,
      headers: csvData.headers,
      mapping: csvData.mapping,
      ids: eligibility.filter((result) => result.status !== "blocked").map((result) => result.toolId),
      // 안 되는 이유를 함께 들고 온다. "안 됩니다"만 말하면 사용자가 할 수 있는 일이
      // 없다 — 무엇이 빠졌는지와 어떻게 채우는지가 같은 자리에 있어야 한다.
      blocked: Object.fromEntries(eligibility
        .filter((result) => result.status === "blocked")
        .map((result) => [result.toolId, {
          fields: blockerFieldLabels(result, locale),
          hint: blockersText(result, locale),
        }])),
    });
  }, [csvData, locale]);
  const getTitle = (id) => {
    const meta = IA.flatMap((group) => group.items).find((item) => item.id === id);
    return meta ? trItemTitle(id, locale, meta.title) : id;
  };
  const openRecommended = (id, preparedOverride = null, { comparison = null, scope = null } = {}) => {
    trackProductEvent("analysis_recommended", { tool_id: id, source: "start" });
    const prepared = preparedOverride || prepareDatasetForTool({ raw: csvData.raw, headers: csvData.headers, toolId: id, source: csvData.fileName || "dataset" });
    // 추천·자격 통과 도구는 도치 독과 같은 분석 완료 상태로 연다. 반대로 목록에
    // 흐리게 보이는 도구까지 완료 처리하면 부족한 컬럼인데도 기본 결과·결정 기록이
    // 열릴 수 있으므로, 그 경우에는 상세 화면의 정직한 업로드 게이트를 유지한다.
    handoffCsvToRoute(id, prepared, { markAnalyzed: Boolean(isEligibilityCurrent && eligibleIds.includes(id)), comparison, scope });
    goTool(id);
  };
  const continueWithNewAnalysis = () => workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // 파일로 찾기 — 이 화면의 주 행동. 매핑 확인 → 분석하기를 누르면 아래 작업대로 넘어간다.
  const uploader = (
    <section className="start-upload-panel" aria-labelledby="start-file-title">
      <h2 id="start-file-title">{C.fileTitle}</h2>
      <p>{C.fileDeck}</p>
      <CsvUploader toolId="start-gate" locale={locale} showMappingReview collapseMappingReview onAnalyzed={analyze} />
    </section>
  );

  return (
    <>
      <StartGateIntroduction locale={locale} />
      {hasSubmitted && <JourneyProgress stage={eligibleIds?.length ? "analyze" : "prepare"} completed={eligibleIds?.length ? ["prepare"] : []} locale={locale} placement="start" />}
      {hasSubmitted && uploadSummary && <section className="block workspace-input-summary" aria-label={locale === "en" ? "Your file" : "올린 파일"}>
        <div><strong>{uploadSummary.fileName}</strong><span>{[uploadSummary.rows, uploadSummary.period, uploadSummary.format].filter(Boolean).join(" · ")}</span></div>
        <button type="button" className="btn" onClick={() => setSubmittedInput(null)}>{locale === "en" ? "Edit input" : "입력·매핑 수정"}</button>
      </section>}
      {/* 파일을 제출하기 전에는 분석 찾기 전체(상황·파일·카드). 업로더 상태를 잃지 않도록 감추기만 한다. */}
      <div className="start-finder" hidden={hasSubmitted}>
        <AnalysisFinder locale={locale} initialSituation={initialSituation} initialFamily={initialFamily} aside={uploader} />
        <p className="start-no-file">
          <span>{C.noFileLead}</span>
          <Link href={locale === "en" ? "/en/calculator" : "/calculator"} onClick={() => trackProductEvent("calculator_entry_clicked", { source: "start", placement: "no_file", locale })}>{C.calculatorCta} →</Link>
          <Link href={locale === "en" ? "/en/diagnose" : "/diagnose"} onClick={() => trackProductEvent("diagnose_entry_clicked", { source: "start", placement: "no_file", locale })}>{C.diagnoseCta} →</Link>
        </p>
      </div>
      {hasSubmitted && <div ref={workspaceRef}>
        {isEligibilityCurrent && eligibleIds.length === 0 && <section role="status" className="callout warn">
          <div><h2>{locale === "en" ? "No analysis is ready for this file" : "이 파일로 실행할 수 있는 분석이 없습니다"}</h2>
          <p>{locale === "en" ? "The file was read, but the required columns are not connected. Review the mapping or choose a template for your analysis below." : "파일은 읽었지만 분석에 필요한 컬럼이 연결되지 않았습니다. 매핑을 수정하거나 분석 목적에 맞는 템플릿을 선택하세요."}</p>
          <button className="btn primary" onClick={() => setSubmittedInput(null)}>{locale === "en" ? "Fix column mapping" : "컬럼 매핑 수정"}</button>
          <Link className="btn" href={locale === "en" ? "/en/templates" : "/templates"}>{locale === "en" ? "Choose a data template" : "데이터 템플릿 선택"}</Link></div>
        </section>}
        <DecisionDataUpdateGuide continuity={continuity} locale={locale} onContinue={continueWithNewAnalysis} />
        <AssistantWorkspace csvData={csvData} locale={locale} getTitle={getTitle} onOpenTool={openRecommended} onEligibilityChange={rememberEligibility} autoStart />
        {eligibleIds?.includes("5-2") && <Link className="btn start-next-project" href={locale === "en" ? "/en/weekly-review#weekly-performance" : "/weekly-review#weekly-performance"}>{locale === "en" ? "Make it my next marketing project" : "다음 마케팅 프로젝트로 만들기"}</Link>}
      </div>}
    </>
  );
}

export default function StartGate(props) {
  return <Suspense fallback={<StartGateIntroduction locale={props.locale} pending />}><StartGateContent {...props} /></Suspense>;
}
