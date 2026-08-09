import Link from "next/link";
import { getAllCalculators } from "@/lib/calculators";

export default function CalculatorHub({ locale = "ko" }) {
  const isEn = locale === "en";
  const base = isEn ? "/en" : "";
  const calculators = getAllCalculators(locale);
  return (
    <main id="main-content" tabIndex="-1" className="calculator-page calculator-hub">
      <header className="calculator-hero">
        <span>{isEn ? "MARKETING METRIC CALCULATORS" : "마케팅 지표 계산기"}</span>
        <h1>{isEn ? "Get the number first. Upload data only when you need the cause." : "숫자는 바로 계산하고, 원인이 필요할 때만 데이터를 넣으세요"}</h1>
        <p>{isEn ? "Five focused calculators for unit economics, advertising profitability, experiment planning, and budget estimates. No CSV or sign-up." : "LTV:CAC, 손익분기 ROAS, 목표 CPA, A/B 표본수, 예산별 설치수를 CSV 없이 바로 계산합니다."}</p>
      </header>
      <section className="calculator-hub__grid" aria-label={isEn ? "Calculator list" : "계산기 목록"}>
        {calculators.map((calculator, index) => (
          <Link key={calculator.slug} href={`${base}/calculator/${calculator.slug}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <small>{calculator.eyebrow}</small>
            <strong>{calculator.name}</strong>
            <p>{calculator.summary}</p>
            <b>{isEn ? "Calculate now" : "바로 계산"} →</b>
          </Link>
        ))}
      </section>
      <section className="calculator-hub__next">
        <span>{isEn ? "WHEN ONE NUMBER IS NOT ENOUGH" : "한 숫자만으로 판단하기 어렵다면"}</span>
        <h2>{isEn ? "Let your data choose the next analysis" : "내 데이터로 가능한 분석부터 확인하세요"}</h2>
        <p>{isEn ? "The analysis router checks your CSV structure in the browser and recommends only analyses your columns can support." : "분석 라우터가 CSV 구조를 브라우저 안에서 확인하고, 현재 컬럼으로 가능한 분석만 추천합니다."}</p>
        <Link href={`${base}/start`}>{isEn ? "Start with my data" : "내 데이터로 시작"} <b aria-hidden>→</b></Link>
      </section>
    </main>
  );
}
