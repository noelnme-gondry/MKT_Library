"use client";
// EN guide nav — simple list (not the full collapsible KR Sidebar.jsx tree; only
// ever a couple of translated guides for now, so a flat list is proportionate).
// `guides` is computed server-side by src/lib/enGuides.js (fs scan of
// public/content/pages/*.en.json) and passed in from the layout; this component
// only handles active-link highlighting via the current pathname.
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function EnGuideSidebar({ guides }) {
  const pathname = usePathname();
  if (!guides || guides.length === 0) return null;

  return (
    <aside className="sidebar" id="en-guide-sidebar">
      <Link
        href="/en"
        className="brand"
        style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}
      >
        <div className="brand-mark">GO</div>
        <div>
          <div className="brand-name">Growth Ops</div>
          <div className="brand-sub">Playbook</div>
        </div>
      </Link>

      <nav aria-label="Translated guides">
        <div className="nav-group">
          <div className="nav-group-header" style={{ cursor: "default" }}>
            <span className="nav-group-title">
              <span>Guides</span>
            </span>
          </div>
          <div className="nav-items">
            {guides.map((g) => (
              <Link
                key={g.id}
                href={g.enSlug}
                className={`nav-item ${pathname === g.enSlug ? "active" : ""}`}
              >
                <span>{g.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
}
