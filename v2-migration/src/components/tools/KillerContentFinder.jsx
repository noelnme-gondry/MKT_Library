"use client";
// 킬러 콘텐츠·충성 독자 발굴 (9-2) — 핵심 가치 발굴(5-20)과 동일 엔진(ahaMath)·
// 동일 컴포넌트를 콘텐츠 도메인 라벨로 렌더. 복제 없이 domain prop만 주입(§12.21).
// CSV 상태는 content_aha 그룹으로 격리(store TOOL_GROUP), 데모/가이드는 콘텐츠판.
import AhaMomentFinder from "@/components/tools/AhaMomentFinder";

export default function KillerContentFinder() {
  return <AhaMomentFinder domain="content" />;
}
