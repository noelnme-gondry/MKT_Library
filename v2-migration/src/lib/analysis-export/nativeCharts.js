import * as XLSX from "xlsx";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { styleWorkbookFiles } from "./workbookPresentation.js";

const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const chartNs = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const drawingNs = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
const mainNs = "http://schemas.openxmlformats.org/drawingml/2006/main";
const relNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const packageNs = "http://schemas.openxmlformats.org/package/2006/relationships";
const xml = body => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;

function chartXml(chart, feeds) {
  const scatter = chart.type === "scatter" || chart.type === "bubble";
  const pie = chart.type === "pie" || chart.type === "doughnut";
  const bar = chart.type === "bar";
  const numberReference = (formula, values) => `<c:numRef><c:f>${esc(formula)}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${values.flatMap((value, index) => value == null ? [] : [`<c:pt idx="${index}"><c:v>${value}</c:v></c:pt>`]).join("")}</c:numCache></c:numRef>`;
  const series = feeds.map((feed, index) => `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:v>${esc(feed.label)}</c:v></c:tx>${scatter ? `<c:xVal>${numberReference(feed.xRef, feed.x)}</c:xVal><c:yVal>${numberReference(feed.yRef, feed.y)}</c:yVal>` : `<c:cat><c:strRef><c:f>${esc(feed.xRef)}</c:f><c:strCache><c:ptCount val="${feed.x.length}"/>${feed.x.map((value, row) => `<c:pt idx="${row}"><c:v>${esc(value)}</c:v></c:pt>`).join("")}</c:strCache></c:strRef></c:cat><c:val>${numberReference(feed.yRef, feed.y)}</c:val>`}</c:ser>`).join("");
  const kind = scatter ? "scatterChart" : pie ? "pieChart" : bar ? "barChart" : "lineChart";
  const axes = pie ? "" : `<c:axId val="100"/><c:axId val="200"/>`;
  const axis = (id, cross, position, numeric) => `<c:${numeric ? "valAx" : "catAx"}><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="${position}"/><c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="${cross}"/><c:crosses val="autoZero"/></c:${numeric ? "valAx" : "catAx"}>`;
  return xml(`<c:chartSpace xmlns:c="${chartNs}" xmlns:a="${mainNs}" xmlns:r="${relNs}"><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${esc(chart.title)}</a:t></a:r></a:p></c:rich></c:tx></c:title><c:plotArea><c:layout/><c:${kind}>${scatter ? '<c:scatterStyle val="lineMarker"/>' : bar ? '<c:barDir val="col"/><c:grouping val="clustered"/>' : !pie ? '<c:grouping val="standard"/>' : ""}${series}${axes}</c:${kind}>${pie ? "" : axis(100, 200, "b", scatter) + axis(200, 100, "l", true)}</c:plotArea><c:legend><c:legendPos val="b"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`);
}

/** Editable native charts; chart feeds are explicit observed snapshots, not a refitted model. */
export function writeWorkbookWithCharts(workbook, charts = []) {
  // Do not combine unlike units/axes into one Excel axis. Word retains the original visual.
  const usable = charts.flatMap(chart => new Set(chart.series.map(series => `${series.axis || "y"}:${series.type || chart.type}`)).size > 1
    ? chart.series.map(series => ({ ...chart, title: `${chart.title} — ${series.label}`, type: series.type || chart.type, series: [series] }))
    : [chart]).filter(chart => chart.series.some(series => series.values.some(point => point.y != null)));
  const feedsByChart = [];
  if (usable.length) {
    const rows = [["Chart data", "Visible chart series from this analysis. Edit these cells to update charts; refit models on the website. Word preserves original visuals; Excel rebuilds series without plugin annotations. Unlike axes are separated."]];
    for (const chart of usable) {
      const feeds = [];
      for (const series of chart.series) {
        rows.push([chart.title, series.label]);
        const start = rows.length + 1;
        const x = series.values.map((point, index) => chart.type === "scatter" || chart.type === "bubble" ? (typeof point.x === "number" ? point.x : index) : chart.labels[index] ?? point.x);
        const y = series.values.map(point => point.y);
        series.values.forEach((_, index) => rows.push([x[index], y[index]]));
        feeds.push({ label: series.label, x, y, xRef: `'09_CHART_DATA'!$A$${start}:$A$${rows.length}`, yRef: `'09_CHART_DATA'!$B$${start}:$B$${rows.length}` });
        rows.push([]);
      }
      feedsByChart.push(feeds);
    }
    const data = XLSX.utils.aoa_to_sheet(rows); data["!cols"] = [{ wch: 38 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(workbook, data, "09_CHART_DATA");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Charts", "Editable charts linked to 09_CHART_DATA"]]), "10_CHARTS");
  }
  const original = XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true, cellStyles: true });
  const files = unzipSync(new Uint8Array(original));
  styleWorkbookFiles(files);
  if (!usable.length) return zipSync(files).buffer;
  const chartSheet = workbook.SheetNames.indexOf("10_CHARTS") + 1;
  const sheetPath = `xl/worksheets/sheet${chartSheet}.xml`;
  files[sheetPath] = strToU8(strFromU8(files[sheetPath]).replace("</worksheet>", '<drawing r:id="rIdCharts"/></worksheet>'));
  files[`xl/worksheets/_rels/sheet${chartSheet}.xml.rels`] = strToU8(xml(`<Relationships xmlns="${packageNs}"><Relationship Id="rIdCharts" Type="${relNs}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`));
  const anchors = usable.map((chart, index) => {
    files[`xl/charts/chart${index + 1}.xml`] = strToU8(chartXml(chart, feedsByChart[index]));
    const row = 2 + index * 24;
    return `<xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>12</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + 22}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${index + 1}" name="Chart ${index + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${chartNs}"><c:chart xmlns:c="${chartNs}" xmlns:r="${relNs}" r:id="rId${index + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
  });
  files["xl/drawings/drawing1.xml"] = strToU8(xml(`<xdr:wsDr xmlns:xdr="${drawingNs}" xmlns:a="${mainNs}">${anchors.join("")}</xdr:wsDr>`));
  files["xl/drawings/_rels/drawing1.xml.rels"] = strToU8(xml(`<Relationships xmlns="${packageNs}">${usable.map((_, index) => `<Relationship Id="rId${index + 1}" Type="${relNs}/chart" Target="../charts/chart${index + 1}.xml"/>`).join("")}</Relationships>`));
  files["[Content_Types].xml"] = strToU8(strFromU8(files["[Content_Types].xml"]).replace("</Types>", `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>${usable.map((_, index) => `<Override PartName="/xl/charts/chart${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`).join("")}</Types>`));
  return zipSync(files).buffer;
}
