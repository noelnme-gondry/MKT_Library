"use client";
// 소재 분석 (9-6) — 구 5-6(소재 분석)을 통합한 대표 도구. creativeMath
// (CREATIVE_STATS·CREATIVE_FATIGUE) 엔진을 퍼포먼스 도메인(소재·피로도 용어)으로 렌더.
// (예전엔 domain="content"로 "콘텐츠 신선도"였으나 5-6과 완전 중복이라 통합·퍼포먼스화.)
// CSV 상태는 creative 그룹(store TOOL_GROUP["9-6"]="creative"), 데모/가이드는 소재판(5-6).
import CreativeAnalyzer from "@/components/tools/CreativeAnalyzer";

export default function ContentFreshness({ locale = "ko" } = {}) {
  return <CreativeAnalyzer domain="performance" locale={locale} />;
}
