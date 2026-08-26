"use client";

import React from "react";
import Link from "next/link";

const COPY = {
  ko: {
    eyebrow: "이전 판단과 데이터 대조",
    period: "이번 파일",
    previous: "이전 판단",
    provisional: "최근 기간이라 집계가 더 바뀔 수 있습니다.",
    duplicate: {
      title: "같은 데이터입니다. 새 분석 대신 지난 판단을 확인하세요.",
      body: "기간과 데이터 지문이 모두 같습니다. 같은 결과를 한 번 더 만들지 않도록 기존 판단을 먼저 엽니다.",
      action: "기존 판단 열기",
      review: true,
    },
    revised_period: {
      title: "같은 기간의 값이 바뀌었습니다.",
      body: "수정된 마감 데이터일 수 있습니다. 새 결론을 만들기 전에 기존 판단을 이 파일로 다시 검토하세요.",
      action: "기존 판단 검토하기",
      review: true,
    },
    next_period: {
      title: "지난 판단의 다음 기간 데이터입니다.",
      body: "후속 결과를 먼저 검토한 뒤, 필요한 분석만 이어서 실행하세요.",
      action: "후속 결과 검토하기",
      review: true,
    },
    gap: {
      title: "이전 기간 뒤에 데이터 공백이 있습니다.",
      body: "분석은 계속할 수 있지만, 이 파일을 연속된 후속 결과로 읽지는 않습니다. 아래에서 새 분석을 시작하세요.",
      action: "새 분석 계속하기",
    },
    partial_overlap: {
      title: "이전 판단 기간과 일부 겹칩니다.",
      body: "잠정치·백필·수정 데이터일 수 있습니다. 자동으로 결론을 잇지 않고, 아래에서 새 분석을 시작하세요.",
      action: "새 분석 계속하기",
    },
    historical_backfill: {
      title: "이전 판단보다 과거 기간 데이터입니다.",
      body: "후속 결과가 아닌 별도 과거 분석으로 다룹니다. 아래에서 새 분석을 시작하세요.",
      action: "새 분석 계속하기",
    },
    mapping_changed: {
      title: "컬럼 역할이 이전 판단과 달라졌습니다.",
      body: "같은 지표인지 확정할 수 없어 자동 비교하지 않습니다. 현재 파일 기준으로 새 분석을 시작하세요.",
      action: "새 분석 계속하기",
    },
  },
  en: {
    eyebrow: "CHECK AGAINST A PRIOR DECISION",
    period: "This file",
    previous: "Prior decision",
    provisional: "This is a recent period and its totals may still change.",
    duplicate: {
      title: "This is the same data. Check the prior decision first.",
      body: "Both the period and data fingerprint match. Reopen the existing decision instead of creating the same result again.",
      action: "Open prior decision",
      review: true,
    },
    revised_period: {
      title: "Values changed for the same period.",
      body: "This may be revised final data. Review the existing decision against this file before creating a new conclusion.",
      action: "Review prior decision",
      review: true,
    },
    next_period: {
      title: "This is the next period after a prior decision.",
      body: "Review the follow-up outcome first, then run only the analysis you still need.",
      action: "Review follow-up outcome",
      review: true,
    },
    gap: {
      title: "There is a gap after the prior period.",
      body: "You can continue analysis, but this is not treated as a continuous follow-up. Start a new analysis below.",
      action: "Continue with a new analysis",
    },
    partial_overlap: {
      title: "This file partly overlaps the prior decision period.",
      body: "It may be provisional, backfilled, or revised data. We do not automatically join conclusions; start a new analysis below.",
      action: "Continue with a new analysis",
    },
    historical_backfill: {
      title: "This file predates the prior decision.",
      body: "It is treated as a separate historical analysis, not a follow-up outcome. Start a new analysis below.",
      action: "Continue with a new analysis",
    },
    mapping_changed: {
      title: "Column roles changed from the prior decision.",
      body: "We cannot confirm the same metrics, so no automatic comparison is made. Start a new analysis with this file.",
      action: "Continue with a new analysis",
    },
  },
};

const ACTIONABLE_STATES = new Set(["duplicate", "revised_period", "next_period", "gap", "partial_overlap", "historical_backfill", "mapping_changed"]);

export function shouldShowDecisionDataUpdateGuide(continuity) {
  return ACTIONABLE_STATES.has(continuity?.state);
}

export default function DecisionDataUpdateGuide({ continuity, locale = "ko", onContinue }) {
  if (!shouldShowDecisionDataUpdateGuide(continuity)) return null;
  const t = COPY[locale] || COPY.ko;
  const content = t[continuity.state];
  const reviewHref = locale === "en" ? "/en/weekly-review" : "/weekly-review";
  const period = continuity.current ? `${continuity.current.dateStart}–${continuity.current.dateEnd}` : "—";
  const previousPeriod = continuity.previous ? `${continuity.previous.dateStart}–${continuity.previous.dateEnd}` : "—";

  return (
    <section className={`decision-data-update-guide continuity-${continuity.state}`} aria-labelledby="decision-data-update-guide-title">
      <span>{t.eyebrow}</span>
      <h2 id="decision-data-update-guide-title">{content.title}</h2>
      <p>{content.body}</p>
      <dl>
        <div><dt>{t.previous}</dt><dd>{previousPeriod}</dd></div>
        <div><dt>{t.period}</dt><dd>{period}</dd></div>
      </dl>
      {continuity.maturity === "provisional" && <small>{t.provisional}</small>}
      {content.review
        ? <Link className="btn" href={reviewHref}>{content.action} →</Link>
        : <button type="button" className="btn" onClick={onContinue}>{content.action} →</button>}
    </section>
  );
}
