"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore, findMeta, displayGroupNumber, displayItemNumber } from "@/store/useDataStore";
import { resolvePathToId } from "@/lib/routeMap";
import { trGroupTitle, trItemTitle } from "@/lib/enNavCopy";
import { setLocalePref } from "@/lib/localePref";
import { englishSwitchHref } from "@/lib/localizedHref";
import BrandMark from "@/components/BrandMark";

const HEADER_COPY = {
  ko: {
    breadcrumbAria: "페이지 경로",
    overview: "Overview",
    csvChangeTitle: "현재 CSV를 지우고 다시 업로드 (이 CSV를 공유하는 모든 도구에 적용)",
    csvChangeBtn: "🔄 CSV 변경",
    themeAria: "테마 전환",
    themeTitle: "테마 전환 (라이트/다크)",
    quickNav: "빠른 이동",
    localeSwitch: "🌐 EN",
    localeSwitchTitle: "영어 페이지로 (번역된 페이지만 지원)",
    homeCrumb: "오늘의 질문",
  },
  en: {
    breadcrumbAria: "Breadcrumb",
    overview: "Overview",
    csvChangeTitle: "Clear current CSV and re-upload (applies to every tool sharing this data)",
    csvChangeBtn: "🔄 Change CSV",
    themeAria: "Toggle theme",
    themeTitle: "Toggle theme (light/dark)",
    quickNav: "Quick nav",
    localeSwitch: "🌐 한국어",
    localeSwitchTitle: "Switch to the Korean page",
    homeCrumb: "Today’s question",
  },
};

export default function Header({ locale = "ko" }) {
  const T = HEADER_COPY[locale] || HEADER_COPY.ko;
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const setCmdkOpen = useAppStore((state) => state.setCmdkOpen);
  // 현재 활성 그룹(효율/소재/실험/응답/aha)의 csvData — 전역 헤더에서 파일명 노출 +
  // 어느 도구에서든 동일하게 초기화 가능하게(§ 그룹 스코프 csvData 미러).
  const csvData = useAppStore((state) => state.csvData);
  const clearCsvGroup = useAppStore((state) => state.clearCsvGroup);
  const hasCsv = !!(csvData && csvData.raw && csvData.raw.length > 0);
  const resetCsv = () => clearCsvGroup();
  // Breadcrumb sourced from the URL (SSOT) → correct on deep-link + back/forward.
  const pathname = usePathname();
  const currentRouteId = resolvePathToId(pathname) ?? "home";
  // 블로그는 routeMap 밖(fs 기반)이라 id 해석이 "home"으로 떨어짐 → 경로로 직접 감지해
  // 브레드크럼("블로그")·언어전환(/blog↔/en/blog)을 도구와 동일한 공용 Header에서 처리.
  const cleanPath = (pathname || "/").replace(/^\/en(?=\/|$)/, "") || "/";
  const isBlog = cleanPath === "/blog" || cleanPath.startsWith("/blog/");
  const blogHref = locale === "en" ? "/en/blog" : "/blog";
  // CSV 템플릿도 블로그와 동일하게 routeMap 밖(§templates). EN 미번역이라 항상 KR로.
  const isTemplates = cleanPath === "/templates";
  // 용어사전도 동일 패턴(§glossary) — 이제 EN 있음(content/glossary-en), 블로그처럼
  // /glossary↔/en/glossary 전환.
  const isGlossary = cleanPath === "/glossary" || cleanPath.startsWith("/glossary/");
  const glossaryHref = locale === "en" ? "/en/glossary" : "/glossary";
  // KR<->EN 페이지 전환 — 현재 페이지 기준(홈 아니어도 항상 이 경로 유지). EN→KR은
  // 늘 있음(KR이 항상 완성본). KR→EN은 번역된 페이지일 때만, 없으면 /en 홈 폴백.
  const switchHref = locale === "en" ? cleanPath : englishSwitchHref(pathname);
  const switchLocale = locale === "en" ? "ko" : "en";
  const hasRestoredTheme = useRef(false);

  // The first inline body script already applies the stored class before paint.
  // Synchronize Zustand once, then keep DOM/storage/canvas charts aligned.
  useEffect(() => {
    const shouldBeDark = localStorage.getItem("mkt-library-theme") === "dark";
    document.body.classList.toggle("light-mode", !shouldBeDark);
    if (useAppStore.getState().isDarkMode !== shouldBeDark) toggleTheme();
    hasRestoredTheme.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!hasRestoredTheme.current) return;
    const currentDark = useAppStore.getState().isDarkMode;
    document.body.classList.toggle("light-mode", !currentDark);
    localStorage.setItem("mkt-library-theme", currentDark ? "dark" : "light");
    Promise.all([import("chart.js/auto"), import("@/utils/chartUtils")]).then(([chartModule, themeModule]) => {
      themeModule.refreshMountedChartThemes(chartModule.default);
    });
  }, [isDarkMode]);

  // 브레드크럼: 홈이면 "Library / Overview", 도구/문서 페이지면 3단계
  // (Library / {그룹번호 · 그룹명} / {항목번호 · 항목명}) — 원본 setBreadcrumb 동일.
  const meta = currentRouteId === "home" ? null : findMeta(currentRouteId);

  return (
    <header className="topbar" role="banner">
      <nav className="breadcrumb" aria-label={T.breadcrumbAria}>
        {/* 브랜드: 로고 마크(GO) + 이름을 좌상단에 고정(전 페이지·KR/EN 공통, 홈 링크). */}
        <Link href={locale === "en" ? "/en" : "/"} className="crumb-link brand-crumb" style={{ textDecoration: "none", color: "inherit", display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <BrandMark size={26} label="Growth Opt Playbook" />
          <span className="brand-crumb__label" style={{ fontWeight: 700 }}>Growth Opt Playbook</span>
        </Link>
        {currentRouteId === "home" && (
          <>
            <span className="sep">/</span>
            <strong className="current">{T.homeCrumb}</strong>
          </>
        )}
        {/* 블로그는 브랜드 + "블로그" 크럼. */}
        {isBlog && (
          <>
            <span className="sep">/</span>
            <Link href={blogHref} className="current" style={{ textDecoration: "none", color: "var(--text-secondary)" }}>
              {locale === "en" ? "Blog" : "블로그"}
            </Link>
          </>
        )}
        {isTemplates && (
          <>
            <span className="sep">/</span>
            <span className="current" style={{ color: "var(--text-secondary)" }}>
              {locale === "en" ? "CSV Templates" : "CSV 템플릿"}
            </span>
          </>
        )}
        {isGlossary && (
          <>
            <span className="sep">/</span>
            <Link href={glossaryHref} className="current" style={{ textDecoration: "none", color: "var(--text-secondary)" }}>
              {locale === "en" ? "Glossary" : "용어사전"}
            </Link>
          </>
        )}
        {/* 트레일링 크럼은 도구/문서 페이지에서만(홈은 브랜드만). */}
        {!isBlog && !isTemplates && !isGlossary && meta && (
          <>
            <span className="sep">/</span>
            <span
              className="current"
              title={trGroupTitle(meta.group.id, locale, meta.group.title)}
              style={{ color: "var(--text-secondary)", cursor: "default" }}
            >
              {displayGroupNumber(meta.group.id, locale)} · {trGroupTitle(meta.group.id, locale, meta.group.title)}
            </span>
            <span className="sep">/</span>
            <span className="current">
              {displayItemNumber(meta.id, locale)} · {trItemTitle(meta.id, locale, meta.title)}
            </span>
          </>
        )}
      </nav>
      <div className="topbar-actions">
        {hasCsv && (
          <span className="header-csv" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--text-muted)", marginRight: "4px" }}>
            <span className="chip" title={csvData.fileName}>
              <span className="dot"></span>{csvData.fileName || "data.csv"}
            </span>
            <button
              className="btn ghost"
              type="button"
              title={T.csvChangeTitle}
              onClick={resetCsv}
              style={{ fontSize: "11.5px" }}
            >
              {T.csvChangeBtn}
            </button>
          </span>
        )}
        <Link
          href={switchHref}
          className="btn ghost header-locale"
          title={T.localeSwitchTitle}
          onClick={() => setLocalePref(switchLocale)}
          style={{ fontSize: "11.5px", textDecoration: "none" }}
        >
          {T.localeSwitch}
        </Link>
        <button
          className="btn ghost"
          id="theme-toggle"
          type="button"
          aria-label={T.themeAria}
          title={T.themeTitle}
          onClick={toggleTheme}
        >
          {/* 원본 로직: 다크모드일 때 sun 아이콘 보여주고(클릭→라이트로), 라이트모드일 때 moon 아이콘 */}
          {isDarkMode ? (
            <svg className="sun-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          ) : (
            <svg className="moon-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          )}
        </button>
        <button
          className="btn ghost header-cmdk"
          type="button"
          aria-label={T.quickNav}
          onClick={() => setCmdkOpen(true)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span>{T.quickNav}</span>
          <span className="kbd">⌘K</span>
        </button>
      </div>
    </header>
  );
}
