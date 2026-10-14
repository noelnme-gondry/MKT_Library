"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { productEventKey, trackProductEvent, trackProductEventOnce } from "@/lib/analytics";
import { calculateMarketingMetric, getCalculator } from "@/lib/calculators";

const INTEGER = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

function formatValue(value, format, locale) {
  const isEn = locale === "en";
  if (value === null || value === undefined) return isEn ? "Unavailable" : "계산 불가";
  const number = Array.isArray(value) ? null : Number(value);
  if (format === "ratio") return `${number.toFixed(2)}×`;
  if (format === "roas") return `${Math.round(number * 100)}% · ${number.toFixed(2)}×`;
  if (format === "percent") return `${(number * 100).toFixed(1)}%`;
  if (format === "percentagePoints") return `${(number * 100).toFixed(1)}${isEn ? " pp" : "%p"}`;
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
  if (type === "people") return locale === "en" ? "people" : "명";
  if (type === "days") return locale === "en" ? "days" : "일";
  return locale === "en" ? "currency" : "원";
}

export default function CalculatorWorkbench({ slug, locale = "ko", entry = null }) {
  const calculator = getCalculator(slug, locale);
  const [values, setValues] = useState(() => Object.fromEntries(
    calculator.inputs.map((input) => [input.id, input.defaultValue]),
  ));
  const result = useMemo(() => calculateMarketingMetric(slug, values), [slug, values]);
  const isEn = locale === "en";
  const toolHref = `${isEn ? "/en" : ""}${calculator.toolHref}`;
  // 계산기 → CSV 분석 연결은 글·용어 CTA와 같은 이벤트로 잰다. 클릭만 있으면 "안 눌렀다"와
  // "안 보였다"를 가를 수 없으므로 노출도 함께 보내고, 클릭은 도구 쪽 결과 이벤트까지
  // content_slug가 이어지게 한다(analytics.withEditorialJourney).
  const contentSlug = entry?.slug || slug, contentType = entry?.type || "calculator", placement = entry?.placement || "calculator_result";
  const eventParams = { tool_id: calculator.toolId, content_slug: contentSlug, content_type: contentType, placement, locale };
  const updateInput = (id, value) => {
    const nextValues = { ...values, [id]: value };
    setValues(nextValues);
    // 기본 예시 노출은 사용이 아니다. 입력값과 계산 결과는 이벤트에 넣지 않는다.
    const hasCompleteInputs = calculator.inputs.every((input) => String(nextValues[input.id]).trim() !== "");
    if (value !== String(values[id]) && hasCompleteInputs && calculateMarketingMetric(slug, nextValues)) {
      trackProductEventOnce("calculator_used", entry ? productEventKey(contentType, contentSlug, slug, locale) : productEventKey(slug, locale), {
        ...eventParams, placement: entry?.placement || "calculator_input", state: "calculated",
      });
    }
  };
  const toolLinkRef = useRef(null);
  useEffect(() => {
    const target = toolLinkRef.current;
    if (!target || typeof IntersectionObserver !== "function") return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      trackProductEventOnce("blog_cta_viewed", productEventKey(contentType, contentSlug, placement, locale), { tool_id: calculator.toolId, content_slug: contentSlug, content_type: contentType, placement, locale });
      observer.disconnect();
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [calculator.toolId, locale, contentSlug, contentType, placement, result]);

  return (
    <section className="calculator-workbench" aria-label={isEn ? "Calculator inputs and result" : "계산기 입력과 결과"}>
      <div className="calculator-workbench__inputs">
        <div className="calculator-workbench__heading">
          <span>{isEn ? "Your inputs" : "내 조건 입력"}</span>
          <strong>{isEn ? "Change a number. The answer updates immediately." : "숫자를 바꾸면 결과가 바로 갱신됩니다."}</strong>
        </div>
        {calculator.exampleNote && <p>{calculator.exampleNote}</p>}
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
                  onChange={(event) => updateInput(input.id, event.target.value)}
                />
                <small>{inputSuffix(input.type, locale)}</small>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className={`calculator-result${result ? "" : " is-invalid"}`} aria-live="polite">
        
        {result ? (
          <>
            <div className="calculator-result__primary">
              <small>{calculator.primaryLabel}</small>
              <strong>{formatValue(result.primary, result.primaryFormat, locale)}</strong>
            </div>
            <div className="calculator-result__secondary">
              <small>{calculator.secondaryLabel}</small>
              <strong>{result.secondary === null && calculator.unavailableSecondary
                ? calculator.unavailableSecondary
                : formatValue(result.secondary, result.secondaryFormat, locale)}</strong>
            </div>
            <p>{calculator.summary}</p>
            {calculator.resultNote && <p>{calculator.resultNote}</p>}
            <div className="calculator-result__formula">
              <span>{isEn ? "Formula" : "계산식"}</span>
              <code>{calculator.formula}</code>
            </div>
            <Link ref={toolLinkRef} href={toolHref} onClick={() => trackProductEvent("blog_tool_cta_clicked", eventParams)}>{calculator.toolCta} <b aria-hidden>→</b></Link>
          </>
        ) : (
          <p>{calculator.inputError || (isEn ? "Check the inputs. Percentages must leave a positive margin and all denominators must be above zero." : "입력값을 확인하세요. 이익률은 0보다 커야 하고, 목표 이익률은 매출총이익률보다 낮아야 합니다.")}</p>
        )}
      </div>
    </section>
  );
}
