import DiagnoseRouter from "@/components/DiagnoseRouter";
import { SITE_URL } from "@/lib/routeMap";

const FAQ = [
  ["CPI가 오르면 어디부터 확인해야 하나요?", "같은 기간의 비용·설치 변화를 채널과 캠페인 단위로 나눠 물량, 믹스, 효율 중 어떤 요인이 CPA를 움직였는지 먼저 확인하세요."],
  ["광고를 늘린 뒤 오가닉이 줄면 잠식인가요?", "동시에 움직였다는 사실만으로는 잠식을 단정할 수 없습니다. 자연 추세와 계절성을 분리하고 가능하면 홀드아웃으로 검증해야 합니다."],
  ["진단 결과가 원인을 확정하나요?", "아니요. 확인 순서와 가설을 제안합니다. 관측 데이터의 연관성과 통제 실험의 인과 근거를 구분합니다."],
];

export const metadata = {
  title: "마케팅 성과 문제 진단 | CPI·ROAS·오가닉 하락 원인 찾기",
  description: "CPI 상승, ROAS 하락, 설치 대비 매출 정체, 오가닉 감소 증상을 3문항으로 진단하고 확인 순서와 맞는 무료 분석 도구를 추천합니다.",
  alternates: {
    canonical: `${SITE_URL}/diagnose`,
    languages: { ko: `${SITE_URL}/diagnose`, en: `${SITE_URL}/en/diagnose`, "x-default": `${SITE_URL}/diagnose` },
  },
  openGraph: { title: "마케팅 성과 문제 진단", description: "증상 3문항으로 원인 가설과 확인 순서를 잡으세요.", url: `${SITE_URL}/diagnose`, images: [`${SITE_URL}/og-card.png`] },
};

export default function DiagnosePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HowTo",
        name: "마케팅 성과 문제 진단 순서",
        step: ["성과가 변한 증상을 선택합니다.", "현재 보유한 데이터 형태를 선택합니다.", "다음에 내려야 할 결정을 선택하고 추천 순서대로 확인합니다."].map((text, index) => ({ "@type": "HowToStep", position: index + 1, text })),
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
      },
    ],
  };
  return (
    <main id="main-content" className="diagnose-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="calculator-hero">
        <span>증상 기반 분석 라우터</span>
        <h1>무슨 분석을 해야 할지<br />모르겠다면</h1>
        <p>지금 겪는 증상부터 하나씩 고르세요. 세 번째 답 뒤에 가장 먼저 확인할 분석 하나를 안내합니다.</p>
      </header>
      <DiagnoseRouter />
      <section className="calculator-faq" aria-label="자주 묻는 질문">
        <span>FAQ</span><h2>진단을 시작하기 전</h2>
        {FAQ.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
      </section>
    </main>
  );
}
