import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const alt = "KT Couriers compact mark";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ alignItems: "center", background: "#101210", display: "flex", height: "100%", justifyContent: "center", position: "relative", width: "100%" }}>
      <div style={{ color: "#FFFFFF", display: "flex", fontFamily: "Arial, sans-serif", fontSize: 82, fontWeight: 800, letterSpacing: -12, lineHeight: 1 }}>KT</div>
      <div style={{ background: "#D83A2E", borderRadius: 999, bottom: 20, height: 18, position: "absolute", right: 20, width: 18 }} />
    </div>,
    size,
  );
}
