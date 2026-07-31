const SYMPTOMS = {
  "cpi-rise": {
    ko: { label: "CPI·CPA가 갑자기 올랐어요", hypothesis: "성과 변동이 특정 채널·캠페인의 효율 저하인지, 예산 믹스 이동인지 먼저 분리해야 합니다." },
    en: { label: "CPI or CPA suddenly increased", hypothesis: "Separate channel or campaign efficiency loss from a change in spend mix." },
  },
  "installs-no-revenue": {
    ko: { label: "설치는 느는데 매출이 안 늘어요", hypothesis: "저가치 유저 유입, 코호트 미성숙, 구매 퍼널 저하를 순서대로 확인해야 합니다." },
    en: { label: "Installs grew but revenue did not", hypothesis: "Check low-value acquisition, cohort maturity, and purchase-funnel loss in that order." },
  },
  "organic-drop": {
    ko: { label: "광고를 늘렸더니 오가닉이 줄었어요", hypothesis: "동시 변동만으로 잠식을 단정할 수 없습니다. 자연 추세를 분리한 뒤 홀드아웃으로 검증해야 합니다." },
    en: { label: "Organic fell after paid spend increased", hypothesis: "Correlation is not cannibalization. Remove natural trend first, then validate with a holdout." },
  },
  "roas-drop": {
    ko: { label: "예산을 늘렸더니 ROAS가 떨어졌어요", hypothesis: "규모 확대에 따른 포화인지, 성과가 낮은 채널로 예산이 이동했는지 구분해야 합니다." },
    en: { label: "ROAS fell after scaling budget", hypothesis: "Separate saturation from a shift of spend toward lower-performing channels." },
  },
};

export const DIAGNOSE_OPTIONS = {
  data: {
    campaign: { ko: "일별 채널·캠페인 성과", en: "Daily channel and campaign performance" },
    creative: { ko: "소재별 성과", en: "Creative-level performance" },
    organic: { ko: "유료·오가닉 주간 데이터", en: "Weekly paid and organic data" },
    experiment: { ko: "통제군·실험군 데이터", en: "Control and treatment data" },
  },
  goal: {
    cause: { ko: "원인을 먼저 찾기", en: "Find the cause first" },
    budget: { ko: "다음 예산 결정하기", en: "Decide the next budget" },
    proof: { ko: "광고의 순수 효과 검증하기", en: "Validate incremental impact" },
  },
};

const TOOL_COPY = {
  "5-2": { href: "/dashboard", ko: ["운영 대시보드", "추세·코호트·퍼널을 한 화면에서 기준선으로 확인"], en: ["Operations dashboard", "Establish the baseline across trends, cohorts, and the funnel"] },
  "5-21": { href: "/tools/campaign-variance", ko: ["성과 변동 분석", "CPA 변화를 물량·믹스·효율 요인으로 무잔차 분해"], en: ["Performance variance", "Decompose CPA change into volume, mix, and efficiency"] },
  "5-22": { href: "/tools/campaign-saturation", ko: ["캠페인 포화도 진단", "예산 확대 구간의 한계 CPA·ROAS 확인"], en: ["Campaign saturation", "Check marginal CPA and ROAS at the scaled spend level"] },
  "5-3": { href: "/tools/budget-allocation", ko: ["예산 배분", "확인된 효율과 지출 여력으로 다음 예산 시뮬레이션"], en: ["Budget allocation", "Simulate the next budget with efficiency and headroom"] },
  "5-18": { href: "/tools/marketing-response", ko: ["마케팅 반응 분석", "유료·오가닉 추세와 잠식 가능성을 관측 데이터로 점검"], en: ["Marketing response", "Review paid-organic trends and possible displacement"] },
  "5-23": { href: "/tools/incrementality", ko: ["증분 효과 분석", "홀드아웃 또는 전후 데이터로 순수 증분 추정"], en: ["Incrementality analysis", "Estimate incremental outcomes with holdout or pre/post data"] },
  "9-6": { href: "/content/freshness", ko: ["소재 피로도 분석", "CTR·CVR 하락이 소재 피로에서 왔는지 확인"], en: ["Creative fatigue", "Check whether CTR or CVR loss is driven by creative fatigue"] },
};

const BASE_ORDER = {
  "cpi-rise": ["5-21", "9-6", "5-22", "5-3"],
  "installs-no-revenue": ["5-2", "5-21", "5-23"],
  "organic-drop": ["5-18", "5-23", "5-3"],
  "roas-drop": ["5-22", "5-21", "5-3"],
};

export function getDiagnoseSymptoms(locale = "ko") {
  return Object.entries(SYMPTOMS).map(([id, value]) => ({ id, ...value[locale] }));
}

export function buildSymptomDiagnosis({ symptom, data, goal, locale = "ko" } = {}) {
  if (!SYMPTOMS[symptom]) return null;
  const order = [...BASE_ORDER[symptom]];
  const boost = [];
  if (data === "creative") boost.push("9-6");
  if (data === "organic") boost.push("5-18");
  if (data === "experiment" || goal === "proof") boost.push("5-23");
  if (goal === "budget") boost.push("5-22", "5-3");
  const ranked = [...new Set([...boost, ...order])].filter((id) => TOOL_COPY[id]);
  const isEn = locale === "en";
  return {
    hypothesis: SYMPTOMS[symptom][locale].hypothesis,
    warning: symptom === "organic-drop"
      ? (isEn ? "This route narrows hypotheses; only a controlled experiment can support a causal claim." : "이 경로는 가설을 좁힐 뿐입니다. 인과 판단은 통제 실험으로만 확정할 수 있습니다.")
      : (isEn ? "Treat each result as diagnostic evidence, not automatic proof of causality." : "각 결과는 진단 근거이며 자동으로 인과를 증명하지 않습니다."),
    steps: ranked.slice(0, 3).map((toolId, index) => {
      const copy = TOOL_COPY[toolId];
      return {
        toolId,
        href: `${isEn ? "/en" : ""}${copy.href}`,
        title: copy[locale][0],
        reason: copy[locale][1],
        order: index + 1,
      };
    }),
  };
}
