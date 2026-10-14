import SharedDecision from "@/components/SharedDecision";
import EditorialLayout from "@/components/EditorialLayout";

export const metadata = {
  title: "Shared decision",
  description: "A shared summary of an analysis conclusion.",
  robots: { index: false, follow: true },
};

export default function Page() {
  return <EditorialLayout locale="en"><main id="main-content" tabIndex="-1"><SharedDecision locale="en" /></main></EditorialLayout>;
}
