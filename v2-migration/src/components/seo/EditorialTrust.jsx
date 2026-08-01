function formatDate(value, locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale === "en" ? "en-US" : "ko-KR", {
    year: "numeric", month: "long", day: "numeric",
  });
}

export default function EditorialTrust({ locale = "ko", reviewer, reviewedAt, sources = [] }) {
  const isEnglish = locale === "en";
  if (!reviewer && !reviewedAt && sources.length === 0) return null;
  return (
    <section className="editorial-trust" aria-label={isEnglish ? "Editorial review and sources" : "검토 기준과 출처"}>
      <div className="editorial-trust__head">
        <span>{isEnglish ? "REVIEW NOTES" : "검토 기준"}</span>
        {reviewedAt && <time dateTime={reviewedAt}>{isEnglish ? "Reviewed " : "검토일 "}{formatDate(reviewedAt, locale)}</time>}
      </div>
      {reviewer && <small>{isEnglish ? "Reviewed by " : "검토 "}{reviewer}</small>}
      {sources.length > 0 && (
        <div className="editorial-trust__sources">
          <strong>{isEnglish ? "Primary sources cited in this article" : "이 글에서 인용한 1차 출처"}</strong>
          <ul>
            {sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
