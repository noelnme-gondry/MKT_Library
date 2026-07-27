import WeeklyReview from "@/components/WeeklyReview";
import { SITE_URL } from "@/lib/routeMap";

export const metadata = {
  title: "Weekly decision review",
  description: "Review operating decisions from analysis results against their next-week outcomes.",
  alternates: { canonical: `${SITE_URL}/en/weekly-review`, languages: { ko: `${SITE_URL}/weekly-review` } },
};

export default function EnglishWeeklyReviewPage() {
  return <WeeklyReview locale="en" />;
}
