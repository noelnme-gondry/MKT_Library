import { ImageResponse } from "next/og";
import { getToolOgData } from "@/lib/toolOg";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const { id } = await params;
  const locale = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "ko";
  const card = getToolOgData(id, locale);
  if (!card) return new Response("Not found", { status: 404 });

  const decisionLabel = locale === "en" ? "DECISION-FIRST MARKETING ANALYTICS" : "숫자로 먼저 판단하는 마케팅 분석";
  const privacy = locale === "en" ? "CSV stays in your browser" : "CSV는 브라우저 안에서만 처리";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "58px 66px",
          color: "#f4f7fb",
          background: "linear-gradient(135deg,#0c121d 0%,#111a28 65%,#172235 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "11px", color: "#0c121d", background: card.accent, fontSize: "15px", fontWeight: 900 }}>GO</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <div style={{ display: "flex", color: "#f4f7fb", fontSize: "24px", fontWeight: 750 }}>Growth Opt Playbook</div>
              <div style={{ display: "flex", color: "#8290a5", fontSize: "13px", letterSpacing: "0.12em" }}>{decisionLabel}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ display: "flex", color: card.accent, fontSize: "15px", fontWeight: 800, letterSpacing: "0.14em" }}>{card.glyph}</div>
            <div style={{ display: "flex", padding: "8px 12px", border: "1px solid rgba(255,255,255,.16)", borderRadius: "999px", color: "#a9b4c4", fontSize: "14px" }}>{card.toolId}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "44px", alignItems: "stretch" }}>
          <div style={{ width: "18px", display: "flex", borderRadius: "9px", background: card.accent }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "980px" }}>
            <div style={{ display: "flex", fontSize: "58px", lineHeight: 1.08, letterSpacing: "-0.045em", fontWeight: 800 }}>{card.title}</div>
            <div style={{ display: "flex", maxWidth: "940px", color: "#a9b4c4", fontSize: "22px", lineHeight: 1.45 }}>{card.description}</div>
            <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
              {card.metrics.map((metric, index) => (
                <div key={metric} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 13px", border: "1px solid rgba(255,255,255,.13)", borderRadius: "8px", color: index === 0 ? card.accent : "#d9e0ea", background: "rgba(255,255,255,.035)", fontSize: "15px", fontWeight: 750 }}>
                  <span style={{ display: "flex", color: card.accent }}>0{index + 1}</span>{metric}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,.12)", color: "#78869b", fontSize: "16px" }}>
          <div style={{ display: "flex" }}>{privacy}</div>
          <div style={{ display: "flex", color: "#f4f7fb", fontWeight: 650 }}>growthoptplaybook.com</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
