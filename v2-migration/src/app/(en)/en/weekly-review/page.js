import WeeklyReviewScreen from "@/components/weekly-review/WeeklyReviewScreen";
import { SITE_URL } from "@/lib/routeMap";

export const metadata = {
  title: "Weekly Marketing Review · CSV Comparison and Reports",
  description: "Compare weekly campaign KPIs, inspect changes, review past decisions and prepare your next action and report. All marketing data stays in your browser.",
  alternates: { canonical: `${SITE_URL}/en/weekly-review`, languages: { ko: `${SITE_URL}/weekly-review`, en: `${SITE_URL}/en/weekly-review`, "x-default": `${SITE_URL}/weekly-review` } },
};

export default function EnglishWeeklyReviewPage() {
  return <WeeklyReviewScreen locale="en" />;
}
