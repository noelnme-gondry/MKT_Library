"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IA, SECTIONS } from "@/store/useDataStore";
import { idToSlug } from "@/lib/routeMap";

const GUIDE_SECTION = SECTIONS.find((s) => s.id === "guide");
const ANALYSIS_SECTION = SECTIONS.find((s) => s.id === "analysis");
const CONTENT_SECTION = SECTIONS.find((s) => s.id === "content");
const GUIDE_GROUP_IDS = new Set(GUIDE_SECTION.groups);
const OPS_GROUP_IDS = new Set(ANALYSIS_SECTION.groups);
const CONTENT_GROUP_IDS = new Set(CONTENT_SECTION ? CONTENT_SECTION.groups : []);

const GROUP_ICONS = { "05": "📊", "06": "🎨", "07": "🧪", "09": "✍️" };

function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ──────────────────────────── STEP 1 ──────────────────────────── */
function LandingHome({ onTrack }) {
  const totalGuides = IA.filter((g) => GUIDE_GROUP_IDS.has(g.id)).reduce(
    (a, g) => a + g.items.length,
    0
  );
  const totalTools = IA.filter((g) => OPS_GROUP_IDS.has(g.id)).reduce(
    (a, g) => a + g.items.length,
    0
  );
  const totalContent = IA.filter((g) => CONTENT_GROUP_IDS.has(g.id)).reduce(
    (a, g) => a + g.items.length,
    0
  );

  return (
    <>
      <div className="page-eyebrow">Growth Ops Playbook</div>
      <h1 className="page-title">무엇을 하시겠어요?</h1>
      <p className="page-deck">
        운영 표준 가이드를 보거나, 내 운영 데이터를 올려 바로 분석하세요. 원하는
        쪽을 고르면 그 안에서만 메뉴가 열립니다.
      </p>

      <div
        className="phase-grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginTop: "1.6rem",
        }}
      >
        {/* 가이드 카드 */}
        <div
          className="phase-card"
          style={{ cursor: "pointer" }}
          onClick={() => onTrack("guide")}
        >
          <div className="phase-card-head">
            <span className="phase-card-step">가이드</span>
            <span className="phase-card-tag">SOP 문서</span>
          </div>
          <div className="phase-card-title">📘 운영 가이드 확인</div>
          <div className="phase-card-desc">
            MMP·트래킹 셋업부터 캠페인 운영·소재, 운영 후 분석·최적화까지. 단계별
            표준 절차 문서.
          </div>
          <div className="phase-card-foot">
            <span className="phase-card-meta tnum">{totalGuides}개 가이드</span>
          </div>
          <div className="phase-card-cta">가이드 보기 →</div>
        </div>

        {/* 분석 카드 */}
        <div
          className="phase-card phase-card-tool"
          style={{ cursor: "pointer" }}
          onClick={() => onTrack("analyze")}
        >
          <div className="phase-card-head">
            <span className="phase-card-step">분석</span>
            <span className="phase-card-tag">대시보드 · 도구</span>
          </div>
          <div className="phase-card-title">📊 마케팅 분석 · 대시보드</div>
          <div className="phase-card-desc">
            실제 운영한 캠페인 CSV를 올려 대시보드 시각화·효율 분석·실험 판독·고급
            회귀까지. 시각화·모니터링은 무료.
          </div>
          <div className="phase-card-foot">
            <span className="phase-card-meta tnum">
              {totalTools}개 분석 도구
            </span>
          </div>
          <div className="phase-card-cta">분석 시작 →</div>
        </div>

        {/* 컨텐츠 분석 카드 — 퍼포먼스 엔진을 콘텐츠 마케터 언어로 리라벨 */}
        {totalContent > 0 && (
          <div
            className="phase-card phase-card-tool"
            style={{ cursor: "pointer" }}
            onClick={() => onTrack("content")}
          >
            <div className="phase-card-head">
              <span className="phase-card-step">콘텐츠</span>
              <span className="phase-card-tag">블로그 · SNS · 뉴스레터</span>
            </div>
            <div className="phase-card-title">✍️ 콘텐츠 성과 분석</div>
            <div className="phase-card-desc">
              콘텐츠 성과 CSV를 올려 어떤 제작 요소가 조회수·CTR을 끌어올리는지,
              어떤 콘텐츠가 구독 전환을 만드는지 진단. 전부 무료.
            </div>
            <div className="phase-card-foot">
              <span className="phase-card-meta tnum">
                {totalContent}개 분석 도구
              </span>
            </div>
            <div className="phase-card-cta">콘텐츠 분석 →</div>
          </div>
        )}
      </div>

      {/* 블로그 진입 — 트랙 3카드와 다른 성격(읽을거리)이라 4번째 동급 카드가 아닌
          풀폭 가로 배너로 아래에 길게 배치(시각 위계 구분 + 통일감). /blog로 이동. */}
      <Link
        href="/blog"
        className="phase-card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginTop: "1.1rem",
          textDecoration: "none",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: "30px", lineHeight: 1 }}>📝</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="phase-card-title" style={{ marginBottom: "3px" }}>
            마케팅 블로그
          </div>
          <div className="phase-card-desc" style={{ margin: 0 }}>
            퍼포먼스·콘텐츠 마케팅 실무 인사이트와 데이터·SEO·그로스 팁을 정기적으로
            업데이트합니다.
          </div>
        </div>
        <span className="phase-card-cta" style={{ whiteSpace: "nowrap", margin: 0 }}>
          글 보러 가기 →
        </span>
      </Link>

      <div className="landing-social-row">
        <a className="landing-social-btn ls-youtube" href="https://youtube.com/channel/UCvRcpOHOqvSHQPNbgZdPNUw/" target="_blank" rel="noopener noreferrer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.11-2.12C19.44 3.5 12 3.5 12 3.5s-7.44 0-9.39.58A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3 3 0 0 0 2.11 2.12C4.56 20.5 12 20.5 12 20.5s7.44 0 9.39-.58a3 3 0 0 0 2.11-2.12A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12Z"/></svg>
          <span>유튜브</span>
        </a>
        <a className="landing-social-btn ls-instagram" href="https://www.instagram.com/gondry__workshop/" target="_blank" rel="noopener noreferrer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.06 1.97.24 2.43.42a4.9 4.9 0 0 1 1.77 1.15 4.9 4.9 0 0 1 1.15 1.77c.18.46.36 1.26.42 2.43.06 1.25.07 1.65.07 4.85s0 3.6-.07 4.85c-.06 1.17-.24 1.97-.42 2.43a4.9 4.9 0 0 1-1.15 1.77 4.9 4.9 0 0 1-1.77 1.15c-.46.18-1.26.36-2.43.42-1.25.06-1.65.07-4.85.07s-3.6 0-4.85-.07c-1.17-.06-1.97-.24-2.43-.42a4.9 4.9 0 0 1-1.77-1.15 4.9 4.9 0 0 1-1.15-1.77c-.18-.46-.36-1.26-.42-2.43C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.85c.06-1.17.24-1.97.42-2.43A4.9 4.9 0 0 1 3.84 3c.53-.5 1.12-.9 1.77-1.15.46-.18 1.26-.36 2.43-.42C9.29 1.37 9.69 2.2 12 2.2Zm0 1.8c-3.15 0-3.52 0-4.75.06-.96.05-1.48.2-1.82.34a3.1 3.1 0 0 0-1.15.75 3.1 3.1 0 0 0-.75 1.15c-.14.34-.29.86-.34 1.82-.06 1.23-.06 1.6-.06 4.75s0 3.52.06 4.75c.05.96.2 1.48.34 1.82.16.42.38.79.75 1.15.36.36.73.6 1.15.75.34.14.86.29 1.82.34 1.23.06 1.6.06 4.75.06s3.52 0 4.75-.06c.96-.05 1.48-.2 1.82-.34.42-.16.79-.38 1.15-.75.36-.36.6-.73.75-1.15.14-.34.29-.86.34-1.82.06-1.23.06-1.6.06-4.75s0-3.52-.06-4.75c-.05-.96-.2-1.48-.34-1.82a3.1 3.1 0 0 0-.75-1.15 3.1 3.1 0 0 0-1.15-.75c-.34-.14-.86-.29-1.82-.34C15.52 4 15.15 4 12 4Zm0 3.05a4.95 4.95 0 1 1 0 9.9 4.95 4.95 0 0 1 0-9.9Zm0 1.8a3.15 3.15 0 1 0 0 6.3 3.15 3.15 0 0 0 0-6.3Zm5.3-3.4a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z"/></svg>
          <span>인스타그램</span>
        </a>
        <a className="landing-social-btn ls-facebook" href="https://www.facebook.com/profile.php?id=61591483650900" target="_blank" rel="noopener noreferrer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12.06C22 6.51 17.52 2 12 2S2 6.51 2 12.06c0 5.01 3.66 9.16 8.44 9.94v-7.03H7.9v-2.91h2.54V9.79c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.23.2 2.23.2v2.75h-1.26c-1.24 0-1.63.78-1.63 1.58v1.89h2.78l-.44 2.91h-2.34V22c4.78-.78 8.44-4.93 8.44-9.94Z"/></svg>
          <span>페이스북</span>
        </a>
        <a className="landing-social-btn ls-feedback" href="https://forms.gle/vxTfmt6HmxwNnWb99" target="_blank" rel="noopener noreferrer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
          <span>1분 설문 남기기</span>
        </a>
      </div>
    </>
  );
}

/* ──────────────────────────── STEP 2a ──────────────────────────── */
function LandingGuide({ onBack, onNavigate }) {
  // 가이드 섹션(01~04)을 병렬로 나열 — 예전엔 셋업/운영/운영후분석 3단계로
  // 불균등하게 묶었으나, 그룹당 1카드로 펼쳐 순서만 참고하게 함(강제 단계 아님).
  const guideGroups = IA.filter((g) => GUIDE_SECTION.groups.includes(g.id));

  return (
    <>
      <button
        className="landing-back-btn"
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          color: "var(--text-2)",
          borderRadius: "9px",
          padding: "7px 13px",
          fontSize: "12.5px",
          cursor: "pointer",
          marginBottom: "1.2rem",
        }}
      >
        ← 처음으로
      </button>
      <div className="page-eyebrow">운영 가이드</div>
      <h1 className="page-title">어느 가이드를 보시겠어요?</h1>
      <p className="page-deck">
        셋업 → 운영 → 소재 → 운영 후 분석, 참고할 순서대로 나열했습니다.
      </p>
      <div className="phase-grid" style={{ marginTop: "1.4rem" }}>
        {guideGroups.map((g, idx) => (
          <a
            key={g.id}
            className="phase-card"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onNavigate(g.items[0].id);
            }}
            style={{ cursor: "pointer", textDecoration: "none" }}
          >
            <div className="phase-card-head">
              <span className="phase-card-step">STEP {idx + 1}</span>
            </div>
            <div className="phase-card-title">{g.title}</div>
            <div className="phase-card-desc">{g.desc}</div>
            <div className="phase-card-foot">
              <span className="phase-card-meta">
                {g.items.map((it) => it.title).join(" / ")}
              </span>
              <span className="phase-card-meta tnum">{g.items.length}개 항목</span>
            </div>
            <div className="phase-card-cta">시작하기 →</div>
          </a>
        ))}
      </div>
    </>
  );
}

/* ──────────────────────────── STEP 2b ──────────────────────────── */
function LandingAnalyze({ onBack, onNavigate }) {
  const opsGroups = IA.filter((g) => OPS_GROUP_IDS.has(g.id));

  const findMeta = (id) => {
    for (const group of IA) {
      const item = group.items.find((i) => i.id === id);
      if (item) return item;
    }
    return null;
  };

  return (
    <>
      <button
        className="landing-back-btn"
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          color: "var(--text-2)",
          borderRadius: "9px",
          padding: "7px 13px",
          fontSize: "12.5px",
          cursor: "pointer",
          marginBottom: "1.2rem",
        }}
      >
        ← 처음으로
      </button>
      <div className="page-eyebrow">마케팅 분석 · 대시보드</div>
      <h1 className="page-title">무엇을 분석하시겠어요?</h1>
      <p className="page-deck">
        목표를 고르면 맞는 도구로 바로 들어갑니다.{" "}
        <strong>모든 분석 도구를 무료</strong>로 사용할 수 있습니다.
      </p>

      {opsGroups.map((g) => (
        <section key={g.id} className="block" style={{ marginTop: "1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "10px",
            }}
          >
            <span style={{ fontSize: "18px" }}>
              {GROUP_ICONS[g.id] || "📦"}
            </span>
            <h2
              className="section-title"
              style={{ margin: 0, border: "none", padding: 0 }}
            >
              {g.title}
            </h2>
          </div>
          {g.subtitle && (
            <p className="muted" style={{ margin: "-4px 0 12px" }}>
              {g.subtitle}
            </p>
          )}
          <div className="phase-grid">
            {g.items.map((item) => {
              const meta = findMeta(item.id);
              if (!meta) return null;
              return (
                <a
                  key={item.id}
                  className="phase-card"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(item.id);
                  }}
                  style={{ cursor: "pointer", textDecoration: "none" }}
                >
                  <div className="phase-card-title">{meta.title}</div>
                  <div className="phase-card-desc">{meta.desc || ""}</div>
                  <div className="phase-card-cta">바로 사용 →</div>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

/* ──────────────────────────── STEP 2c (컨텐츠) ──────────────────────────── */
function LandingContent({ onBack, onNavigate }) {
  const contentGroups = IA.filter((g) => CONTENT_GROUP_IDS.has(g.id));

  const findMeta = (id) => {
    for (const group of IA) {
      const item = group.items.find((i) => i.id === id);
      if (item) return item;
    }
    return null;
  };

  return (
    <>
      <button
        className="landing-back-btn"
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          color: "var(--text-2)",
          borderRadius: "9px",
          padding: "7px 13px",
          fontSize: "12.5px",
          cursor: "pointer",
          marginBottom: "1.2rem",
        }}
      >
        ← 처음으로
      </button>
      <div className="page-eyebrow">컨텐츠 성과 분석</div>
      <h1 className="page-title">무엇을 알고 싶으세요?</h1>
      <p className="page-deck">
        블로그·SNS·뉴스레터 콘텐츠 성과 CSV를 올리면 바로 분석합니다.{" "}
        <strong>모든 도구를 무료</strong>로 사용할 수 있습니다.
      </p>

      {contentGroups.map((g) => (
        <section key={g.id} className="block" style={{ marginTop: "1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "10px",
            }}
          >
            <span style={{ fontSize: "18px" }}>
              {GROUP_ICONS[g.id] || "📦"}
            </span>
            <h2
              className="section-title"
              style={{ margin: 0, border: "none", padding: 0 }}
            >
              {g.title}
            </h2>
          </div>
          <div className="phase-grid">
            {g.items.map((item) => {
              const meta = findMeta(item.id);
              if (!meta) return null;
              return (
                <a
                  key={item.id}
                  className="phase-card"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(item.id);
                  }}
                  style={{ cursor: "pointer", textDecoration: "none" }}
                >
                  <div className="phase-card-title">{meta.title}</div>
                  <div className="phase-card-desc">{meta.desc || ""}</div>
                  <div className="phase-card-cta">바로 사용 →</div>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

/* ──────────────────────────── MAIN ──────────────────────────── */
export default function LandingPage() {
  const [track, setTrack] = useState(null); // null = home, "guide", "analyze", "content"
  const router = useRouter();

  const handleNavigate = (routeId) => {
    // Client-side nav → preserves the module-level Zustand store (csvData etc.).
    // The catch-all page effect then mirrors the resolved id into the store.
    router.push(idToSlug[routeId] || "/");
  };

  if (track === "guide") {
    return (
      <LandingGuide onBack={() => setTrack(null)} onNavigate={handleNavigate} />
    );
  }
  if (track === "analyze") {
    return (
      <LandingAnalyze
        onBack={() => setTrack(null)}
        onNavigate={handleNavigate}
      />
    );
  }
  if (track === "content") {
    return (
      <LandingContent
        onBack={() => setTrack(null)}
        onNavigate={handleNavigate}
      />
    );
  }
  return <LandingHome onTrack={setTrack} />;
}
