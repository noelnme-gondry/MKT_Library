"use client";
// 콘텐츠 트래픽 변동 탐지 (9-3) — 캠페인 성과 변동(5-21)과 동일 엔진(pvmMath)·
// 동일 컴포넌트를 콘텐츠 도메인 라벨로 렌더. 복제 없이 domain prop만 주입(§12.21).
// CSV 상태는 content_traffic 그룹으로 격리(store TOOL_GROUP), 데모/가이드는 콘텐츠판.
import CampaignPvm from "@/components/tools/CampaignPvm";

export default function ContentTrafficVariance() {
  return <CampaignPvm domain="content" />;
}
