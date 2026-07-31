import WeeklyReport from "@/components/WeeklyReport";
import { SITE_URL } from "@/lib/routeMap";

export const metadata = {
  title: "주간 성과 보고서 만들기",
  description: "여러 분석 도구의 결론과 핵심 수치를 모아 Markdown 또는 PDF 주간 보고서를 만듭니다.",
  alternates: { canonical: `${SITE_URL}/weekly-report`, languages: { en: `${SITE_URL}/en/weekly-report` } },
};

export default function WeeklyReportPage() {
  return <WeeklyReport />;
}

