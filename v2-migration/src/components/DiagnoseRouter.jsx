"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildSymptomDiagnosis, DIAGNOSE_OPTIONS, getDiagnoseSymptoms } from "@/lib/diagnoseRouter";

export default function DiagnoseRouter({ locale = "ko" }) {
  const isEn = locale === "en";
  const symptoms = getDiagnoseSymptoms(locale);
  const [symptom, setSymptom] = useState(symptoms[0].id);
  const [data, setData] = useState("campaign");
  const [goal, setGoal] = useState("cause");
  const diagnosis = useMemo(
    () => buildSymptomDiagnosis({ symptom, data, goal, locale }),
    [symptom, data, goal, locale],
  );

  const question = (index, title, options, value, onChange) => (
    <fieldset className="diagnose-question">
      <legend><span>{String(index).padStart(2, "0")}</span>{title}</legend>
      <div>
        {options.map((option) => (
          <label key={option.id} className={value === option.id ? "is-selected" : ""}>
            <input type="radio" name={`diagnose-${index}`} value={option.id} checked={value === option.id} onChange={() => onChange(option.id)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="diagnose-layout">
      <section className="diagnose-form" aria-label={isEn ? "Three diagnosis questions" : "진단 질문 3개"}>
        {question(1, isEn ? "What changed?" : "어떤 문제가 생겼나요?", symptoms, symptom, setSymptom)}
        {question(2, isEn ? "What data do you have?" : "어떤 데이터가 있나요?", Object.entries(DIAGNOSE_OPTIONS.data).map(([id, copy]) => ({ id, label: copy[locale] })), data, setData)}
        {question(3, isEn ? "What decision comes next?" : "무엇을 결정해야 하나요?", Object.entries(DIAGNOSE_OPTIONS.goal).map(([id, copy]) => ({ id, label: copy[locale] })), goal, setGoal)}
      </section>

      <aside className="diagnose-result" aria-live="polite">
        <span>{isEn ? "YOUR CHECK ORDER" : "추천 확인 순서"}</span>
        <h2>{isEn ? "Start with a hypothesis, not a tool menu" : "도구보다 원인 가설부터 잡았습니다"}</h2>
        <p>{diagnosis.hypothesis}</p>
        <ol>
          {diagnosis.steps.map((step) => (
            <li key={step.toolId}>
              <span>{String(step.order).padStart(2, "0")}</span>
              <div><strong>{step.title}</strong><p>{step.reason}</p></div>
              <Link href={step.href} aria-label={`${step.title} ${isEn ? "open" : "열기"}`}>→</Link>
            </li>
          ))}
        </ol>
        <small>{diagnosis.warning}</small>
      </aside>
    </div>
  );
}
