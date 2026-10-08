import { MULTITOUCH_FIELDS, WEEKLY_MOVEMENT_FIELDS } from "./fields";
export function reportGuide(kind, locale) {
  const en = locale === "en", fields = kind === "multitouch" ? MULTITOUCH_FIELDS : WEEKLY_MOVEMENT_FIELDS;
  return {
    when: kind === "multitouch" ? (en ? "Inspect recorded click contributors alongside the attributed install source." : "설치 귀속 매체와 함께 기록된 클릭 contributor를 비교합니다.") : (en ? "Inspect opposite weekly Paid and Organic moves down to campaigns and demographics." : "주간 Paid·Organic 반대 움직임을 캠페인·고객 구성까지 확인합니다."),
    grain: kind === "multitouch" ? (en ? "1 row = one installation; repeated IDs are deduplicated within each app" : "1행 = 설치 1건 · 같은 앱의 반복 ID는 중복 제거") : (en ? "1 row = ISO week × country × OS × channel × campaign × demographic group" : "1행 = ISO 주차 × 국가 × OS × 채널 × 캠페인 × 고객 구분"),
    needs: Object.entries(fields).map(([key, value]) => ({ col: value.aliases[0] || key, label: en ? value.labelEn : value.label, required: value.required,
      why: en ? (key === "af_id" ? "Deduplicate installations; not a person-level identifier" : key.endsWith("_time") ? "Compute chronological order and valid time gaps" : "Preserve the original dimension or observed value") : (key === "af_id" ? "설치 중복 제거용이며 사람 단위 식별자가 아닙니다" : key.endsWith("_time") ? "접촉 순서와 유효한 시간 간격 계산" : "원본 구분값 또는 관측 수치를 보존합니다") })),
    prep: kind === "multitouch" ? (en ? ["Export install raw data with Contributor 1–3, touch type, touch time and match type.", "CTIT needs full timestamps. Select the timezone of timestamps without an explicit offset.", "Network restrictions can hide contributors. Missing data does not prove no contact."] : ["설치 raw에 Contributor 1–3의 매체·접촉 유형·시각·매칭 방식을 포함하세요.", "CTIT에는 시분초가 필요합니다. 오프셋이 없는 시각의 원본 시간대를 선택하세요.", "매체 제한으로 contributor가 빠질 수 있습니다. 누락을 접촉 없음으로 단정하지 않습니다."]) : (en ? ["Use a date or an ISO year + week, with Organic and every paid channel under the same outcome definition.", "Two years of matching weeks are required. Omit incomplete weeks using the cutoff date.", "Age can be a category column or separate bucket counts (age_18_24, age_25_34…). Buckets must not overlap. Female remainders are not assumed to be male."] : ["날짜 또는 ISO 연도+주차를 사용하고 Organic과 유료 채널의 성과 정의를 통일하세요.", "두 연도의 같은 주차가 필요합니다. 미완료 주는 관측 종료일로 제외합니다.", "연령은 구분값 열 또는 age_18_24·age_25_34 등의 건수 열을 쓸 수 있으며 구간은 겹치면 안 됩니다. 여성 건수의 나머지를 남성으로 간주하지 않습니다."]),
  };
}
export const REPORT_SEARCH_CONTENT = {
  "5-30": {
    ko: { eyebrow: "클릭 접촉 경로", title: "설치 전에 기록된 채널과 캠페인의 겹침을 비교하세요",
      lead: "매체별 설치 수만 보면, 설치 전에 다른 광고를 거쳤는지 알기 어렵습니다. AppsFlyer 설치 raw의 contributor를 함께 보면 어떤 채널과 캠페인이 같은 설치에 기록됐는지 확인할 수 있습니다. 관측된 클릭과 시간 간격을 비교하는 분석이며 전체 접촉이나 광고의 인과 기여율을 복원하지는 않습니다.",
      question: "설치 전에 어떤 광고 채널이 함께 기록됐나요?", answer: "설치 raw의 클릭 contributor로 매체·캠페인 겹침과 관측 경로를 비교합니다.",
      outputs: ["매체·캠페인별 멀티터치 비율", "기여 채널·관측 경로", "귀속 클릭→설치 시간(CTIT)"], detailsLabel: "집계 기준과 데이터 제한",
      sections: [
        ["설치 집계", "같은 앱의 AppsFlyer ID마다 파일에서 가장 이른 설치를 남깁니다. 국가·OS·기간은 중복 제거 후 선택하며 사람 단위 이용자 수와 혼동하지 않습니다."],
        ["매칭 방법 비교", "probabilistic로 표시된 contributor를 포함하거나 제외합니다. 전체 설치 분모는 같고, 매칭 방식이 없는 접촉은 제외 비교에서 확인 불가로 표시합니다."],
        ["시간과 해석", "CTIT는 귀속 클릭에서 설치까지이며 contributor에서 설치까지와 다릅니다. 유효 시각의 분모·누락·역순을 표시하고, 경로는 최대 세 contributor의 관측 순서입니다."],
      ],
      faq: [{ q: "contributor가 비어 있으면 단일 접촉인가요?", a: "확정할 수 없습니다. 매체 제한이나 필드 누락으로 접촉이 기록되지 않을 수 있으며 관측된 contributor만 비교합니다." }, { q: "설치 귀속과 기여 채널이 같을 수 있나요?", a: "가능합니다. 캠페인을 함께 확인해 동일 채널 내 중복 접촉인지 읽으세요. 같은 이름만으로 서로 다른 캠페인이라고 단정하지 않습니다." }],
    },
    en: { eyebrow: "CLICK TOUCH PATHS", title: "Compare channels and campaigns recorded before an install",
      lead: "Inspect AppsFlyer click contributors alongside the attributed install source. Compare recorded overlap and time gaps without treating the report as a complete journey or causal allocation of advertising credit.",
      question: "Which ad channels were recorded before the install?", answer: "Compare recorded click contributors, channel overlap and observed install paths.",
      outputs: ["Multi-touch rates by media and campaign", "Contributing channels and observed paths", "Click-to-install time (CTIT)"], detailsLabel: "Counting rules and reporting limits",
      sections: [
        ["Counting installs", "Keep the earliest installation per app and AppsFlyer ID in the file, then select country, OS and dates. This identifier represents an installation context, not a unique person."],
        ["Matching methods", "Compare including and excluding contributors labelled probabilistic while retaining the same installation denominator. Unlabelled matches cannot be certified as non-probabilistic."],
        ["Timing and interpretation", "CTIT runs from the attributed click to installation, not from the last contributor. Valid timestamp denominators, missing times and reversals remain visible; paths contain up to three recorded contributors."],
      ],
      faq: [{ q: "Does an empty contributor mean only one touch?", a: "No. Network restrictions and missing fields may hide earlier contacts. The view describes recorded contributors only." }, { q: "Can the install and contributor media be the same?", a: "Yes. Inspect the campaign pair to understand same-network overlap; matching media names do not prove the campaigns were different." }],
    },
  },
  "5-18-cannibal-detail": {
    ko: { eyebrow: "잠식 상세", title: "반대 움직임이 이어진 구간의 채널과 캠페인을 확인하세요", lead: "국가·OS별 전년 동주차 Paid·Organic 변화를 비교하고, 같은 방향으로 움직인 캠페인과 고객 구성의 겹침을 확인합니다.", question: "어느 캠페인이 오가닉 반대 움직임과 함께 나타났나요?", answer: "연속 반대 움직임 구간에서 채널·캠페인 변화량과 고객 구성의 겹침을 봅니다.", outputs: ["연속 반대 움직임 구간", "채널·캠페인 변화량", "성별·연령 변화 구성"], detailsLabel: "구간 탐지와 해석 기준", sections: [["구간 기준", "전년 같은 ISO 주차의 증감 부호가 반대이거나, 직전 8주 중앙값보다 반대로 움직이는 연속 구간을 탐색합니다. 비교할 주가 빠지면 구간을 끊습니다."], ["채널·캠페인", "Paid 전체 변화량 대비 채널·캠페인 몫과 같은 방향으로 움직인 주를 보여줍니다. 다른 캠페인이 반대로 움직이면 몫이 100%를 넘을 수 있습니다."], ["고객 구성", "같은 방향으로 움직인 성별·연령 그룹의 변화량 비중을 비교합니다. 겹침은 기술 통계이며 잠식 확정 기준으로 사용하지 않습니다."]], faq: [{ q: "지출이 없으면 상세를 볼 수 있나요?", a: "가능합니다. 상세는 주별 관측 성과의 변화량을 비교하며, 지출 기반 통계 신호는 기존 잠식 진단에서 별도 확인합니다." }, { q: "여성 외 건수를 남성으로 계산하나요?", a: "아닙니다. 이진 성별이 확인되지 않은 나머지는 여성 외·미분류로 표시합니다." }] },
    en: { eyebrow: "CANNIBALIZATION DETAIL", title: "Inspect campaigns within consecutive opposite-movement stretches", lead: "Compare same-ISO-week Paid and Organic changes by country and OS, then inspect campaign moves and demographic overlap.", question: "Which campaigns coincided with opposite Organic movement?", answer: "Inspect channel and campaign moves and demographic overlap within stretches.", outputs: ["Opposite-movement stretches", "Channel and campaign moves", "Gender and age mix"], detailsLabel: "Stretch detection and interpretation", sections: [["Stretch definition", "Find opposite year-over-year signs or opposite changes relative to a preceding eight-week median. Missing comparable weeks break a stretch; year boundaries are never crossed."], ["Channels and campaigns", "Inspect each move as a share of the total Paid change and the weeks moving with it. A share can exceed 100% when other campaigns move in the opposite direction."], ["Audience composition", "Compare the distribution of same-direction demographic changes. Their overlap is descriptive and is not used as a causal cannibalization verdict or a pass/fail cutoff."]], faq: [{ q: "Can the detail view run without spend?", a: "Yes. It compares observed weekly outcomes; spend-based statistical signals remain in the existing diagnosis." }, { q: "Are all non-female outcomes treated as male?", a: "No. Without an explicit binary gender field, the remainder is labelled non-female or unknown." }] },
  },
};
