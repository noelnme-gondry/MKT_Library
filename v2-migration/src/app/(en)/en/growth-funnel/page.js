import GrowthFunnelReport from "@/components/GrowthFunnelReport";

export const metadata = {
  title: "Product Growth Funnel Report",
  description: "An internal browser-only report for GA4 event exports.",
  robots: { index: false, follow: false },
};

export default function GrowthFunnelPage() {
  return <GrowthFunnelReport locale="en" />;
}
