import { finderDemoEntries } from "./finderExamples";
import examples from "@/lib/blogExamples/data.json";
import advancedExamples from "@/lib/advanced-marketing/workedExamples.json";
import operationsPreview from "@/lib/finder/operationsPreview.json";
import { fmtCurrency, fmtNum, fmtPct } from "@/utils/format";

// 공개 예시의 기존 계산 사본만 읽는다. 분석 찾기를 여는 것으로 엔진을 실행하지 않는다.
const byTool = finderDemoEntries(examples);

const TITLES = {
  "5-2": ["최근·직전 기간의 지표 변화", "Metric changes between periods"],
  "5-4": ["그룹별 전환율", "Conversion rate by group"],
  "5-18-paid-organic": ["유입 변화맵 예시 · 최근 4주 변화", "Paid-organic example · recent 4-week changes"],
  "5-18-mmm": ["MMM 원 지출의 채널별 VIF", "Channel VIF before fitting MMM"],
  "5-20": ["초기 행동 기준별 전환율", "Conversion by early-action threshold"],
  "5-21": ["전체 CPI 변화에 대한 채널별 기여", "Channel contributions to the CPI change"],
  "5-22": ["한계 CPI / 평균 CPI", "Marginal / average CPI"],
  "5-23": ["홀드아웃과 노출군 전환율", "Holdout and exposed conversion rates"],
  "5-24": ["브랜드 검색의 예상·관측", "Expected and observed brand searches"],
  "5-25": ["채널별 VIF · 로그 눈금", "VIF by channel · logarithmic scale"],
  "5-26": ["검토할 검색어 액션", "Search-term actions to review"],
  "5-27": ["설치당 조회 수 분해 항의 크기 비중", "Absolute component shares in views per install"],
  "5-28": ["선택 시점의 추정 유지율", "Estimated retention at selected times"],
  "5-29": ["전체 비중 변화의 구성", "Components of the overall share change"],
  "9-1": ["콘텐츠 요소별 단순 평균 차이", "Unadjusted mean differences by content element"],
  "9-6": ["판정 가능한 소재의 상태", "Status of analyzable creatives"],
};

const ADVANCED_METRICS = {
  "5-32": ["margin"], "5-33": ["completion"], "5-34": ["raw", "adjusted"],
  "5-35": ["predicted"], "5-36": ["effect"], "5-37": ["policy"],
  "5-38": ["win"], "5-39": ["uniform", "loss"], "5-40": ["revenue", "profit"],
  "5-41": ["rules"], "5-42": ["lower", "upper"], "5-43": ["invalid"],
};

export function previewMetricDisplay(metric, currency = "KRW") {
  if (!Number.isFinite(metric.value)) return null;
  if (metric.type === "money") return fmtCurrency(metric.value, { currency, precise: true });
  if (metric.type === "rate") return fmtPct(metric.value, 1);
  return fmtNum(metric.value, metric.type === "integer" ? 0 : 2);
}

export function finderPreview(toolId, locale = "ko") {
  const lang = locale === "en" ? "en" : "ko";
  const index = lang === "en" ? 1 : 0;
  if (toolId === "5-31") return operationsPreview[lang];
  // 묶음 카드의 그림과 예시 링크가 같은 하위 분석을 가리키게 한다.
  const exampleToolId = toolId === "5-18-trend" ? "5-18-paid-organic" : toolId;
  const entry = byTool[exampleToolId];
  if (entry && entry.bars.length > 0) {
    return {
      toolId: exampleToolId,
      kind: exampleToolId === "5-27" ? "parts" : exampleToolId === "9-6" ? "counts" : "bars",
      title: TITLES[exampleToolId]?.[index] || (lang === "en" ? "Example result" : "예시 결과"),
      headline: entry[lang].headline,
      caption: entry[lang].caption,
      note: entry.note,
      rows: entry.bars.map(row => ({ ...row, label: typeof row.label === "object" ? row.label[lang] : row.label, display: typeof row.display === "object" ? row.display[lang] : row.display })),
    };
  }
  const advanced = advancedExamples[toolId];
  if (!advanced || !ADVANCED_METRICS[toolId]) return null;
  const metrics = ADVANCED_METRICS[toolId].map(id => advanced.metrics.find(metric => metric.id === id));
  if (metrics.some(metric => !metric || !Number.isFinite(metric.value))) return null;
  const intervals = metrics.every(metric => Number.isFinite(metric.low) && Number.isFinite(metric.high));
  return {
    toolId,
    kind: toolId === "5-42" ? "range" : intervals ? "intervals" : metrics.length > 1 ? "bars" : "metric",
    title: metrics.length > 1 ? (lang === "en" ? "Calculated example" : "계산된 예시") : metrics[0].label[lang],
    caption: advanced.warnings.map(warning => warning[lang]).join(" "),
    rows: metrics.map(metric => ({ label: metric.label[lang], value: metric.value, low: metric.low, high: metric.high, display: previewMetricDisplay(metric, advanced.currency), lowDisplay: previewMetricDisplay({ ...metric, value: metric.low }, advanced.currency), highDisplay: previewMetricDisplay({ ...metric, value: metric.high }, advanced.currency) })),
    isRate: metrics.every(metric => metric.type === "rate"),
  };
}
