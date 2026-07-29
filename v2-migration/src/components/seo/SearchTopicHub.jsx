import Link from "next/link";

const TOPICS = {
  ko: [
    { href: "/tools/campaign-variance", kicker: "CPA가 올랐을 때", title: "무엇이 성과를 바꿨는지 확인", desc: "채널·캠페인·소재별 기여도를 나눠 원인부터 좁힙니다.", cta: "성과 변동 분석하기" },
    { href: "/content/freshness", kicker: "CTR이 떨어졌을 때", title: "소재 피로도와 교체 우선순위", desc: "교체할 소재와 다음 제작 가설을 정리합니다.", cta: "소재 피로도 분석하기" },
    { href: "/tools/cannibalization-diagnosis", kicker: "광고가 오가닉을 잠식할 때", title: "카니발라이제이션 가능성부터 점검", desc: "시계열 점검을 마친 뒤 유료 광고가 원래 들어올 오가닉 성과를 빼앗는지 네 가지 신호로 확인합니다.", cta: "잠식 진단 바로 열기" },
    { href: "/tools/budget-allocation", kicker: "예산을 옮기기 전", title: "다음 예산, 어디로 보낼지", desc: "한계 CPA·ROAS와 지출 여력으로 채널별 증액·감액을 시뮬레이션합니다.", cta: "예산 배분 계산하기" },
    { href: "/dashboard", kicker: "매주 운영 점검", title: "CPA·ROAS·예산 속도 한눈에", desc: "CSV 한 파일로 주간 상태와 이상 신호를 확인합니다.", cta: "운영 대시보드 열기" },
    { href: "/tools/incrementality", kicker: "광고의 진짜 효과가 궁금할 때", title: "홀드아웃·전후 증분 효과", desc: "귀속 전환이 아니라 광고가 추가로 만든 성과를 추정합니다.", cta: "증분 효과 분석하기" },
  ],
  en: [
    { href: "/en/tools/campaign-variance", kicker: "When CPA rises", title: "See what actually moved performance", desc: "Narrow the cause with channel, campaign, and creative contributions.", cta: "Analyze performance change" },
    { href: "/en/content/freshness", kicker: "When CTR falls", title: "Find creative fatigue and swap priority", desc: "Identify what to replace and what to produce next.", cta: "Analyze creative fatigue" },
    { href: "/en/tools/cannibalization-diagnosis", kicker: "When ads may displace organic", title: "Start with a cannibalization check", desc: "After the time-series review, use four signals to check whether paid ads may displace organic outcomes.", cta: "Open cannibalization diagnosis" },
    { href: "/en/tools/budget-allocation", kicker: "Before moving spend", title: "Know where the next dollar belongs", desc: "Simulate channel scale-ups and pull-backs with marginal CPA, ROAS, and headroom.", cta: "Plan budget allocation" },
    { href: "/en/dashboard", kicker: "Weekly operating review", title: "Review CPA, ROAS, and pacing together", desc: "Use one CSV to check the weekly operating state and anomalies.", cta: "Open operations dashboard" },
    { href: "/en/tools/incrementality", kicker: "For true advertising impact", title: "Holdout and pre/post incrementality", desc: "Estimate what advertising added beyond attributed conversions.", cta: "Analyze incrementality" },
  ],
};

export default function SearchTopicHub({ locale = "ko", compact = false }) {
  const isEn = locale === "en";
  const topics = compact ? TOPICS[isEn ? "en" : "ko"].slice(0, 3) : TOPICS[isEn ? "en" : "ko"];
  return <section className={`search-topic-hub${compact ? " is-compact" : ""}`} aria-label={isEn ? "Marketing analysis tools by task" : "업무별 마케팅 분석 도구"}>
    <div className="search-topic-hub__intro">
      <span className="search-topic-hub__eyebrow">{isEn ? "FROM READING TO DECISION" : "읽은 뒤 바로 실행"}</span>
      <h2>{isEn ? "Turn this question into a decision" : "지금 읽는 문제를 내 데이터로 확인하세요"}</h2>
      <p>{isEn ? "Every guide and definition leads to a matching free analysis tool. No sign-up; raw data stays in your browser." : "글과 용어의 다음 단계는 도구 실행입니다. 회원가입 없이, 원본 데이터는 브라우저 안에서만 처리합니다."}</p>
    </div>
    <div className="search-topic-hub__grid">
      {topics.map((topic, index) => <Link key={topic.href} href={topic.href} className="search-topic-hub__card">
        <span className="search-topic-hub__index">0{index + 1}</span>
        <span className="search-topic-hub__kicker">{topic.kicker}</span>
        <strong>{topic.title}</strong>
        <span className="search-topic-hub__desc">{topic.desc}</span>
        <span className="search-topic-hub__cta">{topic.cta} <b aria-hidden>→</b></span>
      </Link>)}
    </div>
  </section>;
}
