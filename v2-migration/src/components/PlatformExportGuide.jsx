import { platformExportsForTool } from "@/lib/platformExports";

// 템플릿 상세의 "플랫폼 파일 그대로 올리기" 절(KO/EN 공용). 목록과 열은 `lib/platformExports.js`에서
// 오고, 적힌 열 이름은 `platformExports.test.js`가 실제 업로드 판정에 통과시킨 이름이다.
// 플랫폼 메뉴 경로는 적지 않는다 — 계정·개편에 따라 바뀌어 우리가 검증할 수 없다(§8).
const COPY = {
  ko: {
    heading: "플랫폼에서 내보낸 파일 그대로 올리기",
    lead: "아래 파일은 열 이름을 바꾸지 않고 올려도 이 도구가 필요한 열을 알아봅니다. 템플릿에 옮겨 적을 필요가 없습니다.",
    limit: "열 이름은 계정 언어·열 설정에 따라 다를 수 있습니다. 이름이 다르면 업로드 후 연결 화면에서 직접 고르면 됩니다.",
    fileColumn: "파일의 열",
    readAs: "읽는 항목",
    ignored: "읽지 않는 열",
    tableLabel: (platform) => `${platform} 열 연결`,
  },
  en: {
    heading: "Upload a platform export as is",
    lead: "These files can be uploaded without renaming columns—this tool recognizes the columns it needs. There is no need to copy them into the template.",
    limit: "Column names can differ with account language and column settings. If they do, pick the columns yourself on the mapping screen after upload.",
    fileColumn: "Column in the file",
    readAs: "Read as",
    ignored: "Columns not read",
    tableLabel: (platform) => `${platform} column mapping`,
  },
};

/** 도구 이름 없이 플랫폼 이름만(메타 설명·요약에 쓴다). "(한글 화면)" 같은 변형 표기는 합친다. */
export function platformExportNames(toolId, locale = "ko") {
  return [...new Set(platformExportsForTool(toolId, locale).map((item) => item.platform.replace(/\s*\([^)]*\)$/, "")))];
}

export default function PlatformExportGuide({ toolId, locale = "ko" }) {
  const exports = platformExportsForTool(toolId, locale);
  if (!exports.length) return null;
  const t = COPY[locale] || COPY.ko;
  return (
    <section className="template-detail__platforms" aria-labelledby="platform-export-heading" data-platform-exports={exports.map((item) => item.id).join(" ")}>
      <h2 id="platform-export-heading">{t.heading}</h2>
      <p className="template-detail__note">{t.lead}</p>
      {exports.map((item) => (
        <div key={item.id} className="template-detail__platform" data-platform-export={item.id}>
          <h3>{item.platform}</h3>
          <p className="template-detail__note">{item.report}</p>
          <div className="table-scroll" role="region" tabIndex={0} aria-label={t.tableLabel(item.platform)}>
            <table className="template-detail__table">
              <thead>
                <tr>
                  <th scope="col">{t.fileColumn}</th>
                  <th scope="col">{t.readAs}</th>
                </tr>
              </thead>
              <tbody>
                {item.columns.map((column) => (
                  <tr key={column.header}>
                    <td><code>{column.header}</code></td>
                    <td>{column.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {item.ignored.length > 0 && (
            <>
              <p className="template-detail__note">{t.ignored}</p>
              <ul className="template-detail__rules">
                {item.ignored.map((column) => <li key={column.header}><code>{column.header}</code> — {column.reason}</li>)}
              </ul>
            </>
          )}
        </div>
      ))}
      <p className="template-detail__note">{t.limit}</p>
    </section>
  );
}
