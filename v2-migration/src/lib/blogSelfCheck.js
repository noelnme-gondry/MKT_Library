// 시안 D — CSV로 계산할 수 없는 글의 30초 자가 점검.
//
// 이 글들(`BLOG_INSIGHT_EXCLUSIONS`)은 CSV 도구로 답할 수 없어서 예전에는 무관한 운영
// 대시보드로 보냈다. 대신 글 본문이 이미 말한 판단 기준을 두 질문으로 돌려준다.
// 판정 문장은 각 글의 본문에서만 가져오고 "가능성"으로 말한다 — 새 주장을 만들지 않는다.
// 결과 키: 두 질문의 답을 이어 붙인 "yy"·"yn"·"ny"·"nn".
// `blogSelfCheck.test.js`가 제외 목록 전체와 네 결과·두 언어를 강제한다.

const skanDelay = {
  ko: {
    title: "숫자가 덜 들어온 걸까요, 정말 떨어진 걸까요?",
    questions: ["Android는 괜찮고 iOS만 떨어졌나요?", "비교 기간에 최근 35일이 들어 있나요?"],
    results: {
      yy: ["측정 지연일 가능성이 큽니다.", "SKAN 4는 0–2일·3–7일·8–35일 창에서 포스트백을 보내고, 받는 데도 추가 지연이 있습니다. 캠페인을 끄기 전에 35일이 지난 기간끼리 다시 비교해 보세요."],
      yn: ["지연만으로는 설명하기 어렵습니다.", "충분히 지난 기간인데 iOS만 낮다면, 동의율 변화나 컨버전 밸류 설계부터 확인하세요."],
      ny: ["iOS 측정 문제만은 아닐 수 있습니다.", "두 OS가 같이 떨어졌다면 공통 원인(예산 배분·경매·소재)을 먼저 보세요. 최근 35일이 섞여 있다면 iOS 쪽은 한 번 더 늦게 확인합니다."],
      nn: ["iOS 측정 문제가 아닐 가능성이 큽니다.", "두 OS가 함께, 충분히 지난 기간에서 떨어졌다면 공통 원인을 먼저 보세요."],
    },
  },
  en: {
    title: "Did the numbers arrive late, or did performance really drop?",
    questions: ["Did only iOS drop while Android held?", "Does the comparison include the last 35 days?"],
    results: {
      yy: ["It is likely a measurement delay.", "SKAN 4 sends postbacks for the 0–2, 3–7 and 8–35 day windows, with extra delay on receipt. Before pausing campaigns, compare periods that are more than 35 days old."],
      yn: ["Delay alone is unlikely to explain it.", "If only iOS is low in a mature period, check consent rate changes or the conversion value schema first."],
      ny: ["It may not be only an iOS measurement issue.", "If both platforms dropped, check shared causes first (budget mix, auctions, creatives). If the last 35 days are included, recheck the iOS side later."],
      nn: ["It is unlikely to be an iOS measurement issue.", "If both platforms dropped in a mature period, look for shared causes first."],
    },
  },
};

export const BLOG_SELF_CHECKS = {
  "ios-att-skan-guide": skanDelay,
  "skan-vs-mmp-attribution": {
    ko: {
      title: "SKAN과 MMP 숫자가 다를 때 먼저 볼 것",
      questions: ["두 숫자를 같은 설치일 기준으로 비교했나요?", "비교 기간이 35일보다 오래됐나요?"],
      results: {
        yy: ["귀속 규칙 차이일 가능성이 큽니다.", "같은 날짜·성숙한 기간인데도 다르다면 SKAN과 MMP의 귀속 규칙·윈도우가 다른 것입니다. 합치려 하지 말고 질문별로 어느 쪽을 볼지 나누세요."],
        yn: ["아직 덜 성숙한 숫자일 수 있습니다.", "SKAN의 창과 무작위 지연 때문에 최근 구간은 덜 들어옵니다. 같은 코호트를 나중에 다시 대조하세요."],
        ny: ["날짜 기준부터 맞추세요.", "설치일과 포스트백 수신일을 섞으면 같은 설치가 다른 날에 잡힙니다. 설치일 기준으로 다시 비교하세요."],
        nn: ["날짜 기준과 성숙 기간이 모두 달라 비교할 수 없습니다.", "설치일 기준으로 맞추고, 35일이 지난 뒤 같은 코호트로 다시 비교하세요."],
      },
    },
    en: {
      title: "What to check first when SKAN and MMP disagree",
      questions: ["Did you compare both by install date?", "Is the comparison period older than 35 days?"],
      results: {
        yy: ["It is likely a difference in attribution rules.", "If they still differ on the same dates in a mature period, SKAN and the MMP are using different rules and windows. Don't merge them; decide which source answers which question."],
        yn: ["The numbers may not be mature yet.", "SKAN windows and random delays leave recent periods incomplete. Compare the same cohort again later."],
        ny: ["Align the date basis first.", "Mixing install dates with postback receipt dates puts the same install on different days. Compare by install date."],
        nn: ["Different date bases and maturity make them incomparable.", "Align on install date and compare the same cohort again after 35 days."],
      },
    },
  },
  "skan-conversion-value-schema": {
    ko: {
      title: "지금 스키마, 64칸을 제대로 쓰고 있나요?",
      questions: ["칸마다 다음 행동(입찰·예산)이 달라지나요?", "하루 설치가 수백 건 이상인가요?"],
      results: {
        yy: ["판단이 갈리는 지점으로 나눈 스키마입니다.", "fine 값은 SKAN 4 첫 창에서, 볼륨 조건을 만족할 때만 옵니다. 매체가 이 값을 어떻게 최적화에 쓰는지까지 확인하세요."],
        yn: ["설계는 맞지만 값이 거칠게 올 수 있습니다.", "볼륨이 작으면 개인정보 임계 때문에 fine 값 대신 coarse 값만 올 수 있습니다. 칸을 줄여 핵심 구분만 남기는 쪽을 검토하세요."],
        ny: ["칸을 너무 잘게 나눴을 수 있습니다.", "같은 행동으로 이어지는 칸은 합치세요. 판단이 갈리는 지점만 나누는 것이 원칙입니다."],
        nn: ["스키마를 단순하게 다시 짜는 편이 낫습니다.", "볼륨도 작고 칸마다 행동도 같다면, 판단이 갈리는 두세 구간만 남기세요."],
      },
    },
    en: {
      title: "Is your schema using the 64 values well?",
      questions: ["Does each value lead to a different action (bid or budget)?", "Do you get hundreds of installs a day or more?"],
      results: {
        yy: ["The schema splits where decisions differ.", "Fine values arrive only in the first SKAN 4 window and only when volume thresholds are met. Also check how each network optimizes on these values."],
        yn: ["The design is sound, but values may arrive coarse.", "At low volume the privacy threshold can return only coarse values. Consider fewer values that keep the key splits."],
        ny: ["The schema may be split too finely.", "Merge values that lead to the same action. Split only where decisions differ."],
        nn: ["A simpler schema would serve you better.", "With low volume and the same action per value, keep only two or three decision points."],
      },
    },
  },
  "skan4-migration-guide": {
    ko: {
      title: "SKAN 4 전환, 어디서부터 할까요?",
      questions: ["핵심 행동(구매·구독)이 설치 후 2일 안에 일어나나요?", "첫 창 스키마를 이미 확정했나요?"],
      results: {
        yy: ["캠페인 구조 정리로 넘어가세요.", "핵심 행동이 첫 창 안에 있고 스키마도 정해졌다면, 다음은 캠페인 구조를 iOS 기준으로 다시 짜는 순서입니다."],
        yn: ["첫 창 스키마부터 확정하세요.", "fine 값은 첫 창에서만 옵니다. 핵심 행동이 그 안에 있다면 거기에 판단 구간을 먼저 담으세요."],
        ny: ["창 2·3을 초기 설계에 넣을지 판단할 때입니다.", "늦은 행동이 핵심이면 창 2·3을 처음부터 포함하세요. 다만 뒤 두 창은 coarse 값만 옵니다."],
        nn: ["늦은 행동을 어느 창에 담을지부터 정하세요.", "첫 창 스키마를 확정하되, 늦게 일어나는 핵심 행동은 창 2·3의 coarse 값으로 받을 계획을 함께 세우세요."],
      },
    },
    en: {
      title: "Where to start with the SKAN 4 migration",
      questions: ["Does your key action (purchase, subscription) happen within 2 days of install?", "Have you finalized the first-window schema?"],
      results: {
        yy: ["Move on to campaign structure.", "With the key action inside the first window and the schema set, the next step is rebuilding campaign structure for iOS."],
        yn: ["Finalize the first-window schema first.", "Fine values arrive only in the first window. Put your decision points there first."],
        ny: ["Decide whether windows 2 and 3 belong in the initial design.", "If late actions matter most, include windows 2 and 3 from the start. The later windows return coarse values only."],
        nn: ["Decide which window carries the late action first.", "Finalize the first-window schema and plan to capture late key actions with coarse values in windows 2 and 3."],
      },
    },
  },
  "postback-integration-guide": {
    ko: {
      title: "매체에 데이터가 0으로 보일 때",
      questions: ["MMP에는 설치·이벤트가 기록되나요?", "0인 것이 비용인가요?"],
      results: {
        yy: ["비용 연동 문제일 가능성이 큽니다.", "비용 0은 포스트백과 별도 흐름입니다. 매체 API 권한·계정 연결·시간대·동기화 지연을 확인하세요."],
        yn: ["포스트백 설정을 확인할 차례입니다.", "앱에서 발생한 이벤트가 자동으로 매체에 가지 않습니다. 이벤트명 매핑, 파트너 포스트백 대상 선택, 필수 값(구매는 value·currency)을 나눠 확인하세요."],
        ny: ["비용 연동과 수집 문제가 함께 있을 수 있습니다.", "MMP에도 없으면 앱 수집부터 봐야 합니다. 비용 0은 매체 API 연결을 따로 확인하세요."],
        nn: ["앱 수집부터 확인하세요.", "MMP에도 기록이 없다면 테스트 기기에서 설치·첫 실행과 이벤트 발생부터 확인합니다."],
      },
    },
    en: {
      title: "When a network shows zero data",
      questions: ["Does the MMP record the installs and events?", "Is it cost that shows zero?"],
      results: {
        yy: ["It is likely a cost connection issue.", "Zero cost is a separate flow from postbacks. Check network API permissions, account linking, time zone and sync delay."],
        yn: ["Check the postback setup next.", "Events in the app are not sent to networks automatically. Check event name mapping, partner postback selection and required values (value and currency for purchases)."],
        ny: ["Cost linking and collection may both be broken.", "If the MMP has nothing, start with in-app collection. Check the network API connection for cost separately."],
        nn: ["Start with in-app collection.", "If the MMP has no records, verify install, first open and event firing on a test device."],
      },
    },
  },
  "attribution-data-mismatch": {
    ko: {
      title: "시스템마다 전환 수가 다를 때",
      questions: ["비교하는 시스템들의 어트리뷰션 윈도우가 같나요?", "모두 같은 날짜 기준(클릭일·전환일)으로 집계했나요?"],
      results: {
        yy: ["정의는 맞췄으니 누락·중복을 점검할 차례입니다.", "윈도우와 날짜가 같은데도 다르면, 조회 기반 전환 포함 여부와 연동 누락·중복을 확인하세요."],
        yn: ["날짜 기준 차이가 먼저입니다.", "클릭일로 찍는 시스템과 전환일로 찍는 시스템을 섞으면 같은 전환이 다른 날에 잡힙니다."],
        ny: ["어트리뷰션 윈도우 차이가 먼저입니다.", "클릭 후 며칠까지 인정하는지가 다르면 같은 전환도 다르게 셉니다. 윈도우를 맞춘 뒤 다시 비교하세요."],
        nn: ["지금 숫자는 서로 비교할 수 없습니다.", "윈도우와 날짜 기준을 먼저 맞추세요. 질문별로 어느 시스템을 기준으로 볼지도 정해 두세요."],
      },
    },
    en: {
      title: "When conversion counts differ across systems",
      questions: ["Do the systems use the same attribution window?", "Did they all count on the same date basis (click date or conversion date)?"],
      results: {
        yy: ["Definitions are aligned; check missing and duplicate data next.", "If they still differ with the same window and dates, check view-through inclusion and integration gaps or duplicates."],
        yn: ["The date basis differs first.", "Mixing click-date and conversion-date systems puts the same conversion on different days."],
        ny: ["The attribution window differs first.", "Different post-click windows count the same conversion differently. Align windows and compare again."],
        nn: ["These numbers can't be compared yet.", "Align the window and date basis first, and decide which system answers which question."],
      },
    },
  },
  "ga4-data-traps": {
    ko: {
      title: "GA4 숫자가 이상할 때 먼저 볼 것",
      questions: ["보고서 상단에 샘플링·임계값 표시가 있나요?", "어제 이후의 최근 데이터가 포함돼 있나요?"],
      results: {
        yy: ["품질 표시와 처리 지연을 함께 의심하세요.", "샘플링·임계값은 전체 이벤트를 읽은 결과와 다르고, 최근 데이터는 아직 확정이 아닙니다. 표시와 추출 시각을 보고서에 남기세요."],
        yn: ["샘플링·임계값부터 확인하세요.", "표시가 있으면 일부 데이터가 제한됐거나 추정된 값입니다. 탐색 범위를 줄이거나 원본 이벤트로 확인하세요."],
        ny: ["처리 지연일 수 있습니다.", "어제 숫자는 아직 확정이 아닐 수 있습니다. 며칠 뒤 같은 조건으로 다시 확인하세요."],
        nn: ["지표·범위·시간대를 확인하세요.", "같은 이름처럼 보여도 지표와 범위가 다를 수 있고, 시간대가 다르면 하루가 달라집니다."],
      },
    },
    en: {
      title: "What to check first when GA4 numbers look off",
      questions: ["Does the report show a sampling or threshold indicator?", "Does it include data from yesterday onward?"],
      results: {
        yy: ["Suspect both the quality indicator and processing delay.", "Sampled or thresholded results differ from full event data, and recent data isn't final yet. Record the indicator and export time."],
        yn: ["Check sampling and thresholds first.", "An indicator means some data was limited or estimated. Narrow the exploration or check raw events."],
        ny: ["It may be processing delay.", "Yesterday's numbers may not be final. Check again in a few days with the same settings."],
        nn: ["Check metric, scope and time zone.", "Similar names can hide different metrics and scopes, and a different time zone shifts the day."],
      },
    },
  },
  "event-taxonomy-guide": {
    ko: {
      title: "이벤트 설계, 지금 상태는?",
      questions: ["이벤트 이름이 행동만 담고, 맥락은 파라미터로 빠져 있나요?", "GA4 권장 이벤트를 먼저 확인하고 이름을 정했나요?"],
      results: {
        yy: ["구조는 맞습니다. 매핑표와 QA로 넘어가세요.", "GA4·MMP·매체가 같은 행동을 같은 뜻으로 읽는지 매핑표로 확인하고, 개발 전달 전 체크리스트를 돌리세요."],
        yn: ["권장 이벤트와 겹치는 이름부터 정리하세요.", "제품 정의와 맞는 권장 이벤트가 있다면 그대로 쓰는 편이 도구 간 해석을 맞추기 쉽습니다."],
        ny: ["이름에 맥락이 섞여 있습니다.", "화면·버튼 같은 맥락은 파라미터로 빼야 이벤트 수가 불어나지 않고 같은 행동을 한 이름으로 셀 수 있습니다."],
        nn: ["행동과 맥락 분리부터 다시 하세요.", "행동은 이벤트 이름, 맥락은 파라미터로 나누고, 권장 이벤트를 먼저 확인하세요."],
      },
    },
    en: {
      title: "Where does your event design stand?",
      questions: ["Do event names hold only the action, with context in parameters?", "Did you check GA4 recommended events before naming?"],
      results: {
        yy: ["The structure is right; move on to the mapping table and QA.", "Confirm with a mapping table that GA4, the MMP and networks read each action the same way, then run the pre-handoff checklist."],
        yn: ["Clean up names that overlap recommended events.", "If a recommended event fits your definition, using it keeps tools aligned."],
        ny: ["Names are mixing in context.", "Move screen or button context into parameters so the same action is counted under one name."],
        nn: ["Start by separating action from context.", "Use the event name for the action and parameters for context, and check recommended events first."],
      },
    },
  },
  "ad-creative-specs-guide": {
    ko: {
      title: "소재가 반려되거나 잘릴 때",
      questions: ["매체마다 비율(1:1·9:16 등)을 따로 만들었나요?", "실제 미리보기에서 UI에 가려지는 영역을 확인했나요?"],
      results: {
        yy: ["용량과 검수 사유를 확인하세요.", "비율과 안전 영역이 맞다면, 플레이어블 용량 제한이나 매체 검수 사유를 다음으로 보세요."],
        yn: ["안전 영역을 확인하세요.", "영상은 매체 UI에 가려지는 영역이 있습니다. 핵심 문구와 로고를 가리지 않는지 실제 미리보기로 보세요."],
        ny: ["매체별 비율부터 맞추세요.", "하나의 파일로 통일하면 매체마다 크롭됩니다. 매체별 규격으로 따로 만드세요."],
        nn: ["규격과 미리보기를 둘 다 확인하세요.", "매체별 비율로 만들고, 집행 전에 실제 미리보기로 가려지는 영역까지 확인하세요."],
      },
    },
    en: {
      title: "When creatives get rejected or cropped",
      questions: ["Did you make separate aspect ratios (1:1, 9:16) per network?", "Did you check the UI-covered area in an actual preview?"],
      results: {
        yy: ["Check file size and review reasons.", "If ratios and safe areas are right, look at playable size limits or the network's review reasons next."],
        yn: ["Check the safe area.", "Network UI covers part of video. Confirm in a real preview that key text and logos stay visible."],
        ny: ["Match each network's ratio first.", "One universal file gets cropped differently by each network. Make files per network spec."],
        nn: ["Check both specs and previews.", "Make files per network ratio and confirm the covered areas in a real preview before launch."],
      },
    },
  },
  "ai-era-marketer": {
    ko: {
      title: "자동화 이후에도 내가 챙기고 있나요?",
      questions: ["최적화 목표가 실제 사업 목표(매출·유지)와 맞나요?", "매체 보고 수치와 증분 검증을 구분해서 보나요?"],
      results: {
        yy: ["판단의 핵심 두 가지는 챙기고 있습니다.", "남은 하나는 사업 맥락이 실제로 입력됐는지입니다. 시즌·재고·가격 변화를 자동화가 알고 있는지 확인하세요."],
        yn: ["귀속 보고와 증분을 나눠 보세요.", "매체가 보고한 전환은 광고가 없었어도 일어났을 전환을 빼주지 않습니다. 중요한 결정은 증분으로 확인하세요."],
        ny: ["최적화 목표부터 점검하세요.", "기계는 주어진 목표를 잘 쫓습니다. 목표가 사업과 어긋나면 잘 쫓을수록 멀어집니다."],
        nn: ["목표 정의와 증분 검증부터 다시 잡으세요.", "소재를 100개 만들어도 방향이 틀리면 모두 쓸모없습니다. 목표와 검증 방식을 먼저 정하세요."],
      },
    },
    en: {
      title: "Are you still covering what automation can't?",
      questions: ["Does the optimization goal match the real business goal (revenue, retention)?", "Do you separate platform-reported numbers from incrementality checks?"],
      results: {
        yy: ["You cover the two core judgments.", "The remaining one is business context: confirm the automation knows about seasonality, stock and price changes."],
        yn: ["Separate attributed reports from incrementality.", "Reported conversions don't subtract what would have happened without ads. Verify key decisions with incrementality."],
        ny: ["Check the optimization goal first.", "Machines chase the goal they're given. If it's misaligned with the business, better optimization moves you further away."],
        nn: ["Reset the goal and the validation method first.", "A hundred creatives are wasted if the direction is wrong. Define the goal and how you'll verify results first."],
      },
    },
  },
};

export function blogSelfCheckFor(slug, locale = "ko") {
  const entry = BLOG_SELF_CHECKS[slug];
  return entry ? entry[locale === "en" ? "en" : "ko"] : null;
}
