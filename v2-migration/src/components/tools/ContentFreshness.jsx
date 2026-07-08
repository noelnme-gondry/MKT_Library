"use client";
// 콘텐츠 수명주기·신선도 진단 (9-6) — 소재 피로도 진단(5-6)과 동일 엔진
// (creativeMath: CREATIVE_STATS·CREATIVE_FATIGUE, CTR/CVR 비율 기반이라 스케일 안전)·
// 동일 컴포넌트를 콘텐츠 도메인 라벨로 렌더. 복제 없이 domain prop만 주입(§12.21).
// CSV 상태는 content_freshness 그룹으로 격리(store TOOL_GROUP), 데모/가이드는 콘텐츠판.
import CreativeAnalyzer from "@/components/tools/CreativeAnalyzer";

export default function ContentFreshness() {
  return <CreativeAnalyzer domain="content" />;
}
