"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { calculateMarketingMetric, getCalculator } from "@/lib/calculators";

const INTEGER = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

function formatValue(value, format, locale) {
  const isEn = locale === "en";
  const number = Array.isArray(value) ? null : Number(value);
  if (format === "ratio") return `${number.toFixed(2)}×`;
  if (format === "roas") return `${Math.round(number * 100)}% · ${number.toFixed(2)}×`;
  if (format === "percent") return `${(number * 100).toFixed(1)}%`;
  if (format === "months") return `${number.toFixed(1)}${isEn ? " months" : "개월"}`;
  if (format === "days") return `${INTEGER.format(number)}${isEn ? " days" : "일"}`;
  if (format === "countRange") {
    return `${INTEGER.format(value[0])}–${INTEGER.format(value[1])}${isEn ? "" : "건"}`;
  }
  if (format === "count") return `${INTEGER.format(number)}${isEn ? "" : "건"}`;
  if (format === "currency") return `${INTEGER.format(number)}${isEn ? "" : "원"}`;
  return INTEGER.format(number);
}

function inputSuffix(type, locale) {
  if (type === "percent") return "%";
  if (type === "count") return locale === "en" ? "/ day" : "명/일";
  if (type === "quantity") return locale === "en" ? "" : "건";
  if (type === "days") return locale === "en" ? "days" : "일";
  return locale === "en" ? "currency" : "원";
}

export default function CalculatorWorkbench({ slug, locale = "ko" }) {
  const calculator = getCalculator(slug, locale);
  const [values, setValues] = useState(() => Object.fromEntries(
    calculator.inputs.map((input) => [input.id, input.defaultValue]),
  ));
  const result = useMemo(() => calculateMarketingMetric(slug, values), [slug, values]);
  const isEn = locale === "en";
  const toolHref = `${isEn ? "/en" : ""}${calculator.toolHref}`;

  return (
    <section className="calculator-workbench" aria-label={isEn ? "Calculator inputs and result" : "계산기 입력과 결과"}>
      <div className="calculator-workbench__inputs">
        <div className="calculator-workbench__heading">
          <span>{isEn ? "YOUR ASSUMPTIONS" : "내 조건 입력"}</span>
          <strong>{isEn ? "Change a number. The answer updates immediately." : "숫자를 바꾸면 결과가 바로 갱신됩니다."}</strong>
        </div>
        <div className="calculator-input-grid">
          {calculator.inputs.map((input) => (
            <label key={input.id} className="calculator-input">
              <span>{calculator.labels[input.id]}</span>
              <span className="calculator-input__control">
                <input
                  type="number"
                  inputMode={input.type === "percent" ? "decimal" : "numeric"}
                  min="0"
                  step={input.type === "percent" ? "0.1" : "1"}
                  value={values[input.id]}
                  onChange={(event) => setValues((current) => ({
                    ...current,
                    [input.id]: event.target.value,
                  }))}
                />
                <small>{inputSuffix(input.type, locale)}</small>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className={`calculator-result${result ? "" : " is-invalid"}`} aria-live="polite">
        <span className="calculator-result__eyebrow">{isEn ? "CALCULATED ANSWER" : "계산 결과"}</span>
        {result ? (
          <>
            <div className="calculator-result__primary">
              <small>{calculator.primaryLabel}</small>
              <strong>{formatValue(result.primary, result.primaryFormat, locale)}</strong>
            </div>
            <div className="calculator-result__secondary">
              <small>{calculator.secondaryLabel}</small>
              <strong>{formatValue(result.secondary, result.secondaryFormat, locale)}</strong>
            </div>
            <p>{calculator.summary}</p>
            <div className="calculator-result__formula">
              <span>{isEn ? "FORMULA" : "계산식"}</span>
              <code>{calculator.formula}</code>
            </div>
            <Link href={toolHref}>{calculator.toolCta} <b aria-hidden>→</b></Link>
          </>
        ) : (
          <p>{isEn ? "Check the inputs. Percentages must leave a positive margin and all denominators must be above zero." : "입력값을 확인하세요. 이익률은 0보다 커야 하고, 목표 이익률은 매출총이익률보다 낮아야 합니다."}</p>
        )}
      </div>
    </section>
  );
}
