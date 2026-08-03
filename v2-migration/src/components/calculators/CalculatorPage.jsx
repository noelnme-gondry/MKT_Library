import Link from "next/link";
import CalculatorWorkbench from "./CalculatorWorkbench";
import { getAllCalculators, getCalculator } from "@/lib/calculators";

export default function CalculatorPage({ slug, locale = "ko" }) {
  const calculator = getCalculator(slug, locale);
  const isEn = locale === "en";
  const base = isEn ? "/en" : "";
  const siblings = getAllCalculators(locale).filter((item) => item.slug !== slug);

  return (
    <main id="main-content" className="calculator-page">
      <nav className="calculator-breadcrumb" aria-label={isEn ? "Breadcrumb" : "현재 위치"}>
        <Link href={base || "/"}>{isEn ? "Home" : "홈"}</Link>
        <span aria-hidden>/</span>
        <Link href={`${base}/calculator`}>{isEn ? "Metric calculators" : "지표 계산기"}</Link>
        <span aria-hidden>/</span>
        <span>{calculator.name}</span>
      </nav>

      <header className="calculator-hero">
        <span>{calculator.eyebrow}</span>
        <h1>{calculator.title}</h1>
        <p>{calculator.description}</p>
        <div>
          <b>{isEn ? "No CSV" : "CSV 불필요"}</b>
          <b>{isEn ? "No sign-up" : "회원가입 없음"}</b>
          <b>{isEn ? "Runs in your browser" : "브라우저에서 계산"}</b>
        </div>
      </header>

      <CalculatorWorkbench slug={slug} locale={locale} />

      <section className="calculator-explainer">
        <div>
          <span>{isEn ? "HOW TO READ IT" : "결과 읽는 법"}</span>
          <h2>{isEn ? "Use the answer as a decision boundary" : "계산값을 판단 기준으로 쓰세요"}</h2>
        </div>
        <div className="calculator-explainer__rows">
          {calculator.guide.map(([label, description]) => (
            <article key={label}>
              <strong>{label}</strong>
              <p>{description}</p>
            </article>
          ))}
        </div>
        <aside>
          <strong>{isEn ? "Important limitation" : "해석할 때 주의"}</strong>
          <p>{calculator.caveat}</p>
        </aside>
      </section>

      <section className="calculator-faq" aria-label={isEn ? "Frequently asked questions" : "자주 묻는 질문"}>
        <span>FAQ</span>
        <h2>{isEn ? "Questions before using this number" : "이 숫자를 쓰기 전 확인할 것"}</h2>
        {calculator.faq.map(([question, answer]) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>

      <section className="calculator-related">
        <span>{isEn ? "MORE MARKETING METRIC CALCULATORS" : "다른 마케팅 지표 계산기"}</span>
        <div>
          {siblings.map((item) => (
            <Link key={item.slug} href={`${base}/calculator/${item.slug}`}>
              <small>{item.eyebrow}</small>
              <strong>{item.name}</strong>
              <b aria-hidden>→</b>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
