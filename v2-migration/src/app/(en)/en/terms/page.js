import { SITE_URL } from "@/lib/routeMap";
import Link from "next/link";
import PolicyPage from "@/components/PolicyPage";
import { withOpenGraphBase } from "@/lib/openGraph";

export const metadata = {
  title: { absolute: "Terms of Use | Growth Opt Playbook" },
  description: "Terms governing the free marketing analysis tools and practical guides provided by Growth Opt Playbook.",
  alternates: {
    canonical: `${SITE_URL}/en/terms`,
    languages: { ko: `${SITE_URL}/terms`, en: `${SITE_URL}/en/terms`, "x-default": `${SITE_URL}/en/terms` },
  },
  openGraph: withOpenGraphBase({ url: `${SITE_URL}/en/terms` }, "en"),
};

export default function EnglishTermsPage() {
  return (
    <PolicyPage
      locale="en"
      eyebrow="LEGAL"
      alternateHref="/terms"
      title="Terms of Use"
      intro="These terms set out the basic conditions for using Growth Opt Playbook tools and content."
      sections={[
        {
          title: "Service and acceptable use",
          content: <p>Growth Opt Playbook provides performance marketing guides and browser-based analysis tools. You may not use the service unlawfully or in a way that disrupts its normal operation.</p>,
        },
        {
          title: "Analysis results and responsibility",
          content: <p>The service and its analysis results are provided &quot;as is&quot; for informational purposes. We do not warrant accuracy, completeness, or fitness for a particular purpose. You remain responsible for campaign, budget, and other business decisions.</p>,
        },
        {
          title: "Data processing",
          content: <p>Uploaded CSV files and source analysis rows are processed in your browser and are not sent to our server. See the <Link href="/en/privacy">Privacy Policy</Link> for details about settings and records stored in your browser.</p>,
        },
        {
          title: "Content and third-party services",
          content: <p>Site content and software are protected by applicable rights. You may not misrepresent their source or reproduce and resell the service. Third-party services linked from this site are governed by their own terms.</p>,
        },
        {
          title: "Changes and contact",
          content: <p>We may update the service or these terms when necessary. Material changes will be reflected by the date on this page. Use the <Link href="/en/contact">Contact page</Link> for questions.</p>,
        },
      ]}
    />
  );
}
