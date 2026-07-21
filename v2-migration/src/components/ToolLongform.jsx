import Link from "next/link";

const COPY = {
  "5-18": {
    ko: {
      eyebrow: "도구 사용 가이드",
      title: "광고가 신규 성과를 만들었는지, 기존 유입을 옮겼는지 구분하세요",
      lead: "카니발라이제이션 진단은 광고가 켜진 뒤 성과가 늘었다는 사실만으로 결론내리지 않습니다. 같은 시점의 오가닉·브랜드·검색 흐름과 채널 지출 패턴을 함께 보고, 예산을 다시 검토할 채널을 좁히는 탐색 도구입니다.",
      detailsLabel: "진단 기준과 다음 조치 보기",
      sections: [
        ["언제 써야 하나", "브랜드 검색이나 오가닉 가입이 줄었는데 유료 전환은 유지되거나 늘었을 때, 리타겟팅·브랜드 캠페인을 확장하기 전, 채널별 기여도를 단순 어트리뷰션과 다르게 검토하고 싶을 때 사용합니다. 이 도구의 신호는 인과 확정이 아니라 홀드아웃 또는 on/off 검증을 설계할 후보를 고르는 근거입니다."],
        ["무엇을 확인하나", "지출을 한 번 늘린 뒤 몇 주간 결과가 어떻게 움직이는지, 오가닉·브랜드 지표와 반대로 움직이는지, 채널끼리 너무 비슷한 패턴인지, 모델이 실제 추이를 얼마나 따라가는지를 함께 확인합니다. 한 신호만으로 잠식이라고 단정하지 않고 네 가지 진단을 병렬로 읽는 이유입니다."],
        ["결과를 어떻게 쓰나", "잠식 의심이 큰 채널은 바로 끄기보다 일부 지역·오디언스·기간을 남겨 통제군으로 비교하세요. 신뢰도가 낮거나 채널 간 패턴이 겹치면 예산을 크게 이동하지 말고, 데이터를 더 모은 뒤 재검토해야 합니다. 잠식 가능성이 낮고 한계 효율이 남은 채널은 예산 배분 시뮬레이션에서 증액 후보로 비교할 수 있습니다."],
      ],
      related: { href: "/tools/budget-allocation", label: "의심 채널 포함 예산 시뮬레이션 열기" },
    },
    en: {
      eyebrow: "Tool guide",
      title: "Separate incremental outcomes from shifted demand",
      lead: "Cannibalization diagnosis looks beyond a paid-performance lift. It compares spend patterns with organic, brand, and search trends to narrow the channels that deserve a budget review.",
      detailsLabel: "See diagnostic criteria and next steps",
      sections: [
        ["When to use it", "Use this before scaling brand or retargeting spend, or when paid outcomes rise while organic or branded outcomes weaken. The signals prioritize a holdout or on/off test; they do not prove causality by themselves."],
        ["What to inspect", "Review delayed response after a spend increase, movement against organic and branded outcomes, overlap between channels, and model fit. Read the four signals together rather than labelling one correlation as cannibalization."],
        ["How to act", "Do not turn off a suspect channel immediately. Keep a controlled slice by geography, audience, or time, then compare the incremental outcome. Use budget allocation only after confidence and marginal efficiency support a move."],
      ],
      related: { href: "/en/tools/budget-allocation", label: "Open budget allocation simulation" },
    },
  },
  "5-3": {
    ko: {
      eyebrow: "도구 사용 가이드",
      title: "평균 효율이 아니라 다음 돈의 한계 효율로 예산을 옮기세요",
      lead: "예산 배분은 지금 가장 좋아 보이는 채널에 돈을 몰아주는 기능이 아닙니다. 채널별 반응곡선과 현재 지출 위치를 바탕으로, 다음 예산 단위가 어디에서 가장 나은 결과를 낼지 비교하는 시뮬레이션입니다.",
      detailsLabel: "계산 기준과 안전한 사용법 보기",
      sections: [
        ["언제 써야 하나", "월·주 예산을 다시 나눌 때, 특정 채널 증액 요청을 검토할 때, 평균 CPA나 ROAS는 좋아 보이지만 포화가 걱정될 때 사용합니다. 지출·결과가 기간별로 충분히 쌓인 채널일수록 반응곡선의 참고 가치가 높습니다."],
        ["무엇을 계산하나", "현재 지출 근처에서 추가 예산이 만들 것으로 추정되는 결과를 비교합니다. 따라서 평균 효율이 좋더라도 이미 포화 구간이면 우선순위가 낮아질 수 있고, 평균은 평범해도 아직 여력이 남은 채널이 후보가 될 수 있습니다. 결과는 과거 관측 기반 시뮬레이션이지 미래 보장이 아닙니다."],
        ["결과를 어떻게 쓰나", "추천 금액을 한 번에 전액 적용하지 말고 작은 단위로 나눠 적용한 뒤 실제 CPA·ROAS와 예상 범위를 비교하세요. 카니발라이제이션 의심 채널은 증액 전 먼저 통제 실험을 검토해야 합니다. 신규 채널·캠페인처럼 관측치가 적은 곳은 모델 결과보다 실험 예산으로 취급하세요."],
      ],
      related: { href: "/tools/marketing-response", label: "예산 이동 전 광고 잠식 점검하기" },
    },
    en: {
      eyebrow: "Tool guide",
      title: "Move budget by marginal efficiency, not average efficiency",
      lead: "Budget allocation compares the likely outcome from the next unit of spend at each channel's current position. It is not a rule to concentrate budget in the channel with the best average result.",
      detailsLabel: "See calculation logic and safeguards",
      sections: [
        ["When to use it", "Use it for weekly or monthly reallocations, scale-up reviews, and saturation checks. Response curves are more useful when each channel has enough historical spend and outcome variation."],
        ["What it estimates", "The tool compares estimated incremental outcomes near current spend. A channel with strong average efficiency can rank lower when it is near saturation, while a moderate channel can rank higher when headroom remains. It is a historical simulation, not a guarantee."],
        ["How to act", "Apply recommendations in small steps, then compare actual CPA or ROAS with the estimated range. Check cannibalization before increasing a suspect channel, and treat sparse new channels as an experiment budget rather than a model-led scale decision."],
      ],
      related: { href: "/en/tools/marketing-response", label: "Check ad cannibalization first" },
    },
  },
};

export default function ToolLongform({ toolId, locale = "ko" }) {
  const content = COPY[toolId]?.[locale === "en" ? "en" : "ko"];
  if (!content) return null;

  return <section className="tool-longform" aria-labelledby={`tool-longform-${toolId}`}>
    <span className="tool-longform__eyebrow">{content.eyebrow}</span>
    <h2 id={`tool-longform-${toolId}`}>{content.title}</h2>
    <p className="tool-longform__lead">{content.lead}</p>
    <details className="tool-longform__details">
      <summary>{content.detailsLabel}</summary>
      <div className="tool-longform__body">
        {content.sections.map(([title, body]) => <section key={title}>
          <h3>{title}</h3>
          <p>{body}</p>
        </section>)}
      </div>
    </details>
    <Link className="tool-longform__link" href={content.related.href}>{content.related.label} <span aria-hidden>→</span></Link>
  </section>;
}
