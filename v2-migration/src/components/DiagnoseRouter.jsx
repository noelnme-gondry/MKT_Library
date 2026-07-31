"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildSymptomDiagnosis, DIAGNOSE_OPTIONS, getDiagnoseSymptoms } from "@/lib/diagnoseRouter";
import { trackProductEvent } from "@/lib/analytics";

const COPY = {
  ko: {
    aria: "성과 문제 진단 3단계",
    progress: (step) => `${step}/3`,
    hint: "하나를 고르면 다음 질문으로 넘어갑니다.",
    back: "이전",
    restart: "처음부터",
    edit: "수정",
    selected: "선택한 답",
    resultEyebrow: "가장 먼저 확인할 것",
    resultTitle: "이 분석부터 시작하세요",
    open: "이 분석 시작하기",
    alternatives: (count) => `다른 가능성 ${count}개 보기`,
    warningTitle: "해석 주의",
    questions: [
      "지금 가장 가까운 증상은?",
      "어떤 데이터가 있나요?",
      "다음에 무엇을 결정해야 하나요?",
    ],
  },
  en: {
    aria: "Three-step performance diagnosis",
    progress: (step) => `${step}/3`,
    hint: "Choose one answer to continue.",
    back: "Back",
    restart: "Start over",
    edit: "Edit",
    selected: "Your answers",
    resultEyebrow: "CHECK THIS FIRST",
    resultTitle: "Start with this analysis",
    open: "Start this analysis",
    alternatives: (count) => `View ${count} other ${count === 1 ? "possibility" : "possibilities"}`,
    warningTitle: "Interpretation note",
    questions: [
      "What changed?",
      "What data do you have?",
      "What decision comes next?",
    ],
  },
};

export default function DiagnoseRouter({ locale = "ko" }) {
  const isEn = locale === "en";
  const t = COPY[locale] || COPY.ko;
  const symptoms = getDiagnoseSymptoms(locale);
  const questionOptions = [
    symptoms,
    Object.entries(DIAGNOSE_OPTIONS.data).map(([id, copy]) => ({ id, label: copy[locale] })),
    Object.entries(DIAGNOSE_OPTIONS.goal).map(([id, copy]) => ({ id, label: copy[locale] })),
  ];
  const [answers, setAnswers] = useState({ symptom: null, data: null, goal: null });
  const [step, setStep] = useState(0);
  const answerKeys = ["symptom", "data", "goal"];
  const isComplete = step === 3;
  const diagnosis = useMemo(
    () => answers.symptom && answers.data && answers.goal
      ? buildSymptomDiagnosis({ ...answers, locale })
      : null,
    [answers, locale],
  );

  const choose = (optionId) => {
    const key = answerKeys[step];
    setAnswers((current) => ({ ...current, [key]: optionId }));
    setStep((current) => Math.min(3, current + 1));
  };

  const restart = () => {
    setAnswers({ symptom: null, data: null, goal: null });
    setStep(0);
  };

  const selectedLabel = (index) => questionOptions[index].find((option) => option.id === answers[answerKeys[index]])?.label;

  if (isComplete && diagnosis) {
    const primary = diagnosis.steps[0];
    const alternatives = diagnosis.steps.slice(1);
    return (
      <section className="diagnose-complete" aria-live="polite" aria-label={t.resultTitle}>
        <div className="diagnose-answer-summary">
          <span>{t.selected}</span>
          <div>
            {answerKeys.map((key, index) => (
              <button type="button" key={key} onClick={() => setStep(index)}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                {selectedLabel(index)}
                <small>{t.edit}</small>
              </button>
            ))}
          </div>
        </div>

        <article className="diagnose-primary-result">
          <span>{t.resultEyebrow}</span>
          <h2>{t.resultTitle}</h2>
          <p className="diagnose-primary-result__hypothesis">{diagnosis.hypothesis}</p>
          <div className="diagnose-primary-result__tool">
            <div>
              <small>01</small>
              <strong>{primary.title}</strong>
              <p>{primary.reason}</p>
            </div>
            <Link
              className="btn primary"
              href={primary.href}
              onClick={() => trackProductEvent("diagnose_tool_opened", { tool_id: primary.toolId, rank: 1, locale })}
            >
              {t.open} <span aria-hidden="true">→</span>
            </Link>
          </div>

          {alternatives.length > 0 && (
            <details className="diagnose-alternatives">
              <summary>{t.alternatives(alternatives.length)}</summary>
              <ol>
                {alternatives.map((item) => (
                  <li key={item.toolId}>
                    <span>{String(item.order).padStart(2, "0")}</span>
                    <div><strong>{item.title}</strong><p>{item.reason}</p></div>
                    <Link
                      href={item.href}
                      aria-label={`${item.title} ${isEn ? "open" : "열기"}`}
                      onClick={() => trackProductEvent("diagnose_tool_opened", { tool_id: item.toolId, rank: item.order, locale })}
                    >
                      →
                    </Link>
                  </li>
                ))}
              </ol>
            </details>
          )}

          <aside>
            <strong>{t.warningTitle}</strong>
            <p>{diagnosis.warning}</p>
          </aside>
        </article>
        <button className="diagnose-restart" type="button" onClick={restart}>{t.restart}</button>
      </section>
    );
  }

  const currentOptions = questionOptions[step];
  const currentKey = answerKeys[step];
  return (
    <section className="diagnose-wizard" aria-label={t.aria}>
      <header className="diagnose-progress">
        <div>
          <span>{t.progress(step + 1)}</span>
          <div className="diagnose-progress__track" aria-hidden="true">
            <i style={{ width: `${((step + 1) / 3) * 100}%` }} />
          </div>
        </div>
        <p>{t.hint}</p>
      </header>

      {step > 0 && (
        <div className="diagnose-answer-trail" aria-label={t.selected}>
          {answerKeys.slice(0, step).map((key, index) => (
            <button type="button" key={key} onClick={() => setStep(index)}>
              <b>{String(index + 1).padStart(2, "0")}</b>{selectedLabel(index)}<small>{t.edit}</small>
            </button>
          ))}
        </div>
      )}

      <fieldset className="diagnose-step">
        <legend>{t.questions[step]}</legend>
        <div>
          {currentOptions.map((option) => (
            <button
              type="button"
              role="radio"
              aria-checked={answers[currentKey] === option.id}
              key={option.id}
              onClick={() => choose(option.id)}
            >
              <span>{option.label}</span>
              <b aria-hidden="true">→</b>
            </button>
          ))}
        </div>
      </fieldset>

      {step > 0 && <button className="diagnose-back" type="button" onClick={() => setStep((current) => current - 1)}>← {t.back}</button>}
    </section>
  );
}
