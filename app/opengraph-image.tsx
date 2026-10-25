import { ImageResponse } from "next/og";

export const alt = "Taverning — sessions, RSVPs, and recaps for your table";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function shareCard(kicker: string, title: string, sub: string) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#F3EDE1", padding: 72, fontFamily: "Georgia, serif", color: "#1D1915" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="84" height="84" viewBox="0 0 32 32">
            <path d="M16 2.5l11.7 6.75v13.5L16 29.5 4.3 22.75V9.25z" fill="#FBF8F2" stroke="#1D1915" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M16 9.5l6.2 10.7H9.8z" fill="#9E2F1F" />
            <path d="M16 2.5v7M27.7 9.25l-5.5 10.95M4.3 9.25l5.5 10.95M9.8 20.2L4.3 22.75M22.2 20.2l5.5 2.55M9.8 20.2L16 29.5l6.2-9.3" fill="none" stroke="#1D1915" strokeWidth="1.1" strokeLinejoin="round" />
          </svg>
          <div style={{ fontSize: 36, letterSpacing: 4, textTransform: "uppercase" }}>Taverning</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, letterSpacing: 4, textTransform: "uppercase", color: "#9E2F1F", marginBottom: 18 }}>{kicker}</div>
          <div style={{ fontSize: 84, lineHeight: 1.05, maxWidth: 1000 }}>{title}</div>
        </div>
        <div style={{ display: "flex", borderTop: "2px solid #D3C5AC", paddingTop: 28, fontSize: 30, color: "#5A5047" }}>{sub}</div>
      </div>
    ),
    size,
  );
}

export default function Image() {
  return shareCard("Your table, organized", "Sessions, RSVPs, and recaps.", "Who's in, when, and what happened last time.");
}
