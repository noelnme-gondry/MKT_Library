"use client";
import React from "react";

/**
 * 분석 범위·표시 기준처럼 결과 전체에 영향을 주는 제어를 한곳에 모은다.
 * 도구별 분석 조건은 본문에 남기고, sticky 영역은 데이터 범위만 담당한다.
 */
// 제목("분석 범위"·"표시 기준")·개수 배지·"공유 CSV를 쓰는 도구에 적용" 줄은 정보 없이 한 줄을 차지했다.
// 컨트롤이 각자 이름(기간·채널·성과 기준·금액 단위)을 달고 있으므로 제목은 랜드마크 이름으로만 남기고,
// 공유 범위 안내는 금액 단위 ⓘ로 옮겼다(2026-09-29). 호출부가 넘기는 activeCount·hint는 더 이상 쓰지 않는다.
export default function AnalysisControlBar({ title, children }) {
  return (
    <section className="analysis-control-bar" aria-label={title}>
      <div className="analysis-control-bar__controls">{children}</div>
    </section>
  );
}
