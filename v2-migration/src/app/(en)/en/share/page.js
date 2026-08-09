import SharedDecision from "@/components/SharedDecision";

export const metadata = {
  title: "Shared decision",
  description: "A shared summary of an analysis conclusion.",
  robots: { index: false, follow: true },
};

export default function Page() {
  return <SharedDecision locale="en" />;
}
