import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "68px 76px",
          color: "#f5f6f0",
          background: "linear-gradient(135deg,#11141b 0%,#181e29 72%,#222b38 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div style={{ width: "54px", height: "54px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "12px", color: "#11141b", background: "#d8ff67", fontSize: "18px", fontWeight: 800 }}>GO</div>
            <div style={{ display: "flex", fontSize: "28px", fontWeight: 700 }}>Growth Opt Playbook</div>
          </div>
          <div style={{ display: "flex", padding: "9px 14px", border: "1px solid rgba(255,255,255,.18)", borderRadius: "999px", color: "#b4bac7", fontSize: "16px" }}>BROWSER-ONLY ANALYTICS</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "22px", maxWidth: "980px" }}>
          <div style={{ display: "flex", color: "#d8ff67", fontSize: "19px", fontWeight: 700, letterSpacing: "0.08em" }}>PERFORMANCE MARKETING DECISION DESK</div>
          <div style={{ display: "flex", fontSize: "64px", lineHeight: 1.08, letterSpacing: "-0.045em", fontWeight: 750 }}>성과가 변한 이유부터<br />다음 행동까지.</div>
          <div style={{ display: "flex", color: "#b4bac7", fontSize: "25px", lineHeight: 1.45 }}>Dashboard · PVM · Creative fatigue · Budget allocation · MMM &amp; forecast</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "22px", borderTop: "1px solid rgba(255,255,255,.12)", color: "#8992a3", fontSize: "18px" }}>
          <div style={{ display: "flex" }}>CSV stays in your browser</div>
          <div style={{ display: "flex", color: "#f5f6f0", fontWeight: 650 }}>growthoptplaybook.com</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
