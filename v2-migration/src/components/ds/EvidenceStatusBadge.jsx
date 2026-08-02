"use client";

import Link from "next/link";
import { STATISTICAL_STATUS, statisticalStatusLabel } from "@/lib/analysis-router/statisticalStatus";

const DETAIL = {
  ko: {
    READY: "현재 데이터와 검증 조건에서 이 결론을 운영 참고값으로 사용할 수 있습니다.",
    CAUTION: "결론은 계산됐지만 표본·데이터 품질·모델 조건을 함께 확인해야 합니다.",
    INSUFFICIENT_DATA: "결론을 낼 만큼의 행·기간·필수 지표가 확보되지 않았습니다.",
    NOT_IDENTIFIED: "데이터는 있지만 서로 겹치는 영향 때문에 한 요인의 효과를 분리할 수 없습니다.",
    ABSTAIN: "틀린 확신을 피하기 위해 현재 조건에서는 방향 판정을 보류합니다.",
    ENGINE_ERROR: "계산을 완료하지 못했습니다. 입력과 매핑을 확인한 뒤 다시 실행하세요.",
  },
  en: {
    READY: "The current data and validation checks support using this conclusion as an operating reference.",
    CAUTION: "A result was computed, but sample size, data quality, or model conditions still need review.",
    INSUFFICIENT_DATA: "There are not enough rows, periods, or required metrics to support a conclusion.",
    NOT_IDENTIFIED: "Data exists, but overlapping effects prevent separating this factor's contribution.",
    ABSTAIN: "The product withholds a directional call here to avoid false certainty.",
    ENGINE_ERROR: "The calculation did not complete. Check the input and mapping, then run it again.",
  },
};

const TONE = {
  [STATISTICAL_STATUS.READY]: "ready",
  [STATISTICAL_STATUS.CAUTION]: "caution",
  [STATISTICAL_STATUS.INSUFFICIENT_DATA]: "insufficient",
  [STATISTICAL_STATUS.NOT_IDENTIFIED]: "insufficient",
  [STATISTICAL_STATUS.ABSTAIN]: "abstain",
  [STATISTICAL_STATUS.ENGINE_ERROR]: "error",
};

export default function EvidenceStatusBadge({ status, locale = "ko", detail = "", glossarySlug = "" }) {
  if (!status) return null;
  const lang = locale === "en" ? "en" : "ko";
  const explanation = detail || DETAIL[lang][status] || statisticalStatusLabel(status, lang);
  const content = (
    <>
      <span aria-hidden>●</span>
      <strong>{statisticalStatusLabel(status, lang)}</strong>
      <span className="evidence-status-badge__info" aria-hidden>ⓘ</span>
    </>
  );
  const className = `evidence-status-badge is-${TONE[status] || "caution"}`;
  return glossarySlug ? (
    <Link className={className} href={`${lang === "en" ? "/en" : ""}/glossary/${glossarySlug}`} aria-label={`${statisticalStatusLabel(status, lang)}. ${explanation}`} data-tooltip={explanation}>
      {content}
    </Link>
  ) : (
    <span className={className} role="status" tabIndex={0} aria-label={`${statisticalStatusLabel(status, lang)}. ${explanation}`} data-tooltip={explanation}>
      {content}
    </span>
  );
}
