import WeeklyReview from "@/components/WeeklyReview";
import { SITE_URL } from "@/lib/routeMap";

export const metadata = {
  title: "주간 결정 검토",
  description: "분석 결과에서 내린 실행 결정을 다음 주 실제 결과와 연결해 검토합니다.",
  alternates: { canonical: `${SITE_URL}/weekly-review`, languages: { en: `${SITE_URL}/en/weekly-review` } },
};

export default function WeeklyReviewPage() {
  return <WeeklyReview />;
}
