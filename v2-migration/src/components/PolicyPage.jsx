import Link from "next/link";

export default function PolicyPage({ locale = "ko", alternateHref, eyebrow, title, intro, sections, updated = "2026-07-29" }) {
  const isEn = locale === "en";
  return (
    <main id="main-content" tabIndex="-1" className="policy-page">
      <header className="policy-page__header">
        <div className="policy-page__topline">
          <span>{eyebrow}</span>
          <Link href={alternateHref}>
            {isEn ? "한국어" : "English"}
          </Link>
        </div>
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>
      <div className="policy-page__body">
        {sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.content}
          </section>
        ))}
      </div>
      <footer className="policy-page__updated">
        {isEn ? `Last updated: ${updated}` : `최종 업데이트: ${updated}`}
      </footer>
    </main>
  );
}
