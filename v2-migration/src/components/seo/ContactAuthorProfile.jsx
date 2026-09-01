import { AUTHOR } from "@/lib/authorProfile";

export default function ContactAuthorProfile({ locale = "ko" }) {
  const lang = locale === "en" ? "en" : "ko";
  return (
    <div className="policy-page__contact">
      <strong>{AUTHOR.name}</strong>
      <p>{AUTHOR[lang].role}</p>
      <p>{AUTHOR[lang].bio}</p>
    </div>
  );
}
