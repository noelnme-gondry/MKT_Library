export default function ReportBlockEvidence({ block }) {
  return <div className="report-block-evidence">
    {(Array.isArray(block.charts) ? block.charts : []).filter(chart => /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(chart.image || "")).map((chart,index)=><figure key={index}><figcaption>{chart.title}</figcaption>
      {/* Local canvas PNG, never a remote URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={chart.image} alt={chart.title} width={chart.width} height={chart.height}/></figure>)}
    {(Array.isArray(block.tables) ? block.tables : []).filter(table => Array.isArray(table.cells) && table.cells.every(Array.isArray)).map((table,index)=><div className="table-wrap" key={index}><table className="data"><caption>{table.title}</caption><tbody>{table.cells.map((row,r)=><tr key={r}>{row.map((cell,c)=>r===0?<th key={c}>{cell}</th>:<td key={c}>{cell}</td>)}</tr>)}</tbody></table></div>)}
  </div>;
}
