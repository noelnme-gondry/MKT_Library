import { SITE_URL } from "@/lib/routeMap";
import Link from "next/link";
import AnalyticsOptOut from "@/components/AnalyticsOptOut";
import PolicyPage from "@/components/PolicyPage";
import { withOpenGraphBase } from "@/lib/openGraph";

export const metadata = {
  title: { absolute: "Privacy Policy | Growth Opt Playbook" },
  description: "How Growth Opt Playbook handles browser-only analysis data, local settings, analytics, advertising, and email subscriptions.",
  alternates: {
    canonical: `${SITE_URL}/en/privacy`,
    languages: { ko: `${SITE_URL}/privacy`, en: `${SITE_URL}/en/privacy`, "x-default": `${SITE_URL}/en/privacy` },
  },
  openGraph: withOpenGraphBase({ url: `${SITE_URL}/en/privacy` }, "en"),
};

export default function EnglishPrivacyPage() {
  return (
    <PolicyPage
      updated="2026-09-11"
      locale="en"
      eyebrow="PRIVACY"
      alternateHref="/privacy"
      title="Privacy Policy"
      intro="Your source analysis data is not sent to our server. This page explains operational data collection and browser storage."
      sections={[
        {
          title: "Account service emails and temporary checkout storage",
          content: <p>When email delivery is available, account-linked live purchases receive order, amount and access-period notices at the registered email. You may also request a one-time sign-in link. Review and expiry reminders require separate optional consent, which you can disable in the archive. Emails exclude memo contents and CSV data. The delivery queue retains only account, order or memo identifiers, schedules and delivery state for duplicate prevention while the account exists. Sign-in link records are hashed and valid for 10 minutes. Actual email providers and processing locations must be disclosed before activation. Clicking Pay temporarily saves your current work only in this browser. The copy is deleted after restoration or during the next cleanup after 24 hours. Clear all and turning device storage off also remove these temporary copies.</p>,
        },
        {
          title: "Account decision storage (when available)",
          content: <p>If you choose Google sign-in, we use your stable Google account identifier and verified email for identification, pass linking and one 14-day trial per account. The trial starts on the first saved memo and does not charge automatically. Only decision memos you review and select (action, conclusion, hypothesis, review date and review notes) are stored on the server. Memos may include campaign names or figures you entered. Source CSVs, mappings, analysis datasets and local snapshots are excluded. Account memos are separate from the 90-day device policy and are not deleted merely because a pass expires. Delete individual memos in the archive or request account deletion through Contact. Account identity, email and trial-start records are retained while your account exists. Sessions are valid for 30 days; pending login information is valid for 10 minutes. Marketing consent is collected separately through newsletter signup. Google authentication and our operational database are used; processing-provider and transfer-location details must be published before activation.</p>,
        },
        {
          title: "Report-pass payments and recovery",
          content: <p>To process purchases, refunds and access recovery, the server stores the order ID, product, amount, approval/cancellation status, access term and a hash of the recovery code. Payment details are entered and processed on Toss Payments screens; the app does not store full card numbers or passwords. Payment and supply records are retained for the statutory five-year period, separately from the 90-day browser analysis-data policy. Access recovery uses a cookie and a local entitlement cache. CSV files, analysis results, project names and filenames are never included in payment requests. Contact customer service below to request access, correction or deletion; statutory retention requirements may limit deletion during that period.</p>,
        },
        {
          title: "Uploaded data",
          content: <p>CSV files and source analysis rows are <strong>processed in your current browser and are not transmitted to or stored on our server</strong>. Source data uploaded for analysis is not collected in an application-side database.</p>,
        },
        {
          title: "Information stored in your browser",
          content: <p>For convenience, this device may retain theme, language, display preferences, column-mapping recipes, and recently connected public Google Sheets URLs in localStorage or IndexedDB. With the default setting, source CSV/XLSX files you upload yourself, their file names, headers and mappings, plus decision-record summaries are kept in this browser&apos;s IndexedDB/localStorage until 90 days after their last use. Source files are never sent to our server. Turning storage off immediately removes stored source files and the persistent copy of decision records; the current session can remain visible until you refresh or close it. Use <Link href="/en/storage">Stored on this device</Link> to remove one file, remove all files, or change this setting.</p>,
        },
        {
          title: "External requests from advanced analysis",
          content: <p>Some tools&apos; <strong>advanced analysis (regression, Random Forest, MMM challenger)</strong> downloads the <strong>WebR runtime and R packages from an external CDN</strong> so R code can run in your browser. Only those file requests leave your device — <strong>your uploaded CSV, column mapping, and results are never transmitted</strong>. All computation finishes inside this browser. If you would rather avoid the external requests, simply do not run advanced analysis; the standard analyses work without them.</p>,
        },
        {
          title: "Analytics and advertising",
          content: (
            <>
              <p>Google Analytics, Google Tag Manager, and Google AdSense may process cookies, device identifiers, and visit information. This processing is subject to Google&apos;s policies and your browser and consent settings.</p>
              <p>Regardless of your region, you can turn visit analytics and ad measurement off below. The choice is stored in this browser and does not affect how the analysis tools work.</p>
              <AnalyticsOptOut locale="en" />
            </>
          ),
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
