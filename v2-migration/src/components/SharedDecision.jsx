"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

import { trackProductEvent } from "@/lib/analytics";
import { decodeSharePayload, toolHrefForShare } from "@/lib/decisionShare";

const COPY = {
  ko: {
    eyebrow: "공유된 판단",
    empty: "공유 링크가 유효하지 않습니다",
    emptyDesc: "링크가 잘리거나 만료된 형식일 수 있습니다. 보낸 사람에게 링크를 다시 요청하거나, 아래에서 직접 분석을 시작하세요.",
    stats: "핵심 수치",
    points: "근거",
    ctaTool: "같은 분석 내 데이터로 해보기",
    ctaStart: "내 CSV로 시작하기",
    privacy: "이 링크에는 요약 문구만 담깁니다. 보낸 사람의 원본 데이터는 포함되지도, 저장되지도 않습니다.",
  },
  en: {
    eyebrow: "Shared decision",
    empty: "This share link is not valid",
    emptyDesc: "The link may have been truncated or use an older format. Ask the sender for a fresh link, or start your own analysis below.",
    stats: "Key figures",
    points: "Evidence",
    ctaTool: "Run this analysis on my data",
    ctaStart: "Start with my CSV",
    privacy: "This link carries summary text only. The sender's source data is neither included nor stored.",
  },
};

function SharedDecisionBody({ locale }) {
  const token = useSearchParams().get("d");
  const payload = useMemo(() => decodeSharePayload(token), [token]);
  const T = COPY[locale === "en" ? "en" : "ko"];
  const startHref = locale === "en" ? "/en/start" : "/start";
  const toolHref = payload ? toolHrefForShare(payload) : null;

  if (!payload) {
    return <section className="shared-decision">
      <span className="shared-decision__eyebrow">{T.eyebrow}</span>
      <h1>{T.empty}</h1>
      <p className="shared-decision__lead">{T.emptyDesc}</p>
      <Link className="btn primary" href={startHref}>{T.ctaStart}</Link>
    </section>;
  }

  return <section className="shared-decision">
    <span className="shared-decision__eyebrow">{payload.n || T.eyebrow}</span>
    <h1>{payload.h}</h1>

    {payload.s.length > 0 && <div className="shared-decision__stats" aria-label={T.stats}>
      {payload.s.map((stat) => <div key={`${stat.l}-${stat.v}`}>
        <span>{stat.l}</span>
        <strong>{stat.v}</strong>
      </div>)}
    </div>}

    {payload.p.length > 0 && <>
      <h2 className="shared-decision__subhead">{T.points}</h2>
      <ul className="shared-decision__points">
        {payload.p.map((point) => <li key={point}>{point}</li>)}
      </ul>
    </>}

    <div className="shared-decision__actions">
      {toolHref && <Link
        className="btn primary"
        href={toolHref}
        onClick={() => trackProductEvent("share_link_opened", { tool_id: payload.t, source: "share_link", placement: "shared_decision", locale })}
      >{T.ctaTool}</Link>}
      <Link className="btn ghost" href={startHref}>{T.ctaStart}</Link>
    </div>

    <p className="shared-decision__privacy">{T.privacy}</p>
  </section>;
}

export default function SharedDecision({ locale = "ko" }) {
  return <Suspense fallback={null}>
    <SharedDecisionBody locale={locale} />
  </Suspense>;
}
