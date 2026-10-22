import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#F3EDE1" }}>
        <svg width="132" height="132" viewBox="0 0 32 32">
          <path d="M16 2.5l11.7 6.75v13.5L16 29.5 4.3 22.75V9.25z" fill="#FBF8F2" stroke="#1D1915" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M16 9.5l6.2 10.7H9.8z" fill="#9E2F1F" />
          <path d="M16 2.5v7M27.7 9.25l-5.5 10.95M4.3 9.25l5.5 10.95M9.8 20.2L4.3 22.75M22.2 20.2l5.5 2.55M9.8 20.2L16 29.5l6.2-9.3" fill="none" stroke="#1D1915" strokeWidth="1.1" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
