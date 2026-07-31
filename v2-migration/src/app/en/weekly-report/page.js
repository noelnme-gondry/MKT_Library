import WeeklyReport from "@/components/WeeklyReport";
import { SITE_URL } from "@/lib/routeMap";

export const metadata = {
  title: "Weekly performance report builder",
  description: "Collect conclusions and key figures from analysis tools into a Markdown or PDF weekly report.",
  alternates: { canonical: `${SITE_URL}/en/weekly-report`, languages: { ko: `${SITE_URL}/weekly-report` } },
};

export default function EnglishWeeklyReportPage() {
  return <WeeklyReport locale="en" />;
}

