import { SITE_URL } from "@/lib/routeMap";
import Link from "next/link";
import PolicyPage from "@/components/PolicyPage";
import { withOpenGraphBase } from "@/lib/openGraph";

export const metadata = {
  title: { absolute: "Privacy Policy | Growth Opt Playbook" },
  description: "How Growth Opt Playbook handles browser-only analysis data, local settings, analytics, advertising, and email subscriptions.",
  alternates: {
    canonical: `${SITE_URL}/en/privacy`,
    languages: { ko: `${SITE_URL}/privacy`, en: `${SITE_URL}/en/privacy`, "x-default": `${SITE_URL}/privacy` },
  },
  openGraph: withOpenGraphBase({ url: `${SITE_URL}/en/privacy` }, "en"),
};

export default function EnglishPrivacyPage() {
  return (
    <PolicyPage
      updated="2026-08-01"
      locale="en"
      eyebrow="PRIVACY"
      alternateHref="/privacy"
      title="Privacy Policy"
      intro="Your source analysis data is not sent to our server. This page explains operational data collection and browser storage."
      sections={[
        {
          title: "Uploaded data",
          content: <p>CSV files and source analysis rows are <strong>processed in your current browser and are not transmitted to or stored on our server</strong>. Source data uploaded for analysis is not collected in an application-side database.</p>,
        },
        {
          title: "Information stored in your browser",
          content: <p>For convenience, this device may retain theme, language and display preferences, column-mapping recipes, recently connected public Google Sheets URLs, and summaries of recent analysis runs in localStorage or IndexedDB. Decision records stay in the current session by default. Only when you explicitly enable <strong>“Keep decision summaries on this device”</strong> do we store the tool ID and language; conclusion, action, and hypothesis; metric and baseline; source period, review question, and review date; actual outcome and learning; and created/updated timestamps in localStorage. When you save a decision, these fields may include channel, campaign, creative, action, or analysis-element names and summary figures that you entered or accepted from an analysis-result prefill. Full source CSV rows, file names, mappings, filters, input signatures, and chart data are not included. Turning storage off removes the persistent copy while retaining the current session; use Delete all records in Weekly Review or clear browser site data to remove everything.</p>,
        },
        {
          title: "Analytics and advertising",
          content: <p>Google Analytics, Google Tag Manager, and Google AdSense may process cookies, device identifiers, and visit information. This processing is subject to Google&apos;s policies and your browser and consent settings.</p>,
        },
        {
          title: "Email subscriptions",
          content: <p>If you subscribe and consent to receive emails, Buttondown processes your email address, consent version, and signup source. We use it only for new posts and analysis insights. You can unsubscribe through the link in each email. Source analysis data is never sent to the subscription service.</p>,
        },
        {
          title: "Contact",
          content: <p>Send privacy requests through the <Link href="/en/contact">Contact page</Link> or email <a href="mailto:gondry.montauk@gmail.com">gondry.montauk@gmail.com</a>.</p>,
        },
      ]}
    />
  );
}
