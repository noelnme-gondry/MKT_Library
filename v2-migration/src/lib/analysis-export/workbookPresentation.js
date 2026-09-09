import { strFromU8, strToU8 } from "fflate";

/** Apply header hierarchy without replacing numeric formats or calculation cells. */
export function styleWorkbookFiles(files) {
  const path = "xl/styles.xml";
  let xml = strFromU8(files[path]);
  const append = (name, body) => {
    let index = 0;
    xml = xml.replace(new RegExp(`<${name} count="(\\d+)"[^>]*>([\\s\\S]*?)</${name}>`), (_, count, contents) => {
      index = Number(count);
      return `<${name} count="${index + 1}">${contents}${body}</${name}>`;
    });
    return index;
  };
  const fontId = append("fonts", '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>');
  const fillId = append("fills", '<fill><patternFill patternType="solid"><fgColor rgb="FF243B53"/><bgColor indexed="64"/></patternFill></fill>');
  const styleId = append("cellXfs", `<xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>`);
  files[path] = strToU8(xml);
  for (const name of Object.keys(files).filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))) {
    let sheet = strFromU8(files[name]);
    sheet = sheet.replace(/<row r="1"([^>]*)>([\s\S]*?)<\/row>/, (_, attrs, cells) => `<row r="1"${attrs.replace(/\s(?:ht|customHeight)="[^"]*"/g, "")} ht="32" customHeight="1">${cells.replace(/<c\b([^>]*)>/g, (_, attrs) => `<c${attrs.replace(/\ss="[^"]*"/g, "")} s="${styleId}">`)}</row>`);
    // Keep existing sheet view settings, freeze the header in every evidence sheet.
    sheet = sheet.replace(/<sheetView\b([^>]*?)\/>/, '<sheetView$1><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView>');
    sheet = sheet.replace(/<sheetView\b([^>]*?)>(?!<pane)/, '<sheetView$1><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    files[name] = strToU8(sheet);
  }
}
