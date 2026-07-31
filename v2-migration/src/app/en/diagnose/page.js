import DiagnoseRouter from "@/components/DiagnoseRouter";
import { SITE_URL } from "@/lib/routeMap";

const FAQ = [
  ["Where should I start when CPI rises?", "Decompose cost and installs by channel and campaign to separate volume, mix, and efficiency effects."],
  ["Does an organic decline after scaling ads prove cannibalization?", "No. Separate natural trend and seasonality, then validate with a holdout when possible."],
  ["Does the diagnosis prove the cause?", "No. It proposes hypotheses and a check order while separating observational association from causal evidence."],
];

export const metadata = {
  title: "Marketing Performance Diagnosis | Find Causes of CPI, ROAS & Organic Decline",
  description: "Answer three questions about CPI, ROAS, revenue, or organic decline to get a cause hypothesis, check order, and matching free analysis tools.",
  alternates: {
    canonical: `${SITE_URL}/en/diagnose`,
    languages: { ko: `${SITE_URL}/diagnose`, en: `${SITE_URL}/en/diagnose`, "x-default": `${SITE_URL}/diagnose` },
  },
  openGraph: { title: "Marketing performance diagnosis", description: "Turn a symptom into a hypothesis and check order.", url: `${SITE_URL}/en/diagnose`, locale: "en_US", images: [`${SITE_URL}/og-card.png`] },
};

export default function EnglishDiagnosePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HowTo",
        name: "How to diagnose a marketing performance change",
        step: ["Choose the symptom that changed.", "Choose the data you have.", "Choose the next decision and follow the recommended check order."].map((text, index) => ({ "@type": "HowToStep", position: index + 1, text })),
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
        <span>SYMPTOM-BASED ANALYSIS ROUTER</span>
        <h1>Start with “why did it move?”<br />not “which tool should I use?”</h1>
        <p>Three questions turn a performance symptom into a cause hypothesis and check order. No source data is entered, and the result does not claim causality.</p>
      </header>
      <DiagnoseRouter locale="en" />
      <section className="calculator-faq" aria-label="Frequently asked questions">
        <span>FAQ</span><h2>Before you diagnose</h2>
        {FAQ.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
      </section>
    </main>
  );
}
