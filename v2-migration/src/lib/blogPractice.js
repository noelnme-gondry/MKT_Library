import { BLOG_INSIGHT_PLACEMENTS } from "./blogInsightRegistry";
import { TOOL_GROUP } from "./toolGroups";
import { toolIndexEntry } from "./toolIndex";

// Editorial examples: one file and equivalent reading instructions for both locales.
// Numeric examples are verified against these files by editorialExamples.test.js.
export const BLOG_PRACTICES = {
  "budget-scaling-limit": {
    file: "saturation-sparse.csv",
    ko: {
      title: "행이 많아도 판단할 수 없는 이유",
      steps: [
        "데모 CSV를 선택하고 날짜·채널·비용·설치 매핑과 원본 통화를 확인한 뒤 ‘결과 보기’를 누르세요.",
        "8일·24행이지만 각 채널은 한 번만 관측했습니다. 분석 가능한 채널이 없어 판단이 보류되는 이유를 확인해 보세요.",
        "한계 효율을 추정하려면 같은 채널의 여러 날짜·여러 지출 수준이 필요합니다. 예산 배분 도구로 이동해도 부족한 관측 정보가 채워지지는 않습니다.",
      ],
      limit: "판단 보류는 증액해도 안전하다는 뜻이 아닙니다. 지출 변경의 위험과 검증 계획을 먼저 정하세요. 2~3주를 모으면 추정할 수 있다는 보장도 없습니다.",
    },
    en: {
      title: "Why more rows may still be insufficient",
      steps: [
        "Choose the demo CSV, check the date, channel, spend and install mappings and source currency, then select ‘Show result’.",
        "The file covers eight days and 24 rows, but each channel appears only once. Check why the result is withheld when no channel can be estimated.",
        "Marginal efficiency needs observations of the same channel across dates and spend levels. Opening the budget allocation tool cannot supply those missing observations.",
      ],
      limit: "A withheld result does not mean scaling is safe. Define the business risk and validation plan first. Collecting two or three weeks does not guarantee an estimable result.",
    },
  },
  "aso-basics-guide": {
    file: "aso-mix-only.csv",
    ko: {
      title: "소스별 전환율이 그대로인데 전체는 떨어진다면",
      steps: [
        "데모 CSV를 선택하고 Date→날짜, Source Type→스토어 유입 소스, Product Page Views→제품 페이지 조회, Total Downloads→설치 매핑을 확인하세요.",
        "‘결과 보기’를 눌러 8월 1~2일과 3~4일을 비교하세요. 전체 전환율은 34%에서 16%로, 18%p 낮아집니다.",
        "Search는 40%, Browse는 10%로 유지됩니다. ‘더 자세한 분석 보기’에서 소스 구성과 효율 변화의 분해값을 확인하세요. 이 예제의 효율 변화 몫은 0입니다.",
      ],
      limit: "유입 구성 변화에 따른 산술 예제입니다. 스크린샷 변경이나 유료 광고의 인과 효과를 증명하지 않습니다.",
    },
    en: {
      title: "When overall conversion falls but each source is steady",
      steps: [
        "Choose the demo CSV. Check that Date, Source Type, Product Page Views and Total Downloads map to date, store source, page views and installs.",
        "Select ‘Show result’ to compare August 1–2 with August 3–4. Overall conversion falls from 34% to 16%, a decline of 18 percentage points.",
        "Search stays at 40% and Browse at 10%. Open detailed analysis to inspect the mix and rate contributions. The rate contribution in this example is zero.",
      ],
      limit: "This is an arithmetic example of changing traffic composition. It does not establish a causal effect of screenshots or paid advertising.",
    },
  },
  "apple-search-ads-guide": {
    file: "asa-mature-candidate.csv",
    mode: "detail",
    ko: {
      title: "전환 집계가 끝났는지 확인하고 판단하기",
      detailNote: "이 예제는 전환 성숙도를 확인할 수 있는 상세 도구에서 이어집니다.",
      steps: [
        "데모 CSV를 선택하고 날짜·검색어·탭·설치·비용 매핑과 원본 통화를 확인하세요. ‘더 자세한 분석 보기’로 이동해 분석하면, 기본 상태에서는 전환 성숙도가 미확인이라 조정 제안이 보류됩니다.",
        "이 합성 예제에 한해서 ‘계정 전환 지연을 확인해 성숙 기간만 포함’을 선택하고 결과를 다시 확인하세요.",
        "40탭·12설치·비용 4,000의 CPA는 약 333.33입니다. 목표 CPA 500·예산 소진율 10% 조건에서 Exact 승격 1건과 CPT 100→115 조정 후보를 확인하세요.",
      ],
      limit: "실제 파일은 전환 지연을 확인한 뒤 성숙도를 선언하세요. 탭 기여 설치와 조회 기여 설치를 섞지 마세요. 이 예제는 운영 규칙의 후보이며 통계적 효과 검정이 아닙니다.",
    },
    en: {
      title: "Check conversion maturity before making a decision",
      detailNote: "Continue this example in the full tool, where you can confirm conversion maturity.",
      steps: [
        "Choose the demo CSV and check date, search term, taps, installs, spend and source currency. Open detailed analysis and analyze. The default state withholds adjustment suggestions because conversion maturity is unconfirmed.",
        "For this synthetic example only, choose ‘Confirmed conversion lag; only mature periods included’ and inspect the result again.",
        "With 40 taps, 12 installs and 4,000 spend, CPA is about 333.33. At target CPA 500 and 10% budget pacing, inspect one Exact-promotion candidate and a CPT adjustment candidate from 100 to 115.",
      ],
      limit: "For real files, verify conversion lag before declaring maturity. Do not mix tap-attributed and view-through installs. These are operational rule candidates, not a statistical test of effect.",
    },
  },
};

const COPY = {
  ko: {
    before: "읽기 전 준비",
    invitation: "데모 데이터를 받아두고, 본문 중간에서 직접 확인해 보세요.",
    source: "학습용 합성 데이터 · CSV",
    download: "데모 CSV 받기",
    jump: "본문 실습으로",
    eyebrow: "선택 실습",
    introduction: "받아둔 데모 CSV를 선택해 직접 확인해 보세요. 파일은 이 브라우저에서 처리합니다.",
    instructions: "실습 안내와 해석 범위",
  },
  en: {
    before: "Before you read",
    invitation: "Download the demo data and try it as you read.",
    source: "Synthetic practice data · CSV",
    download: "Download demo CSV",
    jump: "Jump to practice",
    eyebrow: "Optional practice",
    introduction: "Choose the demo CSV you downloaded to check the result. Files are processed in this browser.",
    instructions: "Steps and interpretation",
  },
};

export function blogPracticeFor(slug, locale = "ko") {
  const config = BLOG_INSIGHT_PLACEMENTS[slug];
  if (!config) return null;
  const practice = BLOG_PRACTICES[slug];
  if (practice) return { ...COPY[locale], ...practice[locale], mode: practice.mode || "inline", file: practice.file, href: `/examples/${practice.file}` };
  const tool = toolIndexEntry(config.toolId, locale);
  const group = TOOL_GROUP[config.toolId];
  if (!tool || !group) return null;
  const en = locale === "en";
  return {
    ...COPY[locale],
    mode: "detail",
    demoGroup: group,
    locale,
    file: `demo_${group}_${locale}.csv`,
    title: tool.question,
    introduction: en ? "Choose the demo CSV, then check the columns and analysis settings in the full tool." : "데모 CSV를 선택한 뒤 상세 도구에서 필요한 열과 분석 조건을 확인하세요.",
    steps: [
      en ? `Choose the downloaded CSV, then open ${tool.name} using ‘Open detailed analysis’.` : `받아둔 CSV를 선택하고 ‘더 자세한 분석 보기’로 ${tool.name} 도구를 여세요.`,
      en ? "Confirm the column roles, units and observation period in the tool before running the analysis." : "도구에서 열의 역할·단위·관찰 기간을 확인한 뒤 분석하세요.",
      en ? `Inspect the results and their limitations: ${tool.outputs.join("; ")}.` : `결과와 해석 한계를 확인하세요: ${tool.outputs.join(", ")}.`,
    ],
    limit: en ? "This synthetic example teaches the analysis workflow. It does not reproduce the article’s figures or effects in a real account." : "예제는 분석 흐름을 익히기 위한 합성 데이터입니다. 글의 수치나 실제 계정의 효과를 재현하는 자료가 아닙니다.",
  };
}
