import { notFound } from "next/navigation";
import Link from "next/link";

import TemplateDownloadCard from "@/components/TemplateDownloadCard";
import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";
import { getTemplatePage, TEMPLATE_PAGE_SLUGS } from "@/lib/templateCatalog";
import { getRouteSeo } from "@/lib/routeSeo";

// 도구별 CSV 템플릿 상세. 컬럼 표는 실제 템플릿 빌더에서 파생하므로 페이지와
// 내려받는 헤더가 갈라지지 않는다(`lib/templateCatalog.js`).
export function generateStaticParams() {
  return TEMPLATE_PAGE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = getTemplatePage(slug);
  if (!page) return {};
  const seo = getRouteSeo(page.toolId, "ko");
  const toolName = seo?.title || page.toolId;
  const title = `${toolName} CSV 템플릿 다운로드`;
  const description = `${toolName}에 바로 올릴 수 있는 CSV 템플릿입니다. 필요한 컬럼 ${page.fields.length}개(필수 ${page.requiredCount}개)와 각 컬럼의 의미를 확인하고 빈 양식을 받으세요.`;
  const canonical = `${SITE_URL}/templates/${slug}`;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        ko: `${SITE_URL}/templates/${slug}`,
        en: `${SITE_URL}/en/templates/${slug}`,
        "x-default": `${SITE_URL}/en/templates/${slug}`,
      },
    },
    openGraph: withOpenGraphBase({ title, description, url: canonical, images: [`${SITE_URL}/og-card.png`] }),
  };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const page = getTemplatePage(slug);
  if (!page) notFound();
  const seo = getRouteSeo(page.toolId, "ko");
  const toolName = seo?.title || page.toolId;

  return (
    <section className="template-detail">
      <span className="template-detail__eyebrow">CSV 템플릿</span>
      <h1>{toolName} 입력 템플릿</h1>
      <p className="template-detail__lead">이 도구가 읽는 컬럼만 담은 빈 CSV입니다. 헤더 이름을 그대로 두면 업로드할 때 자동으로 매핑됩니다. 데이터는 브라우저에서만 처리되고 서버로 전송되지 않습니다.</p>

      <TemplateDownloadCard
        toolId={page.toolId}
        title={`${toolName} 템플릿`}
        desc={`컬럼 ${page.fields.length}개 · 필수 ${page.requiredCount}개`}
        href={`${page.toolPath}`}
        unified={page.hasUnified}
        locale="ko"
      />

      <h2>템플릿 컬럼</h2>
      <div className="table-scroll">
        <table className="template-detail__table">
          <thead>
            <tr>
              <th scope="col">컬럼</th>
              <th scope="col">의미</th>
              <th scope="col">형식</th>
              <th scope="col">필수</th>
            </tr>
          </thead>
          <tbody>
            {page.fields.map((field) => (
              <tr key={field.key}>
                <td><code>{field.key}</code></td>
                <td>{field.label || "—"}</td>
                <td>{field.type}</td>
                <td>{field.required ? "필수" : "선택"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>작성할 때 주의할 점</h2>
      <ul className="template-detail__rules">
        <li>날짜는 <code>YYYY-MM-DD</code> 형식으로 통일하세요. 형식이 섞이면 기간 비교가 어긋납니다.</li>
        <li>금액·수치 컬럼에는 천단위 콤마가 있어도 되지만, 통화 기호나 문자는 넣지 마세요.</li>
        <li>필수 컬럼이 비어 있는 행은 분석에서 제외됩니다. 0과 빈칸은 다른 의미로 처리됩니다.</li>
        <li>컬럼을 더 넣어도 됩니다. 이 도구가 쓰지 않는 컬럼은 무시됩니다.</li>
      </ul>

      <p className="template-detail__back">
        <Link href="/templates">← 전체 템플릿 목록</Link>
      </p>
    </section>
  );
}
