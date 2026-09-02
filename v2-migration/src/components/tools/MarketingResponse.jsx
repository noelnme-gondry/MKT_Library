"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import HelpTip from "@/components/ds/HelpTip";
import Link from "next/link";
import Papa from "papaparse";
import Chart from "@/utils/chartGlobals";
import { computeAnalyzeSig, useAppStore } from "@/store/useDataStore";
import { MMM_METH_CONFIG, MMM_FORECAST_DEFAULT_TREND_DAMPING, MMM_NONMEDIA_GROUPS, mmmValidate, mmmBayesianRun, mmmBayesianLikeRun, mmmBayesianHealth, mmmBayesianWeeklyDecomp, mmmBayesianForecast, mmmForecastApplySelectedBlend, mmmForecastCombineNestedParts, mmmForecastScenarioEligibility, mmmForecastRestoreSeasonality, mmmTrendExistence, mmmElasticities, mmmCannibalization, mmmChannelCoverage, mmmIRF, mmmAdstock, mmmAudit, mmmMacroFacts, mmmDataQualityAudit, mmmResolveAbsorb, _mmmChans } from "@/utils/mmmMath";
import { mmmNonlinearLaplace } from "@/utils/mmmNonlinearLaplace";
import { MMM_METH_CONFIG as MMM_CLASSIC_CONFIG, MMM_PRISM_MODEL_CONFIG, mmmBayesianRun as mmmClassicBayesianRun, mmmClassicControlSelection, mmmClassicBuildGroupContributionPriors, mmmResolveAbsorb as mmmClassicResolveAbsorb } from "@/utils/mmmMathPr416";
import { mmmBuildCannibRank, mmmCannibLevel, mmmCannibBucket, mmmCannibActionShort, mmmGlobalCannib, mmmRankCfg, CANNIBAL_RANK } from "@/utils/responseCannibRank";
import { analysisResultEventKey, trackProductEvent, trackProductEventOnce } from "@/lib/analytics";
import { createForecastReviewSnapshot, findForecastActualMatches, forecastReviewDate } from "@/lib/forecastReview";
import { toLocalDecisionDate } from "@/lib/decisionReview";
import CsvGuide from "@/components/ds/CsvGuide";
import AnalyzingOverlay from "@/components/ds/AnalyzingOverlay";
import ResultActionCard from "@/components/ds/ResultActionCard";
import DownloadHub from "@/components/ds/DownloadHub";
import { csvBody, downloadCsv } from "@/utils/download";
import { fitGrade, isFitInverted } from "@/utils/modelFitGrade";
import { getMmmInterpretationLimits } from "@/lib/mmmInterpretationLimits";
import AnalysisBlockedTelemetry from "@/components/data-import/AnalysisBlockedTelemetry";
import WebRMmmAdvanced from "@/components/tools/WebRMmmAdvanced";
import EvidenceStatusBadge from "@/components/ds/EvidenceStatusBadge";
import { STATISTICAL_STATUS } from "@/lib/analysis-router/statisticalStatus";
import { buildDemoCsv, buildMmmPriorDemo } from "@/utils/demoData";
import { prepareSemanticParallelData } from "@/lib/data-import/prepareSemanticParallelData";
import MmmColumnMapper, { autoGuessColMap, buildPanelFromColMap, colMapMissing, colMapRoles, mmmPlatformTags, mmmSegmentValues } from "@/components/tools/MmmColumnMapper";
import { buildObservedBusinessSeasonality } from "@/utils/mmmBusinessSeasonality";
import { auditClassicNoPriorRun, classicNoPriorConfig, classicNoPriorFitOptions } from "@/utils/classicMmmPolicy";
import { mmmControlFitRows } from "@/utils/mmmControlContract";
import MmmControlFitTable from "@/components/tools/MmmControlFitTable";
import { buildLowSpendOutcomeSeries } from "@/utils/responseCannibChart";
import BasisCurrencyToggleBar from "@/components/dashboard/BasisCurrencyToggleBar";
import AnalysisControlBar from "@/components/dashboard/AnalysisControlBar";
import PillGroup from "@/components/ds/PillGroup";
import FixedRateNote from "@/components/ds/FixedRateNote";
import { CURRENCY_SYMBOLS, convertCurrency, fmtCompact } from "@/utils/format";
import { allocateFixedMmmGroupTotals, buildMmmAggregateMediaPanel, buildMmmCollinearityGroupedPerformance, buildMmmWeeklyPerformance } from "@/utils/mmmWeeklyPerformance";
import { buildExperimentMediaPriorDetailed, mmmRollingOrigins, summarizeRollingErrors } from "@/utils/mmmPriorMath";
import { resolveResponseStage } from "@/lib/responseStage";
import { planCountryReferenceFits, buildCountryTransferPrior, buildCountryCombinations, mmmCountryRowsAsOfFold, selectCountryPriorCandidate, rescaleCountryPriorToTarget } from "@/utils/mmmCountryPrior";
import { buildForecastProvenance, buildForecastScenarioDefinitions, forecastResidualDiagnostics, summarizeForecastScenario } from "@/utils/forecastEnhancements";
import { buildAttributedForecastDataset } from "@/utils/attributedForecastDataset";
import { runAttributedForecastLiveRouter, runAttributedForecastLiveScenario } from "@/utils/attributedForecastLiveMath";
import { runAnnualAnalogRouter } from "@/utils/annualAnalogForecast";
import {
  BADGE_TONE,
  Badge,
  CHART_THEME,
  Card,
  ChannelSpendTimeline,
  CollinearPairInputChart,
  CommaNumberInput,
  ContributionGroupPanel,
  ForecastHint,
  MMM_BUCKET_ORDER,
  MMM_COUNTRY_HEADER_PATTERN,
  MMM_MEDIA_PALETTE,
  MMM_TEMPLATE_CSV,
  MMM_USER_TARGETS,
  MUTED,
  MmmBacktestChart,
  MmmEvidenceLedger,
  MmmManualDownload,
  NEG,
  NetEffectEvidence,
  POS,
  StatHead,
  TrendChangeBars,
  _today,
  annualAnalogBacktestShape,
  annualAnalogForecastShape,
  annualCandidateRouteLabel,
  attributedForecastShape,
  buildCannibCsv,
  buildCannibGuideDoc,
  buildCannibSeriesCsv,
  buildContributionGroupCsv,
  buildForecastAssistInsight,
  buildForecastCsv,
  buildForecastExcelModel,
  buildForecastOnlyModelFromPanel,
  buildForecastProductionModel,
  buildForecastRecentBacktest,
  buildMmmGuideDoc,
  buildOsForecastPanel,
  buildPaidOrganicPlatformModel,
  buildPaidOrganicRecentBacktest,
  calendarizeForecastPanel,
  certifyForecastBacktest,
  chartBase,
  csvDownload,
  decompBucketOf,
  downloadMmmWorkbook,
  fmtInt,
  fmtOne,
  fmtSignedInt,
  fmtSignedOne,
  forecastBackgroundCandidateCap,
  forecastCandidateSearchProvenance,
  forecastDownloadTitle,
  forecastGuardrailSummaryText,
  forecastHasExactFormulaModels,
  forecastHorizonDraftState,
  forecastIntervalContract,
  forecastIntervalNote,
  forecastNaiveBaselineLabel,
  forecastOrganicTargetValues,
  forecastPct,
  forecastPlatformRouteGuard,
  forecastRegimeInputChanged,
  forecastRegimeStateForInput,
  forecastScenarioReasonLabel,
  forecastSelectionDecisionText,
  forecastSourceIdentity,
  forecastWorkerConfigDto,
  hasForecastSpendHistory,
  hasPaidRegistrationTargets,
  isoDateFromLabel,
  mergeForecastSelectionCache,
  mergeMediaPrior,
  mmmAnalysisGateOpen,
  mmmBucketMeta,
  mmmCacheObjectId,
  mmmCachedResult,
  mmmCanonicalSegment,
  mmmComposeEvidenceTarget,
  mmmCsvParseFailure,
  mmmCsvSourceChanged,
  mmmDetectTargetCountry,
  mmmEvidencePlatformSlice,
  mmmEvidenceSpendHeaders,
  mmmEvidenceTreatmentContrast,
  mmmFindEvidencePeriodHeader,
  mmmFindEvidenceTimeHeader,
  mmmFindExperimentBinaryHeader,
  mmmHealthFlagMessage,
  mmmNormalizeExperimentLongMedia,
  mmmNormalizeGeoWideEvidence,
  mmmResolveExperimentType,
  mmmStageDefs,
  mmmStoreCachedResult,
  mmmSumOsBacktests,
  mmmSumOsForecasts,
  mmmTargetDisplay,
  pickTarget,
  reconcileForecastScenarioAudit,
  runForecastScenario,
  runOnLatestAnimationFrame,
  runPaidOrganicSplitScenario,
  safeForecastRegimeScan,
  scanAnnualForecastRegimeWindows,
  scanForecastRegimeWindows,
  selectForecastProductionRoute,
  sliceForecastTrainingWindow,
  sliceMmmCollinearityGroupRefit,
  sliceMmmPanel,
  sliceMmmRun,
  textDownload,
  trimToActive,
  weekBoundaryDate,
  withMmmViewSpend, MMM_STAGE_GROUPS } from "@/components/tools/marketingResponseModel";
export * from "@/components/tools/marketingResponseModel";

function workbookColumn(index) {
  let value = Number(index) + 1;
  let column = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

export default function MarketingResponse({ locale = "ko", initialStage = "trend", isolated = false }) {
  // 3단계(index MMM_STAGE_DEFS): diagnose | mmm | lab. 구 "forecast" 스테이지는 lab에 흡수 —
  // ③ lab이 mmmForecast(②계수) §7 미래예측을 렌더(stage==="lab"). 셋 다 shared mmmColMap 사용.
  const tx = useCallback((ko, en) => (locale === "en" ? en : ko), [locale]); // 인라인 텍스트 로컬라이즈 헬퍼(§12.20 v2 i18n 패턴)
  const bucketMeta = mmmBucketMeta(locale);
  // URL에서 전달받은 단계는 라우팅 레이어가 검증하지만, 컴포넌트 단독 사용·테스트도
  // 안전하도록 여기서 한 번 더 폴백한다. 모델 계산·데이터 계약에는 관여하지 않는다.
  const [stage, setStage] = useState(() => resolveResponseStage(initialStage)); // hub | trend | diagnose | mmm | lab
  const [target, setTarget] = useState("Regs");
  // 사용자 MMM은 Bayesian을 기본 추정기로 고정하고, WebR challenger를 자동 실행해
  // 같은 OOS 검증구간에서 더 정확한 결과를 고르게 한다. Classic/Prism 구현은
  // 과거 결과 호환과 엔진 검증을 위해 내부에만 남긴다.
  const mmmMode = "bayesian";
  const [mmmResultModel, setMmmResultModel] = useState("bayesian");
  // T1: Bayesian 모드 정보 prior(지출점유 기반 약정보) — 기본 활성. 끄면 평면 OLS(모델 차이 비교용).
  const [bayesianUsePrior, setBayesianUsePrior] = useState(true);
  const [decompGrouped, setDecompGrouped] = useState(true); // §5.5 true=4버킷 묶음 / false=광고 개별채널
  // RMS 비중에서 기본 수요·추세가 너무 큰 경우, 나머지 동인끼리의 상대 크기를
  // 볼 수 있게 한다. 모델·원본 기여값은 바꾸지 않고 이 표시용 분모만 전환한다.
  const [includeBaseDemandInShare, setIncludeBaseDemandInShare] = useState(true);
  const [bayesianResponseChannel, setBayesianResponseChannel] = useState(null);
  const [isHealthWarningOpen, setIsHealthWarningOpen] = useState(false);
  const [spikeNotes, setSpikeNotes] = useState({}); // §5.5 튀는 구간 메모 { [target|week]: note }
  const [fcHorizon, setFcHorizon] = useState(13);
  // 입력 중 값과 실제 계산값을 분리한다. 스피너의 화살표 한 번에도 후보 탐색·OOS
  // 재계산이 실행되면 메인 스레드가 멈추므로, 명시적 적용 때만 계산값을 바꾼다.
  const [fcHorizonDraft, setFcHorizonDraft] = useState("13");
  const [fcBudget, setFcBudget] = useState({}); // {chKey: 주 평균 예산} — 미입력 채널은 최근평균
  const [fcStepOff, setFcStepOff] = useState({}); // {stepKey: 켜둘 미래 기간 N} — 빈값=지속
  const [fcTotalBudget, setFcTotalBudget] = useState(null);
  const [fcMinBudget, setFcMinBudget] = useState(0);
  const [fcMaxBudget, setFcMaxBudget] = useState(null);
  const [fcEventPolicy, setFcEventPolicy] = useState("hold");
  const [fcEventPolicyDraft, setFcEventPolicyDraft] = useState("hold");
  // null=전체 이력. 사용자가 추천을 승인했을 때만 최근 운영 체제의 시작점 이후
  // 데이터로 예측 회귀를 다시 적합한다. 원본 CSV·MMM 기여 분해는 바꾸지 않는다.
  const [fcRegimeTrainingWeeks, setFcRegimeTrainingWeeks] = useState(null);
  const [isRegimeWindowScanRequested, setIsRegimeWindowScanRequested] = useState(false);
  const [forecastRegimeStateSignature, setForecastRegimeStateSignature] = useState(null);
  const [fcScenarioOpen, setFcScenarioOpen] = useState(true);
  const [cannibChannel, setCannibChannel] = useState(null);
  const [cannibQuestion, setCannibQuestion] = useState("precedence");
  const [selectedCollinearPairKey, setSelectedCollinearPairKey] = useState(null);
  const [weeklyPerformanceView, setWeeklyPerformanceView] = useState("individual");
  const [spendTimelineKind, setSpendTimelineKind] = useState("brand");
  const [contributionViewStart, setContributionViewStart] = useState("");
  const [contributionViewEnd, setContributionViewEnd] = useState("");
  // 기본 결과는 기존 MMM 그대로. prior 관련 데이터가 실제로 있을 때만 결과 탭 후보가 추가된다.
  // 원자료는 이 컴포넌트 메모리에만 두며 서버로 보내지 않는다.
  const [selectedEvidence, setSelectedEvidence] = useState({ experiment: false, country: false });
  const [priorEvidence, setPriorEvidence] = useState({ experiment: null, country: null });
  const csvData = useAppStore((state) => state.csvData);
  const setCsvData = useAppStore((state) => state.setCsvData);
  const clearCsvGroup = useAppStore((state) => state.clearCsvGroup);
  const decisionRecords = useAppStore((state) => state.decisionRecords);
  const updateDecisionRecord = useAppStore((state) => state.updateDecisionRecord);
  const responseMappingSession = useAppStore((state) => state.responseMappingSession);
  const setResponseMappingSession = useAppStore((state) => state.setResponseMappingSession);
  const requestAd = useAppStore((state) => state.requestAd);
  const displayCurrency = useAppStore((state) => state.displayCurrency);
  const setDisplayCurrency = useAppStore((state) => state.setDisplayCurrency);
  const currencySym = CURRENCY_SYMBOLS[displayCurrency] || "$";
  // 숫자만 있는 CSV는 USD/KRW를 안전하게 추론할 수 없다. 미선택인데 KRW로
  // 가정해 환산하면 $16,772를 $12처럼 망가뜨리므로, 선택 전에는 환산하지 않는다.
  const selectedSourceCurrency = ["KRW", "USD"].includes(csvData?.currency) ? csvData.currency : null;
  const sourceCurrency = selectedSourceCurrency || displayCurrency;
  const convAmt = (v) => selectedSourceCurrency ? convertCurrency(v, sourceCurrency, displayCurrency) : Number(v);
  const hasData = csvData?.raw?.length > 0;
  const isDemo = !!(csvData?.fileName && csvData.fileName.startsWith("demo_"));
  const setMmmSourceCurrency = (currency) => {
    setCsvData({ ...csvData, currency });
    setDisplayCurrency(currency);
  };

  // 5-18 = colMap DnD가 PRIMARY 매퍼(index.html page_5_18 이식). 단일 generic CSV를
  // 주차/날짜/가입/재활성/채널(perf·brand)/더미/step 역할로 드래그 → 모든 분석(진단·MMM·시뮬)
  // 이 이 하나의 패널을 공유. 표준필드(DataFeatureMatrix) 경로 미사용.
  const [mmmColMap, setMmmColMap] = useState(() => responseMappingSession?.colMap || null);
  const [mmmWeekStart, setMmmWeekStart] = useState(() => responseMappingSession?.weekStart || "monday");
  const [mmmAnalyzedSig, setMmmAnalyzedSig] = useState(null);
  const [mmmAnalyzedRaw, setMmmAnalyzedRaw] = useState(null);
  const [mmmUploadError, setMmmUploadError] = useState(null);
  const [packageDownloadStatus, setPackageDownloadStatus] = useState("idle");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isForecastWorkerRunning, setIsForecastWorkerRunning] = useState(false);
  const [forecastWorkerProgress, setForecastWorkerProgress] = useState({ completed: 0, total: 0 });
  const [forecastSelectionCache, setForecastSelectionCache] = useState({
    signature: null,
    results: {},
  });
  const [forecastWorkerFallbackSignature, setForecastWorkerFallbackSignature] = useState(null);
  const [isRegimeWorkerRunning, setIsRegimeWorkerRunning] = useState(false);
  const [regimeWorkerCache, setRegimeWorkerCache] = useState({
    signature: null,
    result: null,
  });
  const [regimeWorkerFallbackSignature, setRegimeWorkerFallbackSignature] = useState(null);
  const analysisTransitionRef = useRef(0);
  const mmmUploadRequestRef = useRef(0);
  const forecastWorkerRequestRef = useRef(0);
  const regimeWorkerRequestRef = useRef(0);
  const forecastMatchEventRef = useRef("");
  const packageStatusTimerRef = useRef(null);
  useEffect(() => () => {
    if (packageStatusTimerRef.current) clearTimeout(packageStatusTimerRef.current);
  }, []);
  // 타깃·플랫폼·prior를 처음 전환할 때도 수백 회 profile/rolling fit이 필요할 수
  // 있다. 오버레이를 두 프레임 먼저 그린 뒤 상태를 커밋해 첫 클릭이 멈춘 것처럼
  // 보이지 않게 한다. 같은 조합 재방문은 위 WeakMap 캐시에서 즉시 반환된다.
  const deferMmmUpdate = useCallback((update) => {
    const transition = ++analysisTransitionRef.current;
    setIsAnalyzing(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (transition !== analysisTransitionRef.current) return;
        update();
        requestAnimationFrame(() => {
          if (transition === analysisTransitionRef.current) setIsAnalyzing(false);
        });
      });
    });
  }, []);
  const horizonDraftState = forecastHorizonDraftState(fcHorizonDraft, fcHorizon);
  const preparedForecastHorizon = horizonDraftState.horizon;
  const isForecastSettingsDirty = horizonDraftState.dirty
    || fcEventPolicyDraft !== fcEventPolicy;
  const applyForecastSettings = useCallback(() => {
    if (!isForecastSettingsDirty) return;
    // 오버레이를 두 프레임 먼저 페인트한 뒤 무거운 forecast useMemo를 실행한다.
    deferMmmUpdate(() => {
      // 입력값(0, 100 등)이 엔진의 1~52주 범위로 보정되면 화면에도 실제
      // 계산값을 즉시 반영해 표시값과 실행값이 갈리지 않게 한다.
      setFcHorizonDraft(String(preparedForecastHorizon));
      setFcHorizon(preparedForecastHorizon);
      setFcEventPolicy(fcEventPolicyDraft);
    });
  }, [deferMmmUpdate, isForecastSettingsDirty, preparedForecastHorizon, fcEventPolicyDraft]);
  // 플랫폼 필터(Total/Android/iOS) — colMap 헤더 태그(_android/_ios) 기준. 태그 없으면 토글 자체 숨김.
  const [platformFilter, setPlatformFilter] = useState("all"); // all | android | ios

  // CSV 로드 시 colMap 자동 초기화(이름 기반 부분 추정 — reg/react/채널만, 나머지는 트레이).
  const csvSig = hasData ? `${csvData.fileName}|${(csvData.headers || []).join(",")}` : "";
  const colMapSig = mmmColMap ? JSON.stringify(mmmColMap) : "";
  const mmmAnalysisSig = `${colMapSig}\u001fweek-start:${mmmWeekStart}`;
  const forecastRegimeInputSig = [
    csvSig,
    mmmAnalysisSig,
    `target:${target}`,
    `platform:${platformFilter}`,
    `horizon:${fcHorizon}`,
  ].join("\u001f");
  const saveResponseMapping = useCallback((nextMap = mmmColMap, nextWeekStart = mmmWeekStart) => {
    if (!csvData?.raw?.length || !nextMap) return;
    setResponseMappingSession({ raw: csvData.raw, colMap: nextMap, weekStart: nextWeekStart });
  }, [csvData.raw, mmmColMap, mmmWeekStart, setResponseMappingSession]);
  const updateMmmColMap = useCallback((nextMap) => {
    setMmmColMap(nextMap);
    saveResponseMapping(nextMap, mmmWeekStart);
  }, [saveResponseMapping, mmmWeekStart]);
  const prevCsvSig = useRef(null);
  const prevCsvRaw = useRef(null);
  const prevForecastRegimeInputSig = useRef(forecastRegimeInputSig);
  const effectiveForecastRegime = forecastRegimeStateForInput({
    stateSignature: forecastRegimeStateSignature,
    currentSignature: forecastRegimeInputSig,
    trainingWeeks: fcRegimeTrainingWeeks,
    scanRequested: isRegimeWindowScanRequested,
  });
  const effectiveFcRegimeTrainingWeeks = effectiveForecastRegime.trainingWeeks;
  const effectiveIsRegimeWindowScanRequested = effectiveForecastRegime.scanRequested;
  // Set by the demo button so the auto-guessed colMap is also auto-confirmed
  // (analyze gate opened) — results render instantly, matching other tools.
  const demoPending = useRef(false);
  useEffect(() => {
    // 같은 파일명·헤더로 새 CSV를 다시 올려도 raw 배열은 새 객체다. 파일명만
    // 비교하면 이전 수동 매핑이 새 데이터에 남아 계절·이벤트 역할이 달라질 수
    // 있으므로, 실제 원자료가 바뀌면 항상 다시 추정하고 분석 게이트를 닫는다.
    if (hasData && mmmCsvSourceChanged(prevCsvSig.current, csvSig, prevCsvRaw.current, csvData.raw)) {
      const saved = responseMappingSession?.raw === csvData.raw ? responseMappingSession : null;
      const guess = saved?.colMap || autoGuessColMap(csvData.headers, csvData.raw);
      const weekStart = saved?.weekStart || mmmWeekStart;
      const isDemoAutoAnalyze = demoPending.current;
      const shouldAutoAnalyze = Boolean(saved || isDemoAutoAnalyze);
      setMmmColMap(guess);
      setMmmWeekStart(weekStart);
      // 데모도 사용자가 저장한 매핑과 같은 세션 계약을 사용한다. 컴포넌트를
      // 벗어났다가 허브로 돌아와도 5개 분석 선택지가 그대로 복원되어야 한다.
      if (isDemoAutoAnalyze && !saved) {
        setResponseMappingSession({ raw: csvData.raw, colMap: guess, weekStart });
      }
      // 허브에서 저장한 매핑으로 독립 화면에 직접 들어온 경우에는 다시 매핑을
      // 요구하지 않는다. 새 CSV·데모만 명시적으로 분석 확인을 거친다.
      setMmmAnalyzedSig(shouldAutoAnalyze ? `${JSON.stringify(guess)}\u001fweek-start:${weekStart}` : null);
      setMmmAnalyzedRaw(shouldAutoAnalyze ? csvData.raw : null);
      setSelectedEvidence({ experiment: false, country: false });
      setPriorEvidence({ experiment: null, country: null });
      setFcRegimeTrainingWeeks(null);
      setIsRegimeWindowScanRequested(false);
      setForecastRegimeStateSignature(null);
      demoPending.current = false;
      prevCsvSig.current = csvSig;
      prevCsvRaw.current = csvData.raw;
    } else if (!hasData && prevCsvSig.current !== null) {
      setMmmColMap(null);
      setMmmAnalyzedSig(null);
      setMmmAnalyzedRaw(null);
      setFcRegimeTrainingWeeks(null);
      setIsRegimeWindowScanRequested(false);
      setForecastRegimeStateSignature(null);
      prevCsvSig.current = null;
      prevCsvRaw.current = null;
    }
  }, [hasData, csvSig, csvData.headers, csvData.raw, mmmWeekStart, responseMappingSession, setResponseMappingSession]);
  useEffect(() => {
    if (forecastRegimeInputChanged(prevForecastRegimeInputSig.current, forecastRegimeInputSig)) {
      setFcRegimeTrainingWeeks(null);
      setIsRegimeWindowScanRequested(false);
      setForecastRegimeStateSignature(null);
    }
    prevForecastRegimeInputSig.current = forecastRegimeInputSig;
  }, [forecastRegimeInputSig]);

  // 파일 업로드(자체 dropzone — 5-18은 표준 CsvUploader/DataFeatureMatrix 미사용).
  const mmmFileRef = useRef(null);
  useEffect(() => () => {
    // Papa worker는 컴포넌트가 사라진 뒤에도 complete를 보낼 수 있다. 요청 번호를
    // 무효화해 늦은 CSV가 다른 화면의 공유 store를 덮지 못하게 한다.
    mmmUploadRequestRef.current += 1;
  }, []);
  const handleMmmFile = (file) => {
    if (!file) return;
    const requestSequence = ++mmmUploadRequestRef.current;
    setMmmUploadError(null);
    trackProductEvent("data_import_start", { tool_id: "5-18", source: "csv", locale });
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (res) => {
        if (requestSequence !== mmmUploadRequestRef.current) return;
        const failure = mmmCsvParseFailure(res);
        if (failure) {
          setMmmUploadError(failure);
          trackProductEvent("data_import_failed", { tool_id: "5-18", source: "csv", state: failure === "empty" ? "empty_file" : "parse_error", locale });
          return;
        }
        setMmmUploadError(null);
        const headers = res.meta?.fields || [];
        setCsvData({ raw: res.data, headers, mapping: {}, fileName: file.name, workspaceSource: { blob: file.slice(), kind: "csv", originalFileName: file.name }, ...prepareSemanticParallelData({ raw: res.data, headers }) });
        trackProductEvent("data_import_success", { tool_id: "5-18", source: "csv", row_count: res.data.length, column_count: headers.length, locale });
      },
      error: () => {
        if (requestSequence !== mmmUploadRequestRef.current) return;
        setMmmUploadError("read");
        trackProductEvent("data_import_failed", { tool_id: "5-18", source: "csv", state: "parse_error", locale });
      },
    });
  };
  const handleLoadDemo = () => {
    mmmUploadRequestRef.current += 1;
    demoPending.current = true;
    setCsvData(buildDemoCsv("response", locale));
  };
  const handleLoadPriorDemo = () => {
    const demo = buildMmmPriorDemo();
    setPriorEvidence({
      experiment: { name: demo.experiment.fileName, rows: demo.experiment.raw.length, countries: ["KR"], raw: demo.experiment.raw, headers: demo.experiment.headers, analysisType: "auto" },
      country: {
        name: demo.country.fileName,
        rows: demo.country.raw.length,
        countries: [...new Set(demo.country.raw.map((row) => row.country))],
        raw: demo.country.raw,
        headers: demo.country.headers,
      },
    });
    setSelectedEvidence({ experiment: false, country: false });
  };

  // 자동 로드하지 않는다. 도구에 들어가자마자 샘플 분석 화면이 뜨면 "내 데이터를
  // 올리는 곳"이라는 사실이 가려지고, 화면의 숫자가 내 것인지 예시인지도 헷갈린다.
  // 예시는 업로드 안내(CsvGuide)의 "예시로 보기"로 명시적으로 부른다.
  // passive effect가 새 CSV의 매핑을 재설정하기 전 한 렌더에서도 이전 승인 토큰으로
  // 새 raw를 계산하지 않는다. 특히 같은 파일명·헤더로 재업로드한 경우 raw 객체
  // identity까지 맞아야 분석 gate가 열린다.
  const mmmAnalyzed = mmmAnalysisGateOpen({
    analyzedSignature: mmmAnalyzedSig,
    analysisSignature: mmmAnalysisSig,
    analyzedRaw: mmmAnalyzedRaw,
    currentRaw: csvData.raw,
  });
  const changeMmmWeekStart = (weekStart) => {
    if (weekStart === mmmWeekStart) return;
    const shouldReanalyze = mmmAnalyzed;
    setMmmWeekStart(weekStart);
    saveResponseMapping(mmmColMap, weekStart);
    if (shouldReanalyze) {
      deferMmmUpdate(() => {
        setMmmAnalyzedSig(`${colMapSig}\u001fweek-start:${weekStart}`);
        setMmmAnalyzedRaw(csvData.raw);
      });
    }
  };

  // 단일 컬럼 세그먼트(platform role) 모드 — 그 컬럼 고유값(성별·플랫폼·국가 등) pill 토글.
  // 태그 모드(mmmPlatformTags)와 상호배타(buildPanelFromColMap: r.platform 있으면 태그 무시).
  const segmentSel = useMemo(
    () => (hasData && mmmColMap && mmmAnalyzed ? mmmSegmentValues(csvData.headers, csvData.raw, mmmColMap) : null),
    [hasData, mmmColMap, csvData, mmmAnalyzed],
  );
  // platformFilter가 현재 세그먼트 값에 없으면(매핑 변경 잔상) Total로 파생(setState 대신
  // 렌더타임 파생 — AHA validSeg 패턴, 캐스케이딩 렌더 회피). 패널·pill 모두 이 값 사용.
  const effPlatformFilter = useMemo(() => {
    if (segmentSel && platformFilter !== "all" && !segmentSel.values.some((v) => v.value === platformFilter)) return "all";
    return platformFilter;
  }, [segmentSel, platformFilter]);

  // 분석하기: 무거운 mmm useMemo가 커밋 렌더에서 동기 실행되므로, 로딩 오버레이를 먼저
  // 페인트(더블 rAF)한 뒤 시그니처를 커밋 → "멈춤" 대신 "분석 중" 표시(§7 성능).
  // 분석 시작은 현재 매핑 위치에서 하는 행동이므로 스크롤을 강제로 옮기지 않는다.
  const runMmmAnalyze = (sig) => {
    const analysisType = stage === "hub" ? "mapping" : stage;
    const analysisKey = `${sig}|${target}|${effPlatformFilter}|${stage}`;
    trackProductEventOnce("analysis_started", analysisResultEventKey("5-18", analysisType, computeAnalyzeSig(csvData), analysisKey, locale), {
      tool_id: "5-18",
      source: isDemo ? "demo" : "csv",
      row_count: csvData?.raw?.length || 0,
      analysis_type: analysisType,
      locale,
    });
    deferMmmUpdate(() => {
      setMmmAnalyzedSig(sig);
      setMmmAnalyzedRaw(csvData.raw);
    });
  };

  // Chart refs
  const cvRef = useRef(null);
  const shapleyRef = useRef(null);
  const satRef = useRef(null);
  const efficiencyRef = useRef(null);
  const fitRef = useRef(null);
  const decompRef = useRef(null);
  const forecastRef = useRef(null);
  const trendRef = useRef(null);
  const simpleRef = useRef(null);
  const irfRef = useRef(null);

  // 추세·카니발·예측은 전체 MMM 기여 적합을 선행 조건으로 두지 않는다. 공통으로
  // 필요한 것은 매핑된 주간 패널과 데이터 품질 검사뿐이며, 이 가벼운 번들은 각
  // 독립 화면에서만 만든다. MMM 화면만 아래의 무거운 Classic 적합을 실행한다.
  const responseBaseBundle = useMemo(() => {
    if (!hasData || !mmmAnalyzed || stage === "hub") return null;
    try {
      if (!mmmColMap) return { empty: true, reason: tx("컬럼 역할을 매핑하세요 (날짜/주차 · 목표 Y · 채널 spend).", "Map column roles (date/week · target Y · channel spend).") };
      const built = buildPanelFromColMap(csvData.headers, csvData.raw, mmmColMap, effPlatformFilter, locale, null, { weekStart: mmmWeekStart });
      const baseMissing = stage === "lab"
        ? built.missing.filter((item) => !["채널 spend 1개 이상", "1+ channel spend"].includes(item))
        : built.missing;
      if (baseMissing.length) return { empty: true, reason: tx("필수 역할 미지정: ", "Required role not set: ") + baseMissing.join(", ") };
      const panel = trimToActive(built.panel);
      const cfg = { ...MMM_METH_CONFIG, absorbed: new Set() };
      const resolvedTarget = pickTarget(panel, target);
      const dataQuality = mmmDataQualityAudit(panel);
      if (!dataQuality.valid) return { empty: true, reason: tx(`데이터 품질 게이트 미통과: ${dataQuality.issues.join(", ")}`, `Data-quality gate failed: ${dataQuality.issues.join(", ")}`), dataQuality, panel };
      const validate = mmmValidate(panel, locale, resolvedTarget);
      if (validate.issues?.length) return { empty: true, reason: validate.issues.join(" "), issues: validate.issues, validate, panel };
      const absorb = mmmResolveAbsorb(panel, cfg);
      cfg.absorbed = absorb.absorbed;
      return {
        empty: false,
        panel,
        cfg,
        target: resolvedTarget,
        validate,
        absorb,
        derived: {
          availableTargets: MMM_USER_TARGETS.filter((candidate) => Object.prototype.hasOwnProperty.call(panel.targets, candidate)),
          targetSources: {
            Traffic: built.roles.traffic.map((item) => item.header), Regs: built.roles.reg.map((item) => item.header),
            React: built.roles.react.map((item) => item.header), Purchasers: built.roles.purchasers.map((item) => item.header), Revenue: built.roles.revenue.map((item) => item.header),
          },
        },
      };
    } catch (error) {
      return { empty: true, reason: tx("분석 오류: ", "Analysis error: ") + String(error?.message || error) };
    }
  }, [hasData, mmmAnalyzed, stage, mmmColMap, csvData, effPlatformFilter, locale, mmmWeekStart, target, tx]);

  // ── MMM 캐시 (buildMmmMethCache 축약) — 매핑·데이터·target·model 변경 시 재계산 ──
  const mmmBundle = useMemo(() => {
    if (!hasData) return null;
    // 분석 게이트(index 분석하기): 매핑 확정 전엔 무거운 엔진(mmmRunMmm 등)을 돌리지 않음 —
    // 드래그 도중 반쯤 매핑된 colMap으로 엔진이 도는 것을 막고(성능·크래시 방지) 게이트 후에만 계산.
    if (!mmmAnalyzed) return { empty: true, reason: tx("매핑 확정(분석하기) 후 결과가 표시됩니다.", "Results appear after you confirm the mapping (Analyze).") };
    if (stage !== "mmm") return null;
    try {
      // colMap(PRIMARY) → 패널. 미완성이면 매핑 안내(패널 empty).
      if (!mmmColMap) return { empty: true, reason: tx("컬럼 역할을 매핑하세요 (날짜/주차 · 목표 Y · 채널 spend).", "Map column roles (date/week · target Y · channel spend).") };
      const resultCacheKey = [
        `meth:${MMM_METH_CONFIG.version}`,
        `mode:${mmmMode}`,
        mmmMode === "prism" ? `prism-option-3:${MMM_CLASSIC_CONFIG.version}:${MMM_PRISM_MODEL_CONFIG.version}` : mmmMode === "classic" ? `classic:${MMM_CLASSIC_CONFIG.version}` : `bayesian-posterior-channel-fit-v1:prior:${bayesianUsePrior ? 1 : 0}`,
        mmmAnalyzedSig,
        colMapSig,
        target,
        effPlatformFilter,
        locale,
        csvData.headers?.join("\u001f"),
        selectedEvidence.experiment ? `e:${mmmCacheObjectId(priorEvidence.experiment?.raw)}:${priorEvidence.experiment?.analysisType || "auto"}` : "e:off",
        selectedEvidence.country ? `c:${mmmCacheObjectId(priorEvidence.country?.raw)}` : "c:off",
      ].join("\u001e");
      const cachedResult = mmmCachedResult(csvData.raw, resultCacheKey);
      if (cachedResult) return cachedResult;
      const built = buildPanelFromColMap(csvData.headers, csvData.raw, mmmColMap, effPlatformFilter, locale, null, { weekStart: mmmWeekStart });
      if (built.missing.length) return { empty: true, reason: tx("필수 역할 미지정: ", "Required role not set: ") + built.missing.join(", ") };
      const panel = trimToActive(built.panel);
      const cfg = { ...MMM_METH_CONFIG, absorbed: new Set() };
      const t = pickTarget(panel, target);
      if (mmmMode === "prism" && MMM_PRISM_MODEL_CONFIG.requiresExternalIndustry && !Object.keys(panel.external || {}).length) {
        return {
          empty: true,
          reason: tx(
            "Prism 모델은 업황 컬럼이 필요합니다. 매핑에서 업계·카테고리 다운로드/설치 지표를 외부 업황으로 지정하세요.",
            "Prism requires an industry column. Map an industry/category download or install metric as external industry demand.",
          ),
          panel,
        };
      }
      const dataQuality = mmmDataQualityAudit(panel);
      if (!dataQuality.valid) {
        return {
          empty: true,
          reason: tx(
            `데이터 품질 게이트 미통과: ${dataQuality.issues.join(", ")}`,
            `Data-quality gate failed: ${dataQuality.issues.join(", ")}`,
          ),
          dataQuality,
          panel,
        };
      }
      const validate = mmmValidate(panel, locale, t);
      // 실제 달력 주가 비어 있으면 행 번호를 t=1…N으로 압축하는 순간 adstock과
      // 계절성이 틀어진다. 결측 주를 0으로 임의 보간하지 않고 사용자가 실제 KPI·
      // 지출 행을 채우도록 모델 적합 전에 명시적으로 중단한다.
      if (validate.issues?.length) {
        return {
          empty: true,
          reason: validate.issues.join(" "),
          issues: validate.issues,
          validate,
          panel,
        };
      }
      const derived = {
        orientation: "colmap",
        target: t,
        availableTargets: MMM_USER_TARGETS.filter((target) => Object.prototype.hasOwnProperty.call(panel.targets, target)),
        channels: built.roles.channels.map((c) => c.label),
        time: built.roles.week.length ? tx("매핑된 주차 컬럼", "Mapped week column") : tx("행 순서", "Row order"),
        n: panel.week.length,
        dummies: built.roles.dummies.map((d) => d.label),
        useDummies: panel.useDummies,
        targetSources: {
          Traffic: built.roles.traffic.map((item) => item.header),
          Regs: built.roles.reg.map((item) => item.header),
          React: built.roles.react.map((item) => item.header),
          Purchasers: built.roles.purchasers.map((item) => item.header),
          Revenue: built.roles.revenue.map((item) => item.header),
        },
      };
      // 공선쌍 감지. 사용자 선택이 없으면 어느 변수도 임의 제거하지 않고 식별·예산 gate로 보류한다.
      const absorb = mmmResolveAbsorb(panel, cfg);
      cfg.absorbed = absorb.absorbed;
      // 국가 prior: 동일 포맷의 참고 시장을 각각 적합한 뒤 매체 β만 평균낸다.
      // baseline·추세·계절성은 절대 이식하지 않으며, country 컬럼별 개별 모델이
      // 성공한 경우만 약한 precision으로 참고한다.
      const mediaPriors = {};
      const experimentPriorDiagnostics = [];
      let countryCandidates = [];
      let countryIndividualCandidates = [];
      let countryBacktests = null;
      let countryValidationMode = null;
      let countryPlan = null;
      let isCountryPriorTuned = false;
      const experiment = selectedEvidence.experiment ? priorEvidence.experiment : null;
      if (experiment?.raw?.length && experiment.headers?.length) {
        const allTargetRoleItems = [
          ...built.roles.traffic, ...built.roles.reg, ...built.roles.react, ...built.roles.purchasers, ...built.roles.revenue,
        ];
        const requestedExperimentType = experiment.analysisType || "auto";
        let experimentType = mmmResolveExperimentType(experiment.headers, experiment.raw, requestedExperimentType);
        const geoNormalized = experimentType.type === "geo"
          ? mmmNormalizeGeoWideEvidence(experiment.headers, experiment.raw, {
            targetHeaders: allTargetRoleItems.map((item) => item.header),
            channelHeaders: built.roles.channels.map((item) => item.header),
          })
          : { headers: experiment.headers, rows: experiment.raw, normalized: false, mode: "onoff" };
        const longNormalized = mmmNormalizeExperimentLongMedia(
          geoNormalized.headers,
          geoNormalized.rows,
          built.roles.channels,
          allTargetRoleItems.map((item) => item.header),
        );
        const experimentHeaders = longNormalized.headers;
        const experimentSourceRows = longNormalized.rows;
        experimentType = mmmResolveExperimentType(experimentHeaders, experimentSourceRows, requestedExperimentType);
        const normalizationMode = [geoNormalized.normalized ? geoNormalized.mode : null, longNormalized.normalized ? longNormalized.mode : null].filter(Boolean).join(" + ") || "none";
        const normalizationFailure = geoNormalized.error
          ? { reason: geoNormalized.error, detail: "geo-wide" }
          : geoNormalized.droppedBlankGeoRows > 0
            ? { reason: "blank-geo-wide-rows", detail: `${geoNormalized.droppedBlankGeoRows}` }
            : longNormalized.error
              ? { reason: longNormalized.error, detail: "long-media" }
              : longNormalized.repeatedDesignConflicts > 0
                ? { reason: "conflicting-long-design", detail: `${longNormalized.repeatedDesignConflicts}` }
                : longNormalized.repeatedTargetConflicts > 0
                  ? { reason: "conflicting-long-target", detail: `${longNormalized.repeatedTargetConflicts}` }
                : longNormalized.unmatchedChannels?.length
                  ? { reason: "unmatched-long-channels", detail: longNormalized.unmatchedChannels.join(", ") }
                  : null;
        const platformSlice = mmmEvidencePlatformSlice(experimentHeaders, experimentSourceRows, effPlatformFilter);
        let experimentRows = platformSlice.rows;
        const exactHeaderSet = new Set(experimentHeaders);
        const platformKey = mmmCanonicalSegment(effPlatformFilter);
        const activeMappedHeaders = (items) => (items || [])
          .filter((item) => platformSlice.platformHeader || effPlatformFilter === "all" || item.plat === "common" || mmmCanonicalSegment(item.plat) === platformKey)
          .map((item) => item.header)
          .filter((header) => exactHeaderSet.has(header));
        const targetRoleItems = {
          Traffic: built.roles.traffic,
          Regs: built.roles.reg,
          React: built.roles.react,
          Purchasers: built.roles.purchasers,
          Revenue: built.roles.revenue,
        };
        let targetComposition = platformSlice.matched
          ? mmmComposeEvidenceTarget(experimentRows, activeMappedHeaders(targetRoleItems[t]), `__mmm_${t.toLowerCase()}_target`)
          : null;
        let targetHeader = targetComposition?.targetHeader || null;
        if (targetComposition) experimentRows = targetComposition.rows;
        let hasTargetDiagnostic = !!normalizationFailure;
        // Traffic 컬럼 없이 Regs+React로 자동 생성된 총유입은 실험 원자료도 같은
        // 정의로 맞춰야 한다. 별도 traffic 헤더가 있더라도 정의가 달라질 수 있으므로
        // 가입+재유입 합계를 사용하고, 둘 중 하나라도 없으면 prior를 적용하지 않는다.
        if (t === "Traffic" && built.roles.traffic.length === 0 && platformSlice.matched && !normalizationFailure) {
          const regsHeaders = activeMappedHeaders(built.roles.reg);
          const reactHeaders = activeMappedHeaders(built.roles.react);
          if (regsHeaders.length && reactHeaders.length) {
            targetComposition = mmmComposeEvidenceTarget(
              platformSlice.rows,
              [...regsHeaders, ...reactHeaders],
              "__mmm_derived_traffic_target",
            );
            targetHeader = targetComposition.targetHeader;
            experimentRows = targetComposition.rows;
          } else {
            targetHeader = null;
            hasTargetDiagnostic = true;
            experimentPriorDiagnostics.push({
              unidentified: true,
              channel: mmmTargetDisplay("Traffic", locale),
              messageKo: "가입+재유입으로 자동 생성된 총유입 목표에는 실험 원자료에도 가입·재유입 두 컬럼이 모두 필요합니다. 같은 Y를 만들 수 없어 prior를 적용하지 않았습니다.",
              messageEn: "Traffic was derived from registrations + reactivations, so the experiment source also needs both columns. No prior was applied because the same Y could not be constructed.",
            });
          }
        }
        if (!targetHeader && !hasTargetDiagnostic) {
          const platformLabel = effPlatformFilter === "all" ? "" : ` (${effPlatformFilter})`;
          experimentPriorDiagnostics.push({
            unidentified: true,
            channel: `${mmmTargetDisplay(t, locale)}${platformLabel}`,
            messageKo: effPlatformFilter === "all"
              ? "실험 원자료에서 현재 목표와 같은 Y를 찾지 못해 prior를 적용하지 않았습니다. Y 헤더와 비즈니스 정의를 확인하세요."
              : "현재 선택한 플랫폼/세그먼트와 같은 실험 Y 또는 행을 찾지 못했습니다. Total이나 다른 OS의 근거를 자동 차용하지 않았습니다.",
            messageEn: effPlatformFilter === "all"
              ? "No prior was applied because the experiment source has no Y matching the current target. Check the Y header and business definition."
              : "No experiment Y or rows matched the selected platform/segment. Evidence from Total or another OS was not borrowed automatically.",
          });
        }
        const stateHeader = experimentType.type === "onoff" ? mmmFindExperimentBinaryHeader(experimentHeaders, experimentRows, "state") : null;
        const armHeader = experimentType.type === "geo" ? (experimentHeaders.includes("__mmm_arm") ? "__mmm_arm" : mmmFindExperimentBinaryHeader(experimentHeaders, experimentRows, "arm")) : null;
        const mappedTimeHeader = built.roles.date || built.roles.week[0]?.header || null;
        // 메인에서 `period`라는 날짜 컬럼을 매핑한 경우 이름만 보고 pre/post로
        // 먼저 빼앗지 않는다. 시간축을 우선 확정하고, 실제 값이 양쪽 pre/post
        // 범주로 완전히 파싱되는 별도 열만 실험 period로 인정한다.
        const timeHeader = mmmFindEvidenceTimeHeader(experimentHeaders, mappedTimeHeader);
        const periodHeader = experimentType.type === "geo" ? mmmFindEvidencePeriodHeader(experimentHeaders, experimentRows, timeHeader) : null;
        const geoHeader = experimentType.type === "geo" ? experimentHeaders.find((h) => h === "__mmm_geo" || /(^|[_\s])(geo|region|location)([_\s]|$)|지역|권역/i.test(String(h))) : null;
        const spends = mmmEvidenceSpendHeaders(experimentHeaders, built.roles.channels.map((role) => role.header));
        const hasValidTypeSchema = !!timeHeader && (experimentType.type === "onoff" || !!(geoHeader && armHeader && periodHeader));
        if (normalizationFailure) {
          experimentPriorDiagnostics.push({
            unidentified: true,
            experimentType: experimentType.type,
            experimentTypeSource: experimentType.source,
            normalizationMode,
            channel: mmmTargetDisplay(t, locale),
            reason: normalizationFailure.reason,
            detail: normalizationFailure.detail,
            messageKo: normalizationFailure.reason === "unmatched-long-channels"
              ? `long 형식의 channel 값이 메인 MMM 채널과 모두 일치해야 합니다. 미매핑: ${normalizationFailure.detail}`
              : normalizationFailure.reason === "conflicting-long-design"
                ? "같은 기간·지역의 long 행에서 state·arm·period가 서로 달라 prior를 적용하지 않았습니다. 반복 채널 행의 실험 범주를 동일하게 맞추세요."
              : normalizationFailure.reason === "conflicting-long-target"
                ? "같은 기간·지역의 long 행에서 KPI 값이 서로 달라 prior를 적용하지 않았습니다. 반복 행의 Y를 동일하게 맞추세요."
                : normalizationFailure.reason === "blank-geo-wide-rows"
                  ? `target_geo/control_geo가 빈 wide 행 ${normalizationFailure.detail}개가 있어 prior를 적용하지 않았습니다.`
                  : "실험 wide/long 형식을 안전하게 변환하지 못했습니다. 쌍 헤더·channel 값·time을 확인하세요.",
            messageEn: normalizationFailure.reason === "unmatched-long-channels"
              ? `Every long-format channel value must match a main MMM channel. Unmapped: ${normalizationFailure.detail}`
              : normalizationFailure.reason === "conflicting-long-design"
                ? "No prior was applied because repeated long rows disagree on state, arm, or period for the same time and geo. Make experiment categories identical across channel rows."
              : normalizationFailure.reason === "conflicting-long-target"
                ? "No prior was applied because repeated long rows disagree on the KPI for the same time and geo. Make repeated Y values identical."
                : normalizationFailure.reason === "blank-geo-wide-rows"
                  ? `${normalizationFailure.detail} wide row(s) have a blank target_geo/control_geo, so no prior was applied.`
                  : "The experiment wide/long source could not be normalized safely. Check paired headers, channel values, and time.",
          });
        } else if (!hasValidTypeSchema) {
          experimentPriorDiagnostics.push({
            unidentified: true,
            experimentType: experimentType.type,
            experimentTypeSource: experimentType.source,
            normalizationMode,
            channel: mmmTargetDisplay(t, locale),
            reason: "invalid-experiment-type-schema",
            messageKo: experimentType.type === "geo"
              ? "Geo 유형에는 time·geo·arm·period와 같은 채널 spend·KPI가 필요합니다. target_geo/control_geo wide 형식이면 target_/control_ 쌍 헤더를 확인하세요."
              : "On/Off 유형에는 정렬 가능한 time과 같은 채널 spend·KPI가 필요합니다. state가 없으면 검증된 spend 0=OFF·양수=ON으로만 추론합니다.",
            messageEn: experimentType.type === "geo"
              ? "Geo type requires time, geo, arm, period, matching channel spend, and KPI. For target_geo/control_geo wide input, verify every target_/control_ header pair."
              : "On/Off type requires a sortable time column plus matching channel spend and KPI. Without state, only verified spend zero=OFF and positive=ON are inferred.",
          });
        } else if (targetHeader && spends.length) {
          const baseRun = mmmBayesianRun(panel, cfg, t, false, { skipTransformUncertainty: true });
          const matchedSpends = spends.map((spendHeader) => {
            const mappedRole = built.roles.channels.find((role) => role.header === spendHeader);
            const channel = mappedRole ? baseRun?.saturationByChannel?.[mappedRole.key] : null;
            const contrast = channel ? mmmEvidenceTreatmentContrast(experimentRows, spendHeader, { stateHeader, armHeader, periodHeader }) : null;
            return channel ? { spendHeader, key: mappedRole.key, channel, contrast } : null;
          }).filter(Boolean);
          const changedSpends = matchedSpends.filter((item) => item.contrast?.isChanged);
          const identifiedSpends = changedSpends;
          if (identifiedSpends.length > 1) {
            experimentPriorDiagnostics.push({
              unidentified: true,
              channel: identifiedSpends.map((item) => item.channel.label).join(" + "),
              experimentType: experimentType.type,
              experimentTypeSource: experimentType.source,
              normalizationMode,
              messageKo: "동시에 처리된 여러 채널의 효과는 이 실험 하나로 분리할 수 없습니다. 채널별 실험 파일을 따로 올려야 하며, 현재 prior에는 적용하지 않았습니다.",
              messageEn: "One experiment cannot separate effects from multiple channels treated at the same time. Upload a separate experiment file per channel; no prior was applied.",
            });
          } else if (identifiedSpends.length === 0) {
            experimentPriorDiagnostics.push({
              unidentified: true,
              channel: matchedSpends.map((item) => item.channel.label).join(" + ") || mmmTargetDisplay(t, locale),
              experimentType: experimentType.type,
              experimentTypeSource: experimentType.source,
              normalizationMode,
              messageKo: "실험 처리와 함께 충분히 변한 단일 spend 채널을 찾지 못했습니다. 처리 채널별 파일로 나누거나 상태·처리군·기간 컬럼을 확인하세요.",
              messageEn: "No single spend channel showed a clear treatment contrast. Split the source by treated channel or verify the state, arm, and period columns.",
            });
          } else if (identifiedSpends.length === 1) {
            const { spendHeader, key, channel } = identifiedSpends[0];
            const priorResult = channel && buildExperimentMediaPriorDetailed(experimentRows, {
              targetHeader,
              spendHeader,
              stateHeader,
              armHeader,
              periodHeader,
              timeHeader,
              geoHeader,
              targetSpend: panel.ch[key],
              targetTimes: panel.weekLabel || panel.week,
              targetValues: panel.targets[t],
              params: channel.params,
            });
            const prior = priorResult?.prior;
            if (prior) {
              mergeMediaPrior(mediaPriors, key, { ...prior, source: "experiment" });
              experimentPriorDiagnostics.push({ channel: channel.label, key, experimentType: experimentType.type, experimentTypeSource: experimentType.source, normalizationMode, transformParams: channel.params, targetWeeklySpend: channel.recentMean, ...prior, ...(priorResult?.diagnostic || {}) });
            } else {
              const diagnostic = priorResult?.diagnostic || {};
              experimentPriorDiagnostics.push({
                unidentified: true,
                channel: channel.label,
                experimentType: experimentType.type,
                experimentTypeSource: experimentType.source,
                normalizationMode,
                ...diagnostic,
                messageKo: diagnostic.messageKo || "실험의 처리 강도 또는 KPI 효과를 안정적으로 식별하지 못해 prior를 적용하지 않았습니다. 표본 수·주차 연속성·처리 대비를 확인하세요.",
                messageEn: diagnostic.messageEn || "No prior was applied because treatment intensity or KPI lift was not identified reliably. Check sample size, weekly continuity, and treatment contrast.",
              });
            }
          }
        } else if (targetHeader && !spends.length) {
          experimentPriorDiagnostics.push({
            unidentified: true,
            experimentType: experimentType.type,
            experimentTypeSource: experimentType.source,
            normalizationMode,
            channel: mmmTargetDisplay(t, locale),
            reason: longNormalized.error || geoNormalized.error || "missing-mapped-spend",
            messageKo: "실험 spend를 메인 MMM의 채널에 연결하지 못했습니다. wide는 같은 채널 헤더를, long은 channel 값과 spend 열을 확인하세요.",
            messageEn: "Experiment spend could not be mapped to a main MMM channel. Verify matching wide headers or long-format channel values plus the spend column.",
          });
        }
      }
      const source = selectedEvidence.country ? priorEvidence.country : null;
      if (source?.raw?.length && source.headers?.length) {
        const countryHeader = source.headers.find((h) => MMM_COUNTRY_HEADER_PATTERN.test(String(h)));
        const mappedTimeHeader = built.roles.date || built.roles.week[0]?.header || null;
        const sourceTimeHeader = mmmFindEvidenceTimeHeader(source.headers, mappedTimeHeader);
        const targetCountry = mmmDetectTargetCountry(csvData.headers, csvData.raw);
        // 타깃 국가를 단일값으로 확정하지 못하면 참고 파일 안의 자기 국가 행을
        // 제거할 수 없다. 경고만 띄운 채 적용하면 self-reference가 생기므로 prior를
        // 만들지 않고, 메인 CSV의 COUNTRY 매핑을 고치도록 명시적으로 보류한다.
        if (!countryHeader || targetCountry.status !== "single") {
          const visiblePlan = planCountryReferenceFits(source.raw, {
            countryHeader,
            timeHeader: sourceTimeHeader,
            targetTimes: panel.weekLabel || panel.week,
          });
          countryPlan = {
            ...visiblePlan,
            countries: [],
            blocked: true,
            blockReason: countryHeader ? "target-country" : "reference-country",
            targetCountryDetection: targetCountry.status,
            targetCountryBlankRows: targetCountry.blankRows || 0,
            targetCountry: null,
            excludedTargetCountry: null,
            targetCountryConfirmationRequired: true,
          };
        } else {
        const excludedTargetCountry = targetCountry.status === "single" && countryHeader
          ? source.raw.some((row) => String(row?.[countryHeader] ?? "").trim().toLowerCase() === targetCountry.normalized)
          : false;
        const referenceRows = excludedTargetCountry
          ? source.raw.filter((row) => String(row?.[countryHeader] ?? "").trim().toLowerCase() !== targetCountry.normalized)
          : source.raw;
        countryPlan = planCountryReferenceFits(referenceRows, {
          countryHeader,
          timeHeader: sourceTimeHeader,
          targetTimes: panel.weekLabel || panel.week,
        });
        countryPlan = {
          ...countryPlan,
          targetCountryDetection: targetCountry.status,
          targetCountryBlankRows: targetCountry.blankRows || 0,
          targetCountry: targetCountry.value,
          excludedTargetCountry: excludedTargetCountry ? targetCountry.value : null,
          targetCountryConfirmationRequired: targetCountry.status !== "single",
        };
        countryIndividualCandidates = [
          ...(countryPlan.ineligibleCountries || []).map((item) => ({ ...item, status: "held", reason: item.reason || "minimum-rows" })),
          ...(countryPlan.omittedCountryDetails || []).map((item) => ({ ...item, status: "held", reason: item.reason || "browser-fit-cap" })),
        ];
        // 후보 선택에는 가장 이른 학습 cutoff 당시 이용 가능했던 타깃·참고국
        // 정보만 사용한다. 같은 고정 transform/prior를 모든 rolling fold에 적용해
        // 뒤 시점 참고국 데이터가 앞 holdout으로 새는 일을 막는다.
        countryValidationMode = "as-of-earliest-fold";
        const slicePanel = (input, end) => ({ ...input, week: input.week.slice(0, end), weekLabel: input.weekLabel?.slice(0, end), dateLabel: input.dateLabel?.slice(0, end), dates: input.dates?.slice(0, end), ch: Object.fromEntries(Object.entries(input.ch).map(([key, values]) => [key, values.slice(0, end)])), dummy: Object.fromEntries(Object.entries(input.dummy || {}).map(([key, values]) => [key, values.slice(0, end)])), steps: Object.fromEntries(Object.entries(input.steps || {}).map(([key, values]) => [key, values.slice(0, end)])), targets: Object.fromEntries(Object.entries(input.targets).map(([key, values]) => [key, values.slice(0, end)])) });
        // 최대 12개 적격 참고국을 같은 비중복 rolling-origin folds에서 검증해
        // 상위 4개만 조합한다. 같은 folds를 shortlist·조합 선택에 재사용하므로
        // 단일 holdout보다 안정적일 뿐 독립 OOS나 선택편향 제거로 부르지 않는다.
        const validationFolds = mmmRollingOrigins(panel.week.length, { holdout: 12, minTrain: 24, stride: 12, maxFolds: 3 });
        const evalCache = new Map();
        const meanFinite = (values) => {
          const usable = (values || []).map(Number).filter(Number.isFinite);
          return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
        };
        // Validation priors use only the earliest training window's target scale.
        // Reusing the full-target mean here would leak held-out Y into every fold.
        const validationScaleEnd = validationFolds.length ? Math.min(...validationFolds.map((fold) => fold.cut)) : panel.week.length;
        const validationTargetMean = meanFinite(panel.targets[t].slice(0, validationScaleEnd));
        const validationTargetPanel = slicePanel(panel, validationScaleEnd);
        // alpha/ec/slope도 holdout Y를 보지 않은 가장 이른 train에서 한 번만 고른다.
        // 참고국과 모든 fold를 이 단위에 고정해 후보마다 변환을 다시 골라 생기는
        // validation 이점을 차단한다.
        const validationTransformRun = mmmBayesianRun(validationTargetPanel, cfg, t, false, { skipTransformUncertainty: true });
        const validationTransformParams = validationTransformRun?.params || {};
        // 후보 선택이 끝난 뒤 최종 전체기간 prior를 만들 때만 전체 타깃 transform을
        // 별도로 적합한다. 이 최종 refit 수치는 독립 OOS 점수로 표시하지 않는다.
        const finalTransformRun = mmmBayesianRun(panel, cfg, t, false, { skipTransformUncertainty: true });
        const finalTransformParams = finalTransformRun?.params || {};
        const hasCompleteTransform = (params, inputPanel) => Object.keys(inputPanel.ch || {}).every((key) => {
          const value = params?.[key];
          return value && Number.isFinite(value.alpha) && Number.isFinite(value.ec) && value.ec > 0 && Number.isFinite(value.slope) && value.slope > 0;
        });
        const canAlignCountryTransforms = hasCompleteTransform(validationTransformParams, validationTargetPanel)
          && hasCompleteTransform(finalTransformParams, panel);
        if (!canAlignCountryTransforms) {
          countryPlan = { ...countryPlan, blocked: true, blockReason: "target-transform-alignment-failed", countries: countryPlan.countries || [] };
          countryIndividualCandidates.push(...(countryPlan.countries || []).map((item) => ({ ...item, status: "held", reason: "target-transform-alignment-failed" })));
        }
        // 실험 prior는 전체 패널의 대표 transform 단위이므로 train-only fold에
        // 재사용하지 않는다. 국가 후보는 base 대비 country-only로 검증하고, 선택
        // 이후 최종 all-history fit에서만 별도 추정한 실험 prior와 precision 결합한다.
        const fixedPriors = {};
        const priorSignature = (prior) => Object.entries(prior || {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}:${Number(value.mean).toPrecision(9)}:${Number(value.precision).toPrecision(9)}`).join("|");
        const evaluatePrior = (countryPrior, complexity = 1, folds = validationFolds) => {
          const prior = {};
          Object.entries(fixedPriors).forEach(([key, value]) => mergeMediaPrior(prior, key, value));
          Object.entries(countryPrior || {}).forEach(([key, value]) => mergeMediaPrior(prior, key, value));
          const key = `${priorSignature(prior)}|${folds.map((fold) => fold.cut).join(",")}`;
          let result = evalCache.get(key);
          if (!result) {
            const outcomes = folds.map(({ cut, holdout }) => {
              const train = slicePanel(panel, cut);
              const futureSpend = Object.fromEntries(Object.entries(panel.ch).map(([channel, values]) => [channel, values.slice(cut, cut + holdout)]));
              const futureDummy = Object.fromEntries(Object.entries(panel.dummy || {}).map(([key, values]) => [key, values.slice(cut, cut + holdout)]));
              const futureSteps = Object.fromEntries(Object.entries(panel.steps || {}).map(([key, values]) => [key, values.slice(cut, cut + holdout)]));
              const fit = mmmBayesianRun(train, cfg, t, false, {
                mediaPriors: prior,
                skipTransformUncertainty: true,
                // 가장 이른 학습구간에서 선택한 변환을 base/prior 모든 fold에 고정.
                channelParams: validationTransformParams,
              });
              const forecast = fit && mmmBayesianForecast(fit, train, futureSpend, holdout, { futureDummy, futureSteps });
              const actual = panel.targets[t].slice(cut, cut + holdout);
              const rmse = forecast?.predFut?.length === actual.length
                ? Math.sqrt(actual.reduce((sum, value, index) => sum + (value - forecast.predFut[index]) ** 2, 0) / actual.length)
                : Infinity;
              return {
                cut,
                holdout,
                rmse,
                labels: (panel.weekLabel || panel.week).slice(cut, cut + holdout),
                actual,
                predicted: forecast?.predFut || [],
              };
            });
            // 일부 fold만 성공한 후보는 쉬운 구간만으로 순위에 오를 수 있다.
            // 모든 동일 fold가 유한할 때만 shortlist와 조합 평가에 진입시킨다.
            const isComplete = outcomes.length === folds.length && outcomes.every((outcome) => Number.isFinite(outcome.rmse));
            result = { outcomes, summary: isComplete ? summarizeRollingErrors(outcomes.map((outcome) => outcome.rmse), 1) : null };
            evalCache.set(key, result);
          }
          const summary = result.summary && summarizeRollingErrors(result.outcomes.map((outcome) => outcome.rmse), complexity);
          const latest = result.outcomes[0] || null;
          return summary ? { ...summary, rmse: latest?.rmse ?? Infinity, backtest: latest, foldRmses: result.outcomes.map((outcome) => outcome.rmse) } : null;
        };
        const medianPositive = (values) => {
          const sorted = (values || []).map(Number).filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
          if (!sorted.length) return null;
          const middle = Math.floor(sorted.length / 2);
          return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
        };
        const fitReferenceEvidence = (referenceRowsForFit, transformParams, targetScalePanel) => {
          const ref = buildPanelFromColMap(source.headers, referenceRowsForFit, mmmColMap, effPlatformFilter, locale, null, { weekStart: mmmWeekStart });
          if (ref.missing.length) return { error: "mapping-mismatch", detail: ref.missing.join(", ") };
          const refPanel = trimToActive(ref.panel);
          if (!Object.prototype.hasOwnProperty.call(refPanel.targets, t)) return { error: "missing-target", detail: t };
          if (refPanel.week.length < 24) return { error: "insufficient-as-of-weeks", detail: `${refPanel.week.length}/24` };
          const refValidation = mmmValidate(refPanel, locale, t);
          if (refValidation.issues?.length) return { error: "validation-failed", detail: refValidation.issues.join(" | ") };
          const spendScaleFactors = {};
          for (const key of Object.keys(refPanel.ch || {})) {
            const transform = transformParams?.[key];
            if (!transform || !Object.prototype.hasOwnProperty.call(targetScalePanel.ch || {}, key)) {
              return { error: "transform-unit-mismatch", detail: key };
            }
            const sourceAdstockScale = medianPositive(mmmAdstock(refPanel.ch[key], transform.alpha));
            const targetAdstockScale = medianPositive(mmmAdstock(targetScalePanel.ch[key], transform.alpha));
            if (!(sourceAdstockScale > 0) || !(targetAdstockScale > 0)) return { error: "spend-scale-alignment-failed", detail: key };
            const factor = targetAdstockScale / sourceAdstockScale;
            if (!(factor > 0) || !Number.isFinite(factor)) return { error: "spend-scale-alignment-failed", detail: key };
            refPanel.ch[key] = refPanel.ch[key].map((value) => Number.isFinite(Number(value)) ? Number(value) * factor : NaN);
            spendScaleFactors[key] = factor;
          }
          const refRun = mmmBayesianRun(refPanel, { ...cfg, absorbed: new Set(cfg.absorbed || []) }, t, false, {
            ...countryPlan.fitOptions,
            channelParams: transformParams,
          });
          if (!refRun) return { error: "fit-failed", detail: "" };
          const rawPrior = {};
          Object.values(refRun?.saturationByChannel || {}).forEach((s) => {
            const spend = (refPanel.ch?.[s.key] || []).map(Number).filter(Number.isFinite);
            const nonzero = spend.filter((value) => Math.abs(value) > 1e-12).length;
            const minimumNonzero = MMM_METH_CONFIG.sparseMinWeeks || 20;
            const lower = spend.length ? Math.min(...spend) : 0;
            const upper = spend.length ? Math.max(...spend) : 0;
            const scale = spend.length ? spend.reduce((sum, value) => sum + Math.abs(value), 0) / spend.length : 0;
            // 0/blank 위주이거나 사실상 상수인 채널의 ridge β≈0을 전이 prior로
            // 만들면 타깃 효과를 근거 없이 0으로 당긴다.
            if (nonzero < minimumNonzero || !(upper - lower > Math.max(1e-8, scale * 1e-6))) return;
            const se = (s.ci?.[1] - s.ci?.[0]) / (2 * 1.645);
            if (isFinite(s.ln_coef) && isFinite(se) && se > 0) rawPrior[s.key] = {
              mean: s.ln_coef,
              precision: 1 / (se ** 2),
              variance: se ** 2,
              source: "country",
              referenceSpendScaleFactor: spendScaleFactors[s.key],
              referenceSpendScaleMethod: "positive-adstock-median-to-target",
              targetLockedTransform: transformParams[s.key] ? {
                alpha: transformParams[s.key].alpha,
                ec: transformParams[s.key].ec,
                slope: transformParams[s.key].slope,
              } : null,
            };
          });
          if (!Object.keys(rawPrior).length) return { error: "insufficient-channel-evidence", detail: "" };
          return { rawPrior, sourceTargetMean: meanFinite(refPanel.targets[t]), refPanel, spendScaleFactors };
        };
        const preliminary = [];
        (canAlignCountryTransforms ? countryPlan?.countries || [] : []).forEach(({ country, rows }) => {
          const holdIndividual = (reason, detail = "") => countryIndividualCandidates.push({ country, status: "held", reason, detail });
          const asOf = mmmCountryRowsAsOfFold(rows, {
            timeHeader: sourceTimeHeader,
            targetTimes: panel.weekLabel || panel.week,
            cut: validationScaleEnd,
          });
          if (!asOf.isStrictHistorical || asOf.unparseableRows > 0 || !asOf.rows.length) {
            return holdIndividual("historical-alignment-failed", asOf.reason || `${asOf.unparseableRows || 0} unparseable time row(s)`);
          }
          // 타깃이 Android/iOS/임의 세그먼트라면 참고국도 같은 grain으로 적합한다.
          // earliest cutoff 이후의 참고국 행은 후보 선택에 절대 사용하지 않는다.
          const validationEvidence = fitReferenceEvidence(asOf.rows, validationTransformParams, validationTargetPanel);
          if (validationEvidence.error) return holdIndividual(validationEvidence.error, validationEvidence.detail);
          const validationPrior = rescaleCountryPriorToTarget(validationEvidence.rawPrior, validationEvidence.sourceTargetMean, validationTargetMean);
          if (!validationPrior) return holdIndividual("target-scale-alignment-failed");
          const transfer = buildCountryTransferPrior([{ country, prior: validationPrior }], { requireTransformAlignment: true });
          const prior = transfer.prior;
          if (!Object.keys(prior).length) return holdIndividual("insufficient-channel-evidence");
          // 모든 참고국과 조합을 같은 반복 folds에서 비교해 단일 holdout 운은
          // 줄이지만, 이 folds는 shortlist와 최종 후보 선택에 재사용된다. 따라서
          // 아래 점수는 명시적인 tuning 근거이지 독립 최종 OOS가 아니다.
          const rolling = evaluatePrior(prior, 1);
          const referenceEvidence = {
            country,
            validationRawPrior: validationEvidence.rawPrior,
            validationSourceTargetMean: validationEvidence.sourceTargetMean,
            fullRows: rows,
            asOfCutoff: asOf.cutoff,
            excludedFutureRows: asOf.excludedFutureRows,
          };
          if (rolling) preliminary.push({ country, prior, referenceEvidence, members: [referenceEvidence], countryCount: 1, transfer, ...rolling });
          else holdIndividual("rolling-fit-failed");
        });
        preliminary.sort((a, b) => a.score - b.score);
        const candidatePriors = preliminary.slice(0, 4);
        candidatePriors.sort((a, b) => a.score - b.score);
        const top = candidatePriors;
        const scoreSet = (members) => {
          const evidenceMembers = members.map((member) => member.referenceEvidence);
          const validationMembers = evidenceMembers.map((member) => ({
            country: member.country,
            prior: rescaleCountryPriorToTarget(member.validationRawPrior, member.validationSourceTargetMean, validationTargetMean),
          }));
          const transfer = buildCountryTransferPrior(validationMembers, { maxCombinationSize: 3, requireTransformAlignment: true });
          const prior = transfer.prior;
          const rolling = evaluatePrior(prior, members.length);
          return rolling ? { country: transfer.countries.join(" + "), prior, transfer, members: evidenceMembers, countryCount: transfer.countryCount, complexity: transfer.countryCount, validationMode: countryValidationMode, ...rolling } : null;
        };
        const sets = buildCountryCombinations(top, { maxCombinationSize: 3 }).map(scoreSet).filter(Boolean);
        const baseline = evaluatePrior({}, 1);
        const selection = selectCountryPriorCandidate(baseline, sets, { maxCombinationSize: 3 });
        countryIndividualCandidates = [
          ...preliminary.map((candidate) => {
            const evaluated = selection.evaluated.find((item) => item.complexity === 1 && item.country === candidate.country);
            return {
              country: candidate.country,
              status: evaluated?.eligible ? "eligible" : "held",
              reason: evaluated?.eligible ? null : (evaluated?.ineligibleReasons || ["outside-combination-shortlist"]).join(" | "),
              folds: candidate.folds,
              meanRmse: candidate.meanRmse,
              sdRmse: candidate.sdRmse,
              score: candidate.score,
              relativeImprovement: evaluated?.relativeImprovement ?? (baseline?.meanRmse > 0 ? (baseline.meanRmse - candidate.meanRmse) / baseline.meanRmse : null),
              foldWinRate: evaluated?.foldWinRate ?? null,
              pairedImprovementLowerOneSe: evaluated?.pairedImprovementLowerOneSe ?? null,
            };
          }),
          ...countryIndividualCandidates,
        ];
        countryPlan = {
          ...countryPlan,
          validationReason: selection.reason,
          validationFolds: selection.baseline?.folds || 0,
          minimumValidationFolds: 2,
        };
        let selectedCountrySet = selection.selected;
        const baseCandidate = selection.baseline ? { country: tx("기본 MMM", "Base MMM"), prior: {}, isBaseline: true, ...selection.baseline } : null;
        const remaining = selection.evaluated.filter((candidate) => !selectedCountrySet || candidate.country !== selectedCountrySet.country || candidate.score !== selectedCountrySet.score).sort((a, b) => a.score - b.score);
        countryCandidates = selectedCountrySet
          ? [{ ...selectedCountrySet, isRecommended: true }, ...(baseCandidate ? [baseCandidate] : []), ...remaining]
          : [...(baseCandidate ? [baseCandidate] : []), ...remaining];
        if (baseline?.backtest && selectedCountrySet?.backtest) {
          countryBacktests = {
            labels: baseline.backtest.labels,
            actual: baseline.backtest.actual,
            variants: [
              { label: tx("기본 모델(국가 미적용)", "Base model (no market prior)"), predicted: baseline.backtest.predicted, color: CHART_THEME.muted, dash: [2, 3] },
              ...candidatePriors.filter((candidate) => candidate.backtest).map((candidate) => ({ label: candidate.country, predicted: candidate.backtest.predicted })),
              { label: tx(`추천 세트: ${selectedCountrySet.country}`, `Recommended: ${selectedCountrySet.country}`), predicted: selectedCountrySet.backtest.predicted, color: CHART_THEME.primary, dash: [], recommended: true },
            ],
          };
        }
        if (selectedCountrySet) {
          // Validation stayed locked to the earliest training scale. Only after a
          // candidate is selected do we refit only those reference countries on
          // full history/full-target transforms. This final refit has no separate
          // independent OOS score and is labeled accordingly.
          const finalTargetMean = meanFinite(panel.targets[t]);
          const finalMembers = (selectedCountrySet.members || []).map((member) => {
            const finalAsOf = mmmCountryRowsAsOfFold(member.fullRows, {
              timeHeader: sourceTimeHeader,
              targetTimes: panel.weekLabel || panel.week,
              cut: panel.week.length,
            });
            if (!finalAsOf.isStrictHistorical || finalAsOf.unparseableRows > 0 || !finalAsOf.rows.length) {
              return { country: member.country, error: "final-reference-time-alignment-failed", detail: finalAsOf.reason };
            }
            const evidence = fitReferenceEvidence(finalAsOf.rows, finalTransformParams, panel);
            if (evidence.error) return { country: member.country, error: evidence.error, detail: evidence.detail };
            const prior = rescaleCountryPriorToTarget(evidence.rawPrior, evidence.sourceTargetMean, finalTargetMean);
            return prior ? { country: member.country, prior } : { country: member.country, error: "target-scale-alignment-failed" };
          });
          const failedFinalMembers = finalMembers.filter((member) => member.error);
          if (failedFinalMembers.length) {
            countryPlan = {
              ...countryPlan,
              finalRefitReason: "final-reference-refit-failed",
              finalRefitFailures: failedFinalMembers,
            };
            countryCandidates = [...(baseCandidate ? [{ ...baseCandidate, isBaseline: true }] : []), ...selection.evaluated.map((candidate) => ({ ...candidate, isRecommended: false, finalRefitFailed: true }))];
            countryBacktests = null;
            const failedByCountry = new Map(failedFinalMembers.map((member) => [member.country, member.error || "final-reference-refit-failed"]));
            countryIndividualCandidates = countryIndividualCandidates.map((candidate) => failedByCountry.has(candidate.country)
              ? { ...candidate, status: "held", reason: failedByCountry.get(candidate.country) }
              : candidate);
            selectedCountrySet = null;
          } else {
            const finalTransfer = buildCountryTransferPrior(finalMembers, { maxCombinationSize: 3, requireTransformAlignment: true });
            if (!Object.keys(finalTransfer.prior).length) {
              countryPlan = { ...countryPlan, finalRefitReason: "final-reference-refit-failed", finalRefitFailures: [{ country: finalTransfer.countries.join(" + "), error: "transform-unit-mismatch" }] };
              countryCandidates = [...(baseCandidate ? [{ ...baseCandidate, isBaseline: true }] : []), ...selection.evaluated.map((candidate) => ({ ...candidate, isRecommended: false, finalRefitFailed: true }))];
              countryBacktests = null;
              selectedCountrySet = null;
            } else {
              isCountryPriorTuned = true;
              Object.entries(finalTransfer.prior).forEach(([key, prior]) => mergeMediaPrior(mediaPriors, key, prior));
              countryPlan = { ...countryPlan, finalRefitReason: "selected-full-history-refit", finalRefitCountries: finalTransfer.countries };
            }
          }
        }
        }
      }
      if (mmmMode === "bayesian") {
        const bayesianRun = mmmBayesianLikeRun(panel, cfg, t, true, {
          mediaPriors,
          enableBaselineSelection: true,
          // T1: 지출점유 기반 약정보 prior. 실험/국가 prior(mediaPriors)와 병합돼 계수를 수축.
          enableBusinessContributionPrior: bayesianUsePrior,
        });
        if (!bayesianRun) throw new Error("Bayesian posterior estimate failed");
        const health = mmmBayesianHealth(bayesianRun);
        return mmmStoreCachedResult(csvData.raw, resultCacheKey, {
          empty: false,
          panel,
          cfg,
          derived,
          target: t,
          validate,
          saturationPanel: panel,
          aggregatePanel: null,
          run: bayesianRun,
          health,
          effects: [],
          absorb,
          mediaPriors,
          heldMediaPriors: {},
          experimentPriorDiagnostics,
          countryCandidates,
          countryIndividualCandidates,
          countryBacktests,
          countryValidationMode,
          countryPlan,
          isCountryPriorTuned,
          modelMode: "bayesian",
        });
      }

      // Classic과 내부 호환용 Prism은 같은 기반 엔진을 쓴다. Classic은 시즈널리티를
      // 기본 후보로 유지하고, 업황이 매핑되어 있으면 함께 넣는다. 시간순 OOS
      // WMAPE가 악화될 때만 해당 요소를 자동 제외한다. 업황이 없으면 외부
      // 제어변수 없이 일반 Classic으로 계속 진행한다.
      const hasExternalPrior = Object.keys(mediaPriors).length > 0;
      const usePrismModel = mmmMode === "prism";
      const classicAbsorbed = mmmClassicResolveAbsorb(
        panel,
        { ...MMM_CLASSIC_CONFIG, absorbed: new Set() },
      ).absorbed;
      const classicBaseCfg = usePrismModel
        ? {
          ...MMM_CLASSIC_CONFIG,
          trendPriorMultiplier: MMM_PRISM_MODEL_CONFIG.trendPriorMultiplier,
          seasonalityPeriods: MMM_PRISM_MODEL_CONFIG.seasonalityPeriods.slice(),
          mediaPenalty: 0,
          absorbed: classicAbsorbed,
        }
        : classicNoPriorConfig(MMM_CLASSIC_CONFIG, classicAbsorbed);
      const prismNeutralRun = usePrismModel
        ? mmmClassicBayesianRun(panel, {
          ...classicBaseCfg,
          seasonalityPeriods: [],
          seasonalityBasis: null,
        }, t, false, {
          enableClassicControlSelection: false,
          enableSeasonalitySelection: false,
          enableBaselineSelection: false,
          enableMediaPenaltySelection: false,
          skipTransformUncertainty: true,
        })
        : null;
      const prismBusinessSeasonality = usePrismModel
        ? buildObservedBusinessSeasonality(panel.dateLabel, prismNeutralRun?.posterior?.resid || [])
        : null;
      const prismSeasonalityBasis = prismBusinessSeasonality?.available
        ? {
          type: "observed-business",
          values: prismBusinessSeasonality.values,
          yearCount: prismBusinessSeasonality.yearCount,
          observedYears: prismBusinessSeasonality.observedYears,
        }
        : null;
      if (usePrismModel && !prismBusinessSeasonality?.available) {
        throw new Error(tx(
          "Prism 모델은 최소 2개 연도의 실제 비즈니스 계절성 패턴을 추정할 수 있어야 합니다.",
          "Prism requires at least two observed calendar years to estimate business seasonality.",
        ));
      }
      const prismClassicCfg = usePrismModel
        ? { ...classicBaseCfg, seasonalityBasis: prismSeasonalityBasis }
        : classicBaseCfg;
      const classicControlSelection = usePrismModel
        ? null
        : mmmClassicControlSelection(panel, classicBaseCfg, t, {
          enableClassicControlSelection: true,
          enableSeasonalitySelection: false,
          enableBaselineSelection: false,
          enableMediaPenaltySelection: false,
          disableManualPriors: true,
          skipTransformUncertainty: true,
        });
      const selectedPanel = usePrismModel ? panel : classicControlSelection.panel;
      const classicCfg = usePrismModel ? prismClassicCfg : classicControlSelection.cfg;
      const aggregatePanel = buildMmmAggregateMediaPanel(selectedPanel);
      if (!aggregatePanel) throw new Error("Classic aggregate media panel failed");
      const classicFitOptions = usePrismModel ? {
        mediaPriors,
        enableBaselineSelection: true,
        enableSeasonalitySelection: false,
        enableMediaPenaltySelection: false,
      } : classicNoPriorFitOptions({
        enableBaselineSelection: true,
        enableClassicControlSelection: false,
        enableSeasonalitySelection: false,
      });
      const aggregateBaseRun = usePrismModel
        ? mmmClassicBayesianRun(aggregatePanel, classicCfg, t, false, {
          ...classicFitOptions,
          skipTransformUncertainty: true,
        })
        : null;
      const groupContributionPriors = usePrismModel
        ? mmmClassicBuildGroupContributionPriors(aggregatePanel, panel.targets[t], aggregateBaseRun, MMM_PRISM_MODEL_CONFIG)
        : {};
      const aggregateRun = mmmClassicBayesianRun(aggregatePanel, classicCfg, t, true, {
        ...classicFitOptions,
        groupContributionPriors,
      });
      if (!aggregateRun) throw new Error("Classic aggregate estimate failed");
      const allocationFitOptions = usePrismModel
        ? {
          mediaPriors,
          enableBaselineSelection: true,
          skipTransformUncertainty: true,
          enableSeasonalitySelection: false,
          enableMediaPenaltySelection: false,
        }
        : classicNoPriorFitOptions({
          enableBaselineSelection: true,
          skipTransformUncertainty: true,
        });
      const allocationRun = mmmClassicBayesianRun(
        selectedPanel,
        classicCfg,
        t,
        false,
        allocationFitOptions,
      );
      if (!allocationRun) throw new Error("Classic channel allocation model failed");
      if (!usePrismModel) {
        const aggregatePriorAudit = auditClassicNoPriorRun(aggregateRun);
        const allocationPriorAudit = auditClassicNoPriorRun(allocationRun);
        if (!aggregatePriorAudit.passed || !allocationPriorAudit.passed) {
          throw new Error(`Classic prior invariant failed: ${[
            ...aggregatePriorAudit.reasons,
            ...allocationPriorAudit.reasons,
          ].join(",")}`);
        }
      }
      const allocatedRun = allocateFixedMmmGroupTotals(selectedPanel, aggregatePanel, aggregateRun, allocationRun, 0.01);
      allocatedRun.modelVariant = usePrismModel
        ? "prism-option-3-fixed-group-total"
        : "pr416-fixed-group-total-ranked-allocation";
      allocatedRun.methodLabel = usePrismModel
        ? "Prism Option 3 fixed totals with ranked channel allocation"
        : "Classic";
      allocatedRun.priorAudit = usePrismModel ? null : {
        aggregate: auditClassicNoPriorRun(aggregateRun),
        allocation: auditClassicNoPriorRun(allocationRun),
      };
      const targetGateStartIndex = (panel.weekLabel || []).findIndex((label) => String(label) >= "2024-01-01");
      const gateWeeks = targetGateStartIndex >= 0 ? allocatedRun.weeks.slice(targetGateStartIndex) : allocatedRun.weeks;
      const targetDiagnostics = {
        enabled: usePrismModel,
        profile: usePrismModel ? MMM_PRISM_MODEL_CONFIG.version : null,
        performance2024: gateWeeks.reduce((sum, week) => sum + Math.max(0, Number(week.contrib?.Performance) || 0), 0),
        branding2024: gateWeeks.reduce((sum, week) => sum + Math.max(0, Number(week.contrib?.Brand) || 0), 0),
        wmape: aggregateRun.backtest?.wmape ?? null,
        trendStart: allocatedRun.weeks[0]?.contrib?.Trend ?? null,
        trendEnd: allocatedRun.weeks.at(-1)?.contrib?.Trend ?? null,
        seasonalityMandatory: usePrismModel,
        seasonalitySource: usePrismModel ? prismBusinessSeasonality : null,
        industryKey: usePrismModel ? Object.keys(panel.external || {}) : [],
        controlSelection: classicControlSelection,
      };
      targetDiagnostics.passed = !usePrismModel || (
        targetDiagnostics.performance2024 >= 250000
        && targetDiagnostics.branding2024 >= 70000
        && targetDiagnostics.branding2024 <= 100000
        && targetDiagnostics.wmape != null
        && targetDiagnostics.wmape <= MMM_PRISM_MODEL_CONFIG.wmapeMax
        && targetDiagnostics.trendStart <= MMM_PRISM_MODEL_CONFIG.trendStartMax
        && targetDiagnostics.trendEnd >= MMM_PRISM_MODEL_CONFIG.trendEndMin
      );
      allocatedRun.prismDiagnostics = targetDiagnostics;
      allocatedRun.classicControlSelection = classicControlSelection;
      allocatedRun.pr416Provenance = {
        commit: usePrismModel ? "prism-option-3-v1" : "5a3e7fb",
        modelScope: "mmm-engine-only",
        currentFiltersPreserved: true,
        totalIndustryAggregationPreserved: true,
        decompMediaSource: "aggregate Performance/Branding posterior",
        channelAllocation: "fixed-group-total-ranked-coefficient-share",
        channelAllocationByConstruction: true,
        trendPriorMultiplier: classicCfg.trendPriorMultiplier,
        classicEngine: "mmmMathPr416",
        classicBiasPolicy: usePrismModel ? "internal-prism-profile" : "neutral-data-driven-no-manual-priors",
        prismOption: usePrismModel ? {
          ...MMM_PRISM_MODEL_CONFIG,
          groupContributionPriors,
          diagnostics: targetDiagnostics,
        } : null,
        externalChannelPriorsAppliedToAllocationFit: usePrismModel && hasExternalPrior,
        classicControlSelection,
      };
      const health = mmmBayesianHealth(allocatedRun);
      const effects = [];
      return mmmStoreCachedResult(csvData.raw, resultCacheKey, {
        empty: false,
          panel: selectedPanel,
        cfg: classicCfg,
        derived,
        target: t,
        validate,
          saturationPanel: selectedPanel,
        aggregatePanel,
        run: allocatedRun,
        health,
        effects,
        absorb,
        mediaPriors: usePrismModel ? mediaPriors : {},
        heldMediaPriors: usePrismModel ? {} : mediaPriors,
        experimentPriorDiagnostics,
        countryCandidates,
        countryIndividualCandidates,
        countryBacktests,
        countryValidationMode,
        countryPlan,
        isCountryPriorTuned,
        modelMode: usePrismModel ? "prism" : "classic",
      });
    } catch (e) {
      // null-fit(특이행렬)은 대개 채널 공선성(예산이 함께 움직임)·기간 부족 → 정직한 도메인 메시지 (§8)
      const msg = String(e && e.message || "");
      if (/reading '?(beta|coef|params)'?|null|singular|is not a function/i.test(msg)) {
        return {
          empty: true,
          reason: tx(
            "회귀 추정 불가 — 채널 지출이 서로 강하게 연동(공선성)되어 있거나 유효 기간(주)이 부족합니다. 채널별로 독립적인 지출 변동이 있는 데이터가 필요합니다.",
            "Regression estimate not possible — channel spends are strongly linked (collinear), or the valid period (weeks) is too short. Data with independent spend variation per channel is needed.",
          ),
        };
      }
      return { empty: true, reason: tx("분석 오류: ", "Analysis error: ") + msg };
    }
  }, [hasData, csvData, target, mmmMode, bayesianUsePrior, mmmColMap, mmmAnalyzed, mmmAnalyzedSig, colMapSig, mmmWeekStart, effPlatformFilter, locale, tx, selectedEvidence, priorEvidence, stage]);

  const mmm = stage === "mmm" ? mmmBundle : responseBaseBundle;
  const forecastActualMatches = useMemo(() => {
    if (isDemo || !mmm || mmm.empty) return [];
    return findForecastActualMatches(decisionRecords, mmm.panel, effPlatformFilter, mmm.target);
  }, [decisionRecords, effPlatformFilter, isDemo, mmm]);

  useEffect(() => {
    const signature = forecastActualMatches.map((match) => match.recordId).sort().join("|");
    if (!signature || forecastMatchEventRef.current === signature) return;
    forecastMatchEventRef.current = signature;
    trackProductEvent("forecast_actual_match_viewed", {
      tool_id: "5-18",
      source: "forecast_review",
      result_state: "matched",
      locale,
    });
  }, [forecastActualMatches, locale]);

  const decomp = useMemo(() => {
    if (!mmm || mmm.empty || stage !== "mmm") return null;
    try {
      return mmmBayesianWeeklyDecomp(mmm.run);
    } catch (e) {
      return null;
    }
  }, [mmm, stage]);

  // 모델 적합은 항상 전체 이력으로 한 번만 한다. 이 범위는 재학습 조건이 아니라
  // 결과를 읽는 창이다. 따라서 아래 모든 날짜 기반 뷰는 같은 주 구간을 공유한다.
  const contributionFilterDates = useMemo(() => (mmm?.run?.weeks
    ? mmm.run.weeks.map((week, index) => {
      const raw = isoDateFromLabel(mmm.panel.dateLabel?.[index] || mmm.panel.weekLabel?.[index]);
      return { index, label: String(mmm.panel.weekLabel?.[index] || week.week), start: weekBoundaryDate(raw, mmmWeekStart, "start"), end: weekBoundaryDate(raw, mmmWeekStart, "end") };
    }).filter((item) => item.start && item.end)
    : []), [mmm, mmmWeekStart]);
  const contributionViewRange = useMemo(() => {
    if (!mmm || mmm.empty || !contributionFilterDates.length) return { start: 0, end: mmm?.run?.weeks?.length || 0 };
    const visible = contributionFilterDates.filter((item) => (!contributionViewStart || item.start >= contributionViewStart) && (!contributionViewEnd || item.end <= contributionViewEnd));
    return visible.length ? { start: visible[0].index, end: visible.at(-1).index + 1 } : { start: 0, end: 0 };
  }, [mmm, contributionFilterDates, contributionViewStart, contributionViewEnd]);
  const displayedDecomp = useMemo(() => {
    if (!decomp || !mmm?.run) return decomp;
    try { return mmmBayesianWeeklyDecomp(sliceMmmRun(mmm.run, contributionViewRange.start, contributionViewRange.end)); } catch { return null; }
  }, [decomp, mmm, contributionViewRange]);
  const displayedMmmPanel = useMemo(() => mmm?.panel ? sliceMmmPanel(mmm.panel, contributionViewRange.end, contributionViewRange.start) : null, [mmm, contributionViewRange]);
  const displayedSaturationPanel = useMemo(() => mmm?.saturationPanel
    ? sliceMmmPanel(mmm.saturationPanel, contributionViewRange.end, contributionViewRange.start)
    : displayedMmmPanel, [mmm, displayedMmmPanel, contributionViewRange]);

  // 상위 Performance·Branding posterior가 총량 SSOT다. 채널 표에는 그 총량을
  // adstocked spend share로 나눈 배분값만 사용하며 별도 그룹 재적합은 하지 않는다.
  const collinearityGroupRefit = null;
  const displayedCollinearityGroupRefit = useMemo(() => sliceMmmCollinearityGroupRefit(
    collinearityGroupRefit,
    contributionViewRange.start,
    contributionViewRange.end,
  ), [collinearityGroupRefit, contributionViewRange]);
  const displayedSaturationByChannel = useMemo(() => withMmmViewSpend(
    mmm?.run?.saturationByChannel,
    displayedSaturationPanel,
    Boolean(contributionViewStart || contributionViewEnd),
  ), [mmm, displayedSaturationPanel, contributionViewStart, contributionViewEnd]);
  const displayedSaturationCurveSeries = useMemo(() => {
    return Object.values(displayedSaturationByChannel).map((channel) => ({ ...channel, isGroup: false }));
  }, [displayedSaturationByChannel]);
  const effectiveBayesianResponseChannel = useMemo(() => {
    const channels = Object.values(displayedSaturationByChannel);
    return channels.find((channel) => channel.key === bayesianResponseChannel)
      || channels.slice().sort((left, right) => (Number(right.recentMean) || 0) - (Number(left.recentMean) || 0))[0]
      || null;
  }, [bayesianResponseChannel, displayedSaturationByChannel]);
  const visibleSaturationCurveSeries = useMemo(() => (
    effectiveBayesianResponseChannel
      ? displayedSaturationCurveSeries.filter((channel) => channel.key === effectiveBayesianResponseChannel.key)
      : displayedSaturationCurveSeries
  ), [displayedSaturationCurveSeries, effectiveBayesianResponseChannel]);

  // 주간 상위 그룹 기여를 by-construction으로 나눈 채널 배분값을 집계한다.
  const weeklyChannelPerformance = useMemo(() => {
    if (!mmm || mmm.empty || stage !== "mmm") return [];
    return buildMmmWeeklyPerformance(mmm.panel, mmm.run.channelContributions);
  }, [mmm, stage]);
  const groupedWeeklyChannelPerformance = useMemo(() => {
    if (!mmm || mmm.empty || stage !== "mmm") return [];
    return buildMmmCollinearityGroupedPerformance(
      mmm.panel,
      weeklyChannelPerformance,
      mmm.run.collinear_pairs,
      0.9,
      collinearityGroupRefit,
    );
  }, [mmm, stage, weeklyChannelPerformance, collinearityGroupRefit]);

  const forecastSelectionSignature = [
    forecastSourceIdentity(csvData?.raw),
    mmmAnalyzedSig || "unconfirmed",
    colMapSig,
    `week-start:${mmmWeekStart}`,
    `target:${target}`,
    `platform:${effPlatformFilter}`,
    `horizon:${fcHorizon}`,
    `regime:${effectiveFcRegimeTrainingWeeks || "all"}`,
  ].join("\u001f");

  // Organic 행에 채널별 귀속 Y가 들어 있는 long CSV는 일반 MMM 예측과 계약이
  // 다르다. 이 경우에만 Organic 수준 + Paid 반응을 분리하고, 같은 마지막 H주를
  // 봉인한 상태에서 Direct Total과 Android+iOS 합산 중 낮은 wMAPE 경로를 고른다.
  const attributedForecastRoute = useMemo(() => {
    if (stage !== "lab" || effPlatformFilter !== "all" || !mmmColMap || !csvData?.raw?.length) return null;
    const roles = colMapRoles(csvData.headers, mmmColMap);
    const targetItems = {
      Regs: roles.reg,
      React: roles.react,
      Traffic: roles.traffic,
      Purchasers: roles.purchasers,
      Revenue: roles.revenue,
    }[target] || [];
    if (targetItems.length !== 1) return null;
    const channelHeader = (csvData.headers || []).find((header) => /(^|[_\s])(channel|media|source|network)([_\s]|$)|채널|매체/i.test(String(header).trim()));
    const spendHeader = (csvData.headers || []).find((header) => /(^|[_\s])(spend|cost|budget|expense)([_\s]|$)|지출|비용|예산/i.test(String(header).trim()));
    const timeHeader = roles.date || roles.week[0]?.header;
    if (!channelHeader || !spendHeader || !timeHeader) return null;
    const dataset = buildAttributedForecastDataset(csvData.raw, {
      timeHeader,
      platformHeader: roles.platform,
      channelHeader,
      spendHeader,
      targetHeader: targetItems[0].header,
      stepFields: roles.steps,
    }, {
      asOfDate: csvData.fileModifiedAt,
      asOfDateSource: csvData.fileModifiedAt != null ? "file-modified-time" : null,
    });
    if (!dataset) return null;
    if (dataset.invalidPaidCostRows > 0) {
      return {
        unavailable: true,
        dataset,
        reason: locale === "en"
          ? `${dataset.invalidPaidCostRows} Paid row(s) have blank or invalid Cost. Fix or explicitly enter 0; missing Cost is not treated as zero spend.`
          : `Paid 행 ${dataset.invalidPaidCostRows}개의 Cost가 비어 있거나 잘못되었습니다. 값을 수정하거나 실제 무지출이면 0을 명시하세요. 결측 Cost를 0으로 간주하지 않습니다.`,
      };
    }
    const hasActivePaidEvidence = dataset.records.some((record) =>
      !record.organic && Number(record.cost) > 0 && Number(record.outcome) > 0,
    );
    return {
      dataset,
      hasActivePaidEvidence,
      requiresWorkerRouter: true,
    };
  }, [stage, effPlatformFilter, mmmColMap, csvData, target, locale]);

  // 미래예측은 MMM 기여 분석과 별도 적합한다. 전체 기간 MMM은 장기 기여 해석에
  // 남기고, 예측 회귀만 최근 window·계절성 후보를 rolling holdout으로 선택한다.
  const forecastModel = useMemo(() => {
    if (!mmm || mmm.empty || stage !== "lab") return null;
    try {
      const pendingSelectionTasks = [];
      const cachedSelections = forecastSelectionCache.signature === forecastSelectionSignature
        ? forecastSelectionCache.results
        : {};
      const canUseForecastWorker = typeof Worker === "function"
        && forecastWorkerFallbackSignature !== forecastSelectionSignature;
      const pendingToken = {};
      const pendingForecastModel = () => ({
        isSelectionPending: true,
        pendingSelectionTasks,
      });
      const resolveBackgroundTask = (taskId, task, syncRun) => {
        if (Object.prototype.hasOwnProperty.call(cachedSelections, taskId)) {
          return cachedSelections[taskId];
        }
        if (!canUseForecastWorker) return syncRun();
        pendingSelectionTasks.push({ id: taskId, ...task });
        return pendingToken;
      };
      if (attributedForecastRoute?.unavailable) {
        return { reason: attributedForecastRoute.reason };
      }
      if (attributedForecastRoute?.requiresWorkerRouter) {
        const route = resolveBackgroundTask(
          "attributed-router",
          {
            kind: "attributed-router",
            dataset: attributedForecastRoute.dataset,
            horizon: fcHorizon,
          },
          () => runAttributedForecastLiveRouter(
            attributedForecastRoute.dataset,
            { holdout: fcHorizon, horizon: fcHorizon },
          ),
        );
        if (route === pendingToken) return pendingForecastModel();
        // A long-format file with Organic rows but no usable Paid spend belongs
        // to the generic Organic selector when the attributed router abstains.
        if (route) {
          return {
            isStructural: true,
            route: { ...route, dataset: attributedForecastRoute.dataset },
          };
        }
        if (attributedForecastRoute.hasActivePaidEvidence) {
          const attributedMinimumWeeks = 26 + fcHorizon * 4;
          return {
            reason: attributedForecastRoute.dataset.weeks.length < attributedMinimumWeeks
              ? locale === "en"
                ? `This attributed forecast needs at least ${attributedMinimumWeeks} valid weekly periods for a sealed ${fcHorizon}-week audit and three older selection folds; ${attributedForecastRoute.dataset.weeks.length} were found. The data was not discarded; add more history and rerun.`
                : `귀속형 예측은 봉인 ${fcHorizon}주와 그보다 오래된 선택용 fold 3개를 위해 유효 주간 ${attributedMinimumWeeks}개 이상이 필요합니다. 현재 ${attributedForecastRoute.dataset.weeks.length}개이며 데이터는 버리지 않았습니다. 이력을 추가한 뒤 다시 분석하세요.`
              : locale === "en"
                ? "No attributed candidate passed fitting. Confirm that at least one Paid channel has positive Cost and outcome history, and that Organic + Paid reconciles with Total."
                : "적합 가능한 귀속형 후보가 없습니다. Paid 채널에 양수 Cost와 성과 이력이 있는지, Organic + Paid가 Total과 맞는지 확인하세요.",
          };
        }
      }
      const buildResolvedForecastModel = (sourcePanel, sourceCfg, modelTarget, taskId) => {
        const candidateCap = forecastBackgroundCandidateCap(sourcePanel);
        if (Object.prototype.hasOwnProperty.call(cachedSelections, taskId)) {
          return buildForecastOnlyModelFromPanel(sourcePanel, sourceCfg, modelTarget, {
            horizon: fcHorizon,
            selection: cachedSelections[taskId],
          });
        }
        if (!canUseForecastWorker) {
          return buildForecastOnlyModelFromPanel(sourcePanel, sourceCfg, modelTarget, {
            horizon: fcHorizon,
            maxCandidateConfigurations: candidateCap,
          });
        }
        const panel = calendarizeForecastPanel(sourcePanel);
        pendingSelectionTasks.push({
          id: taskId,
          panel,
          cfg: forecastWorkerConfigDto(sourceCfg),
          target: modelTarget,
          horizon: fcHorizon,
          options: { maxCandidateConfigurations: candidateCap },
        });
        return {
          selectionPending: true,
          sourcePanel: panel,
          sourceCfg,
          target: modelTarget,
          panel: null,
          cfg: null,
          run: null,
        };
      };
      const platformGuard = forecastPlatformRouteGuard([
        ...mmmPlatformTags(csvData.headers, mmmColMap),
        ...(segmentSel?.values || []).map((value) => value.value),
      ]);
      if (
        effPlatformFilter === "all"
        && platformGuard.hasAggregatePlatformRows
        && platformGuard.hasDisaggregatedPlatformRows
      ) {
        return {
          reason: locale === "en"
            ? "The platform column mixes aggregate Total rows with platform rows. Remove one grain so outcomes are not double-counted."
            : "플랫폼 열에 Total 합계 행과 플랫폼별 행이 함께 있어 성과가 이중 집계됩니다. 둘 중 한 grain만 남겨주세요.",
        };
      }
      // Android+iOS가 모두 있을 때만 OS 부분합을 Direct Total과 같은 actual로
      // 비교한다. 플랫폼 없는 Total-only, 단일 OS, Web-only CSV는 아래의 단일
      // Direct 경로로 내려가며 존재하지 않는 OS를 억지로 요구하지 않는다.
      if (effPlatformFilter === "all" && platformGuard.hasAndroid && platformGuard.hasIos) {
        const annualAllowedProductionRoutes = platformGuard.hasOnlyAndroidIos
          ? undefined
          : ["direct-total"];
        const prepared = Object.fromEntries(["android", "ios", "all"].map((platform) => [
          platform,
          buildOsForecastPanel(csvData.headers, csvData.raw, mmmColMap, platform, target, locale, mmmWeekStart, true),
        ]));
        const invalid = Object.values(prepared).find((item) => !item.sourcePanel);
        if (invalid) return { isAdditiveTotal: true, components: [], reason: invalid.reason || "Forecast panel unavailable" };
        const preparedForRegime = Object.fromEntries(Object.entries(prepared).map(([platform, item]) => [platform, {
          ...item,
          sourcePanel: sliceForecastTrainingWindow(item.sourcePanel, effectiveFcRegimeTrainingWeeks),
        }]));
        const hasPaidTargets = hasPaidRegistrationTargets(preparedForRegime);
        // Total 운영 경로의 입력 존재 여부도 전체 행으로 판정한다. Web/기타에만
        // Spend가 있는 CSV를 "무지출 Organic"으로 잘못 보내면 그 플랫폼의
        // 예산 반응이 통째로 사라진다.
        const hasSpendHistory = hasForecastSpendHistory(preparedForRegime.all.sourcePanel);
        if (!hasSpendHistory) {
          const organicPanels = Object.fromEntries(["android", "ios"].map((platform) => {
            const source = preparedForRegime[platform].sourcePanel;
            const sourceTarget = preparedForRegime[platform].target;
            const totalValues = source.targets[sourceTarget];
            const paidValues = source.targets.PaidRegs;
            const values = forecastOrganicTargetValues(sourceTarget, totalValues, paidValues);
            return [platform, {
              ...source,
              ch: {},
              targets: { ...source.targets, [sourceTarget]: values },
            }];
          }));
          const organicTarget = preparedForRegime.android.target;
          const allSource = preparedForRegime.all.sourcePanel;
          const totalOrganic = forecastOrganicTargetValues(
            preparedForRegime.all.target,
            allSource.targets[preparedForRegime.all.target],
            allSource.targets.PaidRegs,
          );
          const annualArgs = {
            totalPanel: { ...preparedForRegime.all.sourcePanel, ch: {}, targets: { ...preparedForRegime.all.sourcePanel.targets, [organicTarget]: totalOrganic } },
            androidPanel: organicPanels.android,
            iosPanel: organicPanels.ios,
            target: organicTarget,
            horizon: fcHorizon,
            allowedProductionRoutes: annualAllowedProductionRoutes,
          };
          const annual = resolveBackgroundTask(
            "annual-no-spend-total",
            { kind: "annual-router", args: annualArgs },
            () => runAnnualAnalogRouter(annualArgs),
          );
          if (annual === pendingToken) return pendingForecastModel();
          return annual?.selected ? {
            isAnnualAnalog: true,
            organicOnly: true,
            annual: { ...annual, bestAvailable: true, fallbackReason: "no-spend-input" },
            totalPanel: annualArgs.totalPanel,
            androidPanel: organicPanels.android,
            iosPanel: organicPanels.ios,
            target: organicTarget,
          } : {
            reason: locale === "en"
              ? "No Spend history is available, and there is not enough history to fit an Organic trend/seasonality forecast."
              : "Spend 이력이 없고 Organic 추세·계절성 예측을 만들기에도 이력이 부족합니다.",
          };
        }
        // Paid/Organic OS 항등 분해는 Total이 Android+iOS로 완전히 닫힐 때만
        // 사용한다. Web/기타 플랫폼이 있으면 일부 OS 합을 Total로 오표시하지
        // 않고 아래의 Direct Total 대 OS route 공통-actual 검증으로 보낸다.
        if (hasPaidTargets && platformGuard.hasOnlyAndroidIos) {
          const paidOrganicComponents = ["android", "ios"].map((platform) =>
            buildPaidOrganicPlatformModel(
              preparedForRegime[platform],
              fcHorizon,
              buildResolvedForecastModel,
            ),
          );
          if (pendingSelectionTasks.length) return pendingForecastModel();
          const unavailable = paidOrganicComponents.find((component) => component.reason);
          return {
            isPaidOrganicSplit: true,
            isAdditiveTotal: true,
            components: paidOrganicComponents,
            totalPanel: preparedForRegime.all.sourcePanel,
            target: preparedForRegime.all.target,
            reason: unavailable
              ? locale === "en"
                ? `The ${unavailable.platform || "OS"} Paid/Organic split could not be fitted (${unavailable.reason}). Check that Paid is between 0 and Total for every week and that Spend varies enough to estimate both components.`
                : `${unavailable.platform || "OS"} Paid·Organic 분리 모델을 적합하지 못했습니다(${unavailable.reason}). 모든 주차에서 Paid가 0~Total 범위인지, 두 성분을 추정할 만큼 Spend가 변했는지 확인하세요.`
              : null,
          };
        }
        const components = ["android", "ios"].map((platform) => ({
          ...buildResolvedForecastModel(
            preparedForRegime[platform].sourcePanel,
            preparedForRegime[platform].cfg,
            preparedForRegime[platform].target,
            `${platform}-total`,
          ),
          ...preparedForRegime[platform],
        }));
        const direct = {
          ...buildResolvedForecastModel(
            preparedForRegime.all.sourcePanel,
            preparedForRegime.all.cfg,
            preparedForRegime.all.target,
            "direct-total",
          ),
          ...preparedForRegime.all,
          platform: "all",
        };
        if (pendingSelectionTasks.length) return pendingForecastModel();
        const annualFallbackArgs = {
          totalPanel: preparedForRegime.all.sourcePanel,
          androidPanel: preparedForRegime.android.sourcePanel,
          iosPanel: preparedForRegime.ios.sourcePanel,
          target: preparedForRegime.all.target,
          horizon: fcHorizon,
          allowedProductionRoutes: annualAllowedProductionRoutes,
        };
        const getAnnualFallback = () => resolveBackgroundTask(
          "annual-fallback-total",
          { kind: "annual-router", args: annualFallbackArgs },
          () => runAnnualAnalogRouter(annualFallbackArgs),
        );
        const unavailableComponent = components.find((component) =>
          !component.run || !component.panel);
        if (unavailableComponent && platformGuard.hasOnlyAndroidIos) {
          // 연간 반복형은 Cost 반응 회귀의 대체 기본값이 아니다. Cost 회귀가
          // **적합 자체를 만들 수 없는 경우에만** 수준 예측 참고값으로 사용한다.
          // 구조변화(step)가 있다는 이유만으로 예산 반응 모델을 덮어쓰면, 어떤
          // CSV에서도 채널 시나리오가 잠기는 문제가 생긴다.
          const annual = getAnnualFallback();
          if (annual === pendingToken) return pendingForecastModel();
          if (annual?.selected) {
            return {
              isAnnualAnalog: true,
              annual: { ...annual, bestAvailable: true, fallbackReason: "cost-regression-unavailable" },
              totalPanel: preparedForRegime.all.sourcePanel,
              androidPanel: preparedForRegime.android.sourcePanel,
              iosPanel: preparedForRegime.ios.sourcePanel,
              target: preparedForRegime.all.target,
            };
          }
          return { isAdditiveTotal: true, paidOrganicUnavailable: true, components, reason: unavailableComponent.reason || "OS forecast model unavailable" };
        }
        if (!direct.run || !direct.panel) {
          const annual = getAnnualFallback();
          if (annual === pendingToken) return pendingForecastModel();
          if (!platformGuard.hasOnlyAndroidIos && annual?.selected) {
            return {
              isAnnualAnalog: true,
              annual: { ...annual, bestAvailable: true, fallbackReason: "direct-total-regression-unavailable" },
              totalPanel: preparedForRegime.all.sourcePanel,
              androidPanel: preparedForRegime.android.sourcePanel,
              iosPanel: preparedForRegime.ios.sourcePanel,
              target: preparedForRegime.all.target,
            };
          }
          if (!platformGuard.hasOnlyAndroidIos) {
            return {
              isAdditiveTotal: false,
              reason: locale === "en"
                ? "A Direct Total forecast could not be fitted. Android+iOS is not shown as Total because Web or another platform is also present."
                : "Direct Total 예측을 적합하지 못했습니다. Web·기타 플랫폼이 함께 있어 Android+iOS 부분합을 Total로 표시하지 않습니다.",
            };
          }
          return { isAdditiveTotal: true, paidOrganicUnavailable: true, components, routeDecision: null };
        }
        const directNested = direct.selection?.nested ? { ...direct.selection.nested, route: "direct-total" } : null;
        const osNested = directNested
          ? mmmForecastCombineNestedParts(components.map((component) => component.selection?.nested
            ? { ...component.selection.nested, component: component.platform }
            : null), { route: "android-ios-sum", actualRoute: directNested })
          : null;
        const rawRouteDecision = selectForecastProductionRoute(
          directNested,
          osNested,
          {
            horizon: fcHorizon,
            allowOsProduction: platformGuard.hasOnlyAndroidIos,
          },
        );
        const routeDecision = rawRouteDecision.auditRoute ? rawRouteDecision : null;
        // 연간 반복형은 별도 수준 예측 후보로만 남긴다. Cost 회귀의 OOS가 좋지
        // 않더라도 구조변화 열 하나를 근거로 Cost 반응 모델을 자동 대체하지 않는다.
        // 그 경우에는 Cost 시나리오를 잠그고 회귀의 검증 결과를 정직하게 표시한다.
        if (!routeDecision) {
          return {
            ...direct,
            isNestedDirect: true,
            paidOrganicUnavailable: true,
            routeDecision: rawRouteDecision,
            routeSelectionUnavailable: true,
            challengerComponents: components,
          };
        }
        return buildForecastProductionModel(direct, components, routeDecision);
      }
      const singlePanel = sliceForecastTrainingWindow(mmm.panel, effectiveFcRegimeTrainingWeeks);
      const singlePaid = singlePanel.targets?.PaidRegs;
      const singleTotal = singlePanel.targets?.[mmm.target];
      const hasSingleSpend = Object.values(singlePanel.ch || {}).some((values) =>
        values.some((value) => Number.isFinite(value) && value > 0),
      );
      if (!hasSingleSpend) {
        const organicValues = forecastOrganicTargetValues(mmm.target, singleTotal, singlePaid);
        const organicPanel = { ...singlePanel, ch: {}, targets: { ...singlePanel.targets, [mmm.target]: organicValues } };
        const zeroPanel = { ...singlePanel, ch: {}, targets: { ...singlePanel.targets, [mmm.target]: organicValues.map(() => 0) } };
        const annualArgs = {
          totalPanel: organicPanel,
          androidPanel: organicPanel,
          iosPanel: zeroPanel,
          target: mmm.target,
          horizon: fcHorizon,
          allowedProductionRoutes: ["direct-total"],
        };
        const annual = resolveBackgroundTask(
          `annual-no-spend-${effPlatformFilter}`,
          { kind: "annual-router", args: annualArgs },
          () => runAnnualAnalogRouter(annualArgs),
        );
        if (annual === pendingToken) return pendingForecastModel();
        return annual?.selected ? {
          isAnnualAnalog: true,
          organicOnly: true,
          annual: { ...annual, bestAvailable: true, fallbackReason: "no-spend-input" },
          totalPanel: organicPanel,
          androidPanel: organicPanel,
          iosPanel: zeroPanel,
          target: mmm.target,
        } : {
          reason: locale === "en"
            ? "No Spend history is available, and there is not enough history to fit an Organic trend/seasonality forecast."
            : "Spend 이력이 없고 Organic 추세·계절성 예측을 만들기에도 이력이 부족합니다.",
        };
      }
      if (mmm.target === "Regs" && hasSingleSpend && singlePaid?.length === singleTotal?.length) {
        const component = buildPaidOrganicPlatformModel({
          platform: effPlatformFilter,
          sourcePanel: singlePanel,
          cfg: mmm.cfg,
          target: mmm.target,
        }, fcHorizon, buildResolvedForecastModel);
        if (pendingSelectionTasks.length) return pendingForecastModel();
        return {
          isPaidOrganicSplit: true,
          isAdditiveTotal: false,
          components: [component],
          target: mmm.target,
          reason: component.reason
            ? locale === "en"
              ? `The ${effPlatformFilter} Paid/Organic split could not be fitted (${component.reason}).`
              : `${effPlatformFilter} Paid·Organic 분리 모델을 적합하지 못했습니다(${component.reason}).`
            : null,
        };
      }
      const singleModel = buildResolvedForecastModel(
        singlePanel,
        mmm.cfg,
        mmm.target,
        `${effPlatformFilter}-total`,
      );
      if (pendingSelectionTasks.length) return pendingForecastModel();
      return {
        ...singleModel,
        paidOrganicUnavailable: mmm.target === "Regs" && hasSingleSpend,
      };
    } catch {
      return {
        reason: locale === "en"
          ? "Forecast calculation stopped safely because no candidate could be evaluated without an internal error. Your CSV remains in this browser; review the mapping and rerun."
          : "내부 오류 없이 평가할 수 있는 예측 후보가 없어 계산을 안전하게 중단했습니다. CSV는 이 브라우저에 그대로 있으니 매핑을 확인한 뒤 다시 실행하세요.",
        calculationFailed: true,
      };
    }
  }, [mmm, stage, effPlatformFilter, csvData, mmmColMap, target, locale, segmentSel, mmmWeekStart, attributedForecastRoute, fcHorizon, effectiveFcRegimeTrainingWeeks, forecastSelectionCache, forecastSelectionSignature, forecastWorkerFallbackSignature]);

  useEffect(() => {
    const tasks = forecastModel?.pendingSelectionTasks || [];
    if (!tasks.length || typeof Worker !== "function") return undefined;
    const requestSequence = ++forecastWorkerRequestRef.current;
    const workerCount = Math.min(2, tasks.length);
    const groups = Array.from({ length: workerCount }, () => []);
    tasks.forEach((task, index) => groups[index % workerCount].push(task));
    const workers = [];
    const progressByWorker = Array(workerCount).fill(0);
    const combinedResults = {};
    let completedWorkers = 0;
    let isActive = true;

    requestAnimationFrame(() => {
      if (!isActive) return;
      setIsForecastWorkerRunning(true);
      setForecastWorkerProgress({ completed: 0, total: tasks.length });
    });

    const failToPaintedFallback = () => {
      if (!isActive) return;
      isActive = false;
      workers.forEach((worker) => worker.terminate());
      // 테스트·구형 브라우저를 위한 동기 fallback은 유지하되, 이미 그려진
      // 분석 오버레이 아래에서 한 번만 실행한다.
      requestAnimationFrame(() => {
        if (forecastWorkerRequestRef.current !== requestSequence) return;
        setIsForecastWorkerRunning(true);
        setForecastWorkerProgress({ completed: 0, total: tasks.length });
        requestAnimationFrame(() => {
          if (forecastWorkerRequestRef.current !== requestSequence) return;
          setForecastWorkerFallbackSignature(forecastSelectionSignature);
          requestAnimationFrame(() => {
            if (forecastWorkerRequestRef.current === requestSequence) {
              setIsForecastWorkerRunning(false);
            }
          });
        });
      });
    };

    groups.forEach((group, workerIndex) => {
      if (!isActive) return;
      try {
        const worker = new Worker(
          new URL("../../workers/forecastSelection.worker.js", import.meta.url),
          { type: "module" },
        );
        workers.push(worker);
        const requestId = `${requestSequence}:${workerIndex}`;
        worker.onmessage = (event) => {
          if (!isActive || event.data?.requestId !== requestId) return;
          if (event.data.type === "progress") {
            progressByWorker[workerIndex] = event.data.completed || 0;
            setForecastWorkerProgress({
              completed: progressByWorker.reduce((sum, value) => sum + value, 0),
              total: tasks.length,
            });
            return;
          }
          if (event.data.type !== "complete") return;
          Object.assign(combinedResults, event.data.results || {});
          completedWorkers += 1;
          worker.terminate();
          if (completedWorkers !== workerCount) return;
          if (Object.values(combinedResults).some((result) => result?.workerError === true)) {
            failToPaintedFallback();
            return;
          }
          isActive = false;
          setForecastSelectionCache((current) =>
            mergeForecastSelectionCache(
              current,
              forecastSelectionSignature,
              combinedResults,
            ));
          setIsForecastWorkerRunning(false);
          setForecastWorkerProgress({ completed: tasks.length, total: tasks.length });
        };
        worker.onerror = failToPaintedFallback;
        worker.onmessageerror = failToPaintedFallback;
        worker.postMessage({ requestId, tasks: group });
      } catch {
        failToPaintedFallback();
      }
    });

    return () => {
      isActive = false;
      workers.forEach((worker) => worker.terminate());
      runOnLatestAnimationFrame(forecastWorkerRequestRef, requestSequence, () => {
        setIsForecastWorkerRunning(false);
        setForecastWorkerProgress({ completed: 0, total: 0 });
      });
    };
  }, [forecastModel, forecastSelectionSignature]);

  // 마지막 H주는 후보 선택과 적합에서 모두 봉인한다. Total 합계가 우연히
  // 좋아 보여도 OS·Paid·Organic 하위 오차가 큰 경우에는 상쇄로 간주해 인증하지 않는다.
  const recentBacktest = useMemo(() => {
    if (!mmm || mmm.empty || stage !== "lab" || !forecastModel) return null;
    try {
      if (forecastModel.isStructural) {
        return certifyForecastBacktest(
          {
            ...forecastModel.route.backtest,
            certificationGate: forecastModel.route.eligible === true,
            decisionReasons: forecastModel.route.componentCertificationComplete === true
              ? forecastModel.route.backtest?.decisionReasons || []
              : [
                ...(forecastModel.route.backtest?.decisionReasons || []),
                "component-certification-incomplete",
              ],
          },
          forecastModel.route.backtest?.componentMetrics || [],
        );
      }
      if (forecastModel.isAnnualAnalog) return certifyForecastBacktest(annualAnalogBacktestShape(forecastModel));
      if (forecastModel.isPaidOrganicSplit) return buildPaidOrganicRecentBacktest(forecastModel);
      if (forecastModel.isAdditiveTotal) {
        const components = forecastModel.components.map((model) => buildForecastRecentBacktest(model));
        const total = mmmSumOsBacktests(components);
        const componentMetrics = components.map((component, index) => ({
          platform: forecastModel.components[index]?.platform || `component-${index + 1}`,
          component: "total",
          wmape: component?.wmape,
        }));
        return certifyForecastBacktest(total ? {
          ...total,
          certificationGate: total.certificationGate !== false
            && forecastModel.routeDecision?.certified !== false,
        } : null, componentMetrics);
      }
      if (!forecastModel.run || !forecastModel.panel) return null;
      const backtest = buildForecastRecentBacktest(forecastModel);
      return certifyForecastBacktest(backtest ? {
        ...backtest,
        certificationGate: backtest.certificationGate !== false
          && forecastModel.routeDecision?.certified !== false,
      } : null);
    } catch {
      return null;
    }
  }, [mmm, stage, forecastModel]);

  // 이 판정은 Stage ④ 예측 회귀에만 적용한다. MMM 기여 분해·이벤트/step(P0)와
  // 분리해, 기본 예측은 유지하고 식별되지 않은 Cost 변경 입력만 막는다. 식별
  // 조건이 좋아도 봉인 감사 또는 하위 성분이 10%를 넘으면 시나리오는 열지 않는다.
  const forecastScenario = useMemo(() => {
    if (!forecastModel) return { eligible: false, reasons: ["missing-model"] };
    if (forecastModel.isAnnualAnalog) return { eligible: false, reasons: ["annual-analog-no-budget-response"] };
    let result;
    if (forecastModel.isStructural) {
      result = forecastModel.route.budgetResponseEligible === true
        ? { eligible: true, structuralConditional: true, reasons: [] }
        : {
          eligible: false,
          structuralConditional: true,
          reasons: forecastModel.route.budgetResponseReasons?.length
            ? forecastModel.route.budgetResponseReasons
            : ["naive-horizon-selected"],
        };
    } else if (forecastModel.isPaidOrganicSplit) {
      result = mmmForecastScenarioEligibility(
        forecastModel.components.flatMap((component) => [component.organicModel, component.paidModel]),
      );
    } else {
      result = mmmForecastScenarioEligibility(
        forecastModel.isAdditiveTotal ? forecastModel.components : [forecastModel],
      );
    }
    if (forecastModel.routeDecision?.certified === false) {
      result = {
        ...result,
        eligible: false,
        reasons: [...new Set([...(result.reasons || []), "route-certification-failed"])],
      };
    }
    return reconcileForecastScenarioAudit(result, recentBacktest);
  }, [forecastModel, recentBacktest]);

  const forecast = useMemo(() => {
    if (!mmm || mmm.empty || stage !== "lab" || !forecastModel) return null;
    try {
      if (forecastModel.isStructural) {
        const scenario = runAttributedForecastLiveScenario(
          forecastModel.route.dataset,
          forecastModel.route,
          forecastScenario.eligible ? fcBudget : {},
          fcHorizon,
        );
        return scenario ? attributedForecastShape({ ...forecastModel.route, forecast: scenario }) : null;
      }
      if (forecastModel.isAnnualAnalog) return annualAnalogForecastShape(forecastModel);
      if (forecastModel.isPaidOrganicSplit) {
        return runPaidOrganicSplitScenario(
          forecastModel,
          fcHorizon,
          forecastScenario.eligible ? fcBudget : {},
          fcStepOff,
          { eventPolicy: fcEventPolicy },
        );
      }
      if (forecastModel.isAdditiveTotal) {
        const scenarioBudget = forecastScenario.eligible ? fcBudget : {};
        const components = forecastModel.components.map((model) => runForecastScenario(model, fcHorizon, scenarioBudget, fcStepOff, { eventPolicy: fcEventPolicy }));
        const summed = mmmSumOsForecasts(components);
        return summed && {
          ...summed,
          paidOrganicUnavailable: forecastModel.paidOrganicUnavailable === true,
          nestedRouteDecision: forecastModel.routeDecision,
        };
      }
      if (!forecastModel.run || !forecastModel.panel) return null;
      // fcBudget: 채널별 주 평균 예산(명시 채널만 H개로 채움) → 미입력은 mmmForecast가 최근평균 사용.
      const chans = _mmmChans(forecastModel.panel).filter((ch) => forecastModel.panel.ch[ch.key]);
      const futureSpend = {};
      const scenarioBudget = forecastScenario.eligible ? fcBudget : {};
      chans.forEach((ch) => {
        const b = scenarioBudget[ch.key];
        if (b != null && isFinite(b)) futureSpend[ch.key] = Array(fcHorizon).fill(b);
      });
      const hasBudget = Object.keys(futureSpend).length > 0;
      const futureSteps = {};
      Object.entries(fcStepOff).forEach(([key, keepWeeks]) => {
        const rawIndex = forecastModel.run.names.indexOf(key);
        if (rawIndex < 0 || !Number.isFinite(keepWeeks)) return;
        const lastValue = forecastModel.run.rawFeatureHistory?.at(-1)?.[rawIndex] || 0;
          futureSteps[key] = fcEventPolicy === "off"
            ? Array(fcHorizon).fill(0)
            : Array.from({ length: fcHorizon }, (_, index) => index < keepWeeks ? lastValue : 0);
      });
      const result = mmmBayesianForecast(
        forecastModel.run,
        forecastModel.panel,
        hasBudget ? futureSpend : null,
        fcHorizon,
        {
          futureSteps,
          trendDamping: forecastModel.forecastSelected?.trendDamping
            ?? MMM_FORECAST_DEFAULT_TREND_DAMPING,
        },
      );
      const restoredRegression = mmmForecastRestoreSeasonality(result, forecastModel.panel, forecastModel.seasonalModel);
      const restored = mmmForecastApplySelectedBlend(
        restoredRegression,
        forecastModel.baselinePanel || forecastModel.rawPanel,
        forecastModel.target,
        forecastModel.forecastSelected,
      );
      const excelModel = restoredRegression && buildForecastExcelModel(forecastModel, result, restoredRegression, restored);
      if (excelModel && restored) {
        excelModel.selectedBlend = restored.selectedBlend;
        excelModel.blendApplied = restored.blendApplied === true;
        excelModel.blendBaselineFut = restored.blendBaselineFut || [];
      }
      return restored && {
        ...restored,
        rollingSelection: forecastModel.selection,
        modelWindow: forecastModel.panel.week.length,
        excelModels: excelModel ? [excelModel] : [],
        paidOrganicUnavailable: forecastModel.paidOrganicUnavailable === true,
        nestedRouteDecision: forecastModel.routeDecision,
      };
    } catch (e) {
      return null;
    }
  }, [mmm, stage, forecastModel, forecastScenario.eligible, fcHorizon, fcBudget, fcStepOff, fcEventPolicy]);

  // 자동 적용하지 않는다. 사용자가 탐색을 요청한 경우에만 후보별 재적합을 하고,
  // 추천된 시작점도 별도 승인 버튼을 눌러야 실제 예측 회귀에 반영된다.
  const regimeWorkerSignature = `${forecastSelectionSignature}\u001fregime-scan`;
  const regimeWindowTask = useMemo(() => {
    if (
      stage !== "lab"
      || !effectiveIsRegimeWindowScanRequested
      || effectiveFcRegimeTrainingWeeks
      || !forecastModel
      || forecastModel.isStructural
      || forecastModel.isSelectionPending
    ) return null;
    if (forecastModel.isAnnualAnalog) {
      return {
        id: "regime-window-scan",
        kind: "regime-annual",
        totalPanel: forecastModel.totalPanel,
        androidPanel: forecastModel.androidPanel,
        iosPanel: forecastModel.iosPanel,
        target: forecastModel.target,
        horizon: fcHorizon,
        allowedProductionRoutes: forecastModel.annual?.allowedProductionRoutes,
      };
    }
    const models = forecastModel.isPaidOrganicSplit
      ? forecastModel.components.flatMap((component) => [component.organicModel, component.paidModel])
      : forecastModel.isAdditiveTotal
        ? forecastModel.components
        : [forecastModel];
    return {
      id: "regime-window-scan",
      kind: "regime-mmm",
      horizon: fcHorizon,
      models: models.map((model) => ({
        panel: model.sourcePanel,
        cfg: forecastWorkerConfigDto(model.sourceCfg),
        target: model.target,
      })),
    };
  }, [stage, effectiveIsRegimeWindowScanRequested, effectiveFcRegimeTrainingWeeks, forecastModel, fcHorizon]);
  const canUseRegimeWorker = typeof Worker === "function"
    && regimeWorkerFallbackSignature !== regimeWorkerSignature;
  const synchronousRegimeWindowScan = useMemo(() => {
    if (!regimeWindowTask || canUseRegimeWorker) return null;
    return safeForecastRegimeScan(() => {
      if (forecastModel.isAnnualAnalog) {
        return scanAnnualForecastRegimeWindows({
          totalPanel: forecastModel.totalPanel,
          androidPanel: forecastModel.androidPanel,
          iosPanel: forecastModel.iosPanel,
          target: forecastModel.target,
          horizon: fcHorizon,
          allowedProductionRoutes: forecastModel.annual?.allowedProductionRoutes,
        });
      }
      const models = forecastModel.isPaidOrganicSplit
        ? forecastModel.components.flatMap((component) => [component.organicModel, component.paidModel])
        : forecastModel.isAdditiveTotal
          ? forecastModel.components
          : [forecastModel];
      return scanForecastRegimeWindows(models);
    });
  }, [regimeWindowTask, canUseRegimeWorker, forecastModel, fcHorizon]);
  const regimeWindowScan = canUseRegimeWorker
    ? regimeWorkerCache.signature === regimeWorkerSignature
      ? regimeWorkerCache.result
      : null
    : synchronousRegimeWindowScan;

  useEffect(() => {
    if (!regimeWindowTask || !canUseRegimeWorker) return undefined;
    const requestSequence = ++regimeWorkerRequestRef.current;
    const requestId = `regime:${requestSequence}`;
    let isActive = true;
    let worker;
    requestAnimationFrame(() => {
      if (isActive) setIsRegimeWorkerRunning(true);
    });
    const failToPaintedFallback = () => {
      if (!isActive) return;
      isActive = false;
      worker?.terminate();
      requestAnimationFrame(() => {
        if (regimeWorkerRequestRef.current !== requestSequence) return;
        setIsRegimeWorkerRunning(true);
        requestAnimationFrame(() => {
          if (regimeWorkerRequestRef.current !== requestSequence) return;
          setRegimeWorkerFallbackSignature(regimeWorkerSignature);
          requestAnimationFrame(() => {
            if (regimeWorkerRequestRef.current === requestSequence) {
              setIsRegimeWorkerRunning(false);
            }
          });
        });
      });
    };
    try {
      worker = new Worker(
        new URL("../../workers/forecastSelection.worker.js", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = (event) => {
        if (
          !isActive
          || event.data?.requestId !== requestId
          || event.data?.type !== "complete"
        ) return;
        const result = event.data.results?.[regimeWindowTask.id] || null;
        if (result?.workerError === true) {
          failToPaintedFallback();
          return;
        }
        isActive = false;
        worker.terminate();
        setRegimeWorkerCache({
          signature: regimeWorkerSignature,
          result,
        });
        setIsRegimeWorkerRunning(false);
      };
      worker.onerror = failToPaintedFallback;
      worker.onmessageerror = failToPaintedFallback;
      worker.postMessage({ requestId, tasks: [regimeWindowTask] });
    } catch {
      failToPaintedFallback();
    }
    return () => {
      isActive = false;
      worker?.terminate();
      runOnLatestAnimationFrame(regimeWorkerRequestRef, requestSequence, () => {
        setIsRegimeWorkerRunning(false);
      });
    };
  }, [regimeWindowTask, canUseRegimeWorker, regimeWorkerSignature]);

  const requestRegimeWindowScan = useCallback(() => {
    deferMmmUpdate(() => {
      setForecastRegimeStateSignature(forecastRegimeInputSig);
      setIsRegimeWindowScanRequested(true);
    });
  }, [deferMmmUpdate, forecastRegimeInputSig]);
  const acceptRegimeWindow = useCallback((candidate) => {
    if (!candidate?.trainingWeeks) return;
    deferMmmUpdate(() => {
      setForecastRegimeStateSignature(forecastRegimeInputSig);
      setFcRegimeTrainingWeeks(candidate.trainingWeeks);
    });
  }, [deferMmmUpdate, forecastRegimeInputSig]);
  const resetRegimeWindow = useCallback(() => {
    deferMmmUpdate(() => {
      setFcRegimeTrainingWeeks(null);
      setIsRegimeWindowScanRequested(false);
      setForecastRegimeStateSignature(null);
    });
  }, [deferMmmUpdate]);

  // 미래 예측 탭의 공통 진단 산출물. rolling holdout coverage와 재현
  // 메타데이터만 표시한다. 모수 구간처럼 보이던 임의 55% 축소 밴드는 제거했다.
  const forecastEnhancement = useMemo(() => {
    if (!forecast) return null;
    const diagnostics = recentBacktest
      ? forecastResidualDiagnostics(
        recentBacktest.actual.slice(recentBacktest.validationStartIndex),
        recentBacktest.predicted.slice(recentBacktest.validationStartIndex),
      )
      : null;
    return {
      diagnostics,
      provenance: buildForecastProvenance({
        target,
        horizon: forecast.horizon,
        selection: forecast.rollingSelection?.productionSelected || forecast.rollingSelection?.selected,
        assumptions: {
          trendDamping: "rolling-oos-selected",
          eventPolicy: fcEventPolicy,
          interval: forecastIntervalContract(forecast).method,
          candidateSearch: forecastCandidateSearchProvenance(forecast),
        },
        validation: recentBacktest ? { wmape: recentBacktest.wmape, rmse: recentBacktest.rmse } : null,
      }),
    };
  }, [forecast, recentBacktest, target, fcEventPolicy]);

  // 기본·OFF·증액·감액을 같은 모델에서 비교한다. 식별 게이트가 닫혀 있으면
  // 값은 계산하지 않고 시나리오 표에 참고용 잠금 상태만 표시한다.
  const forecastScenarioResults = useMemo(() => {
    if (!forecast || !forecastModel) return null;
    if (forecast.organicOnly || !(forecast.chans || []).length) return null;
    const channels = forecast.chans || [];
    const recent = forecast.recentMean || {};
    const baselineBudgets = Object.fromEntries(channels.map((channel) => [channel.key, fcBudget[channel.key] ?? recent[channel.key] ?? 0]));
    const definitions = buildForecastScenarioDefinitions({
      baseline: baselineBudgets,
      recent,
      channels,
      totalBudget: fcTotalBudget,
      minBudget: fcMinBudget,
      maxBudget: fcMaxBudget == null ? Infinity : fcMaxBudget,
    });
    const baseResult = { ...forecast, scenarioKey: "baseline" };
    const results = definitions.map((definition) => {
      if (definition.key === "baseline") return { ...definition, forecast: baseResult, summary: summarizeForecastScenario(definition.key, baseResult, baseResult) };
      if (!forecastScenario.eligible) return { ...definition, forecast: null, summary: null };
      let result;
      if (forecastModel.isStructural) {
        const scenario = runAttributedForecastLiveScenario(
          forecastModel.route.dataset,
          forecastModel.route,
          definition.budgets,
          fcHorizon,
        );
        result = scenario ? attributedForecastShape({ ...forecastModel.route, forecast: scenario }) : null;
      } else if (forecastModel.isPaidOrganicSplit) {
        result = runPaidOrganicSplitScenario(
          forecastModel,
          fcHorizon,
          definition.budgets,
          fcStepOff,
          { eventPolicy: fcEventPolicy },
        );
      } else {
        const runOne = (model) => runForecastScenario(model, fcHorizon, definition.budgets, fcStepOff, { eventPolicy: fcEventPolicy });
        result = forecastModel.isAdditiveTotal
          ? mmmSumOsForecasts(forecastModel.components.map(runOne))
          : runOne(forecastModel);
      }
      return { ...definition, forecast: result, summary: summarizeForecastScenario(definition.key, result, baseResult) };
    });
    return { definitions, results };
  }, [forecast, forecastModel, forecastScenario.eligible, fcBudget, fcTotalBudget, fcMinBudget, fcMaxBudget, fcHorizon, fcStepOff, fcEventPolicy]);

  const trend = useMemo(() => {
    if (!mmm || mmm.empty || !["trend", "diagnose"].includes(stage)) return null;
    try {
      const rawTarget = mmm.panel.targets[mmm.target] || [];
      const weeks = mmm.run?.weeks || [];
      // Baseline STL must not learn Performance as natural demand. Branding
      // remains in this input by design and is stated explicitly in the UI.
      const performanceContribution = rawTarget.map((value, index) => {
        const groupValue = Number(weeks[index]?.contrib?.Performance);
        return Number.isFinite(groupValue) ? groupValue : 0;
      });
      const baselineTarget = rawTarget.map((value, index) => Number(value) - performanceContribution[index]);
      const baselinePanel = {
        ...mmm.panel,
        channels: [],
        ch: {},
        targets: { ...mmm.panel.targets, [mmm.target]: baselineTarget },
      };
      const result = mmmTrendExistence(baselinePanel, mmm.cfg, mmm.target, locale);
      return { ...result, rawTarget, baselineTarget, performanceContribution, trendInput: "performance-excluded-baseline" };
    } catch (e) {
      return null;
    }
  }, [mmm, stage, locale]);

  // STL 원장과 MMM 버킷 원장을 함께 제공하는 표시용 파생값.
  // 엔진의 계수·추정·분해값은 수정하지 않고, 첫 주→마지막 주 변화만 비교한다.
  const trendLedger = useMemo(() => {
    if (!trend || !mmm || mmm.empty) return null;
    const delta = (values) => {
      if (!Array.isArray(values) || values.length < 2) return null;
      const first = Number(values[0]), last = Number(values.at(-1));
      return Number.isFinite(first) && Number.isFinite(last) ? last - first : null;
    };
    const targetValues = trend.rawTarget || mmm.panel.targets[mmm.target] || [];
    const baselineTarget = trend.baselineTarget || targetValues;
    const performanceContribution = trend.performanceContribution || targetValues.map(() => 0);
    const stlTrend = trend.stl?.trend || [];
    const stlNonTrend = baselineTarget.map((value, index) => {
      const trendValue = Number(stlTrend[index]);
      return Number.isFinite(Number(value)) && Number.isFinite(trendValue)
        ? Number(value) - trendValue
        : NaN;
    });
    const stlRows = [
      { key: "stl-trend", label: tx("순수 베이스라인 STL 추세", "Pure baseline STL trend"), tone: "#38bdf8", change: delta(trend.stl?.trend) },
      { key: "stl-seasonal", label: tx("계절성 조정", "Seasonality adjustment"), tone: "#5DCAA5", change: delta(trend.stl?.seasonal) },
      { key: "stl-residual", label: tx("불규칙·잔차", "Irregular / residual"), tone: "#94a3b8", change: delta(trend.stl?.residual) },
    ];
    const modelBuckets = new Map(MMM_BUCKET_ORDER.map((bucket) => [bucket, 0]));
    const weeks = mmm.run?.weeks || [];
    (mmm.run?.groupNames || []).forEach((name) => {
      const bucket = decompBucketOf(name);
      const values = weeks.map((week) => week.contrib?.[name] || 0);
      const change = delta(values);
      if (change != null) modelBuckets.set(bucket, (modelBuckets.get(bucket) || 0) + change);
    });
    const modelMeta = mmmBucketMeta(locale);
    const modelRows = MMM_BUCKET_ORDER.map((bucket) => ({
      key: `mmm-${bucket}`,
      label: modelMeta[bucket].label,
      tone: modelMeta[bucket].tone,
      change: modelBuckets.get(bucket) || 0,
    })).filter((row) => Math.abs(row.change) > 0.05);
    return {
      rawChange: delta(targetValues),
      performanceStart: Number.isFinite(Number(performanceContribution[0])) ? Number(performanceContribution[0]) : null,
      performanceEnd: Number.isFinite(Number(performanceContribution.at(-1))) ? Number(performanceContribution.at(-1)) : null,
      performanceChange: delta(performanceContribution),
      baselineInputChange: delta(baselineTarget),
      stlTrendChange: delta(stlTrend),
      stlNonTrendChange: delta(stlNonTrend),
      stlNonTrend,
      stlRows,
      modelRows,
      fittedChange: delta(weeks.map((week) => week.fitted)),
    };
  }, [trend, mmm, locale, tx]);

  // 채널별 카니발 + §4.5 랭킹/전역 종합 (index buildMmmMethCache byTarget 오케스트레이션 포트)
  const cannib = useMemo(() => {
    // 분석 패키지는 어느 단계에서 받아도 4검증을 모두 포함해야 한다. 화면은
    // diagnose 단계에서만 렌더하지만 결과 캐시는 분석 완료 뒤 유지한다.
    if (!mmm || mmm.empty) return null;
    try {
      const { panel, cfg, target: t } = mmm;
      const elas = mmmElasticities(panel, cfg, t, cfg.defaultLam);
      const chans = _mmmChans(panel).filter((c) => panel.ch[c.key]);
      const cannibByChannel = {};
      const cannChannels = [];
      const rows = chans.map((c) => {
        const e = elas.find((x) => x.var === "ln_" + c.key);
        const net = e
          ? { coef: e.coef, ci_lo: e.ci_lo, ci_hi: e.ci_hi, p: e.p }
          : { coef: 0, ci_lo: -1, ci_hi: 1, p: 1 };
        const cn = mmmCannibalization(panel, cfg, t, net, c.key, locale);
        cannibByChannel[c.key] = cn;
        cannChannels.push(c.key);
        return { channel: c, verdict: cn };
      });
      // 데이터 충분성(적격) 게이트 — index isIdentified: 집행주·지출변동CV·df (공선은 제외 안 함)
      const cov = mmmChannelCoverage(panel, cfg);
      const rcfg = mmmRankCfg();
      const isIdentified = (k) =>
        CANNIBAL_RANK.eligibility(panel.ch[k] || [], (cov[k] || { nonzero: 0 }).nonzero, rcfg)
          .eligible;
      const identifiedChannels = cannChannels.filter(isIdentified);
      const globalCannib = mmmGlobalCannib(cannibByChannel, identifiedChannels);
      const cannibRank = mmmBuildCannibRank(panel, t, cannibByChannel, cov, cannChannels);
      return { rows, cannibByChannel, cannChannels, cov, identifiedChannels, globalCannib, cannibRank };
    } catch (e) {
      return null;
    }
  }, [mmm, locale]);

  // ── §1 매크로 사실 + 자동 흡수(공선) + §2 naive-model audit (모델 독립) ──
  const diag = useMemo(() => {
    if (!mmm || mmm.empty || stage !== "diagnose") return null;
    try {
      const { panel, cfg } = mmm;
      // 주별 Date 배열 — weekLabel이 ISO(YYYY-MM-DD)면 그것을, 아니면 macro는 빈 객체.
      const dates = (panel.weekLabel || []).map((s) => {
        const t = new Date(String(s) + "T00:00:00Z").getTime();
        return isNaN(t) ? null : new Date(t);
      });
      const validDates = dates.every(Boolean) && dates.length === panel.week.length;
      const macro = validDates ? mmmMacroFacts(panel, cfg, dates, locale) : {};
      // 명시적으로 선택된 흡수만 cfg에 반영되며, 미선택 공선쌍은 노티스·예산 보류에 쓴다.
      const absorb = mmm.absorb || { absorbed: new Set(), notices: [] };
      // naive-model audit (RR 필요 — Regs+React 둘 다 있어야 의미). throw 가드.
      let audit = null;
      try {
        audit = mmmAudit(panel, cfg);
      } catch (e) {
        audit = null;
      }
      return { macro, absorb, audit, validDates };
    } catch (e) {
      return null;
    }
  }, [mmm, stage, locale]);

  // target 사용 가능 목록 (setState-in-effect 회피: 선택은 파생값으로 클램프, mmm.target이 실제 사용 타깃)
  const availTargets = mmm?.derived?.availableTargets
    || MMM_USER_TARGETS.filter((candidate) => Object.prototype.hasOwnProperty.call(mmm?.panel?.targets || {}, candidate));
  const isRevenueTarget = mmm?.target === "Revenue";
  const targetValueLabel = useCallback((value, { decimals = 0, sign = false, perWeek = false } = {}) => {
    if (!Number.isFinite(Number(value))) return "—";
    const displayValue = isRevenueTarget
      ? convertCurrency(Number(value), sourceCurrency, displayCurrency)
      : Number(value);
    const prefix = displayValue < 0 ? "-" : sign && displayValue > 0 ? "+" : "";
    const number = Math.abs(displayValue).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    if (isRevenueTarget) return `${prefix}${currencySym}${number}${perWeek ? tx("/주", "/wk") : ""}`;
    return `${prefix}${number}${perWeek ? tx("명/주", "/wk") : tx("명", "")}`;
  }, [isRevenueTarget, sourceCurrency, displayCurrency, currencySym, tx]);
  const applyForecastActual = useCallback((match) => {
    if (!match?.reviewDate || match.reviewDate > toLocalDecisionDate()) return;
    const actual = targetValueLabel(match.actualValue, { perWeek: true });
    updateDecisionRecord(match.recordId, { actual, status: "reviewed", reviewedAt: new Date().toISOString() });
    trackProductEvent("forecast_actual_applied", {
      tool_id: "5-18",
      source: "forecast_review",
      result_state: "reviewed",
      locale,
    });
    trackProductEvent("decision_review_completed", {
      tool_id: "5-18",
      source: "forecast_review",
      result_state: "reviewed",
      locale,
    });
  }, [locale, targetValueLabel, updateDecisionRecord]);
  const spendValueLabel = useCallback((value, { perWeek = false } = {}) => {
    if (!Number.isFinite(Number(value))) return "—";
    const displayValue = convertCurrency(Number(value), sourceCurrency, displayCurrency);
    return `${currencySym}${Math.round(displayValue).toLocaleString()}${perWeek ? tx("/주", "/wk") : ""}`;
  }, [sourceCurrency, displayCurrency, currencySym, tx]);

  const cannibChannels = cannib ? cannib.rows.map((r) => r.channel.key) : [];
  const activeCannibCh =
    cannibChannel && cannibChannels.includes(cannibChannel)
      ? cannibChannel
      : cannibChannels[0] || null;
  // 활성 채널의 카니발 검정 결과(§4 상세용)
  const activeCn =
    cannib && activeCannibCh ? cannib.cannibByChannel[activeCannibCh] : null;

  /* ------------------------------ CHARTS ------------------------------ */
  // Stage ② charts: CV, RMS contribution share, saturation, fit, decomp
  useEffect(() => {
    const inst = [];
    if (stage === "mmm" && mmmResultModel === "bayesian" && mmm && !mmm.empty) {
      const run = mmm.run;
      const dateViewDecomp = displayedDecomp;
      const dateViewPanel = displayedMmmPanel;
      // Bayesian engine selects a carryover parameter per channel; the legacy
      // single-λ CV chart is only meaningful for the old point-estimate engine.
      if (cvRef.current && run.cv_rmse && Object.keys(run.cv_rmse).length) {
        const grid = mmm.cfg.adstockGrid.filter((l) => run.cv_rmse[l] != null);
        inst.push(
          new Chart(cvRef.current.getContext("2d"), {
            type: "line",
            data: {
              labels: grid.map((l) => l.toFixed(1)),
              datasets: [
                {
                  label: "OOS RMSE",
                  data: grid.map((l) => run.cv_rmse[l]),
                  borderColor: CHART_THEME.primary,
                  pointBackgroundColor: grid.map((l) => (l === run.best_lambda ? NEG : CHART_THEME.primary)),
                  pointRadius: grid.map((l) => (l === run.best_lambda ? 6 : 3)),
                  tension: 0.2,
                },
              ],
            },
            options: chartBase(),
          }),
        );
      }
      // RMS contribution-magnitude share (horizontal bar). The engine keeps the
      // legacy `shapley` key for compatibility, but this is not Shapley/R² allocation.
      if (shapleyRef.current && run.shapley?.rows?.length) {
        const sourceRows = includeBaseDemandInShare
          ? run.shapley.rows
          : run.shapley.rows.filter((row) => !["Trend", "기본 수요", "baseline"].includes(row.driver));
        const total = sourceRows.reduce((sum, row) => sum + (row.r2_share || 0), 0);
        const rows = sourceRows
          .map((row) => ({ ...row, r2_share: total > 0 ? row.r2_share / total : 0, pct: total > 0 ? row.r2_share / total * 100 : 0 }))
          .sort((a, b) => b.r2_share - a.r2_share);
        inst.push(
          new Chart(shapleyRef.current.getContext("2d"), {
            type: "bar",
            data: {
              labels: rows.map((r) => r.driver),
              datasets: [
                {
                  label: tx("RMS 기여 크기 비중", "RMS contribution-magnitude share"),
                  data: rows.map((r) => +r.r2_share.toFixed(4)),
                  backgroundColor: CHART_THEME.primary,
                  borderRadius: 3,
                },
              ],
            },
            options: {
              ...chartBase(),
              indexAxis: "y",
              plugins: {
                ...chartBase().plugins,
                tooltip: {
                  callbacks: { label: (c) => `${(rows[c.dataIndex]?.pct || 0).toFixed(1)}%` },
                },
              },
            },
          }),
        );
      }
      // 반응 곡선 (per channel, y = 비음수 절대 기여 = 그 지출에서의 예상 기여).
      // 기존 한계응답(ln_coef/(1+x)) 곡선은 x→0에서 발산(1,000,000)해 판독 불가(§유저) →
      // 누적 반응 곡선으로 교체(단조·발산 없음, 평평해질수록 수확체감). 현재 지출 위치 점으로 표시.
      if (satRef.current && visibleSaturationCurveSeries.length) {
        const themeVarS = (n) => (typeof document !== "undefined" ? getComputedStyle(document.body).getPropertyValue(n).trim() : "") || "";
        const mutedColS = themeVarS("--text-muted") || CHART_THEME.muted;
        const textColS = themeVarS("--text-1") || CHART_THEME.text;
        const chs = visibleSaturationCurveSeries;
        if (chs.length) {
          const maxSpend = Math.max(...chs.map((s) => s.recentMean || 0)) * 1.6 || 40000;
          const grid = Array.from({ length: 41 }, (_, i) => (i / 40) * maxSpend);
          const respAt = (s, x) => s.responseAt(x);
          // 현재 지출 위치(●)는 각 채널 선 위 데이터점으로 → 선을 숨기면 점도 같이 숨겨짐(별도 scatter 제거).
          const lineDs = chs.map((s, i) => {
            const col = s.color || MMM_MEDIA_PALETTE[i % MMM_MEDIA_PALETTE.length];
            let curIdx = -1;
            if (s.recentMean > 0) {
              let best = Infinity;
              grid.forEach((x, gi) => { const d = Math.abs(x - s.recentMean); if (d < best) { best = d; curIdx = gi; } });
            }
            return {
              type: "line",
              label: s.label,
              data: grid.map((x) => ({ x, y: respAt(s, x) })),
              borderColor: col,
              borderDash: !s.isGroup && s.posteriorPositive < 0.8 ? [5, 4] : [],
              borderWidth: 1.75,
              tension: 0.3,
              pointRadius: grid.map((_, gi) => (gi === curIdx ? 4.5 : 0)),
              pointBackgroundColor: col,
              pointBorderColor: textColS,
              pointBorderWidth: 1.5,
            };
          });
          const satOpts = chartBase();
          satOpts.plugins.legend = { display: false }; // 커스텀 HTML 범례(채널 토글) 사용
          satOpts.plugins.tooltip = { ...satOpts.plugins.tooltip, callbacks: { label: (c) => `${c.dataset.label}: ${targetValueLabel(c.parsed.y, { decimals: 1 })} @ ${currencySym}${fmtOne(convAmt(c.parsed.x))}` } };
          satOpts.scales.x = { type: "linear", ticks: { color: mutedColS, font: { size: 10 }, callback: (v) => currencySym + fmtOne(convAmt(v)) }, grid: { display: false } };
          satOpts.scales.y = { ticks: { color: mutedColS, font: { size: 10 }, callback: (v) => targetValueLabel(v, { decimals: 1 }) }, grid: { color: CHART_THEME.grid } };
          inst.push(
            new Chart(satRef.current.getContext("2d"), {
              data: { datasets: lineDs },
              options: satOpts,
            }),
          );
        }
      }
      // 목표가 전환이면 CPA, 매출이면 ROAS. 수확체감 반응곡선을 비용 효율 언어로
      // 다시 읽어 예산을 늘릴수록 왜 CPR이 오르고 ROAS가 내려가는지 보여준다.
      if (efficiencyRef.current && visibleSaturationCurveSeries.length) {
        const themeVarE = (n) => (typeof document !== "undefined" ? getComputedStyle(document.body).getPropertyValue(n).trim() : "") || "";
        const mutedColE = themeVarE("--text-muted") || CHART_THEME.muted;
        const chs = visibleSaturationCurveSeries;
        if (chs.length) {
          const isRoas = mmm.target === "Revenue";
          const maxSpend = Math.max(...chs.map((s) => s.recentMean || 0)) * 1.6 || 40000;
          const grid = Array.from({ length: 41 }, (_, i) => (i / 40) * maxSpend);
          const metricAt = (s, spend) => {
            const result = s.responseAt(spend);
            if (!(spend > 0) || !(result > 0)) return null;
            return isRoas ? result / spend : convAmt(spend / result);
          };
          const datasets = chs.map((s, i) => {
            const col = s.color || MMM_MEDIA_PALETTE[i % MMM_MEDIA_PALETTE.length];
            let curIdx = -1;
            if (s.recentMean > 0) {
              let best = Infinity;
              grid.forEach((x, gi) => { const d = Math.abs(x - s.recentMean); if (d < best) { best = d; curIdx = gi; } });
            }
            return {
              type: "line",
              label: s.label,
              data: grid.map((x) => ({ x, y: metricAt(s, x) })),
              borderColor: col,
              borderDash: !s.isGroup && s.posteriorPositive < 0.8 ? [5, 4] : [],
              borderWidth: 1.75,
              tension: 0.3,
              pointRadius: grid.map((_, gi) => (gi === curIdx ? 4.5 : 0)),
              pointBackgroundColor: col,
              pointBorderColor: mutedColE,
              pointBorderWidth: 1.5,
              spanGaps: false,
            };
          });
          const opts = chartBase();
          opts.plugins.legend = { display: false };
          opts.plugins.tooltip = { ...opts.plugins.tooltip, callbacks: { label: (c) => `${c.dataset.label}: ${isRoas ? "" : currencySym}${fmtOne(c.parsed.y)}${isRoas ? "x" : ""}` } };
          opts.scales.x = { type: "linear", ticks: { color: mutedColE, font: { size: 10 }, callback: (v) => currencySym + fmtOne(convAmt(v)) }, grid: { display: false } };
          opts.scales.y = { ticks: { color: mutedColE, font: { size: 10 }, callback: (v) => `${isRoas ? "" : currencySym}${fmtOne(v)}${isRoas ? "x" : ""}` }, grid: { color: CHART_THEME.grid } };
          inst.push(new Chart(efficiencyRef.current.getContext("2d"), { data: { datasets }, options: opts }));
        }
      }
      // "baseline" 필드는 회귀절편(전체 기간 평균) 단일 상수라 원래 평평함 — 시즌·추세는 그 위에
      // 별도 contrib로 얹힘. 그래서 이 필드만 그리면 "왜 안 움직이나" 혼란(§ 실사용 피드백) →
      // 두 차트 모두 baseline+비매체(시즌·추세·휴일·구조변화) 합산 시계열을 같이 씀.
      const nonMediaGroupsAll = dateViewDecomp ? dateViewDecomp.groupNames.filter((g) => MMM_NONMEDIA_GROUPS.includes(g)) : [];
      const nonMediaSeries = dateViewDecomp
        ? dateViewDecomp.weeks.map((w) => w.baseline + nonMediaGroupsAll.reduce((s, g) => s + (w.contrib[g] || 0), 0))
        : [];
      // Fit chart (actual vs fitted vs 시즌·추세 등)
      if (fitRef.current && dateViewDecomp) {
        const labels = dateViewDecomp.weeks.map((w, i) => dateViewPanel?.weekLabel?.[i] || w.week);
        inst.push(
          new Chart(fitRef.current.getContext("2d"), {
            type: "line",
            data: {
              labels,
              datasets: [
                { label: tx("실제", "Actual"), data: dateViewDecomp.weeks.map((w) => w.actual), borderColor: CHART_THEME.muted, pointRadius: 0, tension: 0.2 },
                { label: tx("모델", "Model"), data: dateViewDecomp.weeks.map((w) => w.fitted), borderColor: CHART_THEME.primary, pointRadius: 0, tension: 0.2 },
                { label: tx("시즌·추세 등(비매체)", "Season/trend etc. (non-media)"), data: nonMediaSeries, borderColor: CHART_THEME.tertiary, borderDash: [5, 4], pointRadius: 0, tension: 0.2 },
              ],
            },
            options: (() => {
              const options = chartBase();
              options.plugins.tooltip = { ...options.plugins.tooltip, callbacks: { label: (context) => `${context.dataset.label}: ${targetValueLabel(context.parsed.y, { decimals: 1 })}` } };
              options.scales.y.ticks.callback = (value) => targetValueLabel(value, { decimals: 0 });
              return options;
            })(),
          }),
        );
      }
      // Decomp stacked area — 기준선(기본 수요) 위에 버킷/채널을 누적. 맨 위 누적선 = 모델(fitted).
      // 그룹모드: 4버킷(기본·시즌추세·이벤트·광고). 개별모드: 비매체 버킷 + 광고를 채널별로 각각 누적.
      // 어느 모드든 모든 밴드를 기준선 위로 쌓아 최상단이 모델선과 일치(=아래 텍스트의 "모델"과 sum 일치).
      if (decompRef.current && dateViewDecomp) {
        const labels = dateViewDecomp.weeks.map((w, i) => dateViewPanel?.weekLabel?.[i] || w.week);
        // 테마 토큰은 body.light-mode에 재정의됨 → documentElement가 아니라 body에서 읽어야 라이트 반영.
        const themeVar = (n) => (typeof document !== "undefined" ? getComputedStyle(document.body).getPropertyValue(n).trim() : "") || "";
        const textCol = themeVar("--text-1") || CHART_THEME.text;
        const mutedCol = themeVar("--text-muted") || CHART_THEME.muted;
        // 버킷별 주간 합 시계열
        const bucketSeries = (bucket) =>
          dateViewDecomp.weeks.map((w) =>
            dateViewDecomp.groupNames.reduce((s, g) => (decompBucketOf(g) === bucket ? s + (w.contrib[g] || 0) : s), 0),
          );
        // area+누적선 방식은 밴드가 음수일 때 선이 역행해 다른 밴드를 침범(§유저 피드백: "쭉 꺼지는 게 카니발?").
        // stacked bar로 전환 — Chart.js는 양/음수를 0선 기준 위/아래로 각자 독립 누적해 절대 안 꼬임.
        // 기본 수요 = baseline(상수) + 계절(Seasonality) 흡수.
        const bars = [];
        bars.push({ label: bucketMeta.base.label, data: dateViewDecomp.weeks.map((w, t) => w.baseline + bucketSeries("base")[t]), tone: bucketMeta.base.tone });
        bars.push({ label: bucketMeta.trend.label, data: bucketSeries("trend"), tone: bucketMeta.trend.tone });
        bars.push({ label: bucketMeta.event.label, data: bucketSeries("event"), tone: bucketMeta.event.tone });
        const industrySeries = bucketSeries("industry");
        if (industrySeries.some((value) => Math.abs(value) > 1e-8)) bars.push({ label: bucketMeta.industry.label, data: industrySeries, tone: bucketMeta.industry.tone });
        if (decompGrouped) {
          bars.push({ label: bucketMeta.media.label, data: bucketSeries("media"), tone: bucketMeta.media.tone });
        } else {
          const mediaGroups = dateViewDecomp.groupNames.filter((g) => decompBucketOf(g) === "media");
          mediaGroups.forEach((g, i) => {
            bars.push({ label: g, data: dateViewDecomp.weeks.map((w) => w.contrib[g] || 0), tone: MMM_MEDIA_PALETTE[i % MMM_MEDIA_PALETTE.length] });
          });
        }
        const datasets = bars.map((b) => ({
          type: "bar",
          label: b.label,
          data: b.data,
          backgroundColor: b.tone,
          stack: "decomp",
          borderRadius: 2,
          order: 2,
        }));
        // 실제(점선 오버레이) — 막대 스택 합과 얼마나 가까운지 눈으로 확인.
        datasets.push({
          type: "line",
          label: tx("실제", "Actual"),
          data: dateViewDecomp.weeks.map((w) => w.actual),
          borderColor: textCol,
          backgroundColor: "transparent",
          borderDash: [4, 3],
          fill: false,
          pointRadius: 0,
          borderWidth: 1.5,
          order: 0,
        });
        const decompOpts = chartBase();
        decompOpts.plugins.legend = {
          position: "bottom",
          labels: { color: textCol, font: { size: 11 }, boxWidth: 12, boxHeight: 12, padding: 10, usePointStyle: true },
        };
        decompOpts.plugins.tooltip = {
          ...decompOpts.plugins.tooltip,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${targetValueLabel(ctx.parsed.y, { sign: true })}`,
          },
        };
        decompOpts.scales.x = { ...decompOpts.scales.x, stacked: true, ticks: { ...decompOpts.scales.x.ticks, color: mutedCol, autoSkip: true, maxTicksLimit: 12, maxRotation: 0 } };
        decompOpts.scales.y = { ...decompOpts.scales.y, stacked: true, ticks: { ...decompOpts.scales.y.ticks, color: mutedCol, callback: (v) => targetValueLabel(v) } };
        // 메모 남긴 튀는 주 → 세로 점선 + 번호 뱃지(글씨 겹침 방지, 실제 메모는 아래 표에 동일 번호로).
        const notedSpikes = (dateViewDecomp.spikes || []).filter((s) => (spikeNotes[`${mmm.target}|${s.week}`] || "").trim());
        const numOf = (s) => notedSpikes.findIndex((n) => n.week === s.week) + 1;
        const spikeLinePlugin = {
          id: "spikeLines",
          afterDraw(chart) {
            if (!notedSpikes.length) return;
            const { ctx, chartArea, scales } = chart;
            ctx.save();
            notedSpikes.forEach((s) => {
              const idx = s.i != null ? s.i : s.week - 1;
              const x = scales.x.getPixelForValue(idx);
              if (x < chartArea.left || x > chartArea.right) return;
              ctx.strokeStyle = "#f59e0b";
              ctx.setLineDash([4, 3]);
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(x, chartArea.top + 12);
              ctx.lineTo(x, chartArea.bottom);
              ctx.stroke();
              ctx.setLineDash([]);
              // 번호 뱃지(원)
              ctx.fillStyle = "#f59e0b";
              ctx.beginPath();
              ctx.arc(x, chartArea.top + 7, 8, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "#fff";
              ctx.font = "bold 10px sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(String(numOf(s)), x, chartArea.top + 7);
            });
            ctx.restore();
          },
        };
        inst.push(
          new Chart(decompRef.current.getContext("2d"), {
            data: { labels, datasets },
            options: decompOpts,
            plugins: [spikeLinePlugin],
          }),
        );
      }
    }
    return () => inst.forEach((c) => c && c.destroy());
    // convAmt는 sourceCurrency/displayCurrency로만 결정되는 순수 파생 함수라 그
    // 둘을 deps에 넣는 것으로 충분(함수 레퍼런스 자체는 deps에 안 넣음, §매 렌더 재생성).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, mmmResultModel, mmm, displayedDecomp, displayedMmmPanel, displayedSaturationByChannel, visibleSaturationCurveSeries, spikeNotes, decompGrouped, includeBaseDemandInShare, currencySym, sourceCurrency, displayCurrency, tx]);

  // Stage ③ forecast chart
  useEffect(() => {
    const inst = [];
    if (stage === "lab" && forecast && forecastRef.current) {
      const fc = forecast;
      const nHist = fc.splitAt;
      const labels = fc.labels;
      // actual: hist만; model: hist fitted + future pred (n-1 지점 연결)
      const actual = [...fc.actual, ...Array(fc.horizon).fill(null)];
      const model = [
        ...fc.fittedHist,
        ...Array(fc.horizon).fill(null),
      ];
      const future = [
        ...Array(nHist - 1).fill(null),
        fc.fittedHist[nHist - 1],
        ...fc.predFut,
      ];
      const selectedBands = fc.lo || [];
      const selectedBandHigh = fc.hi || [];
      const bandLo = [...Array(nHist).fill(null), ...selectedBands];
      const bandHi = [...Array(nHist).fill(null), ...selectedBandHigh];
      const componentDatasets = fc.isPaidOrganicSplit ? [
        {
          label: tx("Organic (기저+halo)", "Organic (baseline+halo)"),
          data: [...Array(nHist - 1).fill(null), fc.organicHist?.[nHist - 1] ?? null, ...(fc.organicFut || [])],
          borderColor: CHART_THEME.secondary,
          borderDash: [3, 3],
          pointRadius: 0,
          tension: 0.2,
        },
        {
          label: tx("Paid 직접반응", "Direct Paid response"),
          data: [...Array(nHist - 1).fill(null), fc.performanceHist?.[nHist - 1] ?? null, ...(fc.performanceFut || [])],
          borderColor: CHART_THEME.tertiary,
          borderDash: [3, 3],
          pointRadius: 0,
          tension: 0.2,
        },
      ] : [];
      inst.push(
        new Chart(forecastRef.current.getContext("2d"), {
          type: "line",
          data: {
            labels,
            datasets: [
              { label: tx("실제", "Actual"), data: actual, borderColor: CHART_THEME.muted, pointRadius: 0, tension: 0.2 },
              { label: tx("모델(과거)", "Model (past)"), data: model, borderColor: CHART_THEME.primary, pointRadius: 0, tension: 0.2 },
              { label: tx("예측(미래)", "Forecast (future)"), data: future, borderColor: CHART_THEME.primary, borderDash: [6, 4], pointRadius: 0, tension: 0.2 },
              ...componentDatasets,
              { label: tx("상한", "Upper bound"), data: bandHi, borderColor: "transparent", backgroundColor: "rgba(122,162,247,0.12)", fill: "+1", pointRadius: 0 },
              { label: tx("하한", "Lower bound"), data: bandLo, borderColor: "transparent", backgroundColor: "rgba(122,162,247,0.12)", fill: false, pointRadius: 0 },
            ],
          },
          options: {
            ...chartBase(),
            plugins: {
              ...chartBase().plugins,
              tooltip: {
                ...chartBase().plugins.tooltip,
                callbacks: { label: (context) => `${context.dataset.label}: ${targetValueLabel(context.parsed.y)}` },
              },
            },
            scales: {
              ...chartBase().scales,
              y: {
                ...chartBase().scales.y,
                ticks: { ...chartBase().scales.y.ticks, callback: (value) => targetValueLabel(value) },
              },
            },
          },
        }),
      );
    }
    return () => inst.forEach((c) => c && c.destroy());
  }, [stage, forecast, tx, targetValueLabel]);

  // Stage ① trend chart: raw RR and Performance-excluded baseline input share the
  // primary axis. The zero-centered non-trend remainder explains the baseline STL trend.
  useEffect(() => {
    const inst = [];
    if (["trend", "diagnose"].includes(stage) && trend && trendRef.current && mmm && !mmm.empty) {
      const y = trend.rawTarget || mmm.panel.targets[mmm.target];
      const baseline = trend.baselineTarget || y;
      const labels = mmm.panel.weekLabel || y.map((_, i) => i + 1);
      inst.push(
        new Chart(trendRef.current.getContext("2d"), {
          type: "line",
          data: {
            labels,
            datasets: [
              { label: tx("실제 RR", "Actual RR"), data: y, borderColor: CHART_THEME.muted, pointRadius: 0, borderWidth: 2, tension: 0.15 },
              { label: tx("Performance 제외 성과(베이스라인 입력)", "Performance-excluded outcome (baseline input)"), data: baseline, borderColor: CHART_THEME.tertiary, borderDash: [4, 3], pointRadius: 0, borderWidth: 1.8, tension: 0.15 },
              { label: tx("순수 베이스라인 STL 추세", "Pure baseline STL trend"), data: trend.stl?.trend || [], borderColor: CHART_THEME.quaternary, pointRadius: 0, borderWidth: 2.5, tension: 0.15 },
              {
                label: tx("베이스라인 추세 외 요인 (계절성 + 잔차)", "Baseline non-trend (seasonality + residual)"),
                data: trendLedger?.stlNonTrend || [],
                borderColor: CHART_THEME.secondary,
                backgroundColor: "rgba(93,202,165,0.12)",
                borderDash: [6, 4],
                pointRadius: 0,
                borderWidth: 1.8,
                tension: 0.15,
                fill: "origin",
                yAxisID: "nonTrend",
              },
            ],
          },
          options: {
            ...chartBase(),
            plugins: {
              ...chartBase().plugins,
              tooltip: {
                ...chartBase().plugins.tooltip,
                callbacks: { label: (context) => `${context.dataset.label}: ${targetValueLabel(context.parsed.y, { sign: context.dataset.yAxisID === "nonTrend" })}` },
              },
            },
            scales: {
              ...chartBase().scales,
              y: {
                ...chartBase().scales.y,
                ticks: { ...chartBase().scales.y.ticks, callback: (value) => targetValueLabel(value) },
              },
              nonTrend: {
                position: "right",
                title: { display: true, text: tx("추세 외 변화량", "Non-trend change"), color: CHART_THEME.muted, font: { size: 10, weight: "600" } },
                ticks: { color: CHART_THEME.secondary, font: { size: 10 }, callback: (value) => targetValueLabel(value, { sign: true }) },
                grid: { drawOnChartArea: false },
              },
            },
          },
        }),
      );
    }
    return () => inst.forEach((c) => c && c.destroy());
  }, [stage, trend, trendLedger, mmm, tx, targetValueLabel]);

  // Stage ① 카니발 4검증 — 선택한 질문 하나의 근거 차트만 렌더.
  useEffect(() => {
    const inst = [];
    if (
      stage === "diagnose" &&
      mmm &&
      !mmm.empty &&
      irfRef.current &&
      cannib &&
      activeCannibCh
    ) {
      try {
        const y = mmm.panel.targets[mmm.target] || [];
        const spend = mmm.panel.ch[activeCannibCh] || [];
        const labels = mmm.panel.weekLabel || y.map((_, i) => i + 1);
        const cn = activeCn;
        if (cannibQuestion === "precedence") {
          const p25 = cn?.precedence?.p25 ?? 0;
          inst.push(
            new Chart(irfRef.current.getContext("2d"), {
              type: "line",
              data: {
                labels,
                datasets: [
                  {
                    label: tx("성과", "Outcome"),
                    data: y,
                    borderColor: CHART_THEME.primary,
                    pointRadius: 0,
                    tension: 0.2,
                  },
                  {
                    label: tx(
                      `저지출 주 성과 (지출 ≤ ${spendValueLabel(p25)})`,
                      `Outcome in low-spend weeks (spend ≤ ${spendValueLabel(p25)})`,
                    ),
                    data: buildLowSpendOutcomeSeries(y, spend, p25),
                    borderColor: "transparent",
                    backgroundColor: CHART_THEME.tertiary,
                    pointBackgroundColor: CHART_THEME.tertiary,
                    pointBorderColor: CHART_THEME.accent,
                    pointBorderWidth: 1,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    showLine: false,
                  },
                  {
                    label: tx("지출", "Spend"), data: spend, borderColor: CHART_THEME.muted, borderDash: [5, 4], pointRadius: 0, tension: 0.2, yAxisID: "spend",
                  },
                ],
              },
              options: {
                ...chartBase(),
                plugins: {
                  ...chartBase().plugins,
                  tooltip: {
                    ...chartBase().plugins.tooltip,
                    callbacks: {
                      label: (context) => `${context.dataset.label}: ${context.dataset.yAxisID === "spend" ? spendValueLabel(context.parsed.y) : targetValueLabel(context.parsed.y)}`,
                      afterLabel: (context) => context.datasetIndex === 1
                        ? tx(
                          `해당 주 지출 ${spendValueLabel(spend[context.dataIndex])} · 저지출 기준 ${spendValueLabel(p25)}`,
                          `Spend that week ${spendValueLabel(spend[context.dataIndex])} · low-spend threshold ${spendValueLabel(p25)}`,
                        )
                        : "",
                    },
                  },
                },
                scales: {
                  ...chartBase().scales,
                  y: { ...chartBase().scales.y, ticks: { ...chartBase().scales.y.ticks, callback: (value) => targetValueLabel(value) } },
                  spend: { position: "right", ticks: { color: CHART_THEME.muted, callback: (value) => spendValueLabel(value) }, grid: { drawOnChartArea: false } },
                },
              },
            }),
          );
        } else if (cannibQuestion === "detrend") {
          const residual = (a) => {
            const n = a.length, xm = (n - 1) / 2, ym = a.reduce((s, v) => s + v, 0) / Math.max(1, n);
            let num = 0, den = 0;
            a.forEach((v, i) => { num += (i - xm) * (v - ym); den += (i - xm) ** 2; });
            const slope = den ? num / den : 0;
            return a.map((v, i) => v - (ym + slope * (i - xm)));
          };
          const logSpend = spend.map((v) => Math.log1p(v));
          const rs = residual(logSpend), ry = residual(y);
          const ds = logSpend.slice(1).map((v, i) => v - logSpend[i]);
          const dy = y.slice(1).map((v, i) => v - y[i]);
          const detrendedPoints = rs.map((x, i) => ({ x, y: ry[i], week: labels[i] }));
          const weeklyPoints = ds.map((x, i) => ({ x, y: dy[i], week: labels[i + 1] }));
          const fitLine = (points) => {
            if (points.length < 2) return [];
            const xMean = points.reduce((sum, point) => sum + point.x, 0) / points.length;
            const yMean = points.reduce((sum, point) => sum + point.y, 0) / points.length;
            const denominator = points.reduce((sum, point) => sum + (point.x - xMean) ** 2, 0);
            if (denominator <= 1e-12) return [];
            const slope = points.reduce(
              (sum, point) => sum + (point.x - xMean) * (point.y - yMean),
              0,
            ) / denominator;
            const intercept = yMean - slope * xMean;
            const xValues = points.map((point) => point.x);
            const xMin = Math.min(...xValues), xMax = Math.max(...xValues);
            return [
              { x: xMin, y: intercept + slope * xMin },
              { x: xMax, y: intercept + slope * xMax },
            ];
          };
          const zeroGridColor = (context) => Number(context.tick?.value) === 0
            ? "#475569"
            : CHART_THEME.grid;
          const zeroGridWidth = (context) => Number(context.tick?.value) === 0 ? 2.2 : 1;
          inst.push(new Chart(irfRef.current.getContext("2d"), {
            type: "scatter",
            data: { datasets: [
              { label: tx("추세 제거 후", "Detrended"), data: detrendedPoints, backgroundColor: CHART_THEME.primary, pointRadius: 3.5, pointHoverRadius: 6 },
              { label: tx("전주 대비 변화", "Weekly change"), data: weeklyPoints, backgroundColor: CHART_THEME.tertiary, pointStyle: "triangle", pointRadius: 4, pointHoverRadius: 6 },
              { type: "line", label: tx("추세 제거 관계선", "Detrended trend line"), data: fitLine(detrendedPoints), borderColor: CHART_THEME.primary, borderWidth: 2.2, pointRadius: 0, tension: 0, fill: false },
              { type: "line", label: tx("전주 대비 관계선", "Weekly-change trend line"), data: fitLine(weeklyPoints), borderColor: CHART_THEME.tertiary, borderWidth: 2.2, borderDash: [6, 4], pointRadius: 0, tension: 0, fill: false },
            ] },
            options: {
              ...chartBase(),
              plugins: {
                ...chartBase().plugins,
                tooltip: {
                  ...chartBase().plugins.tooltip,
                  filter: (context) => context.dataset.type !== "line",
                  callbacks: {
                    title: (items) => items[0]?.raw?.week ? String(items[0].raw.week) : "",
                    label: (context) => tx(
                      `${context.dataset.label} · 지출 ${context.parsed.x.toFixed(3)} · 성과 ${targetValueLabel(context.parsed.y, { sign: true })}`,
                      `${context.dataset.label} · spend ${context.parsed.x.toFixed(3)} · outcome ${targetValueLabel(context.parsed.y, { sign: true })}`,
                    ),
                  },
                },
              },
              scales: {
                x: {
                  type: "linear",
                  grace: "10%",
                  title: { display: true, text: tx("지출 잔차·전주 대비 변화", "Spend residual / weekly change"), color: CHART_THEME.muted },
                  ticks: { color: CHART_THEME.muted },
                  grid: { color: zeroGridColor, lineWidth: zeroGridWidth },
                },
                y: {
                  grace: "12%",
                  title: { display: true, text: tx("성과 잔차·전주 대비 변화", "Outcome residual / weekly change"), color: CHART_THEME.muted },
                  ticks: { color: CHART_THEME.muted, callback: (value) => targetValueLabel(value) },
                  grid: { color: zeroGridColor, lineWidth: zeroGridWidth },
                },
              },
            },
          }));
        } else if (cannibQuestion === "net") {
          // JSX NetEffectEvidence가 0 기준·신뢰구간·판정을 더 명확하게 표시한다.
        } else {
          const irf = mmmIRF(y, spend, { horizon: 12 });
          if (irf) inst.push(new Chart(irfRef.current.getContext("2d"), {
            type: "line", data: { labels: irf.irf.map((_, i) => (i === 0 ? tx("충격", "Shock") : tx(`+${i}주`, `+${i}wk`))), datasets: [
              { label: tx("주별 반응", "Weekly response"), data: irf.irf, borderColor: CHART_THEME.primary, pointRadius: 0, tension: 0.25 },
              { label: tx("누적 반응", "Cumulative response"), data: irf.cum, borderColor: CHART_THEME.tertiary, borderDash: [5, 4], pointRadius: 0, tension: 0.2 },
            ] }, options: {
              ...chartBase(),
              plugins: { ...chartBase().plugins, tooltip: { ...chartBase().plugins.tooltip, callbacks: { label: (context) => `${context.dataset.label}: ${targetValueLabel(context.parsed.y)}` } } },
              scales: { ...chartBase().scales, y: { ...chartBase().scales.y, ticks: { ...chartBase().scales.y.ticks, callback: (value) => targetValueLabel(value) } } },
            },
          }));
        }
      } catch (e) {
        /* 데이터 부족 시 근거 차트 생략 */
      }
    }
    return () => inst.forEach((c) => c && c.destroy());
  }, [stage, mmm, cannib, activeCannibCh, activeCn, cannibQuestion, tx, targetValueLabel, spendValueLabel]);

  // Stage ① simple-cannib chart 없음 (통계 카드만) — 잔차 산점도는 디퍼

  // Lab chart (actual vs predicted)
  // ③ LAB(회귀·미래예측)은 mmmForecast(위 forecast useMemo) 기반으로 렌더 — ②와 같은 MMM 모델 계수를
  // 그대로 써서 과거 적합 + 미래 외삽. buildPanelFromColMap이 타깃을 플랫폼 합산하므로 토글도 자동 반영.

  /* ------------------------------ RENDER ------------------------------ */
  // 아코디언 안 차트는 접힘 상태에서 폭 0으로 마운트됨(§7 함정) → 펼칠 때 resize 이벤트로 재측정.
  const onAccordionToggle = (e) => {
    if (!e.currentTarget.open) return;
    const details = e.currentTarget;
    requestAnimationFrame(() => {
      details.querySelectorAll("canvas").forEach((canvas) => Chart.getChart?.(canvas)?.resize());
      window.dispatchEvent(new Event("resize"));
    });
  };

  // index.html MMM_STAGE_DEFS(3단계) + renderMmmStageTabs 카드형 탭 이식. 구 "시뮬레이션"(TF)은
  // §12.15대로 회귀·미래예측(lab)에 흡수. 카드: no·아이콘·제목·설명 + active 하이라이트.
  const renderTabs = () => {
    if (isolated || stage === "hub") return null;
    const defs = mmmStageDefs(locale);
    const onStageKeyDown = (event, stageId) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      // 그룹마다 tablist가 따로이므로 화살표는 같은 그룹 안에서만 돈다.
      const groupOf = defs.find((item) => item.id === stageId)?.group;
      const ids = defs.filter((item) => item.group === groupOf).map((item) => item.id);
      const current = ids.indexOf(stageId);
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? ids.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length;
      const nextStage = ids[nextIndex];
      setStage(nextStage);
      window.requestAnimationFrame(() => document.getElementById(`marketing-response-tab-${nextStage}`)?.focus());
    };
    // 네 화면을 세 갈래(진단·기여도·예측)로 묶어 보여준다. 그룹마다 tablist를 따로
    // 두는 이유는 §7 — 하나의 tablist가 group을 거쳐 tab을 소유하면 보조기술이
    // 탭을 탭으로 인식하지 못한다. 바깥은 일반 컨테이너로 남긴다.
    return (
    <section className="block mmm-stage-nav" style={{ padding: 0, border: "none", background: "none", marginBottom: "20px" }}>
      {MMM_STAGE_GROUPS.map((group) => {
        const groupDefs = defs.filter((d) => d.group === group.id);
        if (!groupDefs.length) return null;
        const groupLabel = locale === "en" ? group.en : group.ko;
        return (
      <div key={group.id} className="mmm-stage-group">
        <div className="mmm-stage-group__head">
          <span className="mmm-stage-group__title">{groupLabel}</span>
          <span className="mmm-stage-group__desc">{locale === "en" ? group.enDesc : group.koDesc}</span>
        </div>
      <div role="tablist" aria-label={groupLabel} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {groupDefs.map((d) => {
          const on = stage === d.id;
          return (
            <button
              key={d.id}
              type="button"
              id={`marketing-response-tab-${d.id}`}
              role="tab"
              aria-selected={on}
              aria-controls="tab-response"
              tabIndex={on ? 0 : -1}
              onClick={() => setStage(d.id)}
              onKeyDown={(event) => onStageKeyDown(event, d.id)}
              style={{
                flex: 1, minWidth: "170px", textAlign: "left", color: "var(--text-1)",
                background: on ? "linear-gradient(135deg,rgba(122,162,247,0.16),rgba(122,162,247,0.04))" : "var(--bg-2)",
                border: `1px solid ${on ? "rgba(122,162,247,0.55)" : "var(--border)"}`,
                borderRadius: "12px", padding: "11px 14px", cursor: "pointer", transition: "all .15s",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: ".04em", color: on ? "#adc6ff" : "var(--text-2)" }}>{d.no}</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-1)", marginTop: "1px" }}>{d.icon} {d.title}</div>
              <div style={{ fontSize: "11px", color: "var(--text-2)", marginTop: "2px", lineHeight: 1.35 }}>{d.desc}</div>
            </button>
          );
        })}
      </div>
      </div>
        );
      })}
    </section>
    );
  };

  // 5-18 전용 템플릿 — colMap 방식이라 표준필드 경로(효율 template)와 무관, 자체 헤더+예시.
  const downloadMmmTemplate = () => {
    const blob = new Blob([MMM_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "template_5-18.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  // 5-18 전용 dropzone (표준 CsvUploader/DataFeatureMatrix 미사용 — 단일 generic CSV → colMap).
  const mmmDropzone = (
    <>
      <CsvGuide toolId="5-18" onDownloadTemplate={downloadMmmTemplate} onTryExample={handleLoadDemo} locale={locale} />
      <MmmManualDownload locale={locale} placement="upload" />
      <div
        className="csv-dropzone"
        role="button"
        tabIndex={0}
        aria-label={tx("마케팅 반응 분석 CSV 파일 선택", "Choose a marketing-response CSV file")}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) handleMmmFile(e.dataTransfer.files[0]); }}
        onClick={() => mmmFileRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); mmmFileRef.current?.click(); } }}
        style={{ cursor: "pointer" }}
      >
        <div className="csv-drop-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </div>
        <div className="csv-drop-text">{tx("CSV 파일 드래그 & 드롭", "Drag & drop a CSV file")}</div>
        <div className="csv-drop-sub">{tx("일별 또는 주별 패널 CSV. 날짜/주차와 목표가 필요합니다. 카니발·기여·예산 반응에는 채널 spend가 필요하지만, 미래예측은 Spend 없이 Organic 추세·계절성만 사용할 수 있습니다.", "Daily or weekly panel CSV. Date/week and an outcome are required. Cannibalization, contribution, and budget response require channel spend; Forecast can run an Organic trend/seasonality model without Spend.")}</div>
        <input type="file" accept=".csv,text/csv" style={{ display: "none" }} ref={mmmFileRef}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { if (e.target.files?.[0]) handleMmmFile(e.target.files[0]); e.target.value = null; }} />
      </div>
      {mmmUploadError && (
        <div className="callout warn" role="alert" style={{ marginTop: "10px" }}>
          <div className="ico">!</div>
          <div className="body"><strong>{tx("CSV를 읽지 못했습니다", "Couldn't read the CSV")}</strong><p>{tx(
            "파일 인코딩·따옴표·열 수를 확인한 뒤 다시 올려주세요.",
            "Check the file encoding, quotes, and column count, then upload it again.",
          )}</p></div>
        </div>
      )}
    </>
  );

  // colMap 매퍼 + 분석 게이트 섹션 (CSV 로드 후 · 분석 전). index.html §0 데이터·매핑 이식.
  const mmmMapperSection = () => {
    // 매핑 중에는 헤더 역할만 확인한다. 전체 일→주 집계는 `분석하기` 뒤 mmm
    // useMemo에서 한 번만 수행해 대용량 CSV 드래그가 매 렌더마다 멈추지 않게 한다.
    const rawMissing = mmmColMap ? colMapMissing(csvData.headers, mmmColMap, locale) : [tx("매핑", "mapping")];
    const missing = stage === "lab"
      ? rawMissing.filter((item) => !["채널 spend 1개 이상", "1+ channel spend"].includes(item))
      : rawMissing;
    // 지출 단위를 모르는데 분석을 허용하면 숫자가 다른 통화로 오해될 수 있다. 원본
    // 통화는 매핑 단계에서 한 번만 선택하고, 선택 후 표시 통화 토글로 환산한다.
    const currencyMissing = !isDemo && !selectedSourceCurrency;
    const mappingReady = !!mmmColMap && missing.length === 0;
    const canAnalyze = mappingReady && !currencyMissing;
    return (
      <section className="block" id="s-prep">
        <div className="file-state">
          <div className="meta-text">
            <span className="dot" style={{ background: isDemo ? "var(--warning)" : "var(--success)" }}></span>
            {isDemo ? <strong>{tx("샘플 데이터로 미리보기 중", "Previewing with sample data")}</strong> : <strong>{csvData.fileName}</strong>}
            <span className="csv-loaded-stats tnum">{csvData.raw.length.toLocaleString()}{tx("행", " rows")} · {csvData.headers.length}{tx("컬럼", " columns")}{isDemo ? tx(" · 실제 데이터 아님", " · not real data") : ""}</span>
          </div>
          <button className="ab-pill csv-change-btn" title={tx("기존 CSV를 유지한 채 새 파일 선택", "Choose a new file while keeping the current CSV")}
            onClick={() => mmmFileRef.current?.click()}>{isDemo ? tx("📁 내 CSV 업로드", "📁 Upload my CSV") : tx("⟳ CSV 변경", "⟳ Change CSV")}</button>
          <input type="file" accept=".csv,text/csv" style={{ display: "none" }} ref={mmmFileRef}
            onChange={(e) => { if (e.target.files?.[0]) handleMmmFile(e.target.files[0]); e.target.value = null; }} />
        </div>
        {mmmUploadError && (
          <div className="callout warn" role="alert" style={{ marginTop: "10px" }}>
            <div className="ico">!</div>
            <div className="body"><strong>{tx("새 CSV를 읽지 못했습니다", "Couldn't read the new CSV")}</strong><p>{tx(
              "기존 데이터는 유지했습니다. 파일 인코딩·따옴표·열 수를 확인하세요.",
              "The existing data was kept. Check the file encoding, quotes, and column count.",
            )}</p></div>
          </div>
        )}
        {!isDemo && (
          <div className="analysis-local-controls" style={{ marginTop: "8px" }}>
            <div className="analysis-local-controls__inner">
              <span className="analysis-local-controls__label">{tx("원본 CSV 통화", "Source CSV currency")}</span>
              <span className="muted" style={{ fontSize: "11px" }}>{selectedSourceCurrency
                ? tx("원본 단위입니다. 선택하면 화면 표시도 같은 통화로 맞춥니다.", "This is the source unit. Selecting it also aligns the display currency.")
                : tx("⚠ 숫자만으로 통화를 알 수 없어 환산하지 않습니다. 반드시 선택하세요.", "⚠ Currency cannot be inferred from bare numbers, so no conversion is applied. Select it first.")}</span>
              <PillGroup
                style={{ margin: 0 }}
                ariaLabel={tx("원본 CSV 통화", "Source CSV currency")}
                value={selectedSourceCurrency}
                onChange={setMmmSourceCurrency}
                options={[
                  { value: "KRW", label: tx("원 ₩", "KRW ₩") },
                  { value: "USD", label: tx("달러 $", "USD $") },
                ]}
              />
              <FixedRateNote sourceCurrency={selectedSourceCurrency} displayCurrency={displayCurrency} locale={locale} />
            </div>
          </div>
        )}
        <div className="analysis-local-controls" style={{ marginTop: "8px" }}>
          <div className="analysis-local-controls__inner">
            <span className="analysis-local-controls__label">{tx("일별 데이터 주 묶음", "Daily-data week grouping")}</span>
            <span className="muted" style={{ fontSize: "11px" }}>{tx("날짜 컬럼을 매핑한 일별 CSV에만 적용됩니다. 기존 주별 CSV는 바뀌지 않습니다.", "Applies only to daily CSVs with a mapped date column; already-weekly CSVs are unchanged.")}</span>
            <PillGroup
              style={{ margin: 0 }}
              ariaLabel={tx("주 시작 요일", "Week start day")}
              value={mmmWeekStart}
              onChange={changeMmmWeekStart}
              options={[
                { value: "sunday", label: tx("일요일 시작 (일~토)", "Sunday start (Sun–Sat)") },
                { value: "monday", label: tx("월요일 시작 (월~일)", "Monday start (Mon–Sun)") },
              ]}
            />
          </div>
        </div>
        <h3 style={{ fontSize: "14px", margin: "12px 0 8px", color: "var(--primary, #adc6ff)" }}>{tx("🗂 컬럼 역할 매핑 (드래그로 지정)", "🗂 Map column roles (assign by dragging)")}</h3>
        <MmmColumnMapper
          headers={csvData.headers}
          rows={csvData.raw}
          colMap={mmmColMap || autoGuessColMap(csvData.headers, csvData.raw)}
          onChange={updateMmmColMap}
          locale={locale}
          allowNoSpend={stage === "lab"}
        />
        {(!mappingReady || currencyMissing) && (
          <AnalysisBlockedTelemetry
            toolId="5-18"
            source={isDemo ? "demo" : csvData?.importSource || "csv"}
            state={!mappingReady ? "missing_required" : "missing_currency"}
            signature={`${csvSig}|${stage}|${missing.length}|${currencyMissing ? 1 : 0}`}
            rowCount={csvData?.raw?.length || 0}
            missingCount={missing.length + (currencyMissing ? 1 : 0)}
            analysisType={stage === "hub" ? "mapping" : stage}
            locale={locale}
          />
        )}
        {mappingReady && (
          <div data-mmm-analysis-gate style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", background: canAnalyze ? "linear-gradient(135deg,rgba(122,162,247,0.12),rgba(122,162,247,0.03))" : "linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.03))", border: `1px solid ${canAnalyze ? "rgba(122,162,247,0.3)" : "rgba(245,158,11,0.4)"}`, borderRadius: "10px", padding: "14px 16px" }}>
            <span style={{ fontSize: "12.5px", color: "var(--text-1)" }}>
              {canAnalyze
                ? <>{tx("✅ 필수 역할 매핑 완료.", "✅ Required roles mapped.")} <strong>{tx("매핑이 맞는지 확인한 뒤 분석을 실행하세요.", "Check that the mapping is correct, then run the analysis.")}</strong> <span style={{ color: "var(--text-muted)" }}>{tx("(매핑만으로 자동 분석하지 않습니다.)", "(Mapping alone doesn't auto-run the analysis.)")}</span></>
                : <>{tx("⚠ 필수 역할 매핑 완료. 원본 CSV 통화만 선택하면 분석할 수 있습니다.", "⚠ Required roles mapped. Select the source CSV currency to run the analysis.")} <strong>{tx("위에서 원 ₩ 또는 달러 $를 선택하세요.", "Choose KRW ₩ or USD $ above.")}</strong></>}
            </span>
            <button className="ab-button" style={{ marginLeft: "auto" }} disabled={!canAnalyze}
              title={canAnalyze ? undefined : tx("원본 CSV 통화를 선택하면 분석할 수 있습니다.", "Select the source CSV currency to run the analysis.")}
              onClick={() => requestAd(() => {
                saveResponseMapping();
                runMmmAnalyze(mmmAnalysisSig);
              })}>{stage === "hub" ? tx("매핑 저장 후 분석 선택", "Save mapping and choose an analysis") : tx("▶ 분석하기", "▶ Analyze")}</button>
          </div>
        )}
      </section>
    );
  };

  const effectiveTarget = mmm && !mmm.empty ? mmm.target : target;
  const targetSourceHeaders = mmm?.derived?.targetSources?.[effectiveTarget] || [];
  // 태그(_android/_ios) 있는 컬럼이 매핑돼 있을 때만 플랫폼 토글 노출(단일 플랫폼 컬럼 없는 wide 데이터용).
  const platformTags = hasData && mmmColMap ? mmmPlatformTags(csvData.headers, mmmColMap) : [];

  // 브레드크럼 = 현재 위치 + 타깃/플랫폼 토글을 한 바(bar)에 좌측 정렬로 병합(토글이 곧 breadcrumb).
  const stageKo = stage === "trend" ? tx("시계열 점검", "Time series") : stage === "mmm" ? tx("기여 분해", "Contribution") : stage === "lab" ? tx("회귀·미래예측", "Regression · Forecast") : tx("잠식 진단", "Cannibalization");
  const responseStageSummary = () => {
    const weeks = mmm?.panel?.week?.length || 0;
    if (stage === "trend") {
      const stlValue = Number.isFinite(trend?.stl_pct) ? `${trend.stl_pct >= 0 ? "+" : ""}${trend.stl_pct.toFixed(1)}%` : "—";
      return {
        tone: trend ? "neutral" : "bad",
        headline: trend?.verdict || tx("자연 추세를 판정할 수 없습니다", "Natural trend cannot be determined"),
        stats: [
          { label: "STL", value: stlValue },
          { label: "Mann-Kendall", value: Number.isFinite(trend?.mk_deseason?.[1]) ? `p=${trend.mk_deseason[1].toFixed(3)}` : "—" },
          { label: tx("분석 주", "Weeks"), value: weeks },
        ],
        point: tx("추세를 확인했으면 채널 간 잠식 신호를 점검하세요.", "After checking trend, inspect cross-channel cannibalization signals."),
        next: "diagnose",
        nextLabel: tx("잠식 진단으로", "Next: cannibalization"),
        evidenceStatus: trend ? STATISTICAL_STATUS.CAUTION : STATISTICAL_STATUS.INSUFFICIENT_DATA,
        decisionPrefill: trend ? {
          conclusion: trend.verdict || tx("자연 추세를 확인했습니다", "Natural trend was reviewed"),
          action: tx("잠식 진단에서 채널 간 신호를 교차 확인한다", "Cross-check channel signals in cannibalization diagnosis"),
          hypothesis: tx("자연 추세를 먼저 분리하면 광고 효과로 오인할 변화를 줄일 수 있습니다", "Separating natural trend first reduces changes misread as media effects"),
          metric: "STL",
          baseline: stlValue,
          reviewQuestion: tx("잠식 후보가 자연 추세를 제외하고도 남았는가?", "Do cannibalization candidates remain after accounting for natural trend?"),
          sourcePeriod: tx(`${weeks}주`, `${weeks} weeks`),
        } : null,
      };
    }
    if (stage === "diagnose") {
      const ranks = cannib?.cannibRank || [];
      const strong = ranks.filter((row) => mmmCannibLevel(row).lv >= 5).length;
      return {
        tone: strong > 0 ? "bad" : ranks.length ? "neutral" : "bad",
        headline: strong > 0
          ? tx(`강한 잠식 후보 ${strong}개를 먼저 확인하세요`, `Review ${strong} strong cannibalization candidate(s) first`)
          : tx("강한 잠식 후보가 확인되지 않았습니다", "No strong cannibalization candidate was identified"),
        stats: [
          { label: tx("분석 채널", "Channels"), value: ranks.length },
          { label: tx("강한 후보", "Strong candidates"), value: strong },
          { label: tx("식별 가능", "Identified"), value: cannib?.identifiedChannels?.length || 0 },
        ],
        point: tx("후보를 확인했으면 MMM에서 전체 기여와 함께 교차 검증하세요.", "Cross-check candidates against total contribution in MMM."),
        next: "mmm",
        nextLabel: tx("기여 분해로", "Next: contribution"),
        evidenceStatus: cannib?.identifiedChannels?.length ? STATISTICAL_STATUS.CAUTION : STATISTICAL_STATUS.NOT_IDENTIFIED,
        decisionPrefill: ranks.length ? {
          conclusion: strong > 0
            ? tx(`강한 잠식 후보 ${strong}개`, `${strong} strong cannibalization candidate(s)`)
            : tx("강한 잠식 후보 없음", "No strong cannibalization candidate"),
          action: strong > 0
            ? tx(`강한 잠식 후보 ${strong}개를 기여 분해에서 교차 검증한다`, `Cross-check ${strong} strong candidate(s) in contribution analysis`)
            : tx("현재 판단을 유지하고 다음 데이터에서 잠식 신호를 다시 확인한다", "Keep the current call and re-check cannibalization with the next data update"),
          hypothesis: tx("단일 신호가 아니라 기여 분해와 함께 보면 과잉 대응을 줄일 수 있습니다", "Cross-checking with contribution reduces overreaction to a single signal"),
          metric: tx("강한 잠식 후보", "Strong candidates"),
          baseline: String(strong),
          reviewQuestion: tx("다음 검토에서도 같은 후보와 방향이 반복됐는가?", "Did the same candidates and direction persist at the next review?"),
          sourcePeriod: tx(`${weeks}주`, `${weeks} weeks`),
        } : null,
      };
    }
    if (stage === "mmm") {
      const health = mmm?.health || (mmm?.run ? mmmBayesianHealth(mmm.run) : null);
      const oos = health?.oos?.wmape;
      const warningCount = health?.flags?.length || 0;
      return {
        tone: warningCount > 0 ? "neutral" : "good",
        headline: Number.isFinite(oos)
          ? tx(`시간순 검증 오차 ${oos.toFixed(1)}%로 기여를 읽습니다`, `Read contribution with ${oos.toFixed(1)}% time-ordered validation error`)
          : tx("기여 분해 결과와 모델 경고를 함께 확인하세요", "Review contribution together with model warnings"),
        stats: [
          { label: tx("OOS 오차", "OOS error"), value: Number.isFinite(oos) ? `${oos.toFixed(1)}%` : "—" },
          { label: tx("모델 경고", "Model warnings"), value: warningCount },
          { label: tx("분석 주", "Weeks"), value: weeks },
        ],
        point: tx("기여를 확인했으면 미래 예측의 백테스트 신뢰도를 점검하세요.", "After contribution, check forecast backtest reliability."),
        next: "lab",
        nextLabel: tx("미래예측으로", "Next: forecast"),
        evidenceStatus: Number.isFinite(oos)
          ? (warningCount > 0 ? STATISTICAL_STATUS.CAUTION : STATISTICAL_STATUS.READY)
          : STATISTICAL_STATUS.INSUFFICIENT_DATA,
        decisionPrefill: mmm?.run ? {
          conclusion: Number.isFinite(oos)
            ? tx(`시간순 검증 오차 ${oos.toFixed(1)}% · 경고 ${warningCount}건`, `Time-ordered validation error ${oos.toFixed(1)}% · ${warningCount} warning(s)`)
            : tx(`모델 경고 ${warningCount}건`, `${warningCount} model warning(s)`),
          action: warningCount > 0
            ? tx("모델 경고를 해소하기 전 대규모 예산 이동을 보류한다", "Hold large budget moves until model warnings are resolved")
            : tx("기여 상위 채널의 예산 가설을 미래예측에서 검증한다", "Validate the leading channel budget hypothesis in Forecast"),
          hypothesis: tx("시간순 검증과 모델 경고를 함께 지키면 기여도 과신을 줄일 수 있습니다", "Using time-ordered validation and model warnings together reduces overconfidence in contribution"),
          metric: tx("OOS 오차", "OOS error"),
          baseline: Number.isFinite(oos) ? `${oos.toFixed(1)}%` : "—",
          reviewQuestion: tx("OOS 오차와 모델 경고가 운영 가능한 수준을 유지했는가?", "Did OOS error and model warnings remain operationally usable?"),
          sourcePeriod: tx(`${weeks}주`, `${weeks} weeks`),
        } : null,
      };
    }
    const wmape = recentBacktest?.wmape;
    const availableScenarioCount = (forecastScenarioResults?.results || []).filter((result) =>
      result.key !== "baseline" && result.forecast,
    ).length;
    const isSeverelyUnreliable = Number.isFinite(wmape) && wmape >= 30;
    const forecastSnapshot = recentBacktest?.reliable
      ? createForecastReviewSnapshot({
        forecast,
        target: mmm?.target,
        platform: effPlatformFilter,
        sourceThrough: mmm?.panel?.dates?.at(-1),
      })
      : null;
    const forecastTargetLabel = forecastSnapshot ? mmmTargetDisplay(forecastSnapshot.forecastTarget, locale) : "";
    const forecastValueText = forecastSnapshot ? targetValueLabel(Number(forecastSnapshot.forecastValue), { perWeek: true }) : "";
    const forecastRangeText = forecastSnapshot && forecastSnapshot.forecastLower && forecastSnapshot.forecastUpper
      ? `${targetValueLabel(Number(forecastSnapshot.forecastLower), { perWeek: true })}–${targetValueLabel(Number(forecastSnapshot.forecastUpper), { perWeek: true })}`
      : "";
    return {
      tone: recentBacktest?.reliable ? "good" : isSeverelyUnreliable ? "bad" : "neutral",
      headline: recentBacktest
        ? (recentBacktest.reliable
            ? tx(`봉인 ${recentBacktest.validationHorizon || fcHorizon}주 백테스트 인증 · 10% 미만`, `Sealed ${recentBacktest.validationHorizon || fcHorizon}-week backtest certified · below 10%`)
            : isSeverelyUnreliable
              ? tx("예측 사용 보류 · 오차 30% 이상", "Hold forecast use · error is 30% or higher")
              : tx("참고만 · 10% 인증 기준 미달", "Reference only · misses the 10% certification threshold"))
        : tx("예측 조건을 설정해 백테스트부터 확인하세요", "Set forecast conditions and check backtesting first"),
      stats: [
        { label: "wMAPE", value: Number.isFinite(wmape) ? `${wmape.toFixed(1)}%` : "—" },
        { label: tx("예측 기간", "Horizon"), value: tx(`${fcHorizon}주`, `${fcHorizon} weeks`) },
        { label: tx("변경 가능", "Available changes"), value: availableScenarioCount },
      ],
      point: tx("실행 뒤에는 새 데이터를 추가해 추세 단계부터 다시 점검하세요.", "After execution, add new data and re-check from the trend stage."),
      next: "trend",
      nextLabel: tx("처음부터 재점검", "Re-check from trend"),
      evidenceStatus: recentBacktest?.reliable
        ? STATISTICAL_STATUS.READY
        : recentBacktest
          ? (isSeverelyUnreliable ? STATISTICAL_STATUS.ABSTAIN : STATISTICAL_STATUS.CAUTION)
          : STATISTICAL_STATUS.INSUFFICIENT_DATA,
      decisionPrefill: forecastSnapshot ? {
        conclusion: tx(
          `${forecastSnapshot.forecastPeriod} ${forecastTargetLabel} 예측 ${forecastValueText}${forecastRangeText ? ` · 참고범위 ${forecastRangeText}` : ""}`,
          `${forecastSnapshot.forecastPeriod} ${forecastTargetLabel} forecast ${forecastValueText}${forecastRangeText ? ` · reference range ${forecastRangeText}` : ""}`,
        ),
        action: tx(
          `첫 예측 주의 실제 ${forecastTargetLabel}을 다음 CSV와 대조한다`,
          `Compare the first forecast week's actual ${forecastTargetLabel} with the next CSV`,
        ),
        hypothesis: tx(
          "같은 주차·타깃의 예측과 실제를 대조하면 다음 판단에 쓸 수 있는 오차 기록이 남습니다",
          "Matching forecast and actual for the same period and target creates an error record for the next decision",
        ),
        metric: forecastTargetLabel,
        baseline: forecastValueText,
        targetDirection: "neutral",
        reviewQuestion: tx(
          `${forecastSnapshot.forecastPeriod} 실제값이 예측 참고범위 안에 들어왔는가?`,
          `Did the ${forecastSnapshot.forecastPeriod} actual land inside the forecast reference range?`,
        ),
        reviewDate: forecastReviewDate(forecastSnapshot.forecastPeriod),
        sourcePeriod: forecastSnapshot.forecastSourceThrough
          ? tx(`데이터 ${forecastSnapshot.forecastSourceThrough}까지`, `Data through ${forecastSnapshot.forecastSourceThrough}`)
          : tx(`${weeks}주`, `${weeks} weeks`),
        ...forecastSnapshot,
      } : recentBacktest ? {
        conclusion: tx(`예측 사용 보류 · wMAPE ${Number.isFinite(wmape) ? `${wmape.toFixed(1)}%` : "—"}`, `Hold forecast use · wMAPE ${Number.isFinite(wmape) ? `${wmape.toFixed(1)}%` : "—"}`),
        action: tx("예산 변경을 보류하고 데이터를 추가한 뒤 백테스트를 다시 실행한다", "Hold budget changes, add data, and rerun the backtest"),
        hypothesis: tx("인증 전 변경을 보류하면 불안정한 예측으로 인한 예산 손실을 줄일 수 있습니다", "Holding changes before certification reduces budget risk from unstable forecasts"),
        metric: "wMAPE",
        baseline: Number.isFinite(wmape) ? `${wmape.toFixed(1)}%` : "—",
        reviewQuestion: tx("새 데이터에서도 wMAPE와 예측 방향이 유지됐는가?", "Did wMAPE and forecast direction hold with the new data?"),
        sourcePeriod: tx(`${weeks}주`, `${weeks} weeks`),
      } : null,
    };
  };
  const demoBanner = isDemo && (
    <div className="required-banner" style={{ borderLeftColor: "var(--warning)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
      <div>
        <strong>{tx("🧪 지금 보고 있는 화면은 샘플(예시) 데이터입니다", "🧪 You're viewing sample (example) data")}</strong>
        <p style={{ margin: "0.25rem 0 0" }}>{tx("실제 내 데이터가 아니며, 서버로 전송되지 않습니다. 내 CSV를 업로드하면 바로 교체됩니다.", "This isn't your real data, and nothing is sent to a server. Upload your own CSV to replace it instantly.")}</p>
      </div>
      <button className="ab-button" onClick={clearCsvGroup}>{tx("📁 내 CSV 업로드하기", "📁 Upload my CSV")}</button>
    </div>
  );
  const targetLabel = (value) => value === "Traffic" ? tx("총유입", "Traffic")
    : value === "Regs" ? tx("가입", "Signups")
      : value === "React" ? tx("재유입", "Reactivation")
        : value === "Purchasers" ? tx("구매자", "Purchasers")
          : value === "Revenue" ? tx("매출", "Revenue")
            : tx("가입+재유입", "Signups + Reactivation");
  const targetOptions = availTargets.map((value) => ({ value, label: targetLabel(value) }));
  const handlePackageDownload = () => {
    try {
      const packageRun = sliceMmmRun(mmm.run, contributionViewRange.start, contributionViewRange.end);
      const packagePanel = sliceMmmPanel(mmm.panel, contributionViewRange.end, contributionViewRange.start);
      const packageMmm = { ...mmm, run: packageRun, panel: packagePanel, saturationPanel: packagePanel };
      const packageDecomp = mmmBayesianWeeklyDecomp(packageRun);
      const packageTrend = trend || mmmTrendExistence(mmm.panel, mmm.cfg, mmm.target, locale);
      const packageForecast = mmmBayesianForecast(mmm.run, mmm.saturationPanel || mmm.panel, null, 13);
      downloadMmmWorkbook({ mmm: packageMmm, cannib, decomp: packageDecomp, trend: packageTrend, forecast: packageForecast, csvData, colMap: mmmColMap, locale, currency: displayCurrency });
      setPackageDownloadStatus("done");
    } catch {
      setPackageDownloadStatus("error");
    }
    if (packageStatusTimerRef.current) clearTimeout(packageStatusTimerRef.current);
    packageStatusTimerRef.current = setTimeout(() => setPackageDownloadStatus("idle"), 2500);
  };
  const controlBar = () => (
    <div className="analysis-local-controls__inner">
      <span className="analysis-local-controls__label">
        {tx("마케팅 반응 분석", "Marketing Response Analysis")} <span style={{ margin: "0 4px" }}>·</span> <strong style={{ color: "var(--text-1)" }}>{stageKo}</strong>
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        {availTargets.length === 1 && (
          <div className="response-target-context">
            <span>{tx("타깃", "Target")}</span>
            <strong>{targetLabel(effectiveTarget)}</strong>
            {targetSourceHeaders.length > 0 && <small>{tx("원본", "Source")} · {targetSourceHeaders.join(" + ")}</small>}
          </div>
        )}
        {availTargets.length > 1 && (
          <>
            <PillGroup
              label={tx("타깃", "Target")}
              options={targetOptions}
              value={effectiveTarget}
              onChange={(nextTarget) => {
                if (effectiveTarget !== nextTarget) deferMmmUpdate(() => setTarget(nextTarget));
              }}
              style={{ margin: 0 }}
            />
            {targetSourceHeaders.length > 0 && <span className="response-target-source">{tx("원본", "Source")} · {targetSourceHeaders.join(" + ")}</span>}
          </>
        )}
        {platformTags.length > 0 && (
          <PillGroup
            style={{ margin: 0 }}
            label={tx("플랫폼", "Platform")}
            value={effPlatformFilter}
            onChange={(next) => {
              if (effPlatformFilter !== next) deferMmmUpdate(() => setPlatformFilter(next));
            }}
            options={[
              { value: "all", label: "Total" },
              ...(platformTags.includes("android") ? [{ value: "android", label: "Android" }] : []),
              ...(platformTags.includes("ios") ? [{ value: "ios", label: "iOS" }] : []),
            ]}
          />
        )}
        {segmentSel && segmentSel.values.length > 0 && (
          <PillGroup
            style={{ margin: 0 }}
            label={<>🔀 {segmentSel.col}</>}
            labelTitle={tx(`나눠보기: ${segmentSel.col}`, `Break down by: ${segmentSel.col}`)}
            value={effPlatformFilter}
            onChange={(next) => {
              if (effPlatformFilter !== next) deferMmmUpdate(() => setPlatformFilter(next));
            }}
            options={[
              { value: "all", label: tx("전체", "All") },
              ...segmentSel.values.map((v) => ({
                value: v.value,
                label: v.value,
                title: tx(`${v.count.toLocaleString()}행`, `${v.count.toLocaleString()} rows`),
              })),
            ]}
            extra={segmentSel.truncated ? <span style={{ fontSize: "11px", color: "var(--warning)" }}>{tx("⚠ 상위 20개만", "⚠ Top 20 only")}</span> : null}
          />
        )}
        {contributionFilterDates.length > 0 && stage === "mmm" && (
          <div className="ab-pillgroup" style={{ margin: 0 }}>
            <span className="ab-pillgroup-label">📅 {tx("표시 기간", "View period")}</span>
            <input type="date" value={contributionViewStart} min={contributionFilterDates[0]?.start} max={contributionFilterDates.at(-1)?.start} step="7" onChange={(event) => {
              const nextStart = weekBoundaryDate(event.target.value, mmmWeekStart, "start") || "";
              setContributionViewStart(nextStart);
              if (contributionViewEnd && nextStart && nextStart > contributionViewEnd) setContributionViewEnd("");
            }} aria-label={tx("기여 표시 시작일", "Contribution view start date")} title={tx(`${mmmWeekStart === "monday" ? "월요일" : "일요일"}만 선택됩니다.`, `Only ${mmmWeekStart === "monday" ? "Mondays" : "Sundays"} are accepted.`)} />
            <span className="muted" style={{ fontSize: "11px" }}>~</span>
            <input type="date" value={contributionViewEnd} min={contributionFilterDates[0]?.end} max={contributionFilterDates.at(-1)?.end} step="7" onChange={(event) => {
              const nextEnd = weekBoundaryDate(event.target.value, mmmWeekStart, "end") || "";
              setContributionViewEnd(nextEnd);
              if (contributionViewStart && nextEnd && nextEnd < contributionViewStart) setContributionViewStart("");
            }} aria-label={tx("기여 표시 종료일", "Contribution view end date")} title={tx(`${mmmWeekStart === "monday" ? "일요일" : "토요일"}만 선택됩니다.`, `Only ${mmmWeekStart === "monday" ? "Sundays" : "Saturdays"} are accepted.`)} />
            {(contributionViewStart || contributionViewEnd) && <button className="ab-pill" onClick={() => { setContributionViewStart(""); setContributionViewEnd(""); }}>{tx("전체", "All")}</button>}
            <HelpTip label={tx("표시 기간 필터 설명", "About the date filter")}>{tx("학습은 전체 데이터를 사용합니다. 이 필터는 다시 학습하지 않고, 그 결과 중 선택한 날짜만 보여줍니다.", "The model is trained on all data. This filter only limits dates shown from the fitted result.")}</HelpTip>
          </div>
        )}
        {stage === "mmm" && mmm && !mmm.empty && (
          <div className="ab-pillgroup" style={{ margin: 0 }}>
            <span className="ab-pillgroup-label">{tx("모델", "Model")}</span>
            <span className="ab-pill active">{tx("Bayesian + WebR 자동 비교", "Bayesian + WebR auto comparison")}</span>
          </div>
        )}
        {/* T1: Bayesian 모드 정보 prior 토글 + 적합도 신뢰 칩 (모델 차이 비교) */}
        {stage === "mmm" && mmm && !mmm.empty && mmmMode === "bayesian" && (
          <PillGroup
            style={{ margin: 0 }}
            label={<>{tx("정보 prior", "Informative prior")} ⓘ</>}
            labelTitle={tx(
              "지출점유 기반 약정보 prior입니다. 관측이 약한 채널을 지출비중 쪽으로 수축하고, 데이터가 충분하면 likelihood가 지배합니다. 실험·국가 prior와 병합됩니다. 인과·증분 효과 보장이 아닙니다.",
              "A spend-share weakly-informative prior. It shrinks weakly-observed channels toward their spend share; with enough data the likelihood dominates. It merges with experiment/country priors. Not causal or incremental proof.",
            )}
            value={bayesianUsePrior ? "on" : "off"}
            onChange={(next) => {
              const wantPrior = next === "on";
              if (wantPrior !== bayesianUsePrior) deferMmmUpdate(() => setBayesianUsePrior(wantPrior));
            }}
            options={[
              { value: "on", label: tx("켜기", "On") },
              { value: "off", label: tx("끄기 (평면 OLS)", "Off (flat OLS)") },
            ]}
            extra={mmm.health && (() => {
              const r2 = Number(mmm.health.r2);
              const wmape = Number(mmm.health.wmape);
              const cov = Number(mmm.health.coverage90);
              const high = r2 >= 0.8 && wmape <= 15 && cov >= 0.8 && cov <= 0.98;
              const low = r2 < 0.5 || wmape > 35 || cov < 0.7;
              const level = high ? "high" : low ? "low" : "med";
              const label = high ? tx("높음", "High") : low ? tx("낮음", "Low") : tx("보통", "Med");
              const color = high ? "var(--success, #5ad19a)" : low ? "var(--danger, #f0917e)" : MUTED;
              return (
                <span
                  className="ab-pill"
                  style={{ cursor: "help", borderColor: color, color }}
                  title={tx(
                    `적합도 신뢰: R²=${isFinite(r2) ? r2.toFixed(2) : "—"} · WMAPE=${isFinite(wmape) ? wmape.toFixed(1) + "%" : "—"} · 90% 밴드 커버리지=${isFinite(cov) ? (cov * 100).toFixed(0) + "%" : "—"}. 모델이 과거를 얼마나 잘 설명하는지일 뿐, 인과·증분 보장이 아닙니다(확정은 홀드아웃 5-15 전용).`,
                    `Fit confidence: R²=${isFinite(r2) ? r2.toFixed(2) : "—"} · WMAPE=${isFinite(wmape) ? wmape.toFixed(1) + "%" : "—"} · 90% band coverage=${isFinite(cov) ? (cov * 100).toFixed(0) + "%" : "—"}. This reflects how well the model explains the past, not causal or incremental proof (confirm via holdout, 5-15).`,
                  )}
                >{tx("적합도", "Fit")}: {label}</span>
              );
            })()}
          />
        )}
        {mmm && !mmm.empty && (
          <>
            <button type="button" className={`ab-pill response-package-button ${packageDownloadStatus}`} onClick={handlePackageDownload}>
              {packageDownloadStatus === "done"
                ? tx("✓ 저장됨", "✓ Saved")
                : packageDownloadStatus === "error"
                  ? tx("다시 시도", "Try again")
                  : tx("⬇ 분석 패키지", "⬇ Analysis package")}
            </button>
            <span className="sr-only" role="status" aria-live="polite">
              {packageDownloadStatus === "done" ? tx("분석 패키지 저장이 시작되었습니다.", "The analysis package download has started.") : packageDownloadStatus === "error" ? tx("분석 패키지를 저장하지 못했습니다.", "The analysis package could not be saved.") : ""}
            </span>
          </>
        )}
      </div>
    </div>
  );

  // ── LAB stage ──
  // ③ 회귀·미래예측(lab)은 이제 ①②와 동일하게 no-data→shared 게이트→분석완료 흐름을 타므로
  // 여기서 early-return하지 않는다(별도 업로드·샘플·매핑 제거). 실제 렌더는 아래 analyzed return에서.

  // ── no-data ──
  if (!hasData) {
    return (
      <div className="tab-pane active" id="tab-response" role="tabpanel" aria-labelledby={!isolated && stage !== "hub" ? `marketing-response-tab-${stage}` : undefined}>
        {renderTabs()}
        <section className="block" id="s-prep">
          <h2 className="section-title">{tx("데이터 준비", "Data preparation")}</h2>
          <p className="muted" style={{ fontSize: "12px", marginBottom: "12px" }}>{tx("일별 또는 주별 패널 CSV 하나로 카니발 진단 → 기여 분해(MMM) → 회귀·미래예측을 모두 분석합니다. 일별 데이터는 주간으로 자동 정리되고, 매핑한 5개 목표를 언제든 바꿔 볼 수 있습니다. 데이터는 브라우저 메모리에만 — 서버 전송 없음.", "One daily or weekly panel CSV powers cannibalization diagnosis → contribution breakdown (MMM) → regression/forecast. Daily data is normalized to weeks automatically, and you can switch among the five mapped targets at any time. Data stays in browser memory only — never sent to a server.")}</p>
          {mmmDropzone}
        </section>
      </div>
    );
  }

  // ── data present ── colMap 미완성 or 분석 전이면 매퍼+게이트만 노출(PRIMARY 매핑).
  if (!mmmAnalyzed) {
    return (
      <div className="tab-pane active" id="tab-response" role="tabpanel" aria-labelledby={!isolated && stage !== "hub" ? `marketing-response-tab-${stage}` : undefined}>
        <AnalyzingOverlay
          show={isAnalyzing || isForecastWorkerRunning || isRegimeWorkerRunning}
          title={tx("분석 중…", "Analyzing…")}
          sub={isRegimeWorkerRunning
            ? tx("기간 후보를 검증하고 있습니다", "Validating training-window candidates")
            : isForecastWorkerRunning && forecastWorkerProgress.total
            ? tx(
              `모델 탐색 ${forecastWorkerProgress.completed}/${forecastWorkerProgress.total}`,
              `Model search ${forecastWorkerProgress.completed}/${forecastWorkerProgress.total}`,
            )
            : tx(`${(csvData?.raw?.length || 0).toLocaleString()}행 계산 중`, `Computing ${(csvData?.raw?.length || 0).toLocaleString()} rows`)}
        />
        {renderTabs()}
        {mmmMapperSection()}
      </div>
    );
  }

  // 허브는 결과를 겹쳐 보여주지 않는다. 한 번 확정한 CSV·컬럼 역할을 세션 내
  // 독립 분석 화면으로 넘기고, 사용자가 필요한 질문 하나만 실행하게 한다.
  if (stage === "hub") {
    const routePrefix = locale === "en" ? "/en" : "";
    const analysisLinks = [
      { id: "paid-organic", href: `${routePrefix}/tools/paid-organic-trend`, icon: "↗", title: tx("Paid·Organic 변화맵", "Paid · Organic movement map"), desc: tx("최근 주차의 반대 움직임을 한 장에서 빠르게 확인합니다.", "Quickly inspect recent opposite movement in one map.") },
      { id: "trend", href: `${routePrefix}/tools/marketing-trend`, icon: "〰", title: tx("추세 분석", "Trend analysis"), desc: tx("자연 추세·계절성·이상 주차만 분리합니다.", "Separate natural trend, seasonality, and irregular weeks.") },
      { id: "diagnose", href: `${routePrefix}/tools/cannibalization-diagnosis`, icon: "🔬", title: tx("카니발 진단", "Cannibalization diagnosis"), desc: tx("유료 광고가 오가닉 성과를 잠식하는지 점검합니다.", "Check whether paid activity may displace organic outcomes.") },
      { id: "mmm", href: `${routePrefix}/tools/mmm-contribution`, icon: "🧩", title: tx("MMM 기여 분해", "MMM contribution"), desc: tx("채널·기본 수요·이벤트의 기여를 분해합니다.", "Decompose channel, base-demand, and event contribution.") },
      { id: "lab", href: `${routePrefix}/tools/marketing-forecast`, icon: "📈", title: tx("회귀 · 미래 예측", "Regression · forecast"), desc: tx("예측 전용 회귀와 봉인 OOS 검증을 실행합니다.", "Run forecast-only regression with sealed OOS validation.") },
    ];
    return (
      <div className="tab-pane active" id="tab-response" role="tabpanel" aria-labelledby={!isolated && stage !== "hub" ? `marketing-response-tab-${stage}` : undefined}>
        <section className="block">
          <span className="eyebrow">{tx("공유 매핑 준비 완료", "Shared mapping ready")}</span>
          <h2 className="section-title" style={{ marginTop: "6px" }}>{tx("무엇을 확인할까요?", "What do you need to check?")}</h2>
          <p className="muted" style={{ fontSize: "12px", margin: "0 0 14px" }}>{tx("아래 분석은 같은 CSV·매핑을 이어받지만, 다른 분석 결과나 모델을 함께 실행하지 않습니다.", "Each analysis reuses this CSV and mapping, but does not render or run the other analyses.")}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "10px" }}>
            {analysisLinks.map((item) => (
              <Link key={item.id} href={item.href} className="tool-card" style={{ display: "block", padding: "16px", textDecoration: "none" }}>
                <div style={{ fontSize: "18px" }}>{item.icon}</div>
                <strong style={{ display: "block", marginTop: "7px", color: "var(--text-1)" }}>{item.title}</strong>
                <span style={{ display: "block", marginTop: "4px", fontSize: "12px", lineHeight: 1.45, color: "var(--text-2)" }}>{item.desc}</span>
              </Link>
            ))}
          </div>
          <details style={{ marginTop: "16px" }} onToggle={onAccordionToggle}>
            <summary>{tx("컬럼 매핑 다시 보기·수정", "Review or edit column mapping")}</summary>
            <div style={{ marginTop: "12px" }}>{mmmMapperSection()}</div>
          </details>
        </section>
      </div>
    );
  }

  // ── analyzed: 매핑 완료 후에도 패널이 비면(엔진 오류·공선) 사유 표시 ──
  const panelEmpty = mmm && mmm.empty;
  const forecastAssistInsight = stage === "lab"
    ? buildForecastAssistInsight(forecast, recentBacktest, forecastScenario)
    : null;
  const forecastIntervalInfo = forecastIntervalContract(forecast);
  const hasPointPlusForecastOuterP90 = forecastIntervalInfo.kind === "point-plus-outer-oos-p90";
  const hasAggregateForecastOuterP90 = forecastIntervalInfo.kind === "aggregate-oos-envelope";
  const hasComponentForecastEnvelope = forecastIntervalInfo.kind === "component-oos-envelope";
  const hasInsufficientForecastHistory = forecastModel?.selection?.reason === "insufficient-history"
    || (forecastModel?.components || []).some((component) =>
      component?.selection?.reason === "insufficient-history"
      || component?.organicModel?.selection?.reason === "insufficient-history"
      || component?.paidModel?.selection?.reason === "insufficient-history");

  return (
    <div className="tab-pane active" id="tab-response" role="tabpanel" aria-labelledby={!isolated && stage !== "hub" ? `marketing-response-tab-${stage}` : undefined}>
      <AnalyzingOverlay
        show={isAnalyzing || isForecastWorkerRunning || isRegimeWorkerRunning}
        title={tx("분석 중…", "Analyzing…")}
        sub={isRegimeWorkerRunning
          ? tx("기간 후보를 검증하고 있습니다", "Validating training-window candidates")
          : isForecastWorkerRunning && forecastWorkerProgress.total
          ? tx(
            `모델 탐색 ${forecastWorkerProgress.completed}/${forecastWorkerProgress.total}`,
            `Model search ${forecastWorkerProgress.completed}/${forecastWorkerProgress.total}`,
          )
          : tx(`${(csvData?.raw?.length || 0).toLocaleString()}행 계산 중`, `Computing ${(csvData?.raw?.length || 0).toLocaleString()} rows`)}
      />
      {/* 브레드크럼(타깃·플랫폼 토글)+통화 토글 — 페이지 맨 위 sticky(스테이지 카드보다
          위, top:48px 고정)로 이동. 예전엔 스테이지 카드·데모 배너 아래 본문에 있어
          "제일 위로 가야 한다"는 요청 반영(§유저 리포트, 스크롤 시 안 가려짐도 겸함). */}
      {(!panelEmpty || availTargets.length > 0) && (
        <div className="page-sticky-bar">
          <div className="page-sticky-row1">{controlBar()}</div>
          {(isDemo || selectedSourceCurrency) && <AnalysisControlBar title={tx("표시 기준", "Display settings")} hint={tx("공유 CSV 도구에 적용", "Applies to shared CSV tools")}><BasisCurrencyToggleBar locale={locale} currencyMode="convert" /></AnalysisControlBar>}
        </div>
      )}
      {renderTabs()}
      {(() => {
        const summary = responseStageSummary();
        const stageToolId = {
          trend: "5-18-trend",
          diagnose: "5-18-cannibal",
          mmm: "5-18-mmm",
          lab: "5-18-forecast",
        }[stage] || "5-18";
        const stageToolTitle = {
          trend: tx("추세 분석", "Trend analysis"),
          diagnose: tx("잠식 진단", "Cannibalization diagnosis"),
          mmm: tx("채널 기여도", "Channel contribution"),
          lab: tx("미래 예측", "Marketing forecast"),
        }[stage] || tx("마케팅 반응 분석", "Marketing response analysis");
        const stageWorkbookExport = () => {
          if (stage === "trend") {
            const actual = trend?.rawTarget || mmm?.panel?.targets?.[mmm?.target] || [];
            const labels = mmm?.panel?.weekLabel || actual.map((_, index) => String(index + 1));
            const baseline = trend?.baselineTarget || actual;
            const stlTrend = trend?.stl?.trend || [];
            const nonTrend = trendLedger?.stlNonTrend || [];
            return {
              toolId: stageToolId,
              toolTitle: stageToolTitle,
              calculationMode: "hybrid_engine_output",
              calculationTables: [{
                name: "TREND_DECOMPOSITION",
                title: tx("주별 추세 분해", "Weekly trend decomposition"),
                note: tx("MMM Performance 제거·STL 분해는 엔진 출력이고 차이·재결합 검사는 수식", "Performance removal and STL decomposition are engine outputs; differences and reconciliation checks are formulas"),
                rows: [
                  ["week", "actual_engine", "baseline_input_engine", "stl_trend_engine", "non_trend_engine", "actual_minus_baseline", "baseline_reconciliation_gap"],
                  ...actual.map((value, index) => {
                    const row = index + 2;
                    return [labels[index] ?? index + 1, value ?? "", baseline[index] ?? "", stlTrend[index] ?? "", nonTrend[index] ?? "", { formula: `=B${row}-C${row}` }, { formula: `=C${row}-D${row}-E${row}` }];
                  }),
                ],
              }],
              method: {
                name: "Performance-excluded baseline + STL",
                version: "marketing-trend-v1",
                limitations: [tx("Performance 기여 제거와 STL은 워크북에서 다시 적합되지 않으며 Branding이 남아 있어 완전한 미디어 0 반사실이 아닙니다.", "Performance removal and STL are not refit in the workbook; Branding remains, so this is not a fully media-zero counterfactual.")],
              },
            };
          }
          if (stage === "diagnose") {
            const ranks = cannib?.cannibRank || [];
            return {
              toolId: stageToolId,
              toolTitle: stageToolTitle,
              calculationMode: "hybrid_engine_output",
              calculationTables: [{
                name: "CANNIBALIZATION_SIGNALS",
                title: tx("채널별 잠식 진단 신호", "Cannibalization signals by channel"),
                note: tx("탈추세·차분·순증분·시차 검정과 CEI는 엔진 출력이고 절댓값·활성 비율·구간 폭은 수식", "Detrended, differenced, net-incrementality, lag tests, and CEI are engine outputs; absolute values, active share, and interval width are formulas"),
                rows: [
                  ["channel", "eligible_engine", "active_weeks", "total_weeks", "detrended_r_engine", "first_difference_r_engine", "net_elasticity_engine", "net_ci_low_engine", "net_ci_high_engine", "cei_engine", "against_votes_engine", "absolute_detrended_r", "active_week_share", "net_ci_width"],
                  ...ranks.map((rank, index) => {
                    const row = index + 2;
                    return [rank.label || rank.key, rank.eligible ? 1 : 0, rank.nActive, rank.total, rank.rDet ?? "", rank.rDiff ?? "", rank.netElast ?? "", rank.netCiLo ?? "", rank.netCiHi ?? "", rank.cei ?? "", rank.againstCount ?? 0, { formula: `=ABS(E${row})` }, { formula: `=IFERROR(C${row}/D${row},0)`, numberFormat: "0.0%" }, { formula: `=I${row}-H${row}` }];
                  }),
                ],
              }],
              method: {
                name: "four-signal cannibalization diagnosis",
                version: "cannibalization-v1",
                limitations: [tx("관측 패널의 잠식 후보 진단이며 인과 확정이 아닙니다. 검정과 랭킹은 워크북에서 다시 추정되지 않습니다.", "This diagnoses candidates in an observational panel and is not causal proof. Tests and ranking are not re-estimated in the workbook.")],
              },
            };
          }
          if (stage === "mmm") {
            const groupNames = decomp?.groupNames || [];
            return {
              toolId: stageToolId,
              toolTitle: stageToolTitle,
              calculationMode: "hybrid_engine_output",
              calculationTables: [{
                name: "MMM_WEEKLY_CONTRIBUTION",
                title: tx("주별 MMM 기여 분해", "Weekly MMM contribution decomposition"),
                note: tx("적합·변환·기여값은 엔진 출력이고 주별 기여 합·적합값 재결합·항등식 차이는 수식", "Fit, transforms, and contributions are engine outputs; weekly contribution sum, fitted reconstruction, and identity gap are formulas"),
                rows: [
                  ["week", "actual_engine", "fitted_engine", "lower_engine", "upper_engine", "residual_engine", "baseline_engine", ...groupNames, "contribution_sum", "reconstructed_fitted", "identity_gap"],
                  ...(decomp?.weeks || []).map((week, index) => {
                    const row = index + 2;
                    const contributionRange = groupNames.length
                      ? `H${row}:${workbookColumn(6 + groupNames.length)}${row}`
                      : null;
                    const sumExpression = contributionRange ? `SUM(${contributionRange})` : "0";
                    return [
                      week.week || mmm?.panel?.weekLabel?.[index] || index + 1,
                      week.actual ?? "", week.fitted ?? "", week.lo ?? "", week.hi ?? "", week.residual ?? "", week.baseline ?? 0,
                      ...groupNames.map((name) => week.contrib?.[name] ?? 0),
                      { formula: `=${sumExpression}` },
                      { formula: `=G${row}+${sumExpression}` },
                      { formula: `=C${row}-(G${row}+${sumExpression})` },
                    ];
                  }),
                ],
              }],
              method: {
                name: mmm?.run?.methodLabel || "Bayesian MMM",
                version: mmm?.run?.engine || "mmm-v1",
                limitations: [tx("원본 변경만으로 MMM이 재학습되지 않습니다. 기여는 모델 기반 관측 연관이며 홀드아웃 전 인과·증분 확정이 아닙니다.", "Editing raw data does not refit MMM. Contribution is model-based observational association, not causal or incremental proof before a holdout.")],
              },
            };
          }
          const channels = forecast?.chans || [];
          return {
            toolId: stageToolId,
            toolTitle: stageToolTitle,
            calculationMode: "hybrid_engine_output",
            calculationTables: [{
              name: "FORECAST_HORIZON",
              title: tx("기간별 예측·참고범위", "Forecast and reference range by period"),
              note: tx("회귀·모델 선택·구간은 엔진 출력이고 구간 폭·미래 지출 합계는 수식", "Regression, model selection, and intervals are engine outputs; interval width and future-spend total are formulas"),
              rows: [
                ["period", "forecast_engine", "lower_engine", "upper_engine", "interval_width", ...channels.map((channel) => `spend_${channel.key}_input`), "future_spend_total"],
                ...(forecast?.futLabels || []).map((label, index) => {
                  const row = index + 2;
                  const spendRefs = channels.map((_, channelIndex) => `${workbookColumn(5 + channelIndex)}${row}`);
                  return [label, forecast.predFut?.[index] ?? "", forecast.lo?.[index] ?? "", forecast.hi?.[index] ?? "", { formula: `=D${row}-C${row}` }, ...channels.map((channel) => forecast.futSpendByKey?.[channel.key]?.[index] ?? ""), { formula: spendRefs.length ? `=SUM(${spendRefs.join(",")})` : "=0" }];
                }),
              ],
            }],
            method: {
              name: "sealed-OOS forecast regression",
              version: "marketing-forecast-v1",
              limitations: [tx("모델 선택·백테스트·예측 구간은 워크북에서 다시 적합되지 않습니다. 새 데이터는 사이트에서 다시 분석해야 합니다.", "Model selection, backtesting, and intervals are not refit in the workbook. New data must be re-analyzed on the site.")],
            },
          };
        };
        // PR #696으로 추세·예측이 독립 도구가 되면서, 허브 안에서 형제 단계가 제공하던
        // 탈출구 없이 랜딩만 남았다. 각 단계가 **계산한 결과**를 결론 카드에서 바로
        // 받아갈 수 있게 한다 — 원천 데이터를 그대로 돌려주지는 않는다
        // (product-ssot §5.5 · D-13 · §12.27).
        const stageDownloadItems = [];
        if (stage === "trend" && trend && mmm && !mmm.empty) {
          const actual = trend.rawTarget || mmm.panel.targets[mmm.target] || [];
          const labels = mmm.panel.weekLabel || actual.map((_, index) => String(index + 1));
          const baseline = trend.baselineTarget || actual;
          const stlTrend = trend.stl?.trend || [];
          const nonTrend = trendLedger?.stlNonTrend || [];
          if (actual.length) {
            stageDownloadItems.push({
              label: tx("추세 분해 (CSV)", "Trend decomposition (CSV)"),
              desc: tx("주차별 실제·베이스라인·STL 추세·추세 외 요인", "Weekly actual, baseline, STL trend, and non-trend component"),
              icon: "⬇",
              analyticsType: "trend_decomposition",
              onSelect: () => {
                const header = ["week", "actual", "baseline_input", "stl_trend", "non_trend"];
                const rows = actual.map((value, index) => [
                  labels[index] ?? index + 1,
                  value ?? "",
                  baseline[index] ?? "",
                  stlTrend[index] ?? "",
                  nonTrend[index] ?? "",
                ]);
                downloadCsv(csvBody(header, rows), "marketing_trend_decomposition");
              },
            });
          }
        }
        if (stage === "lab" && forecast?.futLabels?.length) {
          stageDownloadItems.push({
            label: tx("예측 구간 (CSV)", "Forecast horizon (CSV)"),
            desc: tx("기간별 예측값과 하한·상한, 채널별 미래 지출", "Forecast with lower/upper bounds and future spend by channel"),
            icon: "⬇",
            analyticsType: "forecast_horizon",
            onSelect: () => {
              const channels = forecast.chans || [];
              const header = ["period", "forecast", "lower", "upper", ...channels.map((channel) => `spend_${channel.key}`)];
              const rows = forecast.futLabels.map((label, index) => [
                label,
                forecast.predFut?.[index] ?? "",
                forecast.lo?.[index] ?? "",
                forecast.hi?.[index] ?? "",
                ...channels.map((channel) => forecast.futSpendByKey?.[channel.key]?.[index] ?? ""),
              ]);
              downloadCsv(csvBody(header, rows), "marketing_forecast_horizon");
            },
          });
        }
        return (
          <ResultActionCard
            toolId="5-18"
            locale={locale}
            analysisKey={`${mmmAnalyzedSig}|${target}|${effPlatformFilter}|${stage}`}
            analysisType={stage === "hub" ? "mapping" : stage}
            resultState={mmm?.empty ? "insufficient" : "ready"}
            tone={summary.tone}
            title={tx(`${stageKo} 요약`, `${stageKo} summary`)}
            headline={summary.headline}
            stats={summary.stats}
            points={[{ text: summary.point, cls: summary.tone === "bad" ? "bad" : "good" }]}
            workbookExport={stageWorkbookExport}
            download={stageDownloadItems.length ? (
              <DownloadHub
                toolId={stage === "lab" ? "5-18-forecast" : "5-18-trend"}
                locale={locale}
                label={tx("결과 받기", "Get results")}
                items={stageDownloadItems}
              />
            ) : null}
            controls={!isolated ? (
              <button className="ab-pill active" onClick={() => setStage(summary.next)}>
                {summary.nextLabel} →
              </button>
            ) : null}
            decisionReview={Boolean(summary.decisionPrefill)}
            decisionPrefill={summary.decisionPrefill}
            analysisDetails={<div className="result-evidence-status"><EvidenceStatusBadge status={summary.evidenceStatus} locale={locale} /></div>}
            analysisBasis={false}
          />
        );
      })()}

      {forecastActualMatches.length > 0 && (
        <section className="forecast-review-match" aria-label={tx("지난 예측 실제값 대조", "Match previous forecasts to actuals")}>
          <div className="forecast-review-match__head">
            <div>
              <span>{tx("FORECAST CHECK-IN", "FORECAST CHECK-IN")}</span>
              <h2>{tx(
                `새 CSV에서 대조 가능한 실제값 ${forecastActualMatches.length}건을 찾았습니다`,
                `Found ${forecastActualMatches.length} actual ${forecastActualMatches.length === 1 ? "value" : "values"} to match from the new CSV`,
              )}</h2>
              <p>{tx(
                "주차·타깃·플랫폼이 모두 같은 값만 제안합니다. 확인 버튼을 눌러야 결정 기록에 반영됩니다.",
                "Only values with the same period, target, and platform are suggested. Nothing is written to the decision record until you confirm it.",
              )}</p>
            </div>
            <strong>{forecastActualMatches.length}</strong>
          </div>
          <div className="forecast-review-match__list">
            {forecastActualMatches.map((match) => {
              const predicted = targetValueLabel(match.predictedValue, { perWeek: true });
              const actual = targetValueLabel(match.actualValue, { perWeek: true });
              const range = Number.isFinite(match.lower) && Number.isFinite(match.upper)
                ? `${targetValueLabel(match.lower, { perWeek: true })}–${targetValueLabel(match.upper, { perWeek: true })}`
                : "—";
              return (
                <article className="forecast-review-match__ticket" key={match.recordId}>
                  <div className="forecast-review-match__identity">
                    <span>{match.period} · {mmmTargetDisplay(match.target, locale)} · {match.platform === "all" ? "Total" : match.platform}</span>
                    <strong>{match.action}</strong>
                  </div>
                  <dl>
                    <div><dt>{tx("당시 예측", "Forecast")}</dt><dd>{predicted}</dd></div>
                    <div><dt>{tx("새 실제값", "New actual")}</dt><dd>{actual}</dd></div>
                    <div><dt>{tx("참고범위", "Reference range")}</dt><dd>{range}</dd></div>
                  </dl>
                  <button type="button" className="btn primary" disabled={!match.reviewDate || match.reviewDate > toLocalDecisionDate()} onClick={() => applyForecastActual(match)}>
                    {tx("이 실제값 반영", "Apply this actual")}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {panelEmpty ? (
        <section className="block">
          {demoBanner}
          <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{mmm.issues?.length
            ? tx(`분석 차단 이슈 ${mmm.issues.length}건`, `${mmm.issues.length} blocking data issue(s)`)
            : tx("MMM 패널을 만들 수 없습니다", "Can't build the MMM panel")}</strong>{mmm.issues?.length
            ? <ul style={{ margin: "6px 0 0", paddingLeft: "18px" }}>{mmm.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>
            : <p>{mmm.reason}</p>}</div></div>
          <div style={{ marginTop: "12px" }}>{mmmMapperSection()}</div>
        </section>
      ) : (
        <>
          {demoBanner}

          {/* ③ LAB(회귀·미래예측)은 아래 §7 forecast 블록에서 렌더(mmmForecast 기반, stage==="lab"). */}

          {/* ── STAGE ① DIAGNOSE (MMM panel) ── */}
          {stage === "trend" && (
            <section className="block" id="s-trend">
              <h2 className="section-title">{tx("광고 전에: 자연 추세·계절성을 먼저 분리합니다", "Before ads: separate natural trend and seasonality")}</h2>
                <details className="result-action-card__details" style={{ marginBottom: "10px" }}>
                  <summary>{tx("추세 분리 방식 보기", "How trend is separated")}</summary>
                  <p className="muted" style={{ fontSize: "12px", margin: "8px 0 0" }}>{tx("먼저 MMM Performance 기여를 실제 RR에서 빼고, 그 Performance 제외 성과를 baseline = 추세 + 계절성 + 잔차로 STL 분해합니다. 파란선은 광고에 잡힌 Performance 하락을 자연 추세로 다시 세지 않은 베이스라인 추세입니다. Branding은 입력에 남아 있으므로 완전한 미디어 0 반사실이 아닙니다.", "First subtract MMM Performance contribution from actual RR, then decompose the Performance-excluded outcome as baseline = trend + seasonality + residual. The blue line is the baseline trend without reclassifying paid Performance decline as natural trend. Branding remains in the input, so this is not a fully media-zero counterfactual.")}</p>
                </details>
              {trend ? <>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
                  <div className="stat-card"><div className="lbl">STL</div><div className="val">{trend.stl_pct >= 0 ? "+" : ""}{fmtOne(trend.stl_pct)}%</div></div>
                  <div className="stat-card"><div className="lbl">Mann-Kendall</div><div className="val">p={fmtOne(trend.mk_deseason?.[1])}</div></div>
                  <div className="stat-card"><div className="lbl">{tx("판정", "Verdict")}</div><div className="val" style={{ fontSize: "13px" }}>{trend.verdict}</div></div>
                </div>
                <div className="chart-container" style={{ height: "310px" }}><canvas ref={trendRef}></canvas></div>
                {trendLedger && (
                  <div className="trend-chart-explainer" role="note">
                    <div className="trend-chart-explainer__eyebrow">{tx("이 차트 읽는 법", "How to read this chart")}</div>
                    <p>
                      {tx(
                        `실제 RR은 ${fmtSignedInt(trendLedger.rawChange)}명 변했습니다. Performance 절대 기여는 ${fmtInt(trendLedger.performanceStart)}명 → ${fmtInt(trendLedger.performanceEnd)}명이고, 두 시점의 변화량은 ${fmtSignedInt(trendLedger.performanceChange)}명입니다. Performance 제외 입력은 ${fmtSignedInt(trendLedger.baselineInputChange)}명 변했습니다. 그 입력의 순수 베이스라인 추세는 ${fmtSignedInt(trendLedger.stlTrendChange)}명, 나머지 ${fmtSignedInt(trendLedger.stlNonTrendChange)}명은 계절성·잔차입니다.`,
                        `Actual RR changed by ${fmtSignedInt(trendLedger.rawChange)}. Absolute Performance contribution moved from ${fmtInt(trendLedger.performanceStart)} to ${fmtInt(trendLedger.performanceEnd)}; the signed change between those points is ${fmtSignedInt(trendLedger.performanceChange)}. The Performance-excluded input changed by ${fmtSignedInt(trendLedger.baselineInputChange)}; its pure baseline trend changed by ${fmtSignedInt(trendLedger.stlTrendChange)}, with ${fmtSignedInt(trendLedger.stlNonTrendChange)} remaining in seasonality and residual.`
                      )}
                    </p>
                    <div className="trend-chart-explainer__legend">
                      <span><i style={{ background: "var(--warning)" }} />{tx("왼쪽 축: Performance 제외 베이스라인 입력", "Left axis: Performance-excluded baseline input")}</span>
                      <span><i style={{ background: "var(--chart-secondary)" }} />{tx("왼쪽 축: 순수 베이스라인 추세", "Left axis: pure baseline trend")}</span>
                      <span><i style={{ background: "var(--chart-tertiary)" }} />{tx("오른쪽 축: 베이스라인 추세 외 변화량(0 기준)", "Right axis: baseline non-trend change (zero-centered)")}</span>
                    </div>
                  </div>
                )}
                {trendLedger && (
                  <div className="trend-change-ledgers">
                    <p className="trend-change-ledgers__intro">
                      {tx(
                        "Performance 기여를 제거한 입력을 기준으로 베이스라인 STL 원장을 계산합니다. Performance 변화는 원본 RR과 베이스라인 입력 사이에 별도로 표시되고, 파란선·계절성·잔차의 합은 Performance 제외 입력 변화와 맞아야 합니다. 막대는 첫 주에서 마지막 주까지의 변화량입니다.",
                        "The baseline STL ledger is calculated from the Performance-excluded input. Performance change is shown separately between raw RR and the baseline input; baseline trend, seasonality, and residual must sum to the baseline-input change. Bars show the change from the first to the last week."
                      )}
                    </p>
                    <div className="trend-change-ledgers__grid">
                      <TrendChangeBars
                        title={tx("STL 변화 원장", "STL change ledger")}
                        subtitle={tx("Performance 제외 입력 = 베이스라인 추세 + 계절성 + 잔차", "Performance-excluded input = baseline trend + seasonality + residual")}
                        rows={trendLedger.stlRows}
                        total={trendLedger.baselineInputChange}
                        totalLabel={tx("Performance 제외 입력 변화", "Performance-excluded input change")}
                        tx={tx}
                      />
                      {trendLedger.modelRows.length > 0 && (
                        <TrendChangeBars
                          title={tx("MMM 드라이버 변화", "MMM driver change")}
                          subtitle={tx("공동 적합된 모델의 변화 배분 · 인과 기여율 아님", "Jointly fitted model change · not causal attribution")}
                          rows={trendLedger.modelRows}
                          total={trendLedger.fittedChange}
                          totalLabel={tx("모델 변화", "Fitted change")}
                          tx={tx}
                        />
                      )}
                    </div>
                  </div>
                )}
                {!isolated && <Card style={{ marginTop: "12px", fontSize: "12px", lineHeight: 1.55 }}>
                  {tx("다음 단계에서 카니발 4검증을 보세요. 그중 ②는 이 시간 추세를 다시 걷어낸 뒤 광고와 성과의 관계를 확인합니다.", "Continue to the four cannibalization checks. Check ② removes this time trend again before comparing spend and outcome.")}
                  <button className="ab-pill active" style={{ marginLeft: "10px" }} onClick={() => setStage("diagnose")}>{tx("카니발 진단으로", "Open cannibalization")}</button>
                </Card>}
              </> : <p className="muted">{tx("추세 분석을 계산할 수 없습니다.", "Trend analysis is unavailable.")}</p>}
            </section>
          )}

          {stage === "diagnose" && (
            <>
              {/* ── 메인: 판정별 3버킷 칸반(그룹핑) + 짧은 평어 헤드라인 ── 통계는 아래 아코디언 ── */}
              {cannib && cannib.cannibRank && cannib.cannibRank.length ? (() => {
                const rk = cannib.cannibRank;
                // 엔진 5단계(lv) → 마케터용 3버킷: 잠식의심 / 애매함(데이터부족·공선) / 문제없음.
                const buckets = { danger: [], unclear: [], ok: [] };
                rk.forEach((r) => buckets[mmmCannibBucket(r)].push(r));
                const nD = buckets.danger.length;
                const headTone = nD > 0 ? "danger" : buckets.ok.length > 0 ? "ok" : "warn";
                const headBadge = nD > 0 ? tx("잠식 의심", "Cannibalization suspected") : buckets.ok.length > 0 ? tx("방어 양호", "Well defended") : tx("판단 보류", "Verdict withheld");
                const headline = nD > 0
                  ? tx(`${rk.length}개 채널 중 ${nD}개에서 잠식이 의심돼요 — 빨간 칸부터 점검하세요.`, `${nD} of ${rk.length} channels show suspected cannibalization — check the red bucket first.`)
                  : buckets.ok.length > 0
                    ? tx(`${rk.length}개 채널 대체로 방어 양호 — 지금 뚜렷한 잠식 신호는 없어요.`, `${rk.length} channels are mostly well defended — no clear cannibalization signal right now.`)
                    : tx(`판정할 만큼 데이터가 충분한 채널이 적어요 — 애매함 칸을 확인하세요.`, `Too few channels have enough data to judge — check the unclear bucket.`);
                const col = (key, title, icon, tone) => {
                  const list = buckets[key];
                  const c = BADGE_TONE[tone];
                  return (
                    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: "12px", padding: "10px 12px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: c.color, marginBottom: "8px" }}>{icon} {title} · {list.length}</div>
                      {list.length ? list.map((r) => (
                        <button type="button" key={r.key} onClick={() => setCannibChannel(r.key)} aria-pressed={r.key === activeCannibCh}
                          className="analysis-choice-card"
                          style={{ background: "var(--bg-2)", border: `1px solid ${r.key === activeCannibCh ? "var(--primary)" : "var(--border)"}`, borderRadius: "8px", padding: "8px 10px", marginBottom: "6px", cursor: "pointer" }}>
                          <div style={{ fontSize: "13px", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>{r.label}{r.brand ? " 🏷" : ""}</span>
                            <span style={{ fontSize: "11px", color: MUTED }}>›</span>
                          </div>
                          <div style={{ fontSize: "11px", color: MUTED, marginTop: "2px" }}>
                            {key === "unclear"
                              ? (r.eligible ? tx("채널끼리 지출이 겹침(공선)", "Channels' spend overlaps (collinear)") : tx(`데이터 부족 (${r.nActive}/${r.total}주)`, `Insufficient data (${r.nActive}/${r.total} wk)`))
                              : mmmCannibActionShort(r, locale)}
                          </div>
                        </button>
                      )) : <div style={{ fontSize: "11px", color: MUTED }}>{tx("없음", "None")}</div>}
                    </div>
                  );
                };
                return (
                  <>
                    <Card style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <Badge tone={headTone}>{headBadge}</Badge>
                      <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-1)" }}>{headline}</span>
                    </Card>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px", marginBottom: "10px" }}>
                      {col("danger", tx("잠식 의심", "Suspected"), "⚠", "danger")}
                      {col("unclear", tx("애매함", "Unclear"), "?", "neutral")}
                      {col("ok", tx("문제 없음", "No issue"), "✓", "ok")}
                    </div>
                    <p style={{ fontSize: "11px", color: MUTED, marginBottom: "14px" }}>
                      {tx("채널을 클릭하면 아래에 왜 그렇게 판정했는지(근거)가 열려요.", "Click a channel to see why it was judged that way, below.")}{rk.mde12 != null ? tx(` · 12주 실험 최소검출력 ≈ ${rk.mde12}%`, ` · 12-week experiment MDE ≈ ${rk.mde12}%`) : ""}
                    </p>
                  </>
                );
              })() : (
                <Card style={{ marginBottom: "14px" }}>
                  <span style={{ fontSize: "13px", color: MUTED }}>{tx("카니발 판정을 계산할 수 없습니다 (데이터·매핑 확인).", "Can't compute a cannibalization verdict (check data/mapping).")}</span>
                </Card>
              )}

              {/* ── 채널 드릴다운: 4가지를 평어 질문으로, ①②③ 3열 균등, 헤드라인은 버킷과 일치 ── */}
              {activeCn && (() => {
                const cn = activeCn;
                const p = cn.precedence, d = cn.detrend_corr, ni = cn.net_incrementality;
                const chLabel = (cannib.rows.find((r) => r.channel.key === activeCannibCh) || {}).channel?.label || activeCannibCh;
                const g = cn.granger;
                const gate = cn.power_gate || { blocked: false, reasons: [] };
                // 헤드라인을 칸반 버킷과 동일 규칙으로 계산 → "문제없다는데 왜 잠식의심" 모순 제거.
                const rr = (cannib.cannibRank || []).find((x) => x.key === activeCannibCh);
                const bucket = rr ? mmmCannibBucket(rr) : "unclear";
                const lagVote = cn.granger_cannibal ? "AGAINST" : cn.granger_help ? "FOR" : "ABSTAIN";
                const votes = [p.vote, d.vote, ni.vote, lagVote];
                const nFor = votes.filter((v) => v === "FOR").length;
                const nAg = votes.filter((v) => v === "AGAINST").length;
                const nAb = votes.filter((v) => v === "ABSTAIN").length;
                const headTone = bucket === "danger" ? "danger" : bucket === "ok" ? "ok" : "warn";
                const headBadge = bucket === "danger" ? tx("잠식 의심", "Cannibalization suspected") : bucket === "ok" ? tx("방어 양호", "Well defended") : tx("판단 보류", "Verdict withheld");
                const headWhy = bucket === "danger"
                  ? (cn.granger_cannibal
                      ? tx("같은 주 지표(①②③)는 대체로 괜찮은데, 몇 주 시차를 두고 광고비가 오가닉을 끌어내리는 신호(④)가 나왔어요. 그래서 의심으로 올렸습니다.", "Same-week metrics (①②③) mostly look fine, but a lagged signal (④) showed spend pulling organic down a few weeks later — so we flagged it as suspected.")
                      : tx("광고가 늘 때 오가닉이 줄어드는 신호가 나왔어요.", "A signal showed organic falling as ad spend rose."))
                  : bucket === "ok"
                    ? tx("네 방향으로 따져봐도 뚜렷한 잠식 신호가 없어요.", "Checking all four angles, there's no clear cannibalization signal.")
                    : tx("데이터가 부족하거나 채널끼리 지출이 겹쳐(공선) 판정하기 어려워요.", "Data is insufficient, or channels' spend overlaps (collinear), making a verdict hard.");
                const voteView = (v) => v === "FOR" ? { t: tx("괜찮음", "OK"), c: "var(--success)" } : v === "AGAINST" ? { t: tx("잠식 신호", "Cannibalization signal"), c: "var(--danger)" } : { t: tx("판단 보류", "Withheld"), c: MUTED };
                const signal = (key, num, q, help, v, tech) => {
                  const vv = voteView(v);
                  return (
                    <button onClick={() => setCannibQuestion(key)} style={{ background: cannibQuestion === key ? "rgba(122,162,247,0.10)" : "var(--bg-2)", border: `1px solid ${cannibQuestion === key ? "rgba(122,162,247,0.65)" : "var(--border)"}`, borderRadius: "10px", padding: "12px 14px", textAlign: "left", color: "inherit", cursor: "pointer", minHeight: "142px" }}>
                      <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-1)", lineHeight: 1.4, minHeight: "34px" }}>{num} {q}</div>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: vv.c, margin: "8px 0 4px" }}>{vv.t}</div>
                      <div style={{ fontSize: "11px", color: MUTED, lineHeight: 1.5 }}>{help}</div>
                      <div style={{ fontSize: "11px", color: MUTED, marginTop: "6px", opacity: 0.8 }} title={tx("통계 원값(전문가용)", "Raw statistics (for specialists)")}>{tech}</div>
                    </button>
                  );
                };
                return (
                  <section className="block" id="s-cannib-detail">
                    <h2 className="section-title">{tx("이 채널은 왜 이렇게 판정됐나?", "Why was this channel judged this way?")} — {chLabel}</h2>
                    <Card style={{ marginBottom: "12px", display: "flex", gap: "10px", alignItems: "flex-start", flexWrap: "wrap" }}>
                      <Badge tone={headTone}>{headBadge}</Badge>
                      <div style={{ flex: 1, minWidth: "220px" }}>
                        <div style={{ fontSize: "13px", color: "var(--text-1)", lineHeight: 1.6 }}>{headWhy}</div>
                        <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px" }}>{tx(`아래 4가지를 각각 따져본 결과예요 · 괜찮음 ${nFor} / 잠식 신호 ${nAg} / 판단 보류 ${nAb} · 확정은 holdout 실험(5-4)에서만.`, `Result of checking the 4 signals below · OK ${nFor} / cannibalization signal ${nAg} / withheld ${nAb} · confirmation only via a holdout experiment (5-4).`)}</div>
                      </div>
                    </Card>
                    {gate.blocked && (
                      <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: "8px", padding: "9px 12px", fontSize: "11.5px", color: "var(--text-1)", marginBottom: "10px" }}>
                        {tx('ⓘ 데이터가 적거나 지출 변동이 작아 ③을 신뢰하기 어려워요 — 이럴 땐 "문제 없음"으로 단정하지 않고 보류합니다.', 'ⓘ Data is limited or spend barely varies, so ③ can\'t be trusted — in that case we withhold rather than assert "no issue."')}
                      </div>
                    )}
                    <div className="cannib-reading-guide" aria-label={tx("카니발 차트 읽는 법", "How to read the cannibalization chart")}>
                      <div className="cannib-reading-guide__title">{tx("산점도는 이렇게 읽어요", "How to read the scatter plot")}</div>
                      <div className="cannib-reading-guide__cards">
                        <div className="cannib-reading-guide__card is-danger">
                          <strong>{tx("잠식 의심", "Suspected cannibalization")}</strong>
                          <span>{tx("오른쪽 아래로 기울면: 광고 지출↑ · 오가닉 성과↓", "Downward slope: spend ↑ · organic outcome ↓")}</span>
                        </div>
                        <div className="cannib-reading-guide__card is-ok">
                          <strong>{tx("증분 신호", "Incremental signal")}</strong>
                          <span>{tx("오른쪽 위로 기울면: 광고 지출↑ · 성과도↑", "Upward slope: spend ↑ · outcome ↑")}</span>
                        </div>
                        <div className="cannib-reading-guide__card is-neutral">
                          <strong>{tx("판단 보류", "Withhold verdict")}</strong>
                          <span>{tx("점이 흩어지면: 방향이 불분명해 추가 검증 필요", "Scattered points: direction unclear, more evidence needed")}</span>
                        </div>
                      </div>
                      <p>{tx("② 차트는 각 시계열의 선형 시간 추세를 걷어낸 뒤의 관계입니다. 기울기 하나만으로 확정하지 않고, 아래 4가지 신호를 함께 봅니다.", "Chart ② removes each series' linear time trend first. One slope never decides the verdict; we combine all four signals below.")}</p>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "10px" }}>
                      {signal("precedence", "①", tx("광고를 늘리기 전에 성과가 이미 줄고 있었나?", "Was outcome already declining before ad spend rose?"), tx("저지출 주의 시간 흐름을 봅니다. 이미 줄었다면 광고 탓으로 단정 못 해요.", "Checks the time path in low-spend weeks. A prior decline cannot be blamed on ads."), p.vote, tx(`저지출 기울기 ${p.kpi_slope_per_wk}/주 · ${p.kpi_change_over_window_pct}%`, `Low-spend slope ${p.kpi_slope_per_wk}/wk · ${p.kpi_change_over_window_pct}%`))}
                      {signal("detrend", "②", tx("시간 추세를 걷어내도 광고와 성과가 반대로 움직이나?", "After removing the time trend, do spend and outcome still move opposite?"), tx("시간 착시를 제거한 잔차와 전주 대비 변화 방향을 함께 봅니다.", "Compares detrended residuals and the direction of week-over-week changes."), d.vote, tx(`잔차 ${d.detrended} · 차분 ${d.first_diff} · 역행 ${d.directional?.opposite_n ?? 0}/${d.directional?.informative_n ?? 0}주`, `Residual ${d.detrended} · diff ${d.first_diff} · opposite ${d.directional?.opposite_n ?? 0}/${d.directional?.informative_n ?? 0} wk`))}
                      {signal("net", "③", tx("광고를 늘리면 전체 성과는 순증가하나?", "Does more spend net-increase total outcome?"), tx("점추정과 신뢰구간이 0보다 어느 쪽에 있는지 봅니다.", "Checks point estimate and confidence interval against zero."), ni.vote, tx(`순증분 ${isFinite(ni.net_elasticity) ? ni.net_elasticity : "—"} · CI[${ni.ci_lo ?? "—"}, ${ni.ci_hi ?? "—"}]`, `Net effect ${isFinite(ni.net_elasticity) ? ni.net_elasticity : "—"} · CI[${ni.ci_lo ?? "—"}, ${ni.ci_hi ?? "—"}]`))}
                      {signal("lag", "④", tx("광고비가 몇 주 뒤 성과를 끌어내리나?", "Does spend pull outcome down weeks later?"), tx("광고 충격 뒤의 주별·누적 반응을 봅니다.", "Shows weekly and cumulative response after a spend shock."), cn.granger_cannibal ? "AGAINST" : cn.granger_help ? "FOR" : "ABSTAIN", g ? tx(`시차 ${g.spend_to_organic.lag}주 · p=${g.spend_to_organic.p}`, `Lag ${g.spend_to_organic.lag}wk · p=${g.spend_to_organic.p}`) : tx("데이터 부족", "Insufficient data"))}
                    </div>
                    <div style={{ marginTop: "12px" }}>
                      <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-1)", marginBottom: "3px" }}>
                        {cannibQuestion === "precedence" ? tx("① 저지출 주의 성과·지출 흐름", "① Outcome and spend in low-spend weeks") : cannibQuestion === "detrend" ? tx("② 추세 제거·전주 대비 관계", "② Detrended and week-over-week relationship") : cannibQuestion === "net" ? tx("③ 순증분 효과와 신뢰구간", "③ Net incremental effect and interval") : tx("④ 지출 충격 뒤 시차 반응", "④ Lagged response after a spend shock")}
                      </div>
                      <p className="muted" style={{ fontSize: "11px", margin: "0 0 5px" }}>{cannibQuestion === "net" ? tx("초록 막대가 아니라 순증분 탄력성의 점추정과 신뢰구간입니다. 0을 포함하면 결론은 보류합니다.", "This is a net-elasticity estimate and interval, not a green success bar. If it includes 0, verdict is withheld.") : cannibQuestion === "lag" ? tx("아래면 시차 잠식, 위면 시차 증분 신호입니다.", "Below zero suggests lagged cannibalization; above zero suggests incremental response.") : cannibQuestion === "detrend" ? tx(`굵은 0축을 기준으로 오른쪽 아래(지출↑·성과↓)와 왼쪽 위(지출↓·성과↑)를 모두 역행으로 셉니다. 점 위의 관계선으로 전체 방향을 확인하세요. 현재 유효 ${d.directional?.informative_n ?? 0}주 중 ${d.directional?.opposite_n ?? 0}주가 반대로 움직였습니다.`, `Using the bold zero axes, both lower-right (spend↑/outcome↓) and upper-left (spend↓/outcome↑) count as opposite movement. Use the fitted lines to read the overall direction. Currently ${d.directional?.opposite_n ?? 0} of ${d.directional?.informative_n ?? 0} informative weeks move opposite.`) : cannibQuestion === "precedence" ? tx(`이 차트는 상관관계 차트가 아닙니다. 주황 점은 지출이 하위 25% 기준(${spendValueLabel(p.p25)}) 이하였던 주의 성과만 표시합니다. 비용과 성과의 직접 관계는 ②에서 확인하세요.`, `This is not a correlation chart. Orange points mark outcome only in weeks where spend was at or below the bottom-quartile threshold (${spendValueLabel(p.p25)}). Use ② for the direct spend–outcome relationship.`) : tx("선택한 검증의 원자료를 직접 확인하세요. 단일 차트가 최종 인과 증명은 아닙니다.", "Inspect source evidence for the selected test. One chart is not causal proof.")}</p>
                      {cannibQuestion === "net" ? <NetEffectEvidence net={ni} locale={locale} /> : <div className="chart-container" style={{ height: cannibQuestion === "detrend" ? "360px" : "280px" }}><canvas ref={irfRef}></canvas></div>}
                    </div>
                  </section>
                );
              })()}

              {/* ── 통계 근거·방법론 전부 여기로 격리(기본 접힘) — 비전문 유저는 위 칸반·평어만 보면 됨 ── */}
              <details className="block" style={{ marginBottom: "14px" }} onToggle={onAccordionToggle}>
                <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "var(--primary, #adc6ff)", padding: "4px 0" }}>
                  {tx("카니발이 뭐고, 이 판정은 어떻게 나온 건가요? — 추세·데이터 위생·단순모델 점검 (통계 상세)", "What is cannibalization, and how was this verdict reached? — trend, data hygiene, naive-model check (statistics detail)")}
                </summary>
                <div style={{ marginTop: "12px" }}>
                  <p className="muted" style={{ fontSize: "12px", lineHeight: 1.7, marginBottom: "10px" }}>
                    <strong>{tx("카니발리제이션(잠식)", "Cannibalization")}</strong>{tx("이란 유료 광고가 원래 공짜로 들어올 오가닉 유입을 빼앗는 현상입니다. 이 도구는 선택한 성과(유저수·매출 등)와 지출의 4가지 신호(①시간 선행성 ②탈추세·방향 반복 ③순증분 탄력성 ④그랜저 인과)를 종합해 의심 채널을 좁힙니다. 관측 데이터만으로 오가닉을 분리하거나 인과를 확정할 수 없으며, 확정은 홀드아웃 실험(5-4)에서만 가능합니다.", " is when paid ads take away organic traffic that would have come for free. This tool combines four signals between spend and the selected outcome (users, revenue, and so on): ① temporal precedence ② detrended and repeated-direction movement ③ net-incremental elasticity ④ Granger causality. Observational data can only narrow down suspects; it cannot isolate organic traffic or prove causality. Confirmation requires a holdout experiment (5-4).")}
                  </p>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
                    <button className="ab-pill" title={tx("채널 × 3-state 투표 + 게이트·탄력성·커버리지·그랜저 → CSV", "Channel × 3-state vote + gate/elasticity/coverage/Granger → CSV")}
                      onClick={() => cannib && csvDownload(`mmm_cannib_${mmm.target}_${_today()}.csv`, buildCannibCsv(cannib, mmm.effects, mmm.target))}>
                      {tx("⬇ 채널별 카니발 CSV", "⬇ Per-channel cannibalization CSV")}
                    </button>
                    <button className="ab-pill" title={tx("주별 타깃·채널별 ln(1+지출)·탈추세 잔차·1차차분 원자료", "Weekly target/channel ln(1+spend), detrended residuals, first-difference raw data")}
                      onClick={() => csvDownload(`mmm_cannib_series_${mmm.target}_${_today()}.csv`, buildCannibSeriesCsv(mmm.panel, mmm.target))}>
                      {tx("⬇ 검정 원자료 CSV", "⬇ Test raw-data CSV")}
                    </button>
                  </div>

              <section className="block" id="s-trend">
                <h2 className="section-title">{tx("성과에 광고와 무관한 '추세'가 있나요?", "Is there a 'trend' in performance unrelated to ads?")}</h2>
                <p className="muted" style={{ fontSize: "12px", marginBottom: "8px" }}>{tx("시간이 흐르며 성과가 저절로 오르내리는 흐름(추세)이 있는지 봐요. 추세가 크면, 광고 효과와 헷갈리지 않게 따로 떼어내야 해요.", "Checks whether performance rises/falls on its own over time (a trend). If the trend is large, it needs to be separated so it isn't confused with ad effect.")}</p>
                {trend ? (
                  <>
                    {(() => {
                      const isNo = trend.verdict.startsWith("NO");
                      const isYes = trend.verdict.startsWith("trend EXISTS");
                      const plain = isNo
                        ? tx("뚜렷한 추세는 없어요 — 성과 등락은 대부분 광고·계절 영향입니다.", "No clear trend — performance swings are mostly due to ads/season.")
                        : isYes
                          ? tx("추세가 있어요 — 광고를 걷어내도 시간 흐름 자체의 상승/하락이 남습니다.", "There's a trend — a rise/fall from time itself remains even after removing ads.")
                          : tx("추세가 조금 있지만 광고·계절과 얽혀 있어요.", "There's some trend, but it's entangled with ads/season.");
                      return (
                        <div className={`callout ${isNo ? "ok" : "warn"}`}>
                          <div className="ico">{isNo ? "✓" : "!"}</div>
                          <div className="body">
                            <strong>{plain}</strong>
                            <p style={{ fontSize: "11px", color: MUTED, marginTop: "4px" }} title={trend.verdict}>{tx(`전 구간 추세 변화 ${trend.stl_pct}% · 판정 근거: ${trend.verdict}`, `Full-period trend change ${trend.stl_pct}% · basis: ${trend.verdict}`)}</p>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="chart-container" style={{ height: "240px", marginTop: "12px" }}>
                      <canvas ref={trendRef}></canvas>
                    </div>
                    <div className="table-wrap" style={{ marginTop: "12px" }}>
                      <table className="data" style={{ fontSize: "11.5px" }}>
                        <thead><tr><th>{tx("검정", "Test")}</th><th>{tx("결과", "Result")}</th><th>p</th></tr></thead>
                        <tbody>
                          <tr><td>Mann-Kendall (raw)</td><td>{trend.mk_raw[0]}</td><td className="tnum">{trend.mk_raw[1]}</td></tr>
                          <tr><td>{tx("MK (자기상관 보정)", "MK (autocorrelation-corrected)")}</td><td>{trend.mk_ac_robust[0]}</td><td className="tnum">{trend.mk_ac_robust[1]}</td></tr>
                          <tr><td>{tx("MK (계절 제거)", "MK (deseasonalized)")}</td><td>{trend.mk_deseason[0]}</td><td className="tnum">{trend.mk_deseason[1]}</td></tr>
                          <tr><td>{tx("ADF (추세정상성)", "ADF (trend stationarity)")}</td><td>—</td><td className="tnum">{trend.adf_ct_p}</td></tr>
                          <tr><td>KPSS</td><td>—</td><td className="tnum">{trend.kpss_ct_p}</td></tr>
                          <tr><td>{tx("media 제거 후 잔차 MK", "Residual MK after removing media")}</td><td>{trend.resid_after_media_mk[0]}</td><td className="tnum">{trend.resid_after_media_mk[1]}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="muted" style={{ fontSize: "12px" }}>{tx("추세 검정을 계산할 수 없습니다.", "Can't compute the trend test.")}</p>
                )}
              </section>

              {/* ── §1 데이터 위생 + 매크로 사실 (모델 독립) ── */}
              <section className="block" id="s-macro">
                <h2 className="section-title">{tx("데이터가 분석하기에 깨끗한가요?", "Is the data clean enough to analyze?")}</h2>
                <p className="muted" style={{ fontSize: "12px" }}>
                  {tx("분석 전에 데이터에 빠진 주·이상한 값이 없는지 점검하고, 작년 대비 지출·성과가 얼마나 변했는지(가장 단순하고 확실한 비교)를 봐요.", "Before analysis, checks for missing weeks/odd values in the data, and shows how much spend/performance changed vs. last year (the simplest, most certain comparison).")}
                </p>
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", margin: "8px 0" }}>
                  <div className="stat-card"><div className="lbl">{tx("주 수(n)", "Weeks (n)")}</div><div className="val">{mmm.derived.n}</div></div>
                  <div className="stat-card"><div className="lbl">{tx("위생 경고", "Hygiene warnings")}</div><div className="val" style={{ color: mmm.validate?.warnings?.length ? "var(--danger)" : "var(--success)" }}>{mmm.validate?.warnings?.length || "OK"}</div></div>
                  <div className="stat-card"><div className="lbl">{tx("분석 차단 이슈", "Blocking issues")}</div><div className="val" style={{ color: mmm.validate?.issues?.length ? "var(--danger)" : "var(--success)" }}>{mmm.validate?.issues?.length || "OK"}</div></div>
                </div>
                {diag && Object.keys(diag.macro).length ? (
                  <div className="table-wrap" style={{ maxWidth: "420px", marginTop: "8px" }}>
                    <table className="data" style={{ fontSize: "11.5px" }}>
                      <thead><tr><th>{tx("매크로 사실", "Macro fact")}</th><th>{tx("값", "Value")}</th></tr></thead>
                      <tbody>
                        {Object.entries(diag.macro).map(([k, v]) => (
                          <tr key={k}><td>{k}</td><td className="tnum" style={{ color: v < 0 ? POS : NEG }}>{v > 0 ? "+" : ""}{v}%</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: "11px", marginTop: "6px" }}>
                    {tx(`ⓘ 매크로 YoY(2024 vs 2025)는 날짜가 매핑된 데이터에서만 계산됩니다${diag && !diag.validDates ? " — 현재 데이터엔 유효 날짜 라벨이 없습니다." : " — 2024·2025 두 해가 모두 있어야 표시됩니다."}`, `ⓘ Macro YoY (2024 vs 2025) is only computed for data with a mapped date${diag && !diag.validDates ? " — the current data has no valid date labels." : " — both 2024 and 2025 must be present."}`)}
                  </p>
                )}
                {mmm.validate?.warnings?.length ? (
                  <details style={{ marginTop: "8px" }}>
                    <summary style={{ cursor: "pointer", fontSize: "11px", color: "var(--warning)" }}>{tx(`⚠ 데이터 위생 경고 ${mmm.validate.warnings.length}건 (펼치기)`, `⚠ ${mmm.validate.warnings.length} data hygiene warnings (expand)`)}</summary>
                    <ul style={{ fontSize: "11px", color: "var(--warning)", marginTop: "4px" }}>
                      {mmm.validate.warnings.map((w, i) => (<li key={i}>{w}</li>))}
                    </ul>
                  </details>
                ) : null}
                {diag && diag.absorb && diag.absorb.notices.length > 0 && (
                  <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: "8px", padding: "9px 12px", fontSize: "11.5px", color: "var(--text-1)", marginTop: "10px" }}>
                    🔗 <strong>{diag.absorb.notices.some((notice) => !notice.dropped) ? tx("식별 불가 — 자동 제거 안 함", "Not identified — no variable auto-removed") : tx("사용자 지정 흡수(공선)", "User-specified absorption (collinear)")}</strong> — {diag.absorb.notices.some((notice) => !notice.dropped)
                      ? tx("채널 지출과 구조변화가 거의 같이 움직여(|r|≥0.9) 어느 쪽 효과인지 구분할 수 없습니다. 앱은 임의로 한 변수를 지우지 않으며 예산 추천을 보류합니다.", "Channel spend and a regime-change variable move almost identically (|r|≥0.9), so their effects cannot be separated. The app does not remove either variable automatically, and budget recommendations are paused.")
                      : tx("사용자가 제거할 변수를 명시한 공선쌍만 모델에서 흡수했습니다.", "Only collinear pairs with an explicitly chosen variable to remove were absorbed.")}
                    <ul style={{ margin: "4px 0 0", paddingLeft: "18px" }}>
                      {diag.absorb.notices.map((nt) => (
                        <li key={nt.key}>{nt.channelLabel} ~ {nt.step} (r={nt.corr}) → {nt.dropped
                          ? <><strong>{nt.dropped}</strong> {tx(`흡수(유지: ${nt.kept})`, `absorbed (kept: ${nt.kept})`)}</>
                          : <strong>{tx("식별 불가 · 자동 제거 안 함 · 예산 추천 보류", "not identified · no auto-removal · budget recommendation paused")}</strong>}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              {/* ── §2 "단순 모델" audit — 흔한 함정 점검 (naive lumped 모델) ── */}
              {diag && diag.audit && (() => {
                const a = diag.audit;
                const f = (v, d = 2) => (v == null || !isFinite(v) ? "—" : (+v).toFixed(d));
                return (
                  <section className="block" id="s-audit">
                    <h2 className="section-title">{tx("'대충 뭉친 모델'은 왜 못 믿나요?", "Why can't you trust a 'crudely lumped model'?")}</h2>
                    <p className="muted" style={{ fontSize: "12px" }}>
                      {tx("모든 채널 지출을", "It shows common pitfalls of")} <strong>{tx("하나로 뭉쳐 대충 만든 모델", "a model crudely lumping all channel spend together")}</strong>{tx("이 흔히 빠지는 함정(자기상관을 무시해 과신하거나, 채널끼리 겹쳐 계수가 출렁이는 것)을 보여줘요 — 그래서 채널을 나누고 광고 잔효·수확체감을 반영한 제대로 된 MMM(② 기여 분해)이 필요합니다.", " (overconfidence from ignoring autocorrelation, or coefficients swinging because channels overlap) — which is why a proper MMM (② Contribution) that separates channels and models carryover/saturation is needed.")}
                    </p>
                    <p style={{ fontSize: "11px", color: MUTED, marginTop: "2px" }}>
                      target=RR · n={a.n} · R²={f(a.r2, 4)} · adjR²={f(a.adj_r2, 4)} · HAC maxlags={a.hac_maxlags}
                    </p>
                    <div className="table-wrap" style={{ marginTop: "6px" }}>
                      <table className="data" style={{ fontSize: "11px" }}>
                        <thead><tr><th>{tx("변수", "Variable")}</th><th>coef</th><th title={tx("일반 최소제곱 p — 독립·등분산 가정", "Plain OLS p — assumes independent, homoskedastic errors")}>OLS p</th><th title={tx("자기상관·이분산에 견고한 HAC p — OLS보다 크거나 작을 수 있음", "HAC p robust to autocorrelation/heteroskedasticity — may be larger or smaller than OLS")}>HAC p</th></tr></thead>
                        <tbody>
                          {a.coefficients.map((r) => (
                            <tr key={r.var}>
                              <td>{r.var}</td>
                              <td className="tnum">{f(r.coef)}</td>
                              <td className="tnum" style={{ color: MUTED }}>{f(r.ols_p, 4)}</td>
                              <td className="tnum">{f(r.hac_p, 4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ fontSize: "12px", margin: "12px 0 2px", color: "var(--text-1)" }}>
                      {tx('① 브랜드 추가 시 R²가 내려가는가?', "① Does R² fall when brand is added?")} <span style={{ color: MUTED, fontSize: "11px" }}>{tx('(회귀변수 추가는 R²를 못 낮춤 → "브랜드 빼자" 논리 반박)', '(adding a regressor can\'t lower R² → this rebuts the "drop brand" argument)')}</span>
                    </p>
                    <div className="table-wrap">
                      <table className="data" style={{ fontSize: "11px" }}>
                        <thead><tr><th>target</th><th>{tx("R²(브랜드 X)", "R² (no brand)")}</th><th>{tx("R²(브랜드 O)", "R² (with brand)")}</th><th>brand p</th></tr></thead>
                        <tbody>
                          {a.brand_test.map((r) => (
                            <tr key={r.target}>
                              <td>{r.target}</td>
                              <td className="tnum">{f(r.R2_no_brand, 4)}</td>
                              <td className="tnum" style={{ color: NEG }}>{f(r.R2_with_brand, 4)}</td>
                              <td className="tnum">{f(r.brand_p, 4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ fontSize: "12px", margin: "12px 0 2px", color: "var(--text-1)" }}>
                      {tx('② 같은 스펙인데 target만 바꿔도 "총지출 계수"가 출렁인다 = 공선 신호', '② Same spec, but the "total-spend coefficient" swings just by changing target = a collinearity signal')}
                    </p>
                    <div className="table-wrap">
                      <table className="data" style={{ fontSize: "11px" }}>
                        <thead><tr><th>target</th><th>{tx("총지출 coef", "Total-spend coef")}</th><th>HAC p</th><th>trend coef</th></tr></thead>
                        <tbody>
                          {a.channel_swing.map((r) => (
                            <tr key={r.target}>
                              <td>{r.target}</td>
                              <td className="tnum">{f(r.ln_G_coef)}</td>
                              <td className="tnum">{f(r.hac_p, 4)}</td>
                              <td className="tnum" style={{ color: POS }}>{f(r.trend_coef)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="muted" style={{ fontSize: "11px", marginTop: "6px" }}>
                      {tx(`RR mean=${a.composite.mean_RR} = 구성요소 합 ${a.composite.components_mean_sum} (RR 정의 확인). ⚠ spend↔trend 공선 + 상쇄 계수 → 단순 모델 계수는 식별 불안정 → §5(채널분리·adstock·HAC)에서 제대로.`, `RR mean=${a.composite.mean_RR} = sum of components ${a.composite.components_mean_sum} (checks the RR definition). ⚠ spend↔trend collinearity + offsetting coefficients → naive-model coefficients are unstable to identify → done properly in §5 (channel separation, adstock, HAC).`)}
                    </p>
                  </section>
                );
              })()}
                </div>
              </details>

              {/* ── 맨 밑: 전 과정 상세 설명 문서 다운로드 ── */}
              <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
                <button className="ab-button"
                  onClick={() => textDownload(`${tx("카니발_진단_설명", "cannibalization_diagnosis_explained")}_${mmm.target}_${_today()}.md`, buildCannibGuideDoc(cannib, mmmTargetDisplay(mmm.target, locale), locale))}>
                  {tx("📄 이 과정에 대한 자세한 설명이 듣고 싶으신가요? — 상세 문서 받기", "📄 Want a detailed explanation of this process? — Get the detailed document")}
                </button>
              </div>
            </>
          )}

          {/* ── STAGE ② MMM ── */}
          {stage === "mmm" && (() => {
            const dateScopedDecomp = displayedDecomp || decomp;
            const isBaseDemandDriver = (driver) => ["Trend", "기본 수요", "baseline"].includes(driver);
            const dateDriverStats = dateScopedDecomp?.driverStats || [];
            const seasonalityDriverStat = dateDriverStats.find((row) => row.name === "Seasonality") || null;
            const isSeasonalitySelected = Boolean(mmm.run.seasonalityPeriods?.length);
            const hasSeasonalityContribution = Boolean(
              seasonalityDriverStat
              && (Math.abs(seasonalityDriverStat.min || 0) > 1e-8 || Math.abs(seasonalityDriverStat.max || 0) > 1e-8),
            );
            const dateDriverTotal = dateDriverStats.reduce((sum, row) => sum + (row.swing || 0) ** 2, 0) || 1;
            const rawShRows = dateDriverStats.map((row) => ({ ...row, driver: row.name, r2_share: (row.swing || 0) ** 2 / dateDriverTotal }));
            const visibleShRows = includeBaseDemandInShare ? rawShRows : rawShRows.filter((row) => !isBaseDemandDriver(row.driver));
            const visibleShTotal = visibleShRows.reduce((sum, row) => sum + (row.r2_share || 0), 0);
            const shRows = visibleShRows
              .map((row) => ({ ...row, pct: visibleShTotal > 0 ? row.r2_share / visibleShTotal * 100 : 0 }))
              .sort((a, b) => b.r2_share - a.r2_share);
            const PLAIN_DRV = locale === "en"
              ? { "기본 수요": "Base demand", Trend: "Base demand · trend", Seasonality: "Season", Holidays: "Holidays/events", "Holidays & Events": "Holidays/events", "Regime(steps)": "Regime change", "Regime change": "Regime change", "Industry Trend": "Industry trend", Performance: "Performance marketing", Brand: "Brand", Regime: "Regime change", baseline: "Baseline" }
              : { Trend: "기본 수요·추세", Seasonality: "시즌·계절", Holidays: "휴일·이벤트", "Holidays & Events": "휴일·이벤트", "Regime(steps)": "구조 변화", "Regime change": "구조 변화", "Industry Trend": "업계 현황", Performance: "마케팅", Brand: "브랜딩", Regime: "구조 변화", baseline: "기본값" };
            const plainDrv = (nm) => PLAIN_DRV[nm] || nm;
            const isMediaDrv = (nm) => !MMM_NONMEDIA_GROUPS.includes(nm) && nm !== "baseline";
            const tgtKo = mmmTargetDisplay(mmm.target, locale);
            const topDrv = shRows[0];
            const topMedia = shRows.find((r) => isMediaDrv(r.driver));
            const headline = shRows.length
              ? tx(
                  `${tgtKo} 성과를 움직인 건 대부분 ${plainDrv(topDrv.driver)}(${(topDrv.pct || 0).toFixed(0)}%)였고${topMedia ? `, 광고 중엔 ${topMedia.driver}가 가장 컸어요` : "예요"}.`,
                  `Most of the ${tgtKo} performance was driven by ${plainDrv(topDrv.driver)} (${(topDrv.pct || 0).toFixed(0)}%)${topMedia ? `, and among ads, ${topMedia.driver} was the largest` : ""}.`,
                )
              : tx("기여 분해 결과를 계산할 수 없어요.", "Can't compute the contribution breakdown.");
            const maxPct = Math.max(0.0001, ...shRows.map((r) => r.pct || 0));
            const barColor = (nm) => isMediaDrv(nm) ? "#7F77DD" : nm === "Seasonality" ? "#5DCAA5" : nm === "Industry Trend" ? "#a78bfa" : nm === "baseline" ? "var(--border-strong)" : "#85B7EB";
            const sat = displayedSaturationByChannel;
            const spendReferenceLabel = contributionViewStart || contributionViewEnd
              ? tx("선택 기간 평균 지출", "Selected-period avg. spend")
              : tx("최근 12주 평균 지출", "Last-12-week avg. spend");
            const spendLabel = (amount) => {
              const displayAmount = convAmt(amount);
              if (displayCurrency === "KRW") {
                if (locale === "en") return `₩${Math.round(displayAmount).toLocaleString("en-US")}`;
                return `${fmtCompact(Math.round(displayAmount))}원`;
              }
              return Math.abs(displayAmount) >= 1000
                ? `$${(displayAmount / 1000).toFixed(1)}k`
                : `$${displayAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
            };
            // 의사결정 step은 원본 통화 기준(KRW +₩1M, USD +$1k)으로 고정한다.
            // 화면 통화 토글은 라벨·표시값만 바꾸며 순위·구간 자체를 바꾸지 않는다.
            const marginalStepSource = sourceCurrency === "KRW" ? 1_000_000 : 1_000;
            const marginalStepLabel = spendLabel(marginalStepSource);
            const ranked = Object.values(sat)
              .map((s) => ({
                ...s,
                marginalDecision: s.incrementalAt(s.recentMean, marginalStepSource),
                incrementInObservedRange: s.isIncrementInObservedRange(s.recentMean, marginalStepSource),
              }))
              .map((s) => ({ ...s, curMarg: s.marginalDecision.mean, marginalCi: s.marginalDecision.ci }))
              .filter((s) => s.budgetEligible && s.incrementInObservedRange && s.curMarg > 0 && s.marginalCi?.[0] > 0)
              .sort((a, b) => b.curMarg - a.curMarg);
            const decisionCandidates = ranked.length ? [ranked[0], ...ranked.slice(1).filter((candidate) => (
              ranked[0].marginalCi[0] <= candidate.marginalCi[1]
              && candidate.marginalCi[0] <= ranked[0].marginalCi[1]
            ))] : [];
            const isRankingAmbiguous = decisionCandidates.length > 1;
            const budgetGateLabel = (reasons = []) => reasons.map((reason) => ({
              "high-collinearity": tx("매체 관련 공선", "media-linked collinearity"),
              "low-information": tx("전체 기간 정보 부족", "limited overall history"),
              "prior-scale-nonconvergence": tx("잔차분산-prior penalty 반복 미수렴", "residual-scale/prior-penalty iteration not converged"),
              "low-positive-probability": tx("양수 확률 80% 미만", "P(positive) below 80%"),
              // 게이트는 두 축이다 — 절대 주 수(20주)와 커버리지 비율(20%). 200주 패널에서
              // 25주는 주 수 하한을 넘지만 12.5%뿐이라 여전히 얇다(D-18). 한쪽만 적어 두면
              // 비율로 걸린 채널에서 화면이 틀린 이유를 말한다.
              "sparse-active-weeks": tx("집행 기간이 짧음 (20주 미만 또는 전체의 20% 미만)", "short flight (under 20 active weeks or under 20% of the window)"),
              "constant-spend": tx("지출 변동 부족", "insufficient spend variation"),
              "recently-inactive": tx("최근 8주 미집행", "inactive in the last 8 weeks"),
              "outside-observed-spend-range": tx("증액 후 지속 주간 노출이 관측 adstock 범위 밖", "sustained post-increment exposure exceeds observed adstock range"),
            }[reason] || reason)).join(" · ");
            const health = mmm.health || mmmBayesianHealth(mmm.run);
            const controlFitRows = mmmControlFitRows(mmm.panel, mmm.run);
            const identification = mmm.run.identification || {};
            const unresolvedCollinearity = (mmm.absorb?.notices || []).some((notice) => !notice.dropped);
            const budgetEligible = identification.budgetEligible !== false && !unresolvedCollinearity;
            const collinearPairKey = (pair) => `${pair.a}|${pair.b}`;
            const highCollinearPairs = (mmm.run.collinear_pairs || [])
              .filter((pair) => pair.a?.startsWith("media_") && pair.b?.startsWith("media_") && Math.abs(pair.corr) >= 0.9);
            const collinearPairDetail = (pair) => {
              if (!pair) return null;
              const channelKey = (featureName) => featureName.replace(/^media_/, "");
              const keys = [channelKey(pair.a), channelKey(pair.b)];
              const series = keys.map((key) => ({
                key,
                label: mmm.panel.channels?.find((channel) => channel.key === key)?.label || key,
                values: mmm.panel.ch?.[key] || [],
              }));
              const isImpression = keys.every((key) => /impressions?$/i.test(key));
              return { ...pair, key: collinearPairKey(pair), series, unitLabel: isImpression ? tx("노출수", "impressions") : tx("소진액", "spend") };
            };
            const selectedCollinearPair = collinearPairDetail(highCollinearPairs.find((pair) => collinearPairKey(pair) === selectedCollinearPairKey));
            const maxPriorShift = health?.priorShifts?.length
              ? Math.max(...health.priorShifts.map((item) => Math.abs(item.shiftZ || 0)))
              : null;
            const contributionIndexes = decomp?.weeks.map((_, index) => index).slice(contributionViewRange.start, contributionViewRange.end) || [];
            const contributionLabels = contributionIndexes.map((index) => String(mmm.panel.weekLabel?.[index] || decomp?.weeks[index]?.week || index + 1));
            const viewedDecomp = decomp ? {
              ...decomp,
              weeks: contributionIndexes.map((index) => decomp.weeks[index]),
            } : null;
            const viewedRun = sliceMmmRun(mmm.run, contributionViewRange.start, contributionViewRange.end);
            const viewedPanel = sliceMmmPanel(mmm.panel, contributionViewRange.end, contributionViewRange.start);
            const viewedWeeklyChannelPerformance = buildMmmWeeklyPerformance(viewedPanel, {
              ...viewedRun.channelContributions,
            });
            const spendTimelineKinds = ["brand", "perf"].filter((kind) => viewedPanel.channels?.some((channel) => channel.kind === kind));
            const effectiveSpendTimelineKind = spendTimelineKinds.includes(spendTimelineKind) ? spendTimelineKind : spendTimelineKinds[0];
            const spendTimelineChannels = (viewedPanel.channels || [])
              .filter((channel) => channel.kind === effectiveSpendTimelineKind)
              .map((channel) => ({ ...channel, values: viewedPanel.ch?.[channel.key] || [] }));
            // 음(−) 기여 알림 — 어떤 버킷이 특정 주에 성과를 크게 끌어내렸나. baseline(기본 수요)은 상수라 제외.
            const negAlert = (() => {
              if (!viewedDecomp || !viewedDecomp.weeks?.length) return null;
              let worst = null;
              viewedDecomp.weeks.forEach((w, i) => {
                const byB = {};
                viewedDecomp.groupNames.forEach((g) => { const b = decompBucketOf(g); byB[b] = (byB[b] || 0) + (w.contrib[g] || 0); });
                Object.entries(byB).forEach(([b, v]) => { if (v < 0 && (!worst || v < worst.val)) worst = { bucket: b, val: v, i }; });
              });
              const thr = -0.08 * Math.abs(viewedDecomp.baseline || 1);
              if (!worst || worst.val > thr) return null;
              const w = viewedDecomp.weeks[worst.i];
              let domG = null, domV = 0;
              viewedDecomp.groupNames.forEach((g) => { if (decompBucketOf(g) !== worst.bucket) return; const v = w.contrib[g] || 0; if (v < domV) { domV = v; domG = g; } });
              return { ...worst, domG, domV, lbl: w.week, bLabel: bucketMeta[worst.bucket]?.label || worst.bucket };
            })();
            const groupPanelPalette = {
              "기본 수요": "#94a3b8",
              Trend: "#c9c2c0",
              Seasonality: "#f4d877",
              "Holidays & Events": "#f4b366",
              "Regime change": "#bda593",
              "Industry Trend": "#a78bfa",
              Performance: "#df8392",
              Brand: "#d5df8e",
            };
            const groupPanels = viewedDecomp
              ? [
                  { key: "기본 수요", values: viewedDecomp.weeks.map((w) => w.baseline) },
                  ...viewedDecomp.groupNames.map((key) => ({ key, values: viewedDecomp.weeks.map((w) => w.contrib[key] || 0) })),
                ].filter((group) => (
                  group.key === "Seasonality"
                    ? isSeasonalitySelected
                    : group.values.some((value) => Math.abs(value) > 1e-8)
                )).map((g) => ({ ...g, label: plainDrv(g.key) }))
              : [];
            const hasCollinearityGroups = displayedCollinearityGroupRefit?.enabled
              || groupedWeeklyChannelPerformance.some((row) => row.isCollinearityGroup);
            const displayedWeeklyChannelPerformance = weeklyPerformanceView === "grouped" && hasCollinearityGroups
              ? buildMmmCollinearityGroupedPerformance(viewedPanel, viewedWeeklyChannelPerformance, mmm.run.collinear_pairs, 0.9, displayedCollinearityGroupRefit)
              : viewedWeeklyChannelPerformance;
            const seasonalityEvidence = mmm.run.seasonalitySelection?.evidence;
            const classicControlSelection = mmm.run.classicControlSelection;
            const classicControlText = classicControlSelection?.enabled
              ? classicControlSelection.overfitDetected
                ? tx(
                  `OOS WMAPE 과적합 방지: ${classicControlSelection.excluded.join("·")} 제외 · 선택 ${Number(classicControlSelection.selected.wmape).toFixed(1)}%`,
                  `OOS WMAPE overfit gate: dropped ${classicControlSelection.excluded.join(" · ")} · selected ${Number(classicControlSelection.selected.wmape).toFixed(1)}%`,
                )
                : tx(
                  `OOS WMAPE 검증: ${classicControlSelection.selected.id} 유지 · ${Number(classicControlSelection.selected.wmape).toFixed(1)}%`,
                  `OOS WMAPE check: retained ${classicControlSelection.selected.id} · ${Number(classicControlSelection.selected.wmape).toFixed(1)}%`,
                )
              : null;
            const seasonalityValidationText = mmm.run.seasonalitySelection?.enabled
              ? seasonalityEvidence?.detectionMode === "trend-direction-first-joint-allocation"
                ? tx(
                  "약 78주 저주파 곡선에서는 추세의 꺾임과 상승·하락 방향만 정하고 크기는 고정하지 않았습니다. 추세·부드러운 비즈니스 계절성·업계 현황·이벤트·광고 기여를 같은 모델에서 함께 추정했습니다. 계절성 없음·일반 Fourier 연간 반복 후보는 사용하지 않습니다.",
                  "The roughly 78-week low-frequency curve fixes only trend breakpoints and rising/falling directions, not magnitudes. Trend, smooth business seasonality, industry movement, events, and media are estimated together. No-season and generic annual Fourier candidates are not used.",
                )
                : seasonalityEvidence?.detectionMode === "joint-full-model-search"
                ? tx(
                  `${seasonalityEvidence.candidateCount}개 완성 모델에서 추세·계절·업계·모든 광고 채널을 함께 적합했습니다. ${seasonalityEvidence.folds}개 과거 구간 예측과 전체기간 설명력을 함께 비교해 ${mmm.run.seasonalitySelection.selected.id} 계절성을 선택했습니다.`,
                  `${seasonalityEvidence.candidateCount} complete models jointly fit trend, seasonality, industry, and every media channel. ${mmm.run.seasonalitySelection.selected.id} seasonality was selected using ${seasonalityEvidence.folds} historical forecast folds plus full-history fit evidence.`,
                )
                : seasonalityEvidence?.detectionMode === "rolling-rescue"
                ? tx(
                  `BIC만으로는 연간 파형이 탈락했지만, ${seasonalityEvidence.rollingRescue.folds}개 순방향 검증에서 오차가 ${Number(seasonalityEvidence.rollingRescue.noneWmape).toFixed(3)}% → ${Number(seasonalityEvidence.rollingRescue.selectedWmape).toFixed(3)}%로 ${Number(seasonalityEvidence.rollingRescue.relativeImprovement * 100).toFixed(1)}% 개선되어 계절성을 복원했습니다.`,
                  `BIC alone rejected the annual shape, but ${seasonalityEvidence.rollingRescue.folds} forward-validation folds improved error from ${Number(seasonalityEvidence.rollingRescue.noneWmape).toFixed(3)}% to ${Number(seasonalityEvidence.rollingRescue.selectedWmape).toFixed(3)}% (${Number(seasonalityEvidence.rollingRescue.relativeImprovement * 100).toFixed(1)}%), so seasonality was restored.`,
                )
                : seasonalityEvidence?.detected
                  ? tx(
                    `전체 ${seasonalityEvidence.observedWeeks}주에서 매체·이벤트·추세를 통제한 뒤 연간 파형의 BIC가 ${Number(seasonalityEvidence.bicImprovement).toFixed(1)} 개선되고 52주 파형 상관이 ${Number(seasonalityEvidence.seasonalLagCorrelation).toFixed(2)}로 유지되어 계절성을 사용했습니다.`,
                    `Across all ${seasonalityEvidence.observedWeeks} weeks, the annual shape improved BIC by ${Number(seasonalityEvidence.bicImprovement).toFixed(1)} after controlling for media, events, and trend, with ${Number(seasonalityEvidence.seasonalLagCorrelation).toFixed(2)} 52-week shape correlation, so seasonality was retained.`,
                  )
                  : tx(
                    "BIC와 순방향 검증 모두 계절성 사용 기준을 넘지 못해 이번 데이터에서는 계절성을 사용하지 않았습니다.",
                    "Neither BIC nor forward validation cleared the seasonality threshold, so seasonality was not used for this data.",
                  )
              : mmm.run.seasonalityPeriods?.length
                ? tx(
                  `현재 ${mmm.panel.week.length}주 이력은 자동 판정 최소 기간보다 짧아 설정된 연간 계절성을 유지했습니다.`,
                  `The current ${mmm.panel.week.length}-week history is shorter than the automatic-selection minimum, so configured annual seasonality was retained.`,
                )
                : "";
            return (
            <>
              <WebRMmmAdvanced
                mmm={mmm}
                signature={`${mmmAnalyzedSig}|${target}|${mmmMode}|${bayesianUsePrior ? 1 : 0}`}
                locale={locale}
                source={isDemo ? "demo" : csvData?.importSource || "csv"}
                currency={sourceCurrency}
                selectedModel={mmmResultModel}
                onSelectModel={setMmmResultModel}
              />
              {mmmResultModel === "bayesian" ? (
                <div className="mmm-result-flow mmm-result-flow--bayesian" data-mmm-result-model="bayesian">
                <section className="mmm-result-step" data-mmm-flow-step="fit" aria-labelledby="mmm-bayesian-fit-title">
                  <div className="mmm-result-step__head">
                    <span>01</span>
                    <div>
                      <h3 id="mmm-bayesian-fit-title">{tx("실제 성과를 얼마나 설명했나", "How much of actual performance did the model explain?")}</h3>
                      <p>{tx("실제값과 학습기간 적합값을 먼저 확인하고, 보지 않은 미래 구간은 시간순 OOS 오차로 따로 판단합니다.", "Compare actuals with the in-sample fitted series first, then judge unseen future windows separately with time-ordered OOS error.")}</p>
                    </div>
                  </div>
                  {dateScopedDecomp ? <>
                    <div className="mmm-metric-grid">
                      <div className="mmm-metric-card"><small>{tx("학습 WMAPE", "Training WMAPE")}</small><strong>{Number.isFinite(health?.wmape) ? `${health.wmape.toFixed(1)}%` : "—"}</strong><em className={`mmm-fit-grade is-${fitGrade(health?.wmape).tone}`}>{tx(fitGrade(health?.wmape).ko, fitGrade(health?.wmape).en)}</em></div>
                      <div className="mmm-metric-card is-primary"><small>{tx("시간순 OOS WMAPE", "Time-ordered OOS WMAPE")}</small><strong>{Number.isFinite(health?.oos?.wmape) ? `${health.oos.wmape.toFixed(1)}%` : "—"}</strong><em className={`mmm-fit-grade is-${fitGrade(health?.oos?.wmape).tone}`}>{tx(fitGrade(health?.oos?.wmape).ko, fitGrade(health?.oos?.wmape).en)}</em></div>
                      <div className="mmm-metric-card"><small>{tx("RMSE", "RMSE")}</small><strong>{targetValueLabel(dateScopedDecomp.rmse)}</strong></div>
                      <div className="mmm-metric-card"><small>{tx("모델 경고", "Model warnings")}</small><strong>{health?.flags?.length || 0}</strong><em>{budgetEligible ? tx("예산 판단 가능", "Budget decision allowed") : tx("예산 판단 보류", "Budget decision held")}</em></div>
                    </div>
                    <div className="chart-container mmm-result-chart"><canvas ref={fitRef}></canvas></div>
                    {isFitInverted(health?.wmape, health?.oos?.wmape) && (
                      <div className="callout warn" role="note"><div className="ico">!</div><div className="body">
                        <strong>{tx("학습 오차가 미래 구간 오차보다 큽니다", "Training error is larger than out-of-sample error")}</strong>
                        <p>{tx("보통은 학습 구간을 더 잘 맞춥니다. 순서가 뒤집혔다면 적합값 자체가 어긋났을 가능성이 있으니, 이 결과로 예산을 옮기기 전에 매핑과 기간을 다시 확인하세요.", "A model usually fits the training window better. When the order flips, the fitted values themselves may be off — recheck the mapping and period before moving budget on this result.")}</p>
                      </div></div>
                    )}
                    <p className="mmm-result-note">{tx("학습 적합도는 과거 설명력이고 OOS 오차는 미래 구간 예측력입니다. 어느 지표도 채널의 인과효과를 확정하지 않습니다.", "Training fit describes historical explanation; OOS error measures future-window prediction. Neither identifies a channel's causal effect.")}</p>
                  </> : <div className="required-banner"><p>{tx("실제값과 적합값을 계산할 수 없습니다.", "Actual and fitted values are unavailable.")}</p></div>}
                </section>

                <details className="mmm-result-details mmm-bayesian-expert" data-mmm-flow-step="expert" onToggle={onAccordionToggle}>
                  <summary>{tx("외부 근거·모델 건강·자동 선택 상세", "External evidence, model health, and automatic-selection details")}</summary>
                <MmmEvidenceLedger
                  locale={locale}
                  selectedEvidence={selectedEvidence}
                  onToggleEvidence={(kind) => deferMmmUpdate(() => setSelectedEvidence((current) => ({ ...current, [kind]: !current[kind] })))}
                  evidence={priorEvidence}
                  onEvidence={(update) => deferMmmUpdate(() => setPriorEvidence(update))}
                  onLoadDemo={handleLoadPriorDemo}
                  appliedPriorCount={Object.keys(mmm.mediaPriors || {}).length}
                  experimentPriorDiagnostics={mmm.experimentPriorDiagnostics || []}
                  countryCandidates={mmm.countryCandidates || []}
                  countryIndividualCandidates={mmm.countryIndividualCandidates || []}
                  countryBacktests={mmm.countryBacktests}
                  countryPlan={mmm.countryPlan}
                  formatValue={targetValueLabel}
                />
              {(mmm.run.trendDecomposition || mmm.run.penaltyAudit || mmm.run.dataQuality || classicControlText) && (
                <Card style={{ marginBottom: "12px", padding: "12px 16px" }}>
                  <strong>{tx("추세·모델 공정성 진단", "Trend and model fairness diagnostics")}</strong>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                    {mmm.run.trendDecomposition && <>
                      <span className="ab-pill">{tx("절편 합계", "Intercept total")} {targetValueLabel(mmm.run.trendDecomposition.totals.intercept)}</span>
                      <span className="ab-pill">{tx("순수 추세", "Pure trend")} {targetValueLabel(mmm.run.trendDecomposition.totals.pureTrend)}</span>
                      <span className="ab-pill">{tx("Trend sink", "Trend sink")} {targetValueLabel(mmm.run.trendDecomposition.totals.trendSink)}</span>
                    </>}
                    {mmm.run.penaltyAudit && <span className="ab-pill" style={mmm.run.penaltyAudit.symmetricWithControl ? undefined : { borderColor: "var(--warning)", color: "var(--warning)" }}>
                      {tx("Penalty", "Penalty")} {mmm.run.penaltyAudit.profile} · {mmm.run.penaltyAudit.symmetricWithControl ? tx("대칭", "symmetric") : tx("비대칭 점검", "asymmetry check")}
                    </span>}
                    {classicControlText && <span className="ab-pill" title={tx("시즈널리티·업황 후보를 동일한 시간순 OOS WMAPE로 비교한 결과입니다.", "Seasonality and industry candidates were compared using the same time-ordered OOS WMAPE.")}>{classicControlText}</span>}
                    {mmm.run.dataQuality && <span className="ab-pill" style={!mmm.run.dataQuality.valid ? { borderColor: "var(--danger)", color: "var(--danger)" } : undefined}>
                      {tx("데이터 품질", "Data quality")} {mmm.run.dataQuality.valid ? tx("통과", "pass") : `${mmm.run.dataQuality.issues.length} ${tx("건 경고", "warning(s)")}`}
                    </span>}
                  </div>
                  <p className="muted" style={{ fontSize: "11px", lineHeight: 1.5, margin: "8px 0 0" }}>
                    {tx("절편·순수 추세·미분류 Trend sink를 분리해 장기 하락을 광고 효과로 자동 전가하지 않습니다. Trend sink는 식별되지 않은 기준선 성분이며 광고 기여로 해석하지 않습니다.", "Intercept, pure trend, and unclassified trend sink are separated so long-term decline is not automatically transferred to media. Trend sink is an unidentified baseline component, not media contribution.")}
                  </p>
                </Card>
              )}
              {mmm.modelMode !== "classic" && (selectedEvidence.experiment || selectedEvidence.country) && (
                <div className="callout" style={{ marginBottom: "12px" }}>
                  <div className="ico">i</div><div className="body"><strong>{Object.keys(mmm.heldMediaPriors || {}).length
                    ? tx(`채널 prior ${Object.keys(mmm.heldMediaPriors).length}개 적용 보류`, `${Object.keys(mmm.heldMediaPriors).length} channel prior(s) held`)
                    : tx(`${tgtKo}에 일치하는 prior 없음`, `No matching prior for ${tgtKo}`)}</strong><p>{Object.keys(mmm.heldMediaPriors || {}).length
                    ? tx("채널 단위 계수를 Performance·Branding 합산 feature의 계수로 직접 바꾸면 단위가 달라집니다. 그룹 prior 변환 규칙이 생기기 전까지 근거는 보존하되 모델에는 적용하지 않습니다.", "A channel coefficient cannot be directly converted to the aggregated Performance/Branding feature without changing units. Evidence is preserved but not applied until a valid group-prior conversion is defined.")
                    : tx("이 목표에는 기본 MMM만 사용합니다.", "This target continues to use the base MMM.")}</p></div>
                </div>
              )}
              {health && (
                <section className="mmm-bayesian-health-detail" aria-label={tx("모델 건강 진단", "Model health diagnostics")}>
                  <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>{tx("모델 건강", "Model health")} <span style={{ fontSize: "12px", color: MUTED, fontWeight: 400 }}>{tx(`예측 오차 ${Number.isFinite(health.oos?.wmape) ? `${health.oos.wmape.toFixed(1)}%` : "—"} · 경고 ${health.flags?.length || 0}건`, `Forecast error ${Number.isFinite(health.oos?.wmape) ? `${health.oos.wmape.toFixed(1)}%` : "—"} · ${health.flags?.length || 0} warnings`)}</span><HelpTip label={tx("모델 건강 지표 설명", "About model health metrics")}>{tx(`전문: 전체 wMAPE·시간순 검증 오차·잔차 상관·VIF·채널 상관·계절성 후보·사전분포 이동을 함께 점검합니다.\n쉬운 말: 전체 예측은 맞아도 함께 움직이는 채널은 각자 몫을 정확히 나누기 어렵습니다. 이 값들은 전체 학습 기간 기준입니다.`, `Technical: checks fit error, time-ordered validation, residual correlation, VIF, channel correlation, seasonality candidates, and prior shifts.\nPlain: even a good overall forecast cannot cleanly separate channels that move together. These checks use the full training period.`)}</HelpTip></h2>
                  <div style={{ display: "none", gap: "10px", flexWrap: "wrap" }}>
                    <div className="stat-card"><div className="lbl">{tx("전체 wMAPE", "In-sample wMAPE")}</div><div className="val">{Number.isFinite(health.wmape) ? `${health.wmape.toFixed(1)}%` : "—"}</div></div>
                    <div className="stat-card"><div className="lbl">{tx("시간순 OOS wMAPE", "Time-ordered OOS wMAPE")}</div><div className="val">{Number.isFinite(health.oos?.wmape) ? `${health.oos.wmape.toFixed(1)}%` : "—"}</div></div>
                    <div className="stat-card"><div className="lbl">{tx("90% 범위 포함률", "90% interval coverage")}</div><div className="val">{Number.isFinite(health.coverage90) ? `${(health.coverage90 * 100).toFixed(0)}%` : "—"}</div></div>
                    <div className="stat-card"><div className="lbl">{tx("잔차 ACF(1주)", "Residual ACF (lag 1)")}</div><div className="val">{Number.isFinite(health.residualAcf1) ? health.residualAcf1.toFixed(2) : "—"}</div></div>
                    <div className="stat-card"><div className="lbl">{tx("음수 자연수요 주", "Negative natural-demand weeks")}</div><div className="val">{Number.isFinite(health.negativeBaselineShare) ? `${(health.negativeBaselineShare * 100).toFixed(0)}%` : "—"}</div></div>
                    <div className="stat-card"><div className="lbl">{tx("최대 prior 이동", "Largest prior shift")}</div><div className="val">{Number.isFinite(maxPriorShift) ? `${maxPriorShift.toFixed(1)} SD` : tx("prior 없음", "No prior")}</div></div>
                    {Number.isFinite(identification.weeksPerParameter) && <div className="stat-card"><div className="lbl">{tx("파라미터당 주", "Weeks per parameter")}</div><div className="val">{identification.weeksPerParameter.toFixed(1)}</div></div>}
                    {Number.isFinite(identification.maxMediaVif) && <div className="stat-card"><div className="lbl">{tx("최대 매체 VIF", "Max media VIF")}</div><div className="val">{identification.maxMediaVif.toFixed(2)}</div></div>}
                    {Number.isFinite(identification.maxMediaCorrelation) && <div className="stat-card"><div className="lbl">{tx("검출된 공선쌍 최대 상관", "Max detected collinear-pair corr.")}</div><div className="val">{identification.maxMediaCorrelation > 0 ? identification.maxMediaCorrelation.toFixed(2) : tx("검출 없음", "None")}</div></div>}
                    {mmm.run.baselineSelection?.enabled && <div className="stat-card"><div className="lbl">{tx("Baseline 후보", "Baseline candidates")}</div><div className="val">{mmm.run.baselineSelection.selected ? tx("Knot 적용", "Knot selected") : tx("기본 유지", "Base retained")}</div></div>}
                    {Array.isArray(mmm.run.seasonalityPeriods) && <div className="stat-card"><div className="lbl">{tx("계절성", "Seasonality")}</div><div className="val">{mmm.run.seasonalityPeriods.length
                      ? (mmm.run.seasonalityBasis?.type === "observed-business"
                        ? tx(`실제 연도 반복 ${mmm.run.seasonalityBasis.yearCount || "—"}개`, `Observed business shape · ${mmm.run.seasonalityBasis.yearCount || "—"} years`)
                        : (mmm.run.seasonalitySelection?.enabled ? mmm.run.seasonalitySelection.selected.id : tx(`연간 ${mmm.run.seasonalityPeriods.length}차`, `Annual ${mmm.run.seasonalityPeriods.length}`)))
                      : tx("미사용", "Off")}</div></div>}
                    {mmm.run.mediaPenaltySelection?.enabled && <div className="stat-card"><div className="lbl">{tx("매체 규제 자동선택", "Media regularization")}</div><div className="val">{mmm.run.mediaPenaltySelection.selected.mediaPenalty.toFixed(2)}</div></div>}
                    {mmm.run.businessContributionPrior?.enabled && <div className="stat-card"><div className="lbl">{tx("비즈니스 기여 prior", "Business contribution prior")}</div><div className="val">{Math.round(mmm.run.businessContributionPrior.meanShare * 100)}% ± {Math.round(mmm.run.businessContributionPrior.shareSd * 100)}%p</div></div>}
                    {mmm.run.jointTransform?.enabled && <div className="stat-card"><div className="lbl">{tx("결합 변환 posterior", "Joint transform posterior")}</div><div className="val">{mmm.run.jointTransform.evaluatedCount}/{mmm.run.jointTransform.candidateCount}</div></div>}
                  </div>
                  {(mmm.run.baselineSelection?.enabled || Array.isArray(mmm.run.seasonalityPeriods) || mmm.run.mediaPenaltySelection?.enabled || mmm.run.jointTransform?.enabled) && <details style={{ display: "none", margin: "8px 0 0" }}>
                    <summary className="muted" style={{ fontSize: "11px", cursor: "pointer" }}>ⓘ {tx("자동 검증 상세", "Automatic validation details")}</summary>
                    <p className="muted" style={{ fontSize: "11px", lineHeight: 1.5, margin: "6px 0 0" }}>
                    {mmm.run.baselineSelection?.enabled ? tx(`Baseline은 78주 이상 데이터에서 0·1·2개 knot 후보를 비교했으며, BIC가 ${mmm.run.baselineSelection.selected ? "충분히 개선되어 적용" : "충분히 개선되지 않아 기본 추세 유지"}되었습니다.`, `With at least 78 weeks, baseline compared 0/1/2-knot candidates; the base trend was ${mmm.run.baselineSelection.selected ? "replaced because BIC improved materially" : "retained because improvement was not material"}.`) : ""}
                    {seasonalityValidationText ? ` ${seasonalityValidationText}` : ""}
                    {mmm.run.mediaPenaltySelection?.enabled ? ` ${tx(`매체 계수 규제는 최근 ${mmm.run.mediaPenaltySelection.selected.folds}개 12주 구간을 당시 실제 지출로 순방향 검증해 ${mmm.run.mediaPenaltySelection.selected.mediaPenalty.toFixed(2)}를 선택했습니다. 최저 오차와 사실상 동률이면 더 보수적인 값을 유지하므로, 기여를 크게 보이게 하려고 낮춘 값이 아닙니다.`, `Media regularization was selected as ${mmm.run.mediaPenaltySelection.selected.mediaPenalty.toFixed(2)} using forward validation across ${mmm.run.mediaPenaltySelection.selected.folds} recent 12-week windows with actual spend. Near ties retain the more conservative value, so this is not tuned to inflate contribution.`)}` : ""}
                    {mmm.run.jointTransform?.enabled ? ` ${tx(`변환 불확실성이 큰 ${mmm.run.jointTransform.channels.length}개 채널은 ${mmm.run.jointTransform.candidateCount}개 조합을 함께 적합해 기여 구간에 반영했습니다. 점추정의 합계는 주간 분해와 맞추고, 조합이 엇갈릴수록 범위를 넓힙니다.`, `${mmm.run.jointTransform.channels.length} channels with the largest transform uncertainty were jointly fit across ${mmm.run.jointTransform.candidateCount} combinations and incorporated into contribution intervals. Point-estimate totals stay reconciled with weekly decomposition, while disagreement widens the range.`)}` : ""}
                    </p>
                  </details>}
                  {health.flags?.length > 0 ? (
                    <div
                      className="callout warn mmm-health-warning"
                      style={{ margin: "10px 0 0", padding: "8px 10px" }}
                      onMouseEnter={() => setIsHealthWarningOpen(true)}
                      onMouseLeave={() => setIsHealthWarningOpen(false)}
                      onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setIsHealthWarningOpen(false);
                      }}
                    >
                      <button
                        type="button"
                        className="mmm-health-warning__button"
                        aria-expanded={isHealthWarningOpen}
                        aria-controls="mmm-health-warning-detail"
                        onFocus={() => setIsHealthWarningOpen(true)}
                        onClick={() => setIsHealthWarningOpen((current) => !current)}
                        title={tx("모델 경고 자세히 보기", "Show model warning details")}
                      >
                        !
                      </button>
                      <div className="body">
                        <strong>{tx(`모델 경고 ${health.flags.length}건`, `${health.flags.length} model warnings`)}</strong>
                        <span className="mmm-health-warning__hint">{tx("아이콘을 누르거나 올리면 상세 내용이 열립니다.", "Click or hover the icon to see details.")}</span>
                        {isHealthWarningOpen && (
                          <div id="mmm-health-warning-detail" className="mmm-health-warning__detail" role="status">
                            <ul>
                              {health.flags.map((flag) => <li key={`${flag.key}-${flag.severity}`}><b>{flag.severity === "fail" ? tx("주의", "High") : tx("점검", "Check")}</b> · {mmmHealthFlagMessage(flag.key, locale)}</li>)}
                            </ul>
                            <p>{tx("쉽게 말하면: 함께 움직이는 채널은 각 채널의 성과를 정확히 따로 나누기 어렵다는 뜻입니다.", "Plainly: when channels move together, it is harder to separate each channel's individual performance precisely.")}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : <p style={{ margin: "10px 0 0", color: "var(--success)", fontSize: "11.5px" }}>{tx("현재 자동 건강 진단에서 추가 경고가 발견되지 않았습니다.", "No additional warnings were found by the automated health checks.")}</p>}
                  <p className="muted" style={{ display: "none", fontSize: "11px", lineHeight: 1.55, margin: "10px 0 0" }}>
                    {tx("이 모델은 Gaussian posterior를 행렬식으로 계산하고 MCMC chain을 샘플링하지 않으므로 R-hat·ESS는 적용되지 않습니다. 이는 Meridian의 NUTS 샘플링 진단과 같은 검사가 아닙니다.", "This model computes a Gaussian posterior analytically and does not sample MCMC chains, so R-hat and ESS do not apply. This is not the same diagnostic as Meridian's NUTS sampling checks.")}
                    {mmm.countryValidationMode === "as-of-earliest-fold" ? ` ${tx("국가 prior 후보 검증은 가장 이른 학습 cutoff의 타깃 변환·Y 스케일·참고국 근거를 모든 fold에 고정합니다. 이후 정보 누수는 막지만, 같은 folds로 후보를 골랐으므로 최종 독립 OOS는 아닙니다.", "Country-prior candidate checks lock target transforms, Y scale, and reference evidence from the earliest training cutoff across every fold. This prevents later-information leakage, but the folds also select the candidate and are therefore not a final independent OOS score.")}` : ""}
                    {mmm.countryPlan?.capped ? ` ${tx(`브라우저 안정성을 위해 ${mmm.countryPlan.totalCountries}개 중 최대 ${mmm.countryPlan.maxReferenceFits}개 참고 국가만 1차 적합했습니다.`, `For browser stability, first-stage fits were capped at ${mmm.countryPlan.maxReferenceFits} of ${mmm.countryPlan.totalCountries} reference markets.`)}` : ""}
                  </p>
                </section>
              )}
                </details>
              {/* ── 메인: 무엇이 성과를 움직였나 — RMS 기여 크기 비중 ── */}
              <section className="mmm-result-step" data-mmm-flow-step="drivers" aria-labelledby="mmm-bayesian-driver-title">
                <div className="mmm-result-step__head">
                  <span>02</span>
                  <div>
                    <h3 id="mmm-bayesian-driver-title">{tx("무엇이 성과를 설명했나", "What explained performance?")}</h3>
                    <p>{headline}</p>
                  </div>
                </div>
                {controlFitRows.length > 0 && (
                  <details className="mmm-result-note" data-mmm-control-fit>
                    <summary>{tx(`연속형 컨트롤 ${controlFitRows.length}개 적용 상태`, `${controlFitRows.length} continuous-control status`)}</summary>
                    <p>{tx(
                      "컨트롤은 평소 대비 상대 변화로 바꿔 광고와 함께 추정합니다. 관측된 연관을 조정하는 변수이며 인과효과를 보장하지 않습니다. 채널 기여·ROAS·예산 추천에는 포함하지 않습니다.",
                      "Controls are converted to change relative to their typical level and estimated jointly with media. They adjust observed associations but do not prove causality, and are excluded from channel contribution, ROAS, and budget recommendations.",
                    )}</p>
                    <MmmControlFitTable rows={controlFitRows} locale={locale} />
                  </details>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                  <strong className="mmm-result-subtitle">{tx("주별 기여 크기", "Weekly contribution magnitude")}</strong>
                  <PillGroup
                    style={{ margin: 0 }}
                    ariaLabel={tx("기본 수요·추세 포함 여부", "Include base demand and trend")}
                    label={tx("기본 수요·추세", "Base demand · trend")}
                    value={includeBaseDemandInShare ? "include" : "exclude"}
                    onChange={(next) => setIncludeBaseDemandInShare(next === "include")}
                    options={[
                      { value: "include", label: tx("포함", "Include") },
                      { value: "exclude", label: tx("제외", "Exclude") },
                    ]}
                  />
                </div>
                {shRows.length ? (
                  // 단일 grid — 라벨 열 폭을 전 행 공유(max-content)해 가장 긴 변수명에 맞춰 정렬, 막대 시작점 일치.
                  <div style={{ display: "grid", gridTemplateColumns: "max-content 1fr 44px", alignItems: "center", columnGap: "10px", rowGap: "8px", marginTop: "6px" }}>
                    {shRows.map((r) => (
                      <React.Fragment key={r.driver}>
                        <span style={{ fontSize: "12.5px", textAlign: "left", color: "var(--text-1)", whiteSpace: "nowrap" }} title={r.driver}>{plainDrv(r.driver)}</span>
                        <div style={{ background: "var(--bg-1)", borderRadius: "6px", height: "20px", minWidth: 0 }}>
                          <div style={{ width: `${Math.round((r.pct || 0) / maxPct * 100)}%`, minWidth: "2px", background: barColor(r.driver), height: "100%", borderRadius: "6px" }}></div>
                        </div>
                        <span style={{ fontSize: "12.5px", fontWeight: 600, textAlign: "right" }}>{(r.pct || 0).toFixed(0)}%</span>
                      </React.Fragment>
                    ))}
                  </div>
                ) : <p className="muted" style={{ fontSize: "12px" }}>{tx("계산할 수 없어요.", "Can't compute this.")}</p>}
                    <HelpTip label={tx("기여도 차트 해석 도움말", "Contribution-chart interpretation help")}>
                      {includeBaseDemandInShare
                        ? tx("각 드라이버의 주별 기여값 제곱평균을 전체 합으로 나눈 크기 비중입니다. 인과 기여율이나 Shapley R²가 아니며, 진한 보라는 광고 채널입니다.", "Each share is the driver's mean squared weekly contribution divided by the total. It is not causal attribution or Shapley R². Dark purple marks ad channels.")
                        : tx("기본 수요·추세를 분모와 표시에서 제외하고, 남은 드라이버만 다시 100%로 정규화했습니다. 모델과 원본 기여값은 바뀌지 않습니다.", "Base demand · trend is removed from both the display and denominator; remaining drivers are re-normalized to 100%. The model and raw contributions do not change.")}
                    </HelpTip>
              </section>

              <section className="mmm-result-step" data-mmm-flow-step="coefficients" aria-labelledby="mmm-bayesian-coef-title">
                <div className="mmm-result-step__head">
                  <span>03</span>
                  <div>
                    <h3 id="mmm-bayesian-coef-title">{tx("채널 효과는 검증에서도 유지됐나", "Did channel effects persist across validation?")}</h3>
                    <p>{tx("효과 방향과 90% profile 혼합 구간을 함께 봅니다. 이 범위는 모델 불확실성이며 홀드아웃 전 인과효과 확정이 아닙니다.", "Review effect direction with its 90% profile-mixture interval. This is model uncertainty, not causal proof before a holdout.")}</p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="data mmm-webr-table">
                    <thead><tr><th>{tx("채널", "Channel")}</th><th className="tnum">{tx("양수 확률", "P(positive)")}</th><th className="tnum">{tx("효과 크기", "Effect size")}</th><th className="tnum">{tx("90% 범위", "90% range")}</th><th>{tx("예산 사용", "Budget use")}</th></tr></thead>
                    <tbody>{Object.values(sat).map((channel) => {
                      const marginal = channel.incrementalAt(channel.recentMean, marginalStepSource);
                      const inObservedRange = channel.isIncrementInObservedRange(channel.recentMean, marginalStepSource);
                      const useBudget = budgetEligible && channel.budgetEligible && inObservedRange && marginal?.ci?.[0] > 0;
                      return <tr key={channel.key}>
                        <td><strong>{channel.label}</strong></td>
                        <td className="tnum">{fmtOne(channel.posteriorPositive * 100)}%</td>
                        <td className="tnum">{targetValueLabel(channel.ln_coef, { decimals: 1 })}</td>
                        <td className="tnum">{targetValueLabel(channel.ci?.[0], { decimals: 1 })}–{targetValueLabel(channel.ci?.[1], { decimals: 1 })}</td>
                        <td><strong className={useBudget ? "mmm-gate-pass" : "muted"}>{useBudget ? tx("통과", "Pass") : tx("보류", "Hold")}</strong>{!useBudget && <small className="muted" style={{ display: "block" }}>{budgetGateLabel([...(channel.budgetGateReasons || []), ...(!inObservedRange ? ["outside-observed-spend-range"] : []), ...(marginal?.ci?.[0] <= 0 ? [tx("한계효과 구간 0 포함", "marginal interval crosses 0")] : [])])}</small>}</td>
                      </tr>;
                    })}</tbody>
                  </table>
                </div>
              </section>

              {/* ── 메인: 다음 예산은 여기로 (액션 카드) ── */}
              <section className="mmm-result-step" data-mmm-flow-step="decision" aria-labelledby="mmm-bayesian-decision-title">
                <div className="mmm-result-step__head">
                  <span>05</span>
                  <div>
                    <h3 id="mmm-bayesian-decision-title">{tx("예산 변경을 추천해도 안전한가", "Is a budget change safe enough to recommend?")}</h3>
                    <p>{tx("식별·집행 이력·지출 변동·관측 범위·한계효과 구간을 모두 통과한 채널만 후보로 남깁니다.", "Only channels that pass identification, activity, spend variation, observed-range, and marginal-effect checks remain eligible.")}</p>
                  </div>
                </div>
              {!budgetEligible ? (
                <div className="callout warn">
                  <div className="ico">!</div><div className="body"><strong>{identification.priorScaleConverged === false
                    ? tx("예산 추천 보류 — 잔차분산·prior penalty 반복이 수렴하지 않았습니다", "Budget recommendation paused — residual-scale/prior-penalty iteration did not converge")
                    : tx("예산 추천 보류 — 채널 효과가 식별되지 않았습니다", "Budget recommendation paused — channel effects are not identified")}</strong><p>{unresolvedCollinearity
                    ? tx("채널 지출과 구조변화가 거의 같이 움직이지만 어느 변수를 제거할지 지정되지 않았습니다. 앱은 임의로 제거하지 않으며, 독립적인 지출 변동 또는 실험 근거가 필요합니다.", "Channel spend and a regime-change variable move almost identically, but no variable was chosen for removal. The app does not remove one arbitrarily; independent spend variation or experimental evidence is needed.")
                    : identification.priorScaleConverged === false
                      ? tx("잔차분산과 외부 prior penalty가 서로 의존해 고정점으로 반복 계산했지만 안정값에 도달하지 못했습니다. 아래 효과·반응곡선은 진단용으로만 보고 예산 순위에는 쓰지 마세요.", "The fixed-point iteration between residual variance and external-prior penalty did not reach a stable value. Treat the effects and response curves below as diagnostic only, not as a budget ranking.")
                      : tx("기간 대비 파라미터가 많거나 채널 간 상관이 높아 예산 순위를 신뢰하기 어렵습니다. 아래 반응곡선은 진단용으로만 보세요.", "There are too many parameters for the time span or media correlation is too high to trust a budget ranking. Treat the response curves below as diagnostic only.")}</p></div>
                </div>
              ) : ranked.length > 0 ? (
                <div className="mmm-budget-decision">
                  <h4>{isRankingAmbiguous
                    ? tx("🎯 증액 후보군 — 우열 불명확", "🎯 Increase candidates — no clear winner")
                    : tx("🎯 다음 예산 우선 후보", "🎯 First candidate for the next budget")}</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {decisionCandidates.map((s, i) => (
                      <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: !isRankingAmbiguous && i === 0 ? "rgba(122,162,247,0.1)" : "transparent", borderRadius: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "15px", fontWeight: 700, color: !isRankingAmbiguous && i === 0 ? "#7aa2f7" : MUTED, minWidth: "20px" }}>{isRankingAmbiguous ? "•" : i + 1}</span>
                        <span style={{ flex: 1, fontSize: "14px", fontWeight: !isRankingAmbiguous && i === 0 ? 700 : 400 }}>{s.label}</span>
                        <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--success)" }}>{targetValueLabel(s.curMarg, { sign: true })} <small style={{ color: MUTED, fontWeight: 400 }}>[{targetValueLabel(s.marginalCi[0])} ~ {targetValueLabel(s.marginalCi[1])}]</small></span>
                        <span style={{ fontSize: "12px", color: MUTED }}>{spendReferenceLabel} {spendLabel(s.recentMean || 0)}/주</span>
                      </div>
                    ))}
                  </div>
                  {ranked.length > decisionCandidates.length && <p className="muted" style={{ fontSize: "11px", margin: "6px 0 0" }}>{tx(`그 외 gate 통과 채널 ${ranked.length - decisionCandidates.length}개는 상위 후보와 구간이 겹치지 않아 우선 후보군에서 제외했습니다.`, `${ranked.length - decisionCandidates.length} other gate-passing channel(s) do not overlap the top interval and are excluded from the first-priority candidate set.`)}</p>}
                  <p className="muted" style={{ fontSize: "11px", marginTop: "8px" }}>{isRankingAmbiguous
                    ? tx("상위 후보들의 90% 한계효과 구간이 겹쳐 단일 1위를 정하지 않았습니다. 후보군을 유지하고 추가 실험으로 구분하세요.", "Top candidates have overlapping 90% marginal-effect intervals, so no single winner is declared. Keep the candidate set and distinguish it with an additional experiment.")
                    : tx("양수 확률·채널별 데이터 충분성·식별 gate를 통과하고 90% 한계효과 구간도 0보다 큰 후보입니다. 관측 회귀 기반 가설이므로 점진적으로 변경하고 홀드아웃으로 확인하세요.", "This candidate passes positive-probability, channel-data, and identification gates, and its 90% marginal-effect interval stays above zero. It remains an observational hypothesis; change gradually and confirm with a holdout.")}</p>
                </div>
              ) : (
                <div className="callout warn" style={{ marginBottom: "12px" }}>
                  <div className="ico">!</div><div className="body"><strong>{tx("예산 추천 보류 — 채널별 근거가 부족합니다", "Budget recommendation paused — channel-level evidence is insufficient")}</strong><p>{tx("효과 양수 확률, 최근 20주 이상 집행, 지출 변동, 최근 활동, 변환된 관측 노출 범위, 90% 한계효과 구간을 모두 통과한 채널이 없습니다. 점추정 순위를 액션으로 사용하지 마세요.", "No channel passes all gates for positive probability, at least 20 active weeks, spend variation, recent activity, transformed observed-exposure range, and a 90% marginal-effect interval above zero. Do not turn point-estimate rankings into action.")}</p></div>
                </div>
              )}
              </section>

              {/* 기간 전체에서 실제로 집행된 주만 평균낸 채널별 모델 성과 — 전문가 상세. */}
              {displayedWeeklyChannelPerformance.length > 0 && (
                <details className="mmm-result-details mmm-bayesian-expert" data-mmm-flow-step="allocation" onToggle={onAccordionToggle}>
                  <summary>{tx("채널별 배분·공선성·집행 시점 상세", "Channel allocation, collinearity, and spend-timing details")}</summary>
                <section className="mmm-weekly-performance" id="s-mmm-weekly-performance">
                  <div className="mmm-weekly-performance__head">
                    <div>
                      <h2 className="section-title">{tx("채널별 RR 배분", "Channel RR allocation")}</h2>
                      <p>{tx(
                        weeklyPerformanceView === "grouped" && hasCollinearityGroups
                          ? (displayedCollinearityGroupRefit?.enabled
                            ? "상관이 높은 채널은 실제로 하나의 입력으로 다시 학습한 결과입니다."
                            : "상관이 높은 채널은 합산해서 보수적으로 표시합니다.")
                          : (displayedCollinearityGroupRefit?.enabled
                            ? "개별 값은 그룹 재학습 총기여 안에서 원래 신호와 지출 비중으로 나눈 참고값입니다."
                            : "Performance·Branding 그룹 RR을 주별 adstock 지출 비중으로 나눈 배분값입니다."),
                        weeklyPerformanceView === "grouped" && hasCollinearityGroups
                          ? (displayedCollinearityGroupRefit?.enabled
                            ? "Highly correlated channels are actually refit as one combined input."
                            : "Highly correlated channels are summed for a conservative view.")
                          : (displayedCollinearityGroupRefit?.enabled
                            ? "Individual values are reference allocations of the refit group total using the original signal and spend shares."
                            : "Performance and Branding group RR is allocated by weekly adstocked spend share."),
                      )}</p>
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {hasCollinearityGroups && (
                        <PillGroup
                          ariaLabel={tx("공선 채널 보기 전환", "Collinear-channel view")}
                          value={weeklyPerformanceView}
                          onChange={setWeeklyPerformanceView}
                          options={[
                            { value: "individual", label: tx("개별 보기", "Individual") },
                            { value: "grouped", label: tx("상관 채널 묶음", "Correlated groups") },
                          ]}
                        />
                      )}
                      {highCollinearPairs.length > 0 && (
                        <button
                          className="ab-pill"
                          style={{ color: "var(--warning)", borderColor: "color-mix(in srgb, var(--warning) 65%, var(--border))", background: "color-mix(in srgb, var(--warning) 10%, transparent)" }}
                          title={tx("강하게 함께 움직이는 채널 쌍의 주별 입력값을 확인합니다.", "Inspect weekly inputs for channel pairs that move strongly together.")}
                          onClick={() => setSelectedCollinearPairKey((current) => current ? null : collinearPairKey(highCollinearPairs[0]))}
                        >
                          ⚠ {tx(`채널 쌍 상관 ${highCollinearPairs.length}건`, `${highCollinearPairs.length} correlated pair${highCollinearPairs.length > 1 ? "s" : ""}`)}
                        </button>
                      )}
                      <span className="mmm-weekly-performance__note">{tx("그룹 총량 기반 배분", "Group-total allocation")}</span>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table className="data mmm-data-table">
                      <thead>
                        <tr>
                          <th>{tx("채널", "Channel")}</th>
                          <th>{tx("집행 주", "Active weeks")}</th>
                          <th>{tx("평균 Cost/주", "Avg. Cost/wk")}</th>
                          <th>{tx(`평균 ${tgtKo}/주`, `Avg. ${tgtKo}/wk`)}</th>
                          <th>{tx("전체 Spend", "Total Spend")}</th>
                          <th>{tx(`전체 ${tgtKo}`, `Total ${tgtKo}`)}</th>
                          <th>{mmm.target === "Revenue" ? tx("ROAS", "ROAS") : tx("CPA", "CPA")}</th>
                          <th>{tx("식별", "Identification")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedWeeklyChannelPerformance.map((row) => {
                          const efficiency = mmm.target === "Revenue"
                            ? row.avgWeeklySpend > 0 && row.avgWeeklyPredicted > 0 ? row.avgWeeklyPredicted / row.avgWeeklySpend : null
                            : row.predictedCpr;
                          const isUnidentified = ["ABSTAIN", "BOUNDARY/UNIDENTIFIED"].includes(row.identificationVerdict);
                          return (
                            <tr key={row.key} style={row.posteriorPositive != null && row.posteriorPositive < 0.8 ? { opacity: 0.62 } : undefined}>
                              <td>
                                <strong>{row.label}</strong>
                                {row.isCollinearityGroup && <div style={{ marginTop: "3px", fontSize: "11px", color: "var(--warning)" }}>⚠ {tx(`최대 상관 ${row.maxCorrelation.toFixed(2)} · ${row.members.length}개 채널 ${row.isGroupRefit ? "재학습" : "합산"}`, `max corr. ${row.maxCorrelation.toFixed(2)} · ${row.members.length} channels ${row.isGroupRefit ? "refit" : "summed"}`)}</div>}
                                {row.boundaryPosteriorMean && <div style={{ marginTop: "3px", fontSize: "11px", color: "var(--warning)" }}>{tx("0으로 잘린 단일값 대신 가능한 양수 범위의 평균", "Mean of the plausible positive range instead of a zero-clipped point")}</div>}
                                {row.allocationReliability === "reference-low" && <div style={{ marginTop: "3px", fontSize: "11px", color: "var(--warning)" }}>{tx("그룹 재학습 후 개별 참고 배분 · 신뢰도 낮음", "Reference allocation after group refit · low reliability")}</div>}
                                {row.allocationReliability === "group-total-by-construction" && <div style={{ marginTop: "3px", fontSize: "11px", color: "var(--warning)" }}>{tx("상위 그룹 총량의 adstock carryover 비중 배분", "Allocation of the top-level total by adstock carryover share")}</div>}
                                {row.allocationReliability === "legacy-response-curve-reapplication" && <div style={{ marginTop: "3px", fontSize: "11px", color: "var(--warning)" }}>{tx("구 responseAt(당주 Cost) 재대입 비교값", "Legacy responseAt(same-week Cost) replay")}</div>}
                              </td>
                              <td className="tnum">{row.activeWeeks}{tx("주", " wk")}</td>
                              <td className="tnum">{spendLabel(row.avgWeeklySpend)}</td>
                              <td className="tnum">
                                {isUnidentified
                                  ? `0–${targetValueLabel(row.avgWeeklyPredictedHigh || 0)}`
                                  : row.avgWeeklyPredicted > 0 ? targetValueLabel(row.avgWeeklyPredicted) : "—"}
                                {!isUnidentified && Number.isFinite(row.avgWeeklyPredictedLow) && Number.isFinite(row.avgWeeklyPredictedHigh) && row.avgWeeklyPredicted > 0 && (
                                  <div style={{ fontSize: "11px", color: MUTED, marginTop: "2px" }}>
                                    {targetValueLabel(row.avgWeeklyPredictedLow)}–{targetValueLabel(row.avgWeeklyPredictedHigh)}
                                  </div>
                                )}
                              </td>
                              <td className="tnum">{spendLabel(row.totalSpend)}</td>
                              <td className="tnum">
                                {isUnidentified
                                  ? `0–${targetValueLabel(row.totalPredictedHigh || 0)}`
                                  : row.totalPredicted > 0 ? targetValueLabel(row.totalPredicted) : "—"}
                                {!isUnidentified && Number.isFinite(row.totalPredictedLow) && Number.isFinite(row.totalPredictedHigh) && row.totalPredicted > 0 && (
                                  <div style={{ fontSize: "11px", color: MUTED, marginTop: "2px" }}>
                                    {targetValueLabel(row.totalPredictedLow)}–{targetValueLabel(row.totalPredictedHigh)}
                                  </div>
                                )}
                              </td>
                              <td className="tnum mmm-data-table__metric">
                                {isUnidentified
                                  ? tx("보류", "Held")
                                  : efficiency == null ? "—" : mmm.target === "Revenue" ? `${fmtOne(efficiency)}x` : spendLabel(efficiency)}
                              </td>
                              <td>
                                <span className={`mmm-data-table__tag ${row.identificationVerdict === "IDENTIFIED" ? "is-media" : ""}`}>
                                  {row.identificationVerdict || tx("배분값", "Allocated")}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mmm-weekly-performance__foot">{tx(
                    "Decomp에서 먼저 확정한 Performance·Branding RR을 주별 adstock 지출 비중으로 채널에 나눕니다. 채널별 값은 인과적으로 식별된 효과가 아닌 운영 배분값이며, 각 그룹의 채널 RR 합은 Decomp와 정확히 일치합니다.",
                    "Performance and Branding RR is fixed in Decomp first, then allocated to channels by weekly adstocked spend share. Channel values are operational allocations, not causally identified effects; each group’s channel RR sum exactly matches Decomp.",
                  )}</p>
                  {spendTimelineKinds.length > 0 && (
                    <Card style={{ marginTop: "12px", padding: "14px 16px", borderColor: "rgba(127,119,221,.34)", background: "linear-gradient(90deg, rgba(127,119,221,.07), transparent 44%)" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-1)" }}>{tx("집행 시점 비교", "Spend timing overlap")}</div>
                          <p className="muted" style={{ fontSize: "11px", margin: "4px 0 0", lineHeight: 1.45 }}>{tx(
                            "같이 켜진 브랜드·퍼포먼스 채널을 찾습니다. 채널별 절대 규모 대신 각자의 최대 집행 대비 강도를 맞춰 비교합니다.",
                            "Find channels that were active together. Compare intensity relative to each channel's own peak, not absolute scale.",
                          )}</p>
                        </div>
                        {spendTimelineKinds.length > 1 && (
                          <div className="ab-pillgroup" aria-label={tx("집행 시점 채널군", "Spend timing channel group")}>
                            <button className={"ab-pill " + (effectiveSpendTimelineKind === "brand" ? "active" : "")} onClick={() => setSpendTimelineKind("brand")}>{tx("브랜딩", "Brand")}</button>
                            <button className={"ab-pill " + (effectiveSpendTimelineKind === "perf" ? "active" : "")} onClick={() => setSpendTimelineKind("perf")}>{tx("퍼포먼스", "Performance")}</button>
                          </div>
                        )}
                      </div>
                      <ChannelSpendTimeline labels={viewedPanel.weekLabel || viewedPanel.week} channels={spendTimelineChannels} locale={locale} />
                    </Card>
                  )}
                  {selectedCollinearPair && (
                    <Card style={{ marginTop: "10px", borderColor: "rgba(245,158,11,.45)", background: "rgba(245,158,11,.045)" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-1)" }}>⚠ {tx("함께 움직이는 채널 입력값", "Channel inputs moving together")}</div>
                          <p className="muted" style={{ fontSize: "11.5px", margin: "4px 0 0", lineHeight: 1.5 }}>
                            {tx(`${selectedCollinearPair.series[0].label} · ${selectedCollinearPair.series[1].label}의 상관은 ${selectedCollinearPair.corr.toFixed(2)}입니다. 두 값을 따로 나눠 기여를 정하기 어려울 수 있습니다.`, `${selectedCollinearPair.series[0].label} · ${selectedCollinearPair.series[1].label} have correlation ${selectedCollinearPair.corr.toFixed(2)}. Separating their contributions can be difficult.`)}
                          </p>
                        </div>
                        <button className="ab-pill" onClick={() => setSelectedCollinearPairKey(null)}>{tx("닫기", "Close")}</button>
                      </div>
                      {highCollinearPairs.length > 1 && (
                        <div className="ab-pillgroup" style={{ marginTop: "10px" }}>
                          {highCollinearPairs.map((pair) => {
                            const detail = collinearPairDetail(pair);
                            return <button key={detail.key} className={`ab-pill ${detail.key === selectedCollinearPair.key ? "active" : ""}`} onClick={() => setSelectedCollinearPairKey(detail.key)}>{detail.series[0].label} · {detail.series[1].label}</button>;
                          })}
                        </div>
                      )}
                      <p className="muted" style={{ fontSize: "11px", margin: "10px 0 0" }}>
                        {selectedCollinearPair.unitLabel === tx("노출수", "impressions")
                          ? tx("이 CSV에서 두 채널은 소진액이 아닌 노출수로 매핑되어 있습니다. 아래에는 실제 모델 입력값인 노출수를 표시합니다.", "These channels are mapped as impressions, not spend, in this CSV. The chart shows the actual model input: impressions.")
                          : tx("아래는 두 채널에 매핑된 주별 소진액입니다.", "The chart below shows the weekly spend mapped to the two channels.")}
                      </p>
                      <CollinearPairInputChart labels={mmm.panel.weekLabel || mmm.panel.week} pair={selectedCollinearPair} locale={locale} />
                    </Card>
                  )}
                </section>
                </details>
              )}

              {/* ── ② 전문가 상세: 주별 드라이버와 튀는 주 ── */}
              <details className="mmm-result-details mmm-bayesian-expert" data-mmm-flow-step="driver-detail" onToggle={onAccordionToggle}>
                <summary>{tx("주별 드라이버·이상 구간 상세", "Weekly driver and spike details")}</summary>
                <div style={{ marginTop: "12px" }}>
                  {dateScopedDecomp ? (
                    <>
                      <div className="section-head" style={{ marginBottom: "6px" }}>
                        <h3 className="section-title" style={{ fontSize: "13.5px" }}>{tx("매주 성과는 무엇으로 이뤄졌나", "What made up each week's performance")} <span style={{ fontSize: "11px", color: MUTED, fontWeight: 400 }}>{tx("· 자동 분류한 그룹별 기여", "· automatically classified contribution groups")}</span></h3>
                        <button
                          className="ab-pill"
                          title={tx("차트와 같은 주별 그룹 기여값을 내려받아 Excel에서 차트를 만들 수 있습니다.", "Download the weekly group values behind this chart for Excel.")}
                          onClick={() => {
                            csvDownload(`mmm_weekly_group_contribution_${mmm.target}_${_today()}.csv`, buildContributionGroupCsv(viewedDecomp, contributionLabels, groupPanels));
                            trackProductEvent("result_downloaded", { tool_id: "5-18", source: "weekly_group_contribution", download_type: "csv", locale });
                          }}
                        >
                          {tx("⬇ 차트 데이터 CSV", "⬇ Chart data CSV")}
                        </button>
                      </div>
                      <p className="muted" style={{ fontSize: "11px", marginBottom: "6px", lineHeight: 1.5 }}>
                        {tx("채널은 직접 노출하지 않고", "Channels are not shown directly. Instead,")} <b>{tx("마케팅·브랜딩", "Performance and Brand")}</b>{tx("으로 자동 묶습니다. 기본 수요·추세는 양수 레벨이 오르내리는 값이고, 휴일·이벤트·시즌·계절·구조 변화는 기준선 대비 음수도 표시합니다.", ", Performance and Brand. Base demand · trend is a positive level that rises or falls; Holidays & Events, Seasonality, and Regime change can be negative versus that level.")}
                      </p>
                      {isSeasonalitySelected && seasonalityDriverStat && (
                        <div
                          className={`callout ${hasSeasonalityContribution ? "info" : "warn"}`}
                          style={{ margin: "0 0 8px", padding: "8px 10px" }}
                        >
                          <div className="ico">~</div>
                          <div className="body">
                            <strong>
                              {hasSeasonalityContribution
                                ? tx(
                                  `계절성 적용 중 · 주간 ${targetValueLabel(seasonalityDriverStat.min, { sign: true })} ~ ${targetValueLabel(seasonalityDriverStat.max, { sign: true })}`,
                                  `Seasonality applied · weekly ${targetValueLabel(seasonalityDriverStat.min, { sign: true })} to ${targetValueLabel(seasonalityDriverStat.max, { sign: true })}`,
                                )
                                : tx("계절성 후보는 선택됐지만 주별 기여가 0입니다.", "A seasonality candidate was selected, but its weekly contribution is zero.")}
                            </strong>
                            <p>
                              {hasSeasonalityContribution
                                ? tx(
                                  "아래 차트와 CSV는 평균·절댓값 변환 없이 각 주의 플러스·마이너스 기여를 그대로 표시합니다.",
                                  "The chart and CSV below preserve each week's positive or negative contribution without averaging or absolute-value conversion.",
                                )
                                : tx("이 상태에서는 계절성을 성과 기여로 해석하지 마세요. 분석을 다시 실행해 계산 경로를 확인해야 합니다.", "Do not interpret seasonality as a contribution in this state. Re-run the analysis to verify the calculation path.")}
                            </p>
                          </div>
                        </div>
                      )}
                      {negAlert && (
                        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", padding: "9px 12px", marginBottom: "8px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.4)", borderRadius: "8px" }}>
                          <span style={{ fontSize: "15px" }}>⚠️</span>
                          <span style={{ fontSize: "12px", color: "var(--text-1)", lineHeight: 1.5 }}>
                            {tx("주", "In week")} <b>{String(negAlert.lbl)}</b>{tx(`에 `, ", ")}<b style={{ color: bucketMeta[negAlert.bucket]?.tone }}>{negAlert.bLabel}</b>{tx("가 성과를 크게 끌어내렸어요 (약 ", " pulled performance down significantly (about ")}{targetValueLabel(negAlert.val)}{tx(").", ").")}
                            {negAlert.domG && negAlert.domV < 0 ? <> {tx("주 원인은", "The main cause was")} <b>{plainDrv(negAlert.domG)}</b> ({targetValueLabel(negAlert.domV)}){tx("예요.", ".")}</> : null}
                            {negAlert.bucket === "media" ? tx(" 광고가 오히려 마이너스로 잡히면 노이즈·공선일 수 있으니 아래 상세를 확인하세요.", " If ads register as negative, it could be noise or collinearity — check the detail below.") : ""}
                          </span>
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {groupPanels.map((group) => (
                          <section key={group.key} style={{ borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                            <h4 style={{ margin: "0 0 3px", fontSize: "12px", color: "var(--text-1)" }}>{group.label}</h4>
                            <ContributionGroupPanel
                              label={group.label}
                              values={group.values}
                              labels={contributionLabels}
                              color={groupPanelPalette[group.key] || "#85B7EB"}
                              locale={locale}
                              formatValue={targetValueLabel}
                            />
                          </section>
                        ))}
                      </div>
                      <div className="table-wrap" style={{ marginTop: "12px" }}>
                        <table className="data mmm-data-table">
                          <thead><tr><th>{tx("성장 요인", "Driver")}</th><th>{dateScopedDecomp.level ? tx("기간 요약", "Period summary") : tx("주별 변동", "Weekly movement")}</th><th>{tx("광고 변수", "Ad variable")}</th></tr></thead>
                          <tbody>
                            {dateScopedDecomp.driverStats.map((d) => {
                              const isCenteredDriver = ["Seasonality", "Holidays & Events", "Industry Trend"].includes(d.name);
                              return (
                                <tr key={d.name}>
                                  <td><strong>{plainDrv(d.name)}</strong></td>
                                  <td className="tnum mmm-data-table__metric">
                                    {dateScopedDecomp.level && isCenteredDriver
                                      ? `${tx("주별", "Weekly")} ${targetValueLabel(d.min, { sign: true })} ~ ${targetValueLabel(d.max, { sign: true })}`
                                      : dateScopedDecomp.level
                                        ? `${tx("주 평균", "Weekly avg.")} ${targetValueLabel(d.avg, { sign: true })}`
                                        : `${targetValueLabel(d.min, { sign: true })} ~ ${targetValueLabel(d.max, { sign: true })}`}
                                  </td>
                                  <td><span className={`mmm-data-table__tag ${d.media ? "is-media" : ""}`}>{d.media ? tx("광고", "Ad") : tx("비광고", "Non-ad")}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {dateScopedDecomp.spikes && dateScopedDecomp.spikes.length > 0 && (
                        <>
                          <h3 className="section-title" style={{ fontSize: "13.5px", marginTop: "16px" }}>{tx("🔎 튀는 구간", "🔎 Spikes")} <span style={{ fontSize: "11px", color: MUTED, fontWeight: 400 }}>{tx("· 평소와 다르게 크게 벗어난 주 (메모 남기면 위 그래프에 번호로 표시)", "· weeks that deviate unusually far from normal (add a note to number them on the chart above)")}</span></h3>
                          <div className="table-wrap">
                            <table className="data" style={{ fontSize: "11.5px" }}>
                              <thead><tr><th>{tx("기간", "Period")}</th><th>{tx("기준선 대비", "vs. baseline")}</th><th>{tx("자동 진단", "Auto diagnosis")}</th><th>{tx("메모 (원인 기록)", "Note (record cause)")}</th></tr></thead>
                              <tbody>
                                {dateScopedDecomp.spikes.map((s) => {
                                  const lbl = displayedMmmPanel?.weekLabel && s.i != null ? displayedMmmPanel.weekLabel[s.i] : null;
                                  const noteKey = `${mmm.target}|${s.week}`;
                                  const noteNum = dateScopedDecomp.spikes.filter((n) => (spikeNotes[`${mmm.target}|${n.week}`] || "").trim()).findIndex((n) => n.week === s.week) + 1;
                                  const clsLabel = s.cls === "channel"
                                    ? { txt: tx("채널 스파크", "Channel spike"), color: "var(--chart-primary)" }
                                    : s.cls === "baseline"
                                      ? { txt: tx("기준선·계절 변동", "Baseline/seasonal swing"), color: "var(--success)" }
                                      : { txt: tx("모델 밖(원인 입력 권장)", "Outside the model (please record a cause)"), color: "var(--warning)" };
                                  const driverTxt = s.cls === "unexplained"
                                    ? `${tx("잔차", "Residual")} ${targetValueLabel(s.residual, { sign: true })}`
                                    : `${s.domDriver} ${targetValueLabel(s.domVal, { sign: true })}`;
                                  return (
                                    <tr key={s.week}>
                                      <td>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                          {noteNum > 0 && <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "16px", height: "16px", borderRadius: "50%", background: "var(--warning)", color: "var(--on-warning)", fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>{noteNum}</span>}
                                          <b style={{ fontSize: "12px" }}>{lbl != null ? String(lbl) : tx(`주차 ${mmm.panel.week?.[s.i] ?? (s.i != null ? s.i + 1 : s.week)}`, `Week ${mmm.panel.week?.[s.i] ?? (s.i != null ? s.i + 1 : s.week)}`)}</b>
                                        </span>
                                        {lbl != null && <span style={{ fontSize: "11px", color: MUTED, display: "block" }}>{tx(`주차 ${mmm.panel.week?.[s.i] ?? (s.i != null ? s.i + 1 : s.week)}`, `Week ${mmm.panel.week?.[s.i] ?? (s.i != null ? s.i + 1 : s.week)}`)}</span>}
                                      </td>
                                      <td className="tnum" style={{ color: s.dev >= 0 ? POS : NEG }}>{targetValueLabel(s.dev, { sign: true })}</td>
                                      <td>
                                        <span style={{ color: clsLabel.color, fontWeight: 600 }}>{clsLabel.txt}</span>
                                        <span style={{ fontSize: "11px", color: MUTED }}><br />{tx("주 원인:", "Main cause:")} {driverTxt}</span>
                                      </td>
                                      <td>
                                        <input
                                          value={spikeNotes[noteKey] || ""}
                                          onChange={(e) => setSpikeNotes((n) => ({ ...n, [noteKey]: e.target.value }))}
                                          placeholder={tx("이 주에 무슨 일? (예: 앱스토어 피처드, 경쟁사 이슈)", "What happened this week? (e.g. App Store feature, competitor issue)")}
                                          style={{ width: "100%", background: "var(--bg-2)", color: "var(--text-1)", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 7px", fontSize: "11px" }}
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="muted" style={{ fontSize: "12px" }}>{tx("분해를 계산할 수 없습니다(ridge 특이·데이터 부족).", "Can't compute the decomposition (ridge singularity/insufficient data).")}</p>
                  )}
                </div>
              </details>

              {/* ── ④ 반응곡선·한계효과 ── */}
              <section className="mmm-result-step" data-mmm-flow-step="response" aria-labelledby="mmm-bayesian-response-title">
                <div className="mmm-result-step__head">
                  <span>04</span>
                  <div>
                    <h3 id="mmm-bayesian-response-title">{tx("지출을 바꾸면 예측이 어떻게 달라지나", "How does prediction change when spend changes?")}</h3>
                    <p>{tx("관측한 지출 범위 안에서 채널 반응과 CPA·ROAS 변화를 확인합니다. 평평해질수록 추가 지출 효율이 낮습니다.", "Inspect channel response and CPA/ROAS within observed spend. A flatter curve means lower efficiency from additional spend.")}</p>
                  </div>
                </div>
                <details className="mmm-result-details" onToggle={onAccordionToggle}>
                  <summary>{tx("광고 여운·포화 변환 상세", "Carryover and saturation-transform details")}</summary>
                  <div style={{ marginTop: "12px" }}>
                  <StatHead title={tx("① 채널별 광고 여운·포화", "① Per-channel carryover and saturation")} hint={tx("한 번에 한 채널씩 α × 반포화점 × Hill 기울기 profile 후보를 비교합니다. 이 표는 기본 기여·예측에 쓰는 대표 후보를 보여 주고, 아래 효과 신뢰도는 profile 후보 차이를 BIC 가중 평균합니다.", "Profile candidates compare α × half-saturation × Hill slope one channel at a time. This table shows the representative candidate used for base contribution and forecast; effect confidence below BIC-averages variation across profile candidates.")} />
                  <div className="table-wrap" style={{ marginBottom: "12px" }}>
                    <table className="data" style={{ fontSize: "11.5px" }}>
                      <thead><tr><th>{tx("채널", "Channel")}</th><th>{tx("잔효 α", "Carryover α")}</th><th>{tx("반포화 지출점", "Half-saturation")}</th><th>{tx("포화 곡선", "Hill slope")}</th><th>{tx("변환 탐색", "Transform search")}</th><th>{tx("효과가 양수일 확률", "P(effect > 0)")}</th></tr></thead>
                      <tbody>{Object.values(sat).map((s) => {
                        // T2: 변환 파라미터(α·ec·slope) 90% Laplace 프로파일 구간(표시층, 골든 무관).
                        const lap = mmmNonlinearLaplace(s.transformUncertainty?.models);
                        const ciCell = (u, fmt) => (u && u.method !== "fixed" && u.sd > 0 ? (
                          <small
                            style={{ display: "block", color: MUTED, fontWeight: 400 }}
                            title={tx(
                              `90% 구간 (Laplace 프로파일 근사${u.gridLimited ? " · 그리드 한계로 관측 범위 제한" : ""}). 변환 파라미터 불확실성일 뿐 인과가 아닙니다.`,
                              `90% interval (Laplace profile approximation${u.gridLimited ? " · grid-limited to observed range" : ""}). Transform-parameter uncertainty only, not causal.`,
                            )}
                          >{tx("프로파일 최빈 ", "Profile mode ")}{fmt(u.value)} · 90% {fmt(u.ci90[0])}–{fmt(u.ci90[1])}{u.gridLimited ? "*" : ""}</small>
                        ) : null);
                        return (
                        <tr key={s.key}><td>{s.label}</td><td className="tnum">{s.params.alpha.toFixed(1)}{ciCell(lap?.alpha, (v) => v.toFixed(1))}</td><td className="tnum">{spendLabel(s.params.ec)}{ciCell(lap?.ec, (v) => spendLabel(v))}</td><td className="tnum">{s.params.slope.toFixed(1)}{ciCell(lap?.slope, (v) => v.toFixed(1))}</td><td>{s.transformUncertainty?.priorLockedTransform
                          ? tx("외부 근거가 타깃 대표 변환 단위로 정렬되어 고정", "Fixed because external evidence is aligned to the target representative-transform units")
                          : tx(`${s.transformUncertainty?.candidateCount || 1}개 후보 평가`, `${s.transformUncertainty?.candidateCount || 1} candidates evaluated`)}</td><td className="tnum" style={{ color: s.posteriorPositive >= 0.8 ? NEG : MUTED }}>{(s.posteriorPositive * 100).toFixed(0)}%</td></tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                  <p className="muted" style={{ fontSize: "11px", marginTop: "-6px", marginBottom: "12px" }}>
                    {tx(
                      "각 대표 변환값 아래에는 프로파일 최빈값과 90% 구간을 함께 표시합니다(Laplace 곡률 근사). 대표값과 프로파일 최빈값은 선택 기준이 달라 다를 수 있습니다. 변환 파라미터의 불확실성을 뜻할 뿐 인과 효과가 아닙니다. * = 그리드가 성기거나 최빈값이 경계라 관측 범위로 제한한 경우.",
                      "Under each representative transform, the profile mode and its 90% interval are shown (Laplace curvature approximation). The representative value and profile mode can differ because they use different selection criteria. This is transform-parameter uncertainty, not a causal effect. * = grid was sparse or the mode sat at an edge, so it is limited to the observed range.",
                    )}
                  </p>
                  <StatHead title={tx("② Empirical-Bayes 효과 신뢰도", "② Empirical-Bayes effect confidence")} hint={tx("잔차 분산은 plug-in 추정한 조건부 Gaussian 근사입니다. 한 번에 한 채널의 adstock α·반포화점·Hill 기울기만 바꾼 profile 후보를 다시 적합하고 BIC로 가중 평균합니다. 후보마다 결론이 다르면 확률은 낮아지고 구간은 넓어집니다. 모든 채널·분산을 함께 샘플링한 joint MCMC posterior는 아니며, 80% 이상도 holdout 전 인과·증분 확정이 아닙니다.", "This is a conditional Gaussian empirical-Bayes approximation with plug-in residual variance. Profile candidates change one channel's adstock α, half-saturation, and Hill slope at a time, refit the model, and receive BIC weights. Disagreement lowers probability and widens the interval. This is not a jointly sampled all-channel and variance MCMC posterior, and even ≥80% is not causal or incremental proof before holdout validation.")} />
                  <div className="table-wrap" style={{ marginBottom: "12px" }}>
                    <table className="data" style={{ fontSize: "11.5px" }}>
                      <thead><tr><th>{tx("채널", "Channel")}</th><th>{tx("효과 양수 확률", "P(effect > 0)")}</th><th>{tx("효과 크기", "Effect size")}</th><th>{tx("90% profile 혼합 구간", "90% profile-mixture interval")}</th><th>{tx("예산 추천", "Budget use")}</th></tr></thead>
                      <tbody>{Object.values(sat).map((s) => {
                        const marginal = s.incrementalAt(s.recentMean, marginalStepSource);
                        const inObservedRange = s.isIncrementInObservedRange(s.recentMean, marginalStepSource);
                        const useBudget = budgetEligible && s.budgetEligible && inObservedRange && marginal.ci?.[0] > 0;
                        return <tr key={s.key}>
                          <td title={s.transformUncertainty ? (s.transformUncertainty.priorLockedTransform
                            ? tx("실험 prior는 타깃 대표 변환으로 처리강도를 계산하고, 국가 prior는 참고국을 같은 변환으로 재적합했습니다. 따라서 이 채널의 adstock·포화 변환을 타깃 대표값에 고정하며 후보 검색 실패가 아닙니다.", "Experiment intensity is computed on the target representative transform, and reference markets are refitted on that same transform. This channel is therefore fixed to the target representative adstock/saturation values; it is not a failed candidate search.")
                            : tx(`평가 후보 ${s.transformUncertainty.candidateCount}/${s.transformUncertainty.totalCandidateCount || s.transformUncertainty.candidateCount}개${s.transformUncertainty.candidateSearchCapped ? "(브라우저 상한 적용)" : ""} · 가중 유효 후보 ${s.transformUncertainty.effectiveCandidateCount.toFixed(1)}개`, `${s.transformUncertainty.candidateCount}/${s.transformUncertainty.totalCandidateCount || s.transformUncertainty.candidateCount} candidates evaluated${s.transformUncertainty.candidateSearchCapped ? " (browser cap applied)" : ""} · ${s.transformUncertainty.effectiveCandidateCount.toFixed(1)} effective candidates`)) : undefined}><strong>{s.label}</strong>{s.transformUncertainty?.priorLockedTransform && <small style={{ display: "block", color: MUTED, fontWeight: 400 }}>{tx("타깃 변환 고정", "target transform fixed")}</small>}</td>
                          <td className="tnum" style={{ color: useBudget ? NEG : MUTED }}>{fmtOne(s.posteriorPositive * 100)}%</td>
                          <td className="tnum">{targetValueLabel(s.ln_coef, { decimals: 1 })}<small style={{ display: "block", color: MUTED }}>{tx("/변환 노출 1단위", "/ transformed-exposure unit")}</small></td>
                          <td className="tnum">[{targetValueLabel(s.ci?.[0], { decimals: 1 })}, {targetValueLabel(s.ci?.[1], { decimals: 1 })}]</td>
                          <td style={{ color: useBudget ? NEG : MUTED, fontWeight: 600 }}>{useBudget ? tx("포함", "Included") : tx("보류", "Hold")}{!useBudget && <small style={{ display: "block", fontWeight: 400 }}>{budgetGateLabel([...(s.budgetGateReasons || []), ...(!inObservedRange ? ["outside-observed-spend-range"] : []), ...(marginal.ci?.[0] <= 0 ? [tx("한계효과 구간 0 포함", "marginal interval crosses 0")] : [])])}</small>}</td>
                        </tr>;
                      })}</tbody>
                    </table>
                  </div>
                  <StatHead title={tx("③ RMS 기여 크기 비중", "③ RMS contribution-magnitude share")} hint={tx("각 드라이버의 주별 기여값 제곱평균을 전체 합으로 나눕니다. 인과 확정·설명된 R² 배분·Shapley 값이 아닙니다.", "Divides each driver's mean squared weekly contribution by the total. It is not causal attribution, allocated explained R², or a Shapley value.")} />
                  <div className="chart-container" style={{ height: "200px", marginBottom: "8px" }}><canvas ref={shapleyRef}></canvas></div>
                  </div>
                </details>
                  <strong className="mmm-result-subtitle">{tx("채널 반응곡선", "Channel response curves")}</strong>
                  <div className="mmm-channel-selector" role="group" aria-label={tx("Bayesian 반응 채널", "Bayesian response channel")}>
                    {Object.values(sat).map((channel) => (
                      <button
                        type="button"
                        key={channel.key}
                        aria-pressed={effectiveBayesianResponseChannel?.key === channel.key}
                        className={effectiveBayesianResponseChannel?.key === channel.key ? "is-selected" : ""}
                        onClick={() => setBayesianResponseChannel(channel.key)}
                      >{channel.label}</button>
                    ))}
                  </div>
                  <div>
                    <div className="chart-container" style={{ height: "340px", minHeight: "340px", marginBottom: "12px" }}><canvas ref={satRef}></canvas></div>
                    <div>
                      <div className="table-wrap">
                        <table className="data mmm-data-table mmm-marginal-table">
                          <thead><tr><th>{tx("채널", "Channel")}</th><th>{`0.5× ${spendReferenceLabel}`}<small>{tx(`추가 ${marginalStepLabel}당`, `per +${marginalStepLabel}`)}</small></th><th>{spendReferenceLabel}<small>{tx(`추가 ${marginalStepLabel}당`, `per +${marginalStepLabel}`)}</small></th><th>{`1.5× ${spendReferenceLabel}`}<small>{tx(`추가 ${marginalStepLabel}당`, `per +${marginalStepLabel}`)}</small></th></tr></thead>
                          <tbody>
                            {(() => {
                              const sbc = sat;
                              const keys = effectiveBayesianResponseChannel?.key
                                ? [effectiveBayesianResponseChannel.key]
                                : Object.keys(sbc);
                              if (!keys.length) return <tr><td colSpan="4" style={{ color: MUTED }}>—</td></tr>;
                              const cell = (v) => (v == null ? "—" : targetValueLabel(v, { decimals: 1, sign: true }));
                              return keys.map((k) => {
                                const s = sbc[k];
                                const levels = [0.5, 1, 1.5].map((multiplier) => {
                                  const spend = (s.recentMean || 0) * multiplier;
                                  return { spend, result: s.recentMean > 0 ? s.incrementalAt(spend, marginalStepSource) : null, inObservedRange: s.isIncrementInObservedRange(spend, marginalStepSource) };
                                });
                                const neg = !s.budgetEligible || !levels[1].inObservedRange;
                                return (
                                  <tr key={k} style={neg ? { opacity: 0.55 } : undefined}>
                                    <td><strong>{s.label}</strong>{neg ? <span style={{ fontSize: "11px", color: "var(--warning)" }}> {tx("예산 보류", "budget hold")}</span> : ""}</td>
                                    {levels.map(({ spend, result, inObservedRange }, index) => <td key={index} className="tnum" style={index === 1 ? { color: "var(--primary)" } : undefined}>{result == null ? "—" : <>{cell(result.mean)}<span style={{ fontSize: "11px", color: inObservedRange ? MUTED : "var(--warning)" }}><br />[{cell(result.ci[0])} ~ {cell(result.ci[1])}]<br />@{spendLabel(spend)}{!inObservedRange ? tx(" · 외삽", " · extrapolation") : ""}</span></>}</td>)}
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                      <StatHead title={mmm.target === "Revenue" ? tx("⑤ ROAS 곡선", "⑤ ROAS curve") : tx("⑤ CPA 곡선", "⑤ CPA curve")} hint={mmm.target === "Revenue" ? tx("지출이 늘수록 같은 광고비가 만드는 매출 비율(ROAS)이 어떻게 변하는지 봅니다. 양수 효과 채널만 해석하세요.", "Shows how revenue return per spend changes as spend grows. Interpret positive-effect channels only.") : tx("지출이 늘수록 결과 1건을 만드는 비용(CPA)이 어떻게 변하는지 봅니다. 양수 효과 채널만 해석하세요.", "Shows how cost per result changes as spend grows. Interpret positive-effect channels only.")} />
                      <div className="chart-container" style={{ height: "280px", minHeight: "280px", marginBottom: "12px" }}><canvas ref={efficiencyRef}></canvas></div>
                      <p className="mmm-result-note">{tx(`표와 곡선은 추가 ${marginalStepLabel}에서 예상되는 ${tgtKo} 변화와 90% 모델 범위입니다. 관측한 지출 범위 안에서만 해석하세요.`, `The table and curves show the expected ${tgtKo} change per additional ${marginalStepLabel} with a 90% model range. Interpret only within observed spend.`)}</p>
                    </div>
                  </div>
              </section>

              {/* 결과를 읽을 때 반드시 감안할 구조적 한계. 결론 옆에 두지 않으면
                  "퍼포먼스가 브랜드보다 N배 효율"이 그대로 예산 결정이 된다(D-16). */}
              <details className="stat-method mmm-reading-limits">
                <summary>{tx("이 숫자를 읽을 때 감안할 것 3가지", "Three things to keep in mind when reading these numbers")}</summary>
                <ul>
                  {getMmmInterpretationLimits(locale).map((limit) => (
                    <li key={limit.id}>
                      <strong>{limit.claim}</strong>
                      <span>{limit.detail}</span>
                    </li>
                  ))}
                </ul>
              </details>

              {/* ── 맨 밑: 상세 설명 문서 다운로드 ──
                  DownloadHub(결과 최상단 드롭다운)을 쓰지 않는 자리다. 5-18은 CSV·매핑
                  허브이고 실제 분석 산출물은 각 subtool이 소유하므로, 여기 있는 것은
                  "결과 받기"가 아니라 claude-ux §6의 **맨밑 상세문서 탈출구**다.
                  드롭다운으로 감싸면 한 항목짜리 메뉴가 되어 클릭만 늘어난다.
                  (product-ssot §5.5 · D-07) */}
              <div className="mmm-result-download" data-mmm-flow-step="download">
                <button type="button"
                  onClick={() => textDownload(`${tx("MMM_기여분해_설명", "mmm_contribution_explained")}_${mmm.target}_${_today()}.md`, buildMmmGuideDoc(mmm, tgtKo, locale))}>
                  {tx("상세 분석 문서 받기", "Download detailed analysis notes")}
                </button>
              </div>
                </div>
              ) : null}
            </>
            );
          })()}

          {/* ── STAGE ③ LAB — 회귀·미래예측(②와 같은 MMM 모델 계수로 과거 적합 + 미래 외삽) ── */}
          {stage === "lab" && (
            <section
              className="block"
              id="s-forecast"
              data-assist-title-ko={forecastAssistInsight?.titleKo}
              data-assist-title-en={forecastAssistInsight?.titleEn}
              data-assist-summary-ko={forecastAssistInsight?.summaryKo}
              data-assist-summary-en={forecastAssistInsight?.summaryEn}
              data-assist-actions-ko={forecastAssistInsight?.actionsKo?.join("|||")}
              data-assist-actions-en={forecastAssistInsight?.actionsEn?.join("|||")}
            >
              <h2 className="section-title">{tx("📈 예측 전용 회귀 · 미래 예측", "📈 Forecast regression · future prediction")} <span style={{ fontSize: "12px", color: MUTED, fontWeight: 400 }}>{tx("· MMM 기여 분석과 별도 모델", "· separate from MMM contribution model")}</span></h2>
              <p style={{ fontSize: "12px", color: MUTED, marginBottom: "12px", lineHeight: 1.55 }}>
                {forecast?.isStructural
                  ? tx("과거 OOS로 모델을 고르고, 기준선보다 나쁘면 최근평균으로 되돌립니다.", "Models are selected by historical OOS; horizons that lose to baseline fall back to the recent average.")
                  : forecast?.isPaidOrganicSplit
                    ? tx("OS별 Organic=Total−Paid와 Paid를 따로 예측해 합산합니다. Halo는 그룹 Spend, Paid는 원 채널 Spend를 사용합니다.", "Organic=Total−Paid and Paid are forecast separately by OS and then summed. Halo uses aggregate spend; Paid uses original-channel spend.")
                  : forecast?.isAnnualAnalog
                      ? forecast.organicOnly
                        ? tx("Spend가 없어 Organic 추세·계절성만 예측합니다.", "Without spend, only Organic trend and seasonality are forecast.")
                      : forecast.paidOrganicHybrid
                      ? tx("Paid·Organic 후보를 과거 OOS로 비교합니다.", "Paid/Organic candidates are compared on historical OOS.")
                      : tx("기간·계절 후보를 과거 OOS로 비교합니다.", "Window and seasonal candidates are compared on historical OOS.")
                  : tx(`이 CSV에서 여러 모델 후보를 rolling OOS로 비교합니다. 마지막 ${fcHorizon}주는 선택에 쓰지 않습니다.`, `Multiple model candidates are compared on rolling OOS for this CSV. The final ${fcHorizon} weeks are not used for selection.`)}
              </p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px", alignItems: "center" }}>
                <div className="ab-pillgroup">
                  <span className="ab-pillgroup-label">{tx("모델", "Model")}</span>
                  <span className="ab-pill active">{forecast?.isStructural
                    ? tx("라이브 OOS 자동선택 · naive 안전장치", "Live-OOS selection · naive guardrail")
                    : forecast?.isPaidOrganicSplit
                      ? tx("Organic 기저+halo · Paid Spend 회귀", "Organic baseline+halo · Paid spend regression")
                    : forecast?.isAnnualAnalog
                      ? forecast.organicOnly
                        ? tx("Organic 추세·계절성 · Spend 없음", "Organic trend/seasonality · no Spend")
	                      : forecast.paidOrganicHybrid
	                        ? tx(`Paid·Organic 자동 탐색 · 현재 데이터 최대 ${forecast.modelSearch?.feasibleMaxTrainingWeeks ?? "—"}주`, `Paid/Organic auto-search · current-data max ${forecast.modelSearch?.feasibleMaxTrainingWeeks ?? "—"} weeks`)
	                        : tx(`기간·연간 패턴 자동 탐색 · 현재 데이터 최대 ${forecast.modelSearch?.feasibleMaxTrainingWeeks ?? "—"}주`, `Window/annual-pattern search · current-data max ${forecast.modelSearch?.feasibleMaxTrainingWeeks ?? "—"} weeks`)
                      : tx("Rolling OOS 자동 탐색", "Rolling-OOS auto search")}</span>
                </div>
                <div className="ab-pillgroup">
                  <span className="ab-pillgroup-label">{tx("범위", "Range")}</span>
                  <span className="ab-pill active">{hasPointPlusForecastOuterP90
                    ? tx("점 예측 ± 바깥 OOS P90 오차", "Point forecast ± outer-OOS P90 error")
                    : hasAggregateForecastOuterP90
                      ? tx("모델폭 + 바깥 OOS 최소폭", "Model width + outer-OOS minimum")
                    : hasComponentForecastEnvelope
                      ? tx("성분별 OOS 구간 합산", "Sum of component OOS envelopes")
                      : forecastIntervalInfo.kind === "point"
                        ? tx("점 예측 · 경험적 구간 없음", "Point forecast · no empirical interval")
                        : tx("모델 참고폭 · OOS 보정 없음", "Model reference · no OOS widening")}</span>
                </div>
                <label style={{ fontSize: "12px", color: MUTED }}>
                  {tx("예측 기간(주):", "Forecast horizon (wk):")}{" "}
                  <input type="number" min="1" max="52" value={fcHorizonDraft} onChange={(e) => setFcHorizonDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") applyForecastSettings(); }} style={{ width: "60px" }} />
                </label>
                {!forecast?.isStructural && <>
                  <span className="ab-pill">{tx("추세 감쇠 자동 선택", "Trend damping auto-selected")}</span>
                  <label style={{ fontSize: "12px", color: MUTED }}>{tx("미래 이벤트:", "Future events:")} {" "}
                    <select value={fcEventPolicyDraft} onChange={(e) => setFcEventPolicyDraft(e.target.value)}>
                      <option value="hold">{tx("마지막 상태 유지", "Hold last state")}</option><option value="off">{tx("모두 끔", "Turn all off")}</option>
                    </select>
                  </label>
                </>}
                <button type="button" className="ab-pill active" disabled={!isForecastSettingsDirty || isAnalyzing} onClick={applyForecastSettings}>
                  {isAnalyzing ? tx("계산 중…", "Calculating…") : tx("예측 다시 계산", "Recalculate forecast")}
                </button>
              </div>
              {forecast ? (
                <>
                  {forecast.isStructural && (
                    <Card style={{ marginBottom: "12px", padding: "12px 16px" }}>
                      <strong>{tx("라이브 조건 rolling OOS · 조건부 비용 오차 분리", "Live-condition rolling OOS · known-spend error separated")}</strong>
                      <p style={{ margin: "5px 0", fontSize: "11.5px", color: MUTED, lineHeight: 1.5 }}>
                        {(forecast.structuralCandidates || []).map((candidate) => `${candidate.route === "direct-total" ? "Direct Total" : "Android + iOS"} · ${tx("라이브", "live")} ${forecastPct(candidate.pooledWmape)} · ${tx("비용 입력 시", "known spend")} ${forecastPct(candidate.conditionalPooledWmape)} · naive ${forecastPct(candidate.naivePooledWmape)} · ${tx("선택용 과거", "selection history")} ${forecastPct(candidate.developmentPooledWmape)}`).join(" / ")}
                        {` → ${forecast.structuralRoute === "direct-total" ? "Direct Total" : "Android + iOS"} ${tx("선택", "selected")}`}
                      </p>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <span className="ab-pill" style={forecast.structuralEligible ? { borderColor: "var(--success)", color: "var(--success)" } : { borderColor: "var(--danger)", color: "var(--danger)" }}>
                          {forecast.structuralEligible ? tx("공식 10% 인증 통과", "Official 10% certification passed") : tx("공식 10% 인증 실패", "Official 10% certification failed")}
                        </span>
                        <span className="ab-pill" style={forecast.structuralShortTermEligible ? { borderColor: "var(--success)", color: "var(--success)" } : { borderColor: "var(--danger)", color: "var(--danger)" }}>
                          {forecast.structuralShortTermEligible
                            ? tx(`단기 ${forecast.structuralRecommendedHorizon}주 사용 가능`, `Short-term use: ${forecast.structuralRecommendedHorizon} weeks`)
                            : tx("단기 운영 기준도 미달", "Short-term operating gate failed")}
                        </span>
                        <span className="ab-pill" style={forecast.structuralOsBreakdownEligible ? undefined : { borderColor: "var(--danger)", color: "var(--danger)" }}>
                          {forecast.structuralOsBreakdownEligible ? tx("OS 분해 사용 가능", "OS breakdown usable") : tx("OS 분해 사용 불가", "OS breakdown unavailable")}
                        </span>
                        <span className="ab-pill">{tx("부분 주차 자동 제외", "Partial current week excluded")}</span>
                        <span className="ab-pill">{tx(`${forecast.structuralSelectedSpec?.trainingWindow || "—"}주 학습`, `${forecast.structuralSelectedSpec?.trainingWindow || "—"}-week training window`)}</span>
                        <span className="ab-pill">{forecast.structuralSelectedSpec?.id || "—"}</span>
                        <span className="ab-pill">{tx(`${forecast.structuralFoldStep || 4}주 간격 OOS`, `${forecast.structuralFoldStep || 4}-week OOS step`)}</span>
                        <span className="ab-pill">{tx("Perf 절대 수준 ≥ 0", "Absolute Perf level ≥ 0")}</span>
                      </div>
                      {!forecast.structuralComponentCertificationComplete && (
                        <p style={{ margin: "7px 0 0", color: "var(--warning)", fontSize: "11.5px", lineHeight: 1.5 }}>
                          {tx(
                            "Total 예측은 표시하지만 플랫폼·Organic/Paid 하위 오차를 모두 닫지 못해 공식 인증과 Cost 변경은 잠갔습니다.",
                            "The Total forecast remains visible, but official certification and Cost changes are locked because platform and Organic/Paid component errors could not all be closed.",
                          )}
                        </p>
                      )}
                      {!forecast.structuralHistoricallyStable && (
                        <p style={{ margin: "7px 0 0", color: "var(--warning)", fontSize: "11.5px", lineHeight: 1.5 }}>
                          {tx("전 구간 10% 인증은 엄격하게 유지합니다. 검증된 단기 구간만 열고, 그 이후는 최근값 naive로 전환합니다.", "The every-window 10% gate remains strict. Only validated short-term horizons are opened; later horizons fall back to the recent-value naive forecast.")}
                        </p>
                      )}
                      <details style={{ marginTop: "8px" }}>
                        <summary style={{ cursor: "pointer", fontSize: "11.5px" }}>{tx("26·52·78주 학습 기간 비교", "Compare 26-, 52-, and 78-week training windows")}</summary>
                        <div className="table-wrap" style={{ marginTop: "7px" }}>
                          <table className="data" style={{ fontSize: "11px" }}>
                            <thead><tr><th>{tx("학습 기간", "Training window")}</th><th>{tx("검증 선택 경로", "Validated route")}</th><th>{tx("선택용 과거 OOS", "Selection-history OOS")}</th><th>{tx("전체 라이브 OOS", "Full live OOS")}</th><th>{tx("비용 입력 시", "Known spend")}</th><th>naive</th></tr></thead>
                            <tbody>
                              {(forecast.structuralLookbackCandidates || []).map((candidate) => (
                                <tr key={candidate.trainingWindow} style={candidate.trainingWindow === forecast.structuralSelectedSpec?.trainingWindow ? { fontWeight: 700 } : undefined}>
                                  <td>{candidate.trainingWindow}{tx("주", " weeks")}</td>
                                  <td>{candidate.available ? candidate.route === "direct-total" ? "Direct Total" : "Android + iOS" : tx("근거 부족", "Insufficient evidence")}</td>
                                  <td className="tnum">{candidate.available ? forecastPct(candidate.developmentPooledWmape) : "—"}</td>
                                  <td className="tnum">{candidate.available ? forecastPct(candidate.pooledWmape) : "—"}</td>
                                  <td className="tnum">{candidate.available ? forecastPct(candidate.conditionalPooledWmape) : "—"}</td>
                                  <td className="tnum">{candidate.available ? forecastPct(candidate.naivePooledWmape) : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                      <details style={{ marginTop: "8px" }}>
                        <summary style={{ cursor: "pointer", fontSize: "11.5px" }}>{tx("전체 OOS 오차 흐름 보기", "View full OOS error trajectory")}</summary>
                        <div className="table-wrap" style={{ marginTop: "7px" }}>
                          <table className="data" style={{ fontSize: "11px" }}>
                            <thead><tr><th>{tx("뒤에서 제외", "Excluded from end")}</th><th>{tx("검증 기간", "Validation period")}</th><th>{tx("라이브", "Live")}</th><th>{tx("비용 입력 시", "Known spend")}</th><th>naive</th><th>{tx("변화", "Break")}</th></tr></thead>
                            <tbody>
                              {((forecast.structuralCandidates || []).find((candidate) => candidate.route === forecast.structuralRoute)?.folds || []).map((fold) => (
                                <tr key={fold.offset}>
                                  <td>{fold.excludedWeeks}{tx("주", " wk")}</td>
                                  <td>{fold.start}–{fold.end}</td>
                                  <td className="tnum" style={fold.wmape >= 10 ? { color: "var(--danger)" } : undefined}>{forecastPct(fold.wmape)}</td>
                                  <td className="tnum">{forecastPct(fold.conditionalWmape)}</td>
                                  <td className="tnum">{forecastPct(fold.naiveWmape)}</td>
                                  <td>{fold.regime?.isBreak ? `⚠ ${fold.regime.reasons.join("/")}` : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                      <details style={{ marginTop: "8px" }}>
                        <summary style={{ cursor: "pointer", fontSize: "11.5px" }}>{tx("예측 거리별 정확도·naive 비교", "Accuracy and naive benchmark by horizon")}</summary>
                        <div className="table-wrap" style={{ marginTop: "7px" }}>
                          <table className="data" style={{ fontSize: "11px" }}>
                            <thead><tr><th>h</th><th>{tx("라이브 wMAPE", "Live wMAPE")}</th><th>{tx("비용 입력 시", "Known spend")}</th><th>naive</th><th>MASE</th><th>{tx("선택", "Choice")}</th></tr></thead>
                            <tbody>
                              {((forecast.structuralCandidates || []).find((candidate) => candidate.route === forecast.structuralRoute)?.horizonMetrics || []).map((metric, index) => (
                                <tr key={metric.horizon}>
                                  <td>{metric.horizon}{tx("주", "w")}</td>
                                  <td className="tnum" style={metric.wmape >= 10 ? { color: "var(--danger)" } : undefined}>{forecastPct(metric.wmape)}</td>
                                  <td className="tnum">{forecastPct(metric.conditionalWmape)}</td>
                                  <td className="tnum">{forecastPct(metric.naiveWmape)}</td>
                                  <td className="tnum">{Number.isFinite(metric.mase) ? metric.mase.toFixed(2) : "—"}</td>
                                  <td>{((forecast.structuralCandidates || []).find((candidate) => candidate.route === forecast.structuralRoute)?.useModelByHorizon || [])[index] ? tx("모델", "Model") : "naive"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                      {forecast.structuralDiagnostics && (
                        <p style={{ margin: "7px 0 0", fontSize: "11.5px", color: MUTED, lineHeight: 1.5 }}>
                          {tx(
                            `최근 12주 vs 직전 12주: Paid CPA ${fmtSignedOne(forecast.structuralDiagnostics.paidCpaChangePct)}% · Organic 주평균 ${fmtSignedOne(forecast.structuralDiagnostics.organicMeanChangePct)}% · Cost ${fmtSignedOne(forecast.structuralDiagnostics.spendChangePct)}%. 최근 CPA·Organic 수준 변화는 구조변화 경고로 함께 해석하세요.`,
                            `Latest 12 vs prior 12 weeks: Paid CPA ${fmtSignedOne(forecast.structuralDiagnostics.paidCpaChangePct)}% · weekly Organic ${fmtSignedOne(forecast.structuralDiagnostics.organicMeanChangePct)}% · Cost ${fmtSignedOne(forecast.structuralDiagnostics.spendChangePct)}%. Treat recent CPA and Organic level shifts as regime-change warnings.`
                          )}
                        </p>
                      )}
                    </Card>
                  )}
                  {forecast.nestedRouteDecision && (
                    <Card style={{ marginBottom: "12px", padding: "12px 16px" }}>
                      <strong>{tx("Actual Cost 조건부 nested rolling OOS", "Actual-Cost conditional nested rolling OOS")}</strong>
                      <p style={{ margin: "5px 0", fontSize: "11.5px", color: MUTED, lineHeight: 1.5 }}>
                        {(forecast.nestedRouteDecision.candidates || []).map((candidate) =>
                          `${candidate.route === "direct-total" ? "Direct Total" : "Android + iOS"} · ${tx("선택용 과거", "selection history")} ${forecastPct(candidate.developmentWmape)} · ${tx(`봉인 최신 ${fcHorizon}주`, `sealed latest ${fcHorizon} weeks`)} ${forecastPct(candidate.latestWmape)}`
                        ).join(" / ")}
                      </p>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <span className="ab-pill" style={forecast.nestedRouteDecision.certified ? { borderColor: "var(--success)", color: "var(--success)" } : { borderColor: "var(--danger)", color: "var(--danger)" }}>
                          {forecast.nestedRouteDecision.certified
                            ? tx(`공식 OOS ${forecastPct(forecast.nestedRouteDecision.latestWmape)} · 10% 인증`, `Official OOS ${forecastPct(forecast.nestedRouteDecision.latestWmape)} · certified under 10%`)
                            : tx(`공식 OOS ${forecastPct(forecast.nestedRouteDecision.latestWmape)} · 10% 미인증`, `Official OOS ${forecastPct(forecast.nestedRouteDecision.latestWmape)} · not certified under 10%`)}
                        </span>
                        <span className="ab-pill">
                          {tx(
                            `미래 운영 경로: ${forecast.nestedRouteDecision.productionRoute === "direct-total" ? "Direct Total" : "Android + iOS"}`,
                            `Production route: ${forecast.nestedRouteDecision.productionRoute === "direct-total" ? "Direct Total" : "Android + iOS"}`,
                          )}
                        </span>
                        {(forecast.nestedRouteDecision.osGuardrail || []).map((component) => (
                          <span
                            className="ab-pill"
                            key={component.component}
                            style={component.passed ? { borderColor: "var(--success)", color: "var(--success)" } : { borderColor: "var(--danger)", color: "var(--danger)" }}
                          >
                            {`${component.component} · ${tx("과거", "history")} ${forecastPct(component.developmentWmape)} · ${tx("최신", "latest")} ${forecastPct(component.latestWmape)}`}
                          </span>
                        ))}
                      </div>
                      <p style={{ margin: "6px 0 0", fontSize: "11.5px", color: MUTED, lineHeight: 1.5 }}>
                        {forecast.nestedRouteDecision.componentGuardrailRequired === false
                          ? tx(
                            `Web·기타 플랫폼이 있어 Android+iOS는 진단 후보로만 비교합니다. 공식 OOS·미래 예측·인증은 전체 행을 사용한 Direct Total 기준이며, 최신 ${fcHorizon}주의 성과는 선택에서 가립니다.`,
                            `Because Web or another platform is present, Android+iOS is retained only as a diagnostic challenger. Official OOS, production forecasting, and certification use Direct Total over all rows; outcomes for the latest ${fcHorizon} weeks remain sealed from selection.`,
                          )
                          : tx(`각 cutoff마다 더 오래된 OOS만으로 기간과 모델을 다시 고릅니다. 최신 ${fcHorizon}주의 성과는 선택에서 가리고 Actual Cost와 알려진 Step만 입력합니다. 한 OS라도 10% 기준을 넘으면 인증하지 않습니다.`, `At every cutoff, the window and model are reselected using only older OOS folds. Outcomes for the latest ${fcHorizon} weeks are hidden from selection; only Actual Cost and known Steps are supplied. Certification is withheld if either OS breaches the 10% gate.`)}
                      </p>
                    </Card>
                  )}
                  {forecast.isAdditiveTotal && (
                    <Card style={{ marginBottom: "12px", padding: "12px 16px" }}>
                      <strong>{forecast.isPaidOrganicSplit
                        ? tx("Total = Android(Organic + Paid) + iOS(Organic + Paid)", "Total = Android (Organic + Paid) + iOS (Organic + Paid)")
                        : tx("Total 예측 = Android 예측 + iOS 예측", "Total forecast = Android forecast + iOS forecast")}</strong>
                      <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: MUTED, lineHeight: 1.5 }}>
                        {forecast.isPaidOrganicSplit
                          ? tx("Organic 실측은 Total−Paid입니다. Halo는 Brand·Performance 총 Spend의 양·음 연관으로, Paid는 원 채널별 직접반응으로 적합합니다. 서로 다른 실측 성분이라 중복 합산하지 않습니다.", "Observed Organic is Total−Paid. Halo is fit as a signed association with aggregate Brand/Performance spend; Paid is fit as direct response by original channel. The disjoint observed components are not double-counted.")
                          : tx("Total에 별도 Cost 회귀를 적합하지 않습니다. 아래 검증·기준선·미래 예측은 각 OS 결과를 같은 주차끼리 더한 값입니다.", "No separate Cost regression is fit for Total. Validation, baseline, and forecasts below are same-week sums of the two OS results.")}
                      </p>
                      {forecast.isPaidOrganicSplit && recentBacktest?.segmentMetrics && (
                        <>
                          <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", marginTop: "9px" }}>
                            {[
                              ["Organic", recentBacktest.segmentMetrics.organic],
                              ["Paid", recentBacktest.segmentMetrics.paid],
                              ["Total", recentBacktest.segmentMetrics.total],
                            ].map(([label, value]) => (
                              <span
                                className="ab-pill"
                                key={label}
                                style={Number.isFinite(value) && value < 10
                                  ? { borderColor: "var(--success)", color: "var(--success)" }
                                  : { borderColor: "var(--danger)", color: "var(--danger)" }}
                              >
                                {tx(`최근 ${fcHorizon}주`, `Latest ${fcHorizon} weeks`)} · {label} {forecastPct(value, 1)}
                              </span>
                            ))}
                          </div>
                          <details style={{ marginTop: "8px" }}>
                            <summary style={{ cursor: "pointer", fontSize: "11.5px" }}>{tx("Android·iOS 성분 검증", "Android/iOS component validation")}</summary>
                            <div className="table-wrap" style={{ marginTop: "6px" }}>
                              <table className="data" style={{ fontSize: "11px" }}>
                                <thead><tr><th>OS</th><th>{tx("성분", "Component")}</th><th>{tx(`최근 ${fcHorizon}주 wMAPE`, `Latest-${fcHorizon}-week wMAPE`)}</th></tr></thead>
                                <tbody>
                                  {(recentBacktest.componentMetrics || []).map((metric) => (
                                    <tr key={`${metric.platform}-${metric.component}`}>
                                      <td>{metric.platform}</td>
                                      <td>{{ organic: "Organic", paid: "Paid", total: "Total" }[metric.component]}</td>
                                      <td className="tnum" style={metric.passed ? { color: "var(--success)" } : { color: "var(--danger)", fontWeight: 700 }}>
                                        {forecastPct(metric.wmape, 1)} · {metric.passed ? tx("통과", "Pass") : tx("미달", "Fail")}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </details>
                          <details style={{ marginTop: "8px" }}>
                            <summary style={{ cursor: "pointer", fontSize: "11.5px" }}>{tx("자동 선택된 4개 성분 모델", "Four automatically selected component models")}</summary>
                            <div className="table-wrap" style={{ marginTop: "6px" }}>
                              <table className="data" style={{ fontSize: "11px" }}>
                                <thead><tr><th>OS</th><th>{tx("성분", "Component")}</th><th>{tx("선택 구조", "Selected structure")}</th><th>{tx("미래 결합", "Future blend")}</th><th>OOS</th></tr></thead>
                                <tbody>
                                  {(forecast.platformForecasts || []).flatMap((part) =>
                                    Object.entries(part.componentForecasts || {}).map(([component, componentForecast]) => {
                                      const selectedComponent = componentForecast.rollingSelection?.productionSelected
                                        || componentForecast.rollingSelection?.selected;
                                      if (!selectedComponent) return null;
                                      const weight = Number.isFinite(selectedComponent.selectedBlend?.regressionWeight)
                                        ? selectedComponent.selectedBlend.regressionWeight
                                        : 1;
                                      const baseline = forecastNaiveBaselineLabel(
                                        selectedComponent.selectedBlend?.baselineId || selectedComponent.bestBaselineId,
                                        tx,
                                      );
                                      return <tr key={`${part.platform}-${component}`}>
                                        <td>{part.platform}</td>
                                        <td>{component === "organic" ? "Organic" : "Paid"}</td>
                                        <td>{selectedComponent.windowMode === "expanding"
                                          ? tx("누적 이력", "expanding history")
                                          : tx(`${selectedComponent.window}주 고정`, `${selectedComponent.window}wk fixed`)} · {selectedComponent.spec} · ridge {selectedComponent.mediaPenaltyStrength ?? 0} · {tx("감쇠", "damping")} {selectedComponent.trendDamping ?? "—"}</td>
                                        <td>{weight < 1
                                          ? tx(`회귀 ${Math.round(weight * 100)}% + ${baseline} ${Math.round((1 - weight) * 100)}%`, `${Math.round(weight * 100)}% regression + ${Math.round((1 - weight) * 100)}% ${baseline}`)
                                          : tx("회귀 100%", "100% regression")}</td>
                                        <td className="tnum">{forecastPct(selectedComponent.wmape, 1)}</td>
                                      </tr>;
                                    }),
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </details>
                        </>
                      )}
                      {!forecast.isPaidOrganicSplit && (forecast.components || []).map((component) => {
                        const componentSelected = component.rollingSelection?.productionSelected
                          || component.rollingSelection?.selected;
                        return componentSelected ? (
                          <p key={component.platform} style={{ margin: "5px 0 0", fontSize: "11.5px", color: MUTED }}>
                            <strong>{component.platform}</strong>{tx(
                              ` · 최근 ${componentSelected.window}주 Cost · rolling wMAPE ${forecastPct(componentSelected.wmape, 1)} (최강 단순 기준선 ${forecastPct(componentSelected.bestBaselineWmape, 1)})`,
                              ` · latest ${componentSelected.window} weeks of Cost · rolling wMAPE ${forecastPct(componentSelected.wmape, 1)} (strongest naive ${forecastPct(componentSelected.bestBaselineWmape, 1)})`,
                            )}
                          </p>
                        ) : null;
                      })}
                    </Card>
                  )}
                  {forecast.paidOrganicUnavailable && (
                    <div className="callout warn" style={{ marginBottom: "12px" }}>
                      <div className="ico">!</div>
                      <div className="body">
                        <strong>{tx("PaidRegs가 없어 Total만 예측합니다", "PaidRegs is unavailable, so only Total is forecast")}</strong>
                        <p>{tx("Spend가 있어도 Paid와 Organic 실측이 분리되지 않으면 Paid 직접반응과 Organic halo를 따로 식별할 수 없습니다. PaidRegs를 매핑하면 OS별 분리 모델로 자동 전환합니다.", "Spend alone cannot separate direct Paid response from the Organic halo without observed Paid and Organic components. Map PaidRegs to switch automatically to the OS-level split model.")}</p>
                      </div>
                    </div>
                  )}
                  {forecast.rollingSelection?.selected && (() => {
	                    const auditSelected = forecast.rollingSelection.selected;
	                    const selected = forecast.rollingSelection.productionSelected || auditSelected;
	                    if (forecast.isAnnualAnalog) {
	                      const feasibleMaxTrainingWeeks = forecast.modelSearch?.feasibleMaxTrainingWeeks;
	                      const excludedTrainingWindows = forecast.modelSearch?.excludedTrainingWindows || [];
	                      return (
                        <Card className="forecast-validation-card" style={{ marginBottom: "12px", padding: "13px 16px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", flexWrap: "wrap" }}>
                            <div>
                              <span className="forecast-validation-card__eyebrow">FORECAST VALIDATION</span>
                              <strong>{forecast.annualQualified ? tx("예측 검증 통과", "Forecast validation passed") : tx("예측 검증 미통과", "Forecast validation did not pass")}</strong>
                              <p>{tx(`봉인 ${fcHorizon}주 ${forecastPct(selected.latestWmape, 1)} · 바깥 rolling OOS ${forecastPct(selected.wmape, 1)} · 기준 10% 미만`, `Sealed ${fcHorizon} weeks ${forecastPct(selected.latestWmape, 1)} · outer rolling OOS ${forecastPct(selected.wmape, 1)} · threshold below 10%`)}</p>
                            </div>
                            <span className="ab-pill" style={forecast.annualQualified ? { borderColor: "var(--success)", color: "var(--success)" } : { borderColor: "var(--warning)", color: "var(--warning)" }}>
                              {forecast.annualQualified ? tx("운영 사용 가능", "Ready for operations") : tx("예산 변경 잠금", "Budget changes locked")}
                            </span>
                          </div>
                          {!forecast.annualQualified && <div className="forecast-validation-card__action">{tx("지금은 기본 예측만 참고하고, 예산 증감·광고 OFF 판단은 보류하세요.", "Use only the base forecast for now; hold budget-change and ad-off decisions.")}</div>}
                          <details className="forecast-validation-card__details">
                            <summary>{tx("모델 검증 상세", "Model validation details")}</summary>
                            <p>{(forecast.annualCandidates || []).map((candidate) => `${annualCandidateRouteLabel(candidate.route, tx)} · ${tx("선택용", "development")} ${forecastPct(candidate.developmentWmape)} · ${tx("봉인", "sealed")} ${forecastPct(candidate.latestWmape)}${candidate.comparisonOrigins ? ` · n=${candidate.comparisonOrigins}` : ""}`).join(" / ")}</p>
	                            <p><strong>{tx("선택 근거: ", "Selection: ")}</strong>{forecastSelectionDecisionText(forecast.modelSearch?.routeDecision, locale)}</p>
	                            <p><strong>{tx("안전장치: ", "Guardrail: ")}</strong>{forecastGuardrailSummaryText(forecast.modelSearch, locale)}</p>
	                            <p>
	                              <strong>{tx("기간 근거: ", "Window evidence: ")}</strong>
	                              {Number.isFinite(feasibleMaxTrainingWeeks)
	                                ? tx(
	                                  `현재 ${forecast.modelSearch?.observedWeeks ?? "—"}주와 독립 OOS 조건에서 최대 ${feasibleMaxTrainingWeeks}주 후보까지 비교했습니다.`,
	                                  `With ${forecast.modelSearch?.observedWeeks ?? "—"} observed weeks and the independent-OOS requirement, candidates up to ${feasibleMaxTrainingWeeks} weeks were eligible.`,
	                                )
	                                : tx("독립 OOS를 확보한 기간 후보가 없습니다.", "No training-window candidate has enough independent OOS evidence.")}
	                              {excludedTrainingWindows.length > 0 && tx(
	                                ` 제외: ${excludedTrainingWindows.map((item) => `${item.window}주(최소 ${item.minimumObservedWeeks}주 필요)`).join(" · ")}.`,
	                                ` Excluded: ${excludedTrainingWindows.map((item) => `${item.window} weeks (needs at least ${item.minimumObservedWeeks})`).join(" · ")}.`,
	                              )}
	                            </p>
	                            {(forecast.annualOsGuardrail || []).length > 0 && (
                                <div>
                                  <p><strong>{forecast.annualComponentGuardrailRequired === false
                                    ? tx("Android+iOS 진단(인증 비적용)", "Android+iOS diagnostic (not a certification gate)")
                                    : tx("Android+iOS 성분 인증", "Android+iOS component certification")}</strong></p>
                                  {(forecast.annualOsGuardrail || []).map((component) => <span className="ab-pill" key={component.component} style={component.passed ? { borderColor: "var(--success)", color: "var(--success)" } : { borderColor: "var(--danger)", color: "var(--danger)" }}>{`${component.component} · ${tx("과거", "history")} ${forecastPct(component.developmentWmape)} · ${tx("최근", "latest")} ${forecastPct(component.latestWmape)}`}</span>)}
                                </div>
                              )}
                          </details>
                        </Card>
                      );
                    }
                    const candidateWindowLabel = (candidate) => candidate?.windowMode === "expanding"
                      ? tx("누적 이력", "expanding history")
                      : tx(`${candidate?.window ?? "—"}주 고정`, `${candidate?.window ?? "—"}-week fixed`);
                    const seasonalityPeriods = selected.seasonalityPeriods || [];
                    const seasonLabel = seasonalityPeriods.length === 0
                      ? tx("계절성 없음", "no seasonality")
                      : selected.seasonalityScope === "global" && seasonalityPeriods.length === 1
                        ? tx("전체 이력 분기 계절성", "full-history quarterly seasonality")
                        : selected.seasonalityScope === "global"
                          ? tx("전체 이력 연간·분기 계절성", "full-history annual/quarterly seasonality")
                          : seasonalityPeriods.length === 1
                            ? tx("분기 계절성", "quarterly seasonality")
                            : tx("연간·분기 계절성", "annual/quarterly seasonality");
                    const trendLabel = selected.trendScope === "global"
                      ? selected.trendWindow === "all"
                        ? tx("전체 이력 추세", "full-history trend")
                        : tx(`최근 ${selected.trendWindow}주 추세`, `recent ${selected.trendWindow}-week trend`)
                      : selected.trendScope === "none"
                        ? tx("무추세", "no trend")
                        : tx("Cost 학습창 내 추세", "trend within Cost window");
                    const eventAdjustedLabel = selected.trendEventControls > 0
                      ? tx(`이벤트·step ${selected.trendEventControls}개 효과 제거 후`, `after controlling ${selected.trendEventControls} event/step effect(s)`)
                      : null;
                    const regressionWeight = Number.isFinite(selected.selectedBlend?.regressionWeight)
                      ? selected.selectedBlend.regressionWeight
                      : 1;
                    const naiveWeight = 1 - regressionWeight;
                    const baselineLabel = forecastNaiveBaselineLabel(selected.selectedBlend?.baselineId || selected.bestBaselineId, tx);
                    const selectionFoldCount = selected.selectionFolds ?? selected.folds ?? 0;
                    const evaluatedConfigurations = forecast.rollingSelection.evaluatedCandidateConfigurations
                      || forecast.rollingSelection.candidates?.length
                      || 0;
                    const plannedConfigurations = forecast.rollingSelection.plannedCandidateConfigurations
                      || evaluatedConfigurations;
                    const attemptedConfigurations = forecast.rollingSelection.attemptedCandidateConfigurations
                      || evaluatedConfigurations;
                    const availableConfigurations = forecast.rollingSelection.availableCandidateConfigurations
                      || evaluatedConfigurations;
                    const candidateSearchAudit = forecast.rollingSelection.candidateSearchAudit;
                    const transformFamilies = (selected.mediaTransformFamilies || []).join("·") || selected.transformPolicy || "—";
                    const transformLabel = selected.transformPolicy === "auto"
                      ? tx(`채널별 ${transformFamilies} 선택`, `per-channel ${transformFamilies}`)
                      : tx(`매체 변환 ${selected.transformPolicy || "—"}`, `media transform ${selected.transformPolicy || "—"}`);
                    return (
                      <Card style={{ marginBottom: "12px", padding: "12px 16px" }}>
                        <strong>{tx("실제 미래 예측 모델", "Model used for the actual future forecast")} <ForecastHint label={tx(
                          "후보 선택 규칙 v1: 전체·최근 OOS, 나쁜 구간 위험, fold 안정성, 복잡도 벌점을 함께 보는 제품 정책입니다. 데이터가 학습한 절대 진실이 아니라, 검증 후보를 고르는 사전 규칙입니다.",
                          "Selection policy v1: a product rule that balances full/recent OOS, bad-window risk, fold stability, and complexity. It is a prior for selecting among validated candidates, not a learned truth.",
                        )} /></strong>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                          <span className="ab-pill">{candidateWindowLabel(selected)} · {trendLabel} · {seasonLabel}</span>
                          <span
                            className="ab-pill"
                            title={tx(
                              `회귀 단독 ${forecastPct(selected.regressionWmape, 1)} · 최강 단순 기준선 ${forecastPct(selected.bestBaselineWmape, 1)}`,
                              `Regression only ${forecastPct(selected.regressionWmape, 1)} · strongest naive ${forecastPct(selected.bestBaselineWmape, 1)}`,
                            )}
                          >
                            {tx("바깥 nested OOS", "Nested outer OOS")} {forecastPct(selected.wmape, 1)}
                          </span>
                          <span className="ab-pill" title={tx("과거 검증 구간에서만 선택한 미래 결합비입니다.", "This future blend was selected using historical validation folds only.")}>
                            {naiveWeight > 0
                              ? tx(`회귀 ${Math.round(regressionWeight * 100)}% + ${baselineLabel} ${Math.round(naiveWeight * 100)}%`, `${Math.round(regressionWeight * 100)}% regression + ${Math.round(naiveWeight * 100)}% ${baselineLabel}`)
                              : tx("회귀 100%", "100% regression")}
                          </span>
                          <span className="ab-pill">{tx("단순 기준선 대비 승리", "Wins vs naive")} {selected.baselineFoldWins ?? selected.foldWins}/{selectionFoldCount}</span>
                          {selected.dataPreservation?.applied && <span className="ab-pill">{tx("근소한 차이 · 긴 이력 유지", "Near tie · longer history kept")} <ForecastHint label={tx(
                            `오차 차이가 ${selected.dataPreservation.tolerancePoints?.toFixed?.(2) ?? "—"}%p 이내여서 더 긴 이력을 유지했습니다. 이 선택은 데이터가 한 후보만 강하게 지지한다는 뜻이 아닙니다.`,
                            `The error difference was within ${selected.dataPreservation.tolerancePoints?.toFixed?.(2) ?? "—"}pp, so the longer history was retained. This does not mean the data strongly supports only one candidate.`,
                          )} /></span>}
                          <span className="ab-pill">{transformLabel}</span>
                          {Number.isFinite(selected.mediaPenaltyStrength) && <span className="ab-pill">ridge {selected.mediaPenaltyStrength}</span>}
                          {Number.isFinite(selected.trendDamping) && <span className="ab-pill">{tx("감쇠", "damping")} {selected.trendDamping}</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "7px", fontSize: "11px", color: MUTED }}>
                          <span>{tx(`검증 후보 ${evaluatedConfigurations}개`, `${evaluatedConfigurations} validated candidates`)}</span>
                          <ForecastHint label={tx(
                            `가능 ${availableConfigurations}개 중 브라우저 계획 ${plannedConfigurations}개, 시도 ${attemptedConfigurations}개, 안정 적합 ${evaluatedConfigurations}개를 nested OOS로 비교했습니다. 전체 조합의 수학적 최적값이 아니라 검증한 후보 중 선택입니다.`,
                            `Of ${availableConfigurations} possible combinations, the browser planned ${plannedConfigurations}, attempted ${attemptedConfigurations}, and stably fitted ${evaluatedConfigurations} for nested OOS. This is the winner among evaluated candidates, not a claimed mathematical optimum over every combination.`,
                          )} />
                          {candidateSearchAudit && !candidateSearchAudit.complete && <><span className="ab-pill" style={{ color: "var(--warning)" }}>{tx("후보 탐색 일부 미완료", "Candidate search incomplete")}</span><ForecastHint label={candidateSearchAudit.reasons.map((reason) => forecastScenarioReasonLabel(reason, tx)).join(" · ")} /></>}
                        </div>
                        {eventAdjustedLabel && <p style={{ margin: "6px 0 0", fontSize: "11px", color: MUTED }}>{eventAdjustedLabel}</p>}
                        {auditSelected.candidateId !== selected.candidateId && (
                          <p style={{ margin: "6px 0 0", fontSize: "11px", color: MUTED }}>
                            {tx(
                              `봉인 감사 선택: ${candidateWindowLabel(auditSelected)} · ${auditSelected.spec} / 미래 재적합: ${candidateWindowLabel(selected)} · ${selected.spec}`,
                              `Sealed-audit selection: ${candidateWindowLabel(auditSelected)} · ${auditSelected.spec} / future refit: ${candidateWindowLabel(selected)} · ${selected.spec}`,
                            )}
                          </p>
                        )}
                        {!forecast.rollingSelection.decisionEligible && <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "7px" }}><span className="ab-pill" style={{ color: "var(--warning)" }}>{tx("Cost 변경 판정 보류", "Cost scenario paused")}</span><ForecastHint label={tx(
                          (forecast.rollingSelection.decisionReasons || []).map((reason) => forecastScenarioReasonLabel(reason, tx)).join(" · ") || "rolling 검증 적격성 미충족",
                          (forecast.rollingSelection.decisionReasons || []).map((reason) => forecastScenarioReasonLabel(reason, tx)).join(" · ") || "rolling validation is not eligible",
                        )} /></div>}
                      </Card>
                    );
                  })()}
                  {!forecastScenario.eligible && !forecast.isAnnualAnalog && (
                    <div className="callout warn" style={{ marginBottom: "12px" }}>
                      <div className="ico">!</div><div className="body">
                        <strong>{tx(`기본 ${fcHorizon}주 예측은 제공하지만, 채널별 Cost 변경은 잠금`, `Base ${fcHorizon}-week forecast is available; channel Cost changes are locked`)}</strong>
                        <ForecastHint label={forecastScenario.reasons.map((reason) => forecastScenarioReasonLabel(reason, tx)).join(" · ")} />
                      </div>
                    </div>
                  )}
                  {forecast.scenarioWarnings?.length > 0 && (
                    <div className="callout warn" style={{ marginBottom: "12px" }}>
                      <div className="ico">!</div><div className="body">
                        <strong>{forecast.scenarioWarnings.some((w) => w.type === "negative-media-effect")
                          ? tx("음의 광고효과 또는 관측 범위 밖 예산 — OFF 시나리오를 인과효과로 해석하지 마세요", "Negative media effect or out-of-range budget — do not interpret OFF as causal")
                          : tx("관측 범위 밖 예산 — 범위 내로 제한해 계산했습니다", "Budget outside observed range — constrained to the observed range")}</strong>
                        <ForecastHint label={forecast.scenarioWarnings.map((w) => w.type === "negative-media-effect"
                          ? tx(
                            `${String(w.key).replace("::", " · ")}: 음의 광고효과 계수(${Number(w.coefficient).toFixed(3)}) — OFF 증분효과 추정 불가`,
                            `${String(w.key).replace("::", " · ")}: negative media coefficient (${Number(w.coefficient).toFixed(3)}) — OFF incrementality is not identifiable`,
                          )
                          : tx(
                            `${String(w.key).replace("::", " · ")}: ${spendValueLabel(w.requested)} (관측 ${spendValueLabel(w.min)}–${spendValueLabel(w.max)})`,
                            `${String(w.key).replace("::", " · ")}: ${spendValueLabel(w.requested)} (observed ${spendValueLabel(w.min)}–${spendValueLabel(w.max)})`,
                          )).join(" · ")} />
                      </div>
                    </div>
                  )}
                  {forecast.baselineFut?.length > 0 && forecastScenario.eligible && (
                    <Card style={{ marginBottom: "12px", padding: "12px 16px" }}>
                      <strong>{forecastScenario.eligible
                        ? tx("광고비 0 기준선(비매체 기준 수요)", "Zero-media baseline (non-media demand)")
                        : tx("비매체 기준 수요(참고값)", "Non-media demand (reference only)")}</strong>
                      <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: MUTED, lineHeight: 1.5 }}>
                        {forecastScenario.eligible
                          ? tx("광고비를 0으로 놓았을 때 모델이 남기는 추정치입니다. 이 값은 증분 효과의 증명이 아니며, 기준선이 최근 실측보다 지나치게 낮으면 광고 OFF 효과를 식별할 수 없다는 뜻입니다.", "The model estimate left after setting media features to zero. It is not proof of incrementality; a baseline far below recent actuals means the ad-off effect is not identified from this data.")
                          : tx("기준선은 표시하지만, 현재 데이터로 광고 OFF 효과는 추정 불가입니다. 음의 기준선이 생기는 경우에는 0으로만 제한해 비현실적인 organic 수치를 만들지 않습니다.", "The baseline is shown, but ad-off impact is not estimable from the current data. A negative restored baseline is only floored at zero to avoid an impossible organic value.")}
                      </p>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                        <span className="ab-pill">{tx("기준선 평균", "Baseline avg")} {targetValueLabel(forecast.baselineFut.reduce((s, v) => s + v, 0) / forecast.baselineFut.length, { perWeek: true })}</span>
                        <span className="ab-pill">{tx("현재 시나리오 평균", "Scenario avg")} {targetValueLabel(forecast.predFut.reduce((s, v) => s + v, 0) / forecast.predFut.length, { perWeek: true })}</span>
                        {forecast.baselineFloorApplied > 0 && <span className="ab-pill" style={{ borderColor: "var(--warning)", color: "var(--warning)" }}>{tx(`기준선 0 하한 ${forecast.baselineFloorApplied}주 적용`, `0 floor applied for ${forecast.baselineFloorApplied} week(s)`)}</span>}
                      </div>
                    </Card>
                  )}
                  {!forecast.isStructural && (
                    <Card style={{ marginBottom: "12px", padding: "14px 16px" }}>
                      <strong>{tx("현재 운영 기간만으로 다시 검증", "Revalidate using the current operating regime")}</strong>
                      {effectiveFcRegimeTrainingWeeks ? (
                        <>
                          <p style={{ margin: "5px 0", fontSize: "11.5px", color: MUTED, lineHeight: 1.5 }}>
                            {tx(`현재 예측 회귀는 최근 ${effectiveFcRegimeTrainingWeeks}주만 학습·검증합니다. 더 이른 기간은 이 예측 모델에서만 제외되며, 원본 CSV와 MMM 기여 분해는 바뀌지 않습니다.`, `This forecast regression trains and validates on only the latest ${effectiveFcRegimeTrainingWeeks} weeks. Earlier history is excluded only from this forecast model; the raw CSV and MMM contribution are unchanged.`)}
                          </p>
                          <button className="ab-pill" disabled={isAnalyzing} onClick={resetRegimeWindow}>{tx("전체 이력으로 되돌리기", "Restore full history")}</button>
                        </>
                      ) : (
                        <>
                          <p style={{ margin: "5px 0", fontSize: "11.5px", color: MUTED, lineHeight: 1.5 }}>
                            {tx(`운영 체제가 바뀌었을 가능성이 있으면 더 짧은 기간도 과거 OOS로 비교합니다. 마지막 ${fcHorizon}주는 기간 선택에 쓰지 않습니다.`, `When the operating regime may have changed, shorter windows are also compared on historical OOS. The final ${fcHorizon} weeks are not used to choose the window.`)}
                          </p>
                          <button className="ab-pill active" disabled={isAnalyzing} onClick={requestRegimeWindowScan}>
                            {isAnalyzing ? tx("기간 후보 계산 중…", "Calculating window candidates…") : tx("현재 운영 기간 후보 찾기", "Find current-regime windows")}
                          </button>
                        </>
                      )}
                      {regimeWindowScan && (
                        <div style={{ marginTop: "10px" }}>
                          {regimeWindowScan.calculationFailed ? (
                            <div className="callout warn"><div className="ico">!</div><div className="body">
                              <strong>{tx("기간 후보 계산을 안전하게 중단했습니다", "Training-window search stopped safely")}</strong>
                              <p>{tx("현재 CSV에서는 후보를 끝까지 비교하지 못했습니다. 원본 데이터는 유지되며 전체 이력 예측은 그대로 사용합니다.", "Candidates could not be compared completely for this CSV. The source data is retained and the full-history forecast remains in use.")}</p>
                            </div></div>
                          ) : regimeWindowScan.recommended ? (
                            <div className="callout good" style={{ marginBottom: "10px" }}><div className="ico">✓</div><div className="body">
                              <strong>{tx(`최근 ${regimeWindowScan.recommended.trainingWeeks}주 (${regimeWindowScan.recommended.startLabel || "날짜 미상"} 이후)를 권장합니다`, `Recommend the latest ${regimeWindowScan.recommended.trainingWeeks} weeks (since ${regimeWindowScan.recommended.startLabel || "unknown date"})`)}</strong>
                              <p>{tx(`선택용 과거 OOS가 전체 이력 ${regimeWindowScan.full.developmentWmape.toFixed(1)}% → ${regimeWindowScan.recommended.developmentWmape.toFixed(1)}%로 개선됐습니다. 봉인 ${fcHorizon}주 오차 ${regimeWindowScan.recommended.latestWmape.toFixed(1)}%는 기간 선택에 쓰지 않았습니다.`, `Development OOS improved from ${regimeWindowScan.full.developmentWmape.toFixed(1)}% on full history to ${regimeWindowScan.recommended.developmentWmape.toFixed(1)}%. The sealed ${fcHorizon}-week error of ${regimeWindowScan.recommended.latestWmape.toFixed(1)}% was not used to choose the window.`)}</p>
                              <button className="ab-pill active" disabled={isAnalyzing} onClick={() => acceptRegimeWindow(regimeWindowScan.recommended)}>{tx("이 기간으로 예측 다시 계산", "Recalculate using this period")}</button>
                            </div></div>
                          ) : (
                            <p className="muted" style={{ margin: "0 0 8px", fontSize: "11.5px" }}>{tx("최소 이력·독립 검증 조건을 지키면서 전체 이력보다 충분히 나은 기간은 찾지 못했습니다. 임의로 과거를 버리지는 않습니다.", "No shorter period improved enough while meeting minimum-history and independent-validation rules. Earlier history will not be removed arbitrarily.")}</p>
                          )}
                          {!regimeWindowScan.calculationFailed && <div className="table-wrap"><table className="data" style={{ fontSize: "11px" }}><thead><tr><th>{tx("학습 시작", "Training starts")}</th><th>{tx("학습 기간", "Training period")}</th><th>{tx("선택용 OOS", "Development OOS")}</th><th>{tx(`봉인 ${fcHorizon}주 감사`, `Sealed ${fcHorizon}-week audit`)}</th><th>{tx("적격", "Eligible")}</th></tr></thead><tbody>
                            {regimeWindowScan.candidates.map((candidate) => <tr key={candidate.trainingWeeks} style={candidate.trainingWeeks === regimeWindowScan.recommended?.trainingWeeks ? { fontWeight: 700 } : undefined}><td>{candidate.startLabel || "—"}</td><td>{candidate.trainingWeeks}{tx("주", " wk")}</td><td className="tnum">{candidate.developmentWmape == null ? "—" : `${candidate.developmentWmape.toFixed(1)}%`}</td><td className="tnum">{candidate.latestWmape == null ? "—" : `${candidate.latestWmape.toFixed(1)}%`}</td><td>{candidate.decisionEligible ? tx("통과", "Pass") : tx("보류", "Hold")}</td></tr>)}
                          </tbody></table></div>}
                        </div>
                      )}
                    </Card>
                  )}
                  {recentBacktest && !forecast.isAnnualAnalog && (
                    <Card style={{ marginBottom: "12px", padding: "14px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", alignItems: "baseline" }}>
                        <div><strong>{tx(`봉인 최근 ${fcHorizon}주 검증`, `Sealed latest-${fcHorizon}-week validation`)}</strong><p style={{ margin: "4px 0 0", fontSize: "11.5px", color: MUTED }}>{tx("실적은 후보 선택·학습에서 가리고 당시 Cost만 입력했습니다.", "Outcomes were hidden from selection and fitting; only the Cost known at that time was supplied.")}</p></div>
                        <span className="ab-pill" style={!recentBacktest.reliable ? { borderColor: "var(--danger)", color: "var(--danger)" } : undefined}>RMSE {targetValueLabel(recentBacktest.rmse)} · MAE {targetValueLabel(recentBacktest.mae)} · wMAPE {Number.isFinite(recentBacktest.wmape) ? `${recentBacktest.wmape.toFixed(1)}%` : "—"}</span>
                      </div>
                      {!recentBacktest.reliable && <div className="callout warn" style={{ marginTop: "10px" }}><div className="ico">!</div><div className="body">
                        <strong>{Number.isFinite(recentBacktest.wmape) && recentBacktest.wmape >= 30
                          ? tx("예측 사용 보류", "Hold forecast use")
                          : tx("참고만 · 인증 미달", "Reference only · not certified")}</strong>
                        <p>{recentBacktest.worstComponent?.passed === false
                          ? tx(`Total 또는 하위 성분이 10% 기준을 넘었습니다. 최악: ${recentBacktest.worstComponent.platform} ${recentBacktest.worstComponent.component} ${recentBacktest.worstComponent.wmape.toFixed(1)}%.`, `Total or a component exceeds the 10% threshold. Worst: ${recentBacktest.worstComponent.platform} ${recentBacktest.worstComponent.component} ${recentBacktest.worstComponent.wmape.toFixed(1)}%.`)
                          : recentBacktest.certificationGate === false
                            ? tx("봉인 최신 점수와 별개로 개발 OOS·기준선 승률·경로 안전장치 중 하나가 인증 기준을 통과하지 못했습니다.", "Independent of the sealed latest score, at least one development-OOS, baseline win-rate, or route guardrail did not pass certification.")
                          : tx(`봉인 ${fcHorizon}주 wMAPE ${Number.isFinite(recentBacktest.wmape) ? `${recentBacktest.wmape.toFixed(1)}%` : "—"} · 인증 기준 10% 미만.`, `Sealed-${fcHorizon}-week wMAPE ${Number.isFinite(recentBacktest.wmape) ? `${recentBacktest.wmape.toFixed(1)}%` : "—"} · certification requires below 10%.`)}</p>
                      </div></div>}
                      <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}><span className="ab-pill" style={{ borderColor: "var(--warning)", color: "var(--warning)" }}>{tx(`${fcHorizon}주 전체: 학습 제외`, `All ${fcHorizon} weeks: held out`)}</span></div>
                      <MmmBacktestChart locale={locale} labels={recentBacktest.labels} actual={recentBacktest.actual} validationStartIndex={recentBacktest.validationStartIndex} variants={[{ label: tx("모델 적합·예측", "Model fit · prediction"), predicted: recentBacktest.predicted, color: CHART_THEME.primary, dash: [] }]} formatValue={targetValueLabel} />
                    </Card>
                  )}
                  {!recentBacktest && !forecast.isAnnualAnalog && (
                    <div className="callout warn" style={{ marginBottom: "12px" }}>
                      <div className="ico">!</div>
                      <div className="body">
                        <strong>{tx(`봉인 ${fcHorizon}주 검증을 만들 수 없어 예측을 인증하지 않습니다`, `The sealed ${fcHorizon}-week validation could not be built, so this forecast is not certified`)}</strong>
                        <p>{tx(`마지막 ${fcHorizon}주를 후보 선택과 학습에서 가린 뒤에는 유효한 모델을 만들 이력이 부족합니다. 이력을 추가한 뒤 다시 검증하세요.`, `After hiding the final ${fcHorizon} weeks from candidate selection and training, there is not enough history to fit a valid model. Add more history and validate again.`)}</p>
                      </div>
                    </div>
                  )}
                  {forecastEnhancement && (
                    <Card className="forecast-diagnostics" style={{ marginBottom: "12px", padding: "14px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", alignItems: "baseline" }}>
                        <strong>{tx("예측 신뢰도·잔차 진단", "Forecast calibration and residual diagnostics")}</strong>
                        <span className="forecast-diagnostics__scope">{tx("관측 예측", "Observational forecast")}</span>
                      </div>
                      <dl className="forecast-diagnostics__metrics">
                        <div><dt>{tx("참고폭 근거", "Interval basis")}</dt><dd>{hasPointPlusForecastOuterP90
                          ? tx("점 예측 ± 바깥 OOS P90 오차", "Point forecast ± outer-OOS P90 error")
                          : hasAggregateForecastOuterP90
                            ? tx("모델폭 + 바깥 OOS 최소폭", "Model + outer-OOS minimum")
                          : hasComponentForecastEnvelope
                            ? tx("성분별 구간 합산", "Summed component envelopes")
                            : forecastIntervalInfo.kind === "point"
                              ? tx("점 예측", "Point forecast")
                              : tx("모델 참고폭", "Model reference")}</dd></div>
                        <div><dt>ACF(1)</dt><dd>{forecastEnhancement.diagnostics?.acf1 == null ? "—" : forecastEnhancement.diagnostics.acf1.toFixed(2)}</dd></div>
                        <div><dt>{tx("잔차 drift", "Residual drift")}</dt><dd>{forecastEnhancement.diagnostics?.drift == null ? "—" : targetValueLabel(forecastEnhancement.diagnostics.drift)}</dd></div>
                        <div className={forecastEnhancement.diagnostics?.heteroscedastic ? "is-warn" : ""}><dt>{tx("분산", "Variance")}</dt><dd>{forecastEnhancement.diagnostics?.heteroscedastic ? tx("변화 점검", "Check shift") : tx("안정", "Stable")}</dd></div>
                      </dl>
                      <p className="muted" style={{ fontSize: "11px", lineHeight: 1.5, margin: "8px 0 0" }}>
                        {forecastIntervalNote(forecast, locale)}
                      </p>
                      <details style={{ marginTop: "8px" }}>
                        <summary style={{ cursor: "pointer", fontSize: "11px" }}>{tx("재현성 정보", "Reproducibility details")}</summary>
                        <pre style={{ whiteSpace: "pre-wrap", fontSize: "11px", color: MUTED, margin: "6px 0 0" }}>{JSON.stringify(forecastEnhancement.provenance, null, 2)}</pre>
                      </details>
                    </Card>
                  )}
                  {forecastScenarioResults && forecastScenario.eligible && (
                    <Card style={{ marginBottom: "12px", padding: "14px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                        <strong>{tx("미래 시나리오 비교", "Future scenario comparison")}</strong>
                        <button className="ab-pill" onClick={() => setFcScenarioOpen((value) => !value)}>{fcScenarioOpen ? tx("접기", "Hide") : tx("열기", "Show")}</button>
                      </div>
                      {fcScenarioOpen && <>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "8px 0" }}>
                          <label style={{ fontSize: "11px", color: MUTED }}>{tx("총 주간 예산", "Total weekly budget")}{` (${currencySym})`} <CommaNumberInput value={fcTotalBudget == null ? "" : Math.round(convertCurrency(fcTotalBudget, sourceCurrency, displayCurrency))} onCommit={(value) => setFcTotalBudget(value == null ? null : convertCurrency(value, displayCurrency, sourceCurrency))} style={{ width: "110px" }} /></label>
                          <label style={{ fontSize: "11px", color: MUTED }}>{tx("채널 최소", "Channel min")}{` (${currencySym})`} <CommaNumberInput value={Math.round(convertCurrency(fcMinBudget, sourceCurrency, displayCurrency))} onCommit={(value) => setFcMinBudget(value == null ? 0 : convertCurrency(value, displayCurrency, sourceCurrency))} style={{ width: "90px" }} /></label>
                          <label style={{ fontSize: "11px", color: MUTED }}>{tx("채널 최대", "Channel max")}{` (${currencySym})`} <CommaNumberInput value={fcMaxBudget == null ? "" : Math.round(convertCurrency(fcMaxBudget, sourceCurrency, displayCurrency))} onCommit={(value) => setFcMaxBudget(value == null ? null : convertCurrency(value, displayCurrency, sourceCurrency))} style={{ width: "90px" }} /></label>
                        </div>
                        {/* 이 입력은 표시 통화로 받아 원본 통화로 되돌려 엔진에 넣는다 —
                            환산이 걸려 있으면 고정 환율이 배분 제약에 들어가므로 고지한다. */}
                        <FixedRateNote sourceCurrency={selectedSourceCurrency} displayCurrency={displayCurrency} locale={locale} />
                        <div className="table-wrap"><table className="data" style={{ fontSize: "11.5px" }}><thead><tr><th>{tx("시나리오", "Scenario")}</th><th>{tx("평균/주", "Average/wk")}</th><th>{tx("기준 대비", "vs baseline")}</th><th>{tx("상태", "Status")}</th></tr></thead><tbody>
                          {forecastScenarioResults.results.map((scenario) => <tr key={scenario.key}><td><strong>{tx({ baseline: "기준 예산", "media-off": "미디어 OFF", "plus-10": "+10% 증액", "minus-10": "-10% 감액" }[scenario.key] || scenario.label, scenario.label)}</strong></td><td className="tnum">{scenario.summary?.average == null ? "—" : targetValueLabel(scenario.summary.average, { perWeek: true })}</td><td className="tnum">{scenario.summary?.percentFromBaseline == null ? "—" : `${scenario.summary.percentFromBaseline >= 0 ? "+" : ""}${scenario.summary.percentFromBaseline.toFixed(1)}%`}</td><td>{scenario.key === "baseline" ? tx("표시", "Shown") : forecastScenario.eligible ? tx("참고 시나리오", "Reference scenario") : tx("식별 게이트 잠금", "Identification locked")}</td></tr>)}
                        </tbody></table></div>
                        <p className="muted" style={{ fontSize: "11px", margin: "7px 0 0" }}>{tx("시나리오 수치는 예측 모델의 조건부 비교이며 증분효과·인과효과를 확정하지 않습니다. 미디어 OFF는 홀드아웃 또는 실험으로 별도 검증해야 합니다.", "Scenario values are conditional model comparisons, not confirmed incremental or causal effects. Validate media-off with a holdout or experiment.")}</p>
                      </>}
                    </Card>
                  )}
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "12px" }}>
                    {(() => {
                      const futAvg = forecast.predFut.reduce((a, b) => a + b, 0) / forecast.predFut.length;
                      const recentN = Math.min(8, forecast.actual.length);
                      const histAvg = forecast.actual.slice(-recentN).reduce((a, b) => a + b, 0) / recentN;
                      const chg = histAvg ? (futAvg / histAvg - 1) * 100 : 0;
                      return (
                        <>
                          <div className="stat-card"><div className="lbl">{tx("예측 평균/주", "Forecast avg/wk")}</div><div className="val">{targetValueLabel(futAvg, { perWeek: true })}</div></div>
                          <div className="stat-card"><div className="lbl">{tx(`최근 ${recentN}주 평균`, `Recent ${recentN}wk avg`)}</div><div className="val">{targetValueLabel(histAvg, { perWeek: true })}</div></div>
                          <div className="stat-card"><div className="lbl">{tx("변화", "Change")}</div><div className="val" style={{ color: chg >= 0 ? NEG : POS }}>{chg >= 0 ? "+" : ""}{chg.toFixed(1)}%</div></div>
                          <div className="stat-card"><div className="lbl">{forecast.isAdditiveTotal ? tx("과거 합산 적합 R² (OOS 아님)", "Historical additive-fit R² (not OOS)") : tx("과거 적합 R² (OOS 아님)", "Historical fit R² (not OOS)")}</div><div className="val">{forecast.r2 ?? "—"}</div></div>
                          {forecast.isPaidOrganicSplit && [
                            [tx("Organic 기저/주", "Organic baseline/wk"), forecast.organicBaseFut],
                            [tx("Organic halo/주", "Organic halo/wk"), forecast.organicHaloFut],
                            [tx("Paid 직접반응/주", "Direct Paid/wk"), forecast.performanceFut],
                          ].map(([label, values]) => {
                            const average = values?.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
                            return <div className="stat-card" key={label}><div className="lbl">{label}</div><div className="val">{average == null ? "—" : targetValueLabel(average, { perWeek: true, sign: label.includes("halo") })}</div></div>;
                          })}
                        </>
                      );
                    })()}
                  </div>
                  <div className="chart-container" style={{ height: "300px", marginBottom: "12px" }}><canvas ref={forecastRef}></canvas></div>
                  <p style={{ fontSize: "11px", color: MUTED, marginBottom: "10px" }}>
                    {forecastIntervalNote(forecast, locale)}
                  </p>

                  {/* ── 채널별 미래 예산 편집 (수정 시 즉시 재예측) ── */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "6px" }}>
                    {forecast.chans.length > 0 && <button className="ab-pill" onClick={() => { setFcBudget({}); setFcStepOff({}); }}>{tx("↺ 최근 평균으로 초기화", "↺ Reset to recent average")}</button>}
                    <button
                      className="ab-pill"
                      style={{ background: "var(--primary)", color: "var(--on-primary)", fontWeight: 700, borderColor: "var(--primary)" }}
                      title={forecastDownloadTitle(forecast, locale)}
                      onClick={() => csvDownload(
                        `mmm_forecast_${mmm.target}_${forecast.model}_${_today()}.csv`,
                        buildForecastCsv(
                          { ...forecast, exportScenarioGate: forecastScenario },
                          mmm.target,
                          locale,
                          sourceCurrency,
                          displayCurrency,
                        ),
                      )}
                    >
                      {forecast.isStructural
                        ? forecast.structuralEligible
                          ? tx("⬇ 예측 분해 CSV (Organic·Perf)", "⬇ Forecast decomposition CSV (Organic · Perf)")
                          : forecast.structuralShortTermEligible
                            ? tx(`⬇ 단기 ${forecast.structuralRecommendedHorizon}주 + 장기 시나리오 CSV`, `⬇ ${forecast.structuralRecommendedHorizon}-week forecast + longer scenario CSV`)
                            : tx("⬇ OOS 진단 CSV (예측 사용 불가)", "⬇ OOS diagnostic CSV (forecast unavailable)")
                        : forecast.isPaidOrganicSplit
                          ? forecastHasExactFormulaModels(forecast)
                            ? tx("⬇ 살아있는 예측 CSV (OS·Cost 수식)", "⬇ Live forecast CSV (OS · Cost formulas)")
                            : tx("⬇ 예측 분해 CSV (OS·Organic·Paid)", "⬇ Forecast decomposition CSV (OS · Organic · Paid)")
                          : forecast.isAnnualAnalog
                            ? tx("⬇ 자동 선택 예측 CSV (고정 스냅샷)", "⬇ Auto-selected forecast CSV (fixed snapshot)")
                          : tx("⬇ 살아있는 예측 CSV (수식·실측·예측)", "⬇ Live forecast CSV (formulas/actual/forecast)")}
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", alignItems: "start" }}>
                    {/* 좌: 채널별 미래 예산 */}
                    <div>
                      {forecast.chans.length > 0 ? <>
                        <h3 style={{ fontSize: "13px", margin: "10px 0 6px" }}>
                        {tx("채널별 미래 예산 (주 평균)", "Future budget per channel (weekly average)")}{" "}
                        <ForecastHint label={forecastScenario.eligible
                          ? forecast.isStructural
                            ? tx("기본값은 OOS가 선택한 비용 예측입니다. 입력값은 조건부 시나리오로 반영합니다.", "The default is the spend forecast selected by OOS. Your input is applied as a conditional scenario.")
                            : tx("기본값은 최근 12주 평균입니다. 수정하면 즉시 재예측합니다.", "The default is the recent 12-week average. Editing it re-forecasts immediately.")
                          : tx("rolling 검증·식별성 또는 Spend=0 자기비교를 통과하지 못해 입력을 잠갔습니다. 기본 예측만 표시합니다.", "Inputs are locked because rolling validation, identification, or the Spend=0 self-comparison did not pass. Only the base forecast is shown.")
                        } />
                      </h3>
                      <div className="table-wrap">
                        <table className="data" style={{ fontSize: "12px" }}>
                          <thead><tr><th>{tx("채널", "Channel")}</th><th>{tx(`최근평균/주 (${displayCurrency})`, `Recent avg/wk (${displayCurrency})`)}</th><th>{tx(`미래 예산/주 (${displayCurrency})`, `Future budget/wk (${displayCurrency})`)}</th></tr></thead>
                          <tbody>
                            {forecast.chans.map((ch) => {
                              const rec = forecast.recentMean[ch.key] || 0;
                              // 잠긴 상태에서는 저장된 과거 입력값도 표시·계산에 쓰지 않는다.
                              // 표의 숫자와 실제 기본 예측이 어긋나는 것을 막는다.
                              const cur = forecastScenario.eligible ? fcBudget[ch.key] : null;
                              const sourceValue = cur != null && isFinite(cur) ? cur : rec;
                              const val = Math.round(convertCurrency(sourceValue, sourceCurrency, displayCurrency));
                              const effectiveValue = forecast.futSpendByKey?.[ch.key]?.[0];
                              const isEffectiveValueClamped = forecast.spendRanges?.[ch.key]?.outOfRange === true
                                && Number.isFinite(effectiveValue)
                                && Math.abs(effectiveValue - sourceValue) > Math.max(1, Math.abs(sourceValue) * 0.001);
                              return (
                                <tr key={ch.key}>
                                  <td>{ch.label}</td>
                                  <td className="tnum" style={{ color: MUTED }}>{spendValueLabel(rec, { perWeek: true })}</td>
                                  <td>
                                    <CommaNumberInput
                                      value={val}
                                      disabled={!forecastScenario.eligible}
                                      onCommit={(n) => setFcBudget((prev) => {
                                        const next = { ...prev };
                                        if (n == null) delete next[ch.key];
                                        else next[ch.key] = Math.max(0, convertCurrency(n, displayCurrency, sourceCurrency));
                                        return next;
                                      })}
                                      style={{ width: "120px", textAlign: "right" }}
                                    />
                                    {isEffectiveValueClamped && <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px", marginTop: "3px", fontSize: "11px", color: "var(--warning)" }}>
                                      <span>{tx(`모델 반영 ${spendValueLabel(effectiveValue, { perWeek: true })}`, `Model input ${spendValueLabel(effectiveValue, { perWeek: true })}`)}</span>
                                      <ForecastHint label={tx(
                                        `요청한 Cost ${spendValueLabel(sourceValue, { perWeek: true })}는 관측 범위 밖이라 모델에는 ${spendValueLabel(effectiveValue, { perWeek: true })}까지만 반영했습니다. 성과가 없거나 포화됐다는 뜻이 아니라, 이 범위 밖은 추정하지 않는다는 뜻입니다.`,
                                        `Requested Cost ${spendValueLabel(sourceValue, { perWeek: true })} is outside the observed range, so the model uses ${spendValueLabel(effectiveValue, { perWeek: true })}. This does not mean no effect or saturation; it means the model does not estimate outside that range.`,
                                      )} />
                                    </div>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      </> : <div className="callout" style={{ marginTop: "10px" }}><div className="ico">i</div><div className="body"><strong>{tx("Spend 없음 · Organic 예측만 표시", "No Spend · Organic-only forecast")}</strong><p>{tx("예산 입력과 Paid 시나리오는 표시하지 않습니다.", "Budget inputs and Paid scenarios are not shown.")}</p></div></div>}
                    </div>

                    {/* 우: 구조변화 미래 처리. 휴일·이벤트 더미는 미래 기본값 0. */}
                    <div>
                      <h3 style={{ fontSize: "13px", margin: "10px 0 6px" }}>
                        {tx("구조변화 미래 처리", "Future handling of regime changes")}{" "}
                        <span style={{ fontSize: "11px", color: MUTED, fontWeight: 400 }}>{tx("— 비우면 ", "— leave empty to ")}<strong>{tx("지속", "persist")}</strong>{tx(", N주 뒤 끔(0=즉시)", ", or turn off N weeks later (0=immediately)")}</span>
                      </h3>
                      {forecast.steps && forecast.steps.length ? (
                        <>
                          <div className="table-wrap">
                            <table className="data" style={{ fontSize: "12px" }}>
                              <thead><tr><th>{tx("항목", "Item")}</th><th>{tx("종류", "Type")}</th><th>{tx("현재", "Current")}</th><th>{tx("켜둘 미래 주", "Weeks to keep on")}</th></tr></thead>
                              <tbody>
                                {forecast.steps.map((s) => {
                                  const cur = fcStepOff[s.key];
                                  return (
                                    <tr key={s.key}>
                                      <td>{s.label}</td>
                                      <td style={{ fontSize: "11px", color: MUTED }}>{tx("구조변화", "Regime change")}</td>
                                      <td style={{ color: s.lastOn ? "var(--success)" : MUTED, fontSize: "11px" }}>{s.lastOn ? "ON" : "OFF"}</td>
                                      <td>
                                        <input
                                          type="number"
                                          min="0"
                                          placeholder={tx("지속", "persist")}
                                          value={cur != null && isFinite(cur) ? cur : ""}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            setFcStepOff((prev) => {
                                              const next = { ...prev };
                                              if (v === "") delete next[s.key];
                                              else next[s.key] = Math.max(0, parseInt(v, 10) || 0);
                                              return next;
                                            });
                                          }}
                                          style={{ width: "100px", textAlign: "right" }}
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <p className="muted" style={{ fontSize: "11px", marginTop: "4px" }}>
                            {tx("구조변화는 마지막 상태가 지속되며 종료는 N주로 지정합니다(예: 12). 영구 변화는 비워두세요. 날짜가 정해지지 않은 미래 휴일·이벤트 더미는 기본 0으로 둡니다.", "Regime changes persist from their last state; specify an end in N weeks (for example, 12). Leave permanent changes blank. Future holiday/event dummies without a supplied calendar default to 0.")}
                          </p>
                        </>
                      ) : (
                        <p className="muted" style={{ fontSize: "11px", marginTop: "8px" }}>{tx("매핑된 구조변화가 없습니다. 미래 휴일·이벤트 더미는 기본 0입니다.", "No mapped regime changes. Future holiday/event dummies default to 0.")}</p>
                      )}
                    </div>
                  </div>

                  <details style={{ marginTop: "12px" }}>
                    <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>{tx("미래 예측 상세 (기간별)", "Forecast detail (by period)")}</summary>
                    <div className="table-wrap" style={{ marginTop: "8px" }}>
                      <table className="data" style={{ fontSize: "11px" }}>
                        <thead>
                          <tr><th>{tx("기간", "Period")}</th><th>{tx("예측", "Forecast")}</th><th>{tx("하한", "Lower")}</th><th>{tx("상한", "Upper")}</th>{forecast.chans.map((c) => (<th key={c.key}>{c.label} ({displayCurrency})</th>))}</tr>
                        </thead>
                        <tbody>
                          {forecast.futLabels.map((lb, i) => (
                            <tr key={lb + i}>
                              <td>{lb}</td>
                              <td className="tnum">{targetValueLabel(forecast.predFut[i])}</td>
                              <td className="tnum">{targetValueLabel(forecast.lo[i])}</td>
                              <td className="tnum">{targetValueLabel(forecast.hi[i])}</td>
                              {forecast.chans.map((c) => (<td key={c.key} className="tnum">{spendValueLabel(forecast.futSpendByKey[c.key]?.[i])}</td>))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              ) : (
                <div className="callout warn"><div className="ico">!</div><div className="body">
                  <strong>{hasInsufficientForecastHistory
                    ? tx(`봉인 ${fcHorizon}주 검증을 만들 수 없어 예측을 인증하지 않습니다`, `The sealed ${fcHorizon}-week validation could not be built, so this forecast is not certified`)
                    : tx("예측 불가", "Can't forecast")}</strong>
                  <p>{hasInsufficientForecastHistory
                    ? tx(`마지막 ${fcHorizon}주와 그보다 오래된 선택용 fold를 모두 확보할 이력이 부족합니다. 이력을 추가한 뒤 다시 검증하세요.`, `There is not enough history for the final ${fcHorizon}-week audit and the older selection folds. Add more history and validate again.`)
                    : forecastModel?.reason || tx("MMM 모델이 적합되지 않았거나 데이터가 변수 수보다 적습니다. 기간을 늘리거나 채널을 줄이세요.", "The MMM model didn't fit, or the data has fewer rows than variables. Extend the period or reduce channels.")}</p>
                </div></div>
              )}
            </section>
          )}
        </>
      )}
      <MmmManualDownload locale={locale} placement="footer" />
    </div>
  );
}
