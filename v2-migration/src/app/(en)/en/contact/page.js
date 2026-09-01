import { SITE_URL } from "@/lib/routeMap";
import PolicyPage from "@/components/PolicyPage";
import { withOpenGraphBase } from "@/lib/openGraph";
import { profilePageNode } from "@/lib/authorProfile";
import ContactAuthorProfile from "@/components/seo/ContactAuthorProfile";

export const metadata = {
  title: { absolute: "Contact | Growth Opt Playbook" },
  description: "Contact Growth Opt Playbook for business inquiries, partnerships, product feedback, or privacy requests.",
  alternates: {
    canonical: `${SITE_URL}/en/contact`,
    languages: { ko: `${SITE_URL}/contact`, en: `${SITE_URL}/en/contact`, "x-default": `${SITE_URL}/en/contact` },
  },
  openGraph: withOpenGraphBase({ url: `${SITE_URL}/en/contact` }, "en"),
};

export default function EnglishContactPage() {
  const profileJsonLd = profilePageNode("en");
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd).replace(/</g, "\\u003c") }} />
      <PolicyPage
        locale="en"
        eyebrow="CONTACT"
        alternateHref="/contact"
        title="Contact"
        intro="Business inquiries, collaborations, and product feedback are all welcome. Use whichever channel works best."
        updated="2026-09-02"
        sections={[
          {
            title: "About the operator",
            content: <ContactAuthorProfile locale="en" />,
          },
          {
            title: "Business email",
            content: <div className="policy-page__contact"><a href="mailto:gondry.montauk@gmail.com">gondry.montauk@gmail.com</a><p>Best for partnerships, interviews, collaborations, and product inquiries. A clear subject line helps us respond faster.</p></div>,
          },
          {
            title: "Instagram",
            content: <div className="policy-page__contact"><a href="https://www.instagram.com/gondry__workshop/" target="_blank" rel="noreferrer">@gondry__workshop ↗</a><p>Send a DM for a quick question or an informal conversation.</p></div>,
          },
          {
            title: "Helpful context to include",
            content: <ul><li>The page or analysis tool your message is about</li><li>Your environment and symptoms for a reproducible issue</li><li>Your preferred timeline and outcome for a collaboration</li></ul>,
          },
        ]}
      />
    </>
  );
}
