// Both editorial loaders use the same keyboard-accessible overflow container.
export function wrapArticleTables(html, locale = "ko") {
  return html
    .replace(/<table>/g, `<div class="table-scroll" role="region" tabindex="0" aria-label="${locale === "en" ? "Data table" : "데이터 표"}"><table>`)
    .replace(/<\/table>/g, "</table></div>");
}
