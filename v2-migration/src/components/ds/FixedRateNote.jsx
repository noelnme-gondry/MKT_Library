"use client";
import React from "react";
import { USD_KRW_RATE, isCurrencyConverted } from "@/utils/format";

// 표시 통화 환산 고지.
//
// 왜 필요한가: `convertCurrency`는 실시간 시세가 아니라 고정 환율(USD_KRW_RATE)을 쓴다.
// 고지가 없으면 사용자는 환산값을 실제 시세로 읽는다(§8 "거짓 숫자"). 5-18 예측은
// 예산 입력을 표시 통화로 받아 같은 환율로 되돌려 엔진에 넣으므로 표시만의 문제도 아니다.
//
// 환산이 실제로 일어날 때만 렌더한다 — 원본과 표시가 같은 통화면 no-op이라 고지할 것이
// 없고, 늘 떠 있으면 읽히지 않는 문구가 된다.
export default function FixedRateNote({ sourceCurrency, displayCurrency, locale = "ko" }) {
  if (!isCurrencyConverted(sourceCurrency, displayCurrency)) return null;
  const rate = USD_KRW_RATE.toLocaleString("en-US");
  return (
    <p className="muted fixed-rate-note" style={{ fontSize: "11px", margin: "6px 0 0" }}>
      {locale === "en"
        ? `Converted at a fixed ₩${rate} / $1 — an approximate reference rate, not a live quote. Compare amounts in the original currency for accounting.`
        : `고정 환율 ₩${rate}/$1로 환산한 값입니다. 실시간 시세가 아닌 대략적 기준값이라 정산에는 원본 통화 금액을 쓰세요.`}
    </p>
  );
}
