"use client";
// 콘텐츠 운영 대시보드 (9-7) — 운영 대시보드(5-2)와 동일 엔진(dashboardAggregator·
// anomalyMath, 순수·골든)·동일 컴포넌트를 콘텐츠 도메인 라벨로 렌더. 복제 없이
// domain prop만 주입(§12.21). 3탭(viz·scorecard·anomaly)만 노출하고 결제·예산·매출
// 전제 탭(pacing·ltv·cohort·funnel·segment)은 Dashboard가 domain="content"에서 제외.
// CSV 상태는 content_dashboard 그룹으로 격리(store TOOL_GROUP), 데모/가이드는 콘텐츠판.
import Dashboard from "@/components/Dashboard";

export default function ContentDashboard() {
  return <Dashboard domain="content" />;
}
