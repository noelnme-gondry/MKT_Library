export default function WeeklyReportDocument({ text }) {
  const blocks = text.split("\n\n");
  return <div className="wr-report">
    {blocks.map((block, index) => {
      const [heading, ...body] = block.split("\n");
      if (index === 0) return <header key={index}><strong>{heading}</strong><p>{body.join("\n")}</p></header>;
      if (heading.startsWith("■ ")) return <section key={index}><h3>{heading}</h3><p>{body.join("\n")}</p></section>;
      return <p className="wr-report-appendix" key={index}>{block}</p>;
    })}
  </div>;
}
