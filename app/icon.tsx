import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";
export const alt = "KT Couriers compact mark";

export default function Icon() {
  return new ImageResponse(
    <div style={{ alignItems: "center", background: "#101210", display: "flex", height: "100%", justifyContent: "center", position: "relative", width: "100%" }}>
      <div style={{ color: "#FFFFFF", display: "flex", fontFamily: "Arial, sans-serif", fontSize: 240, fontWeight: 800, letterSpacing: -30, lineHeight: 1 }}>KT</div>
      <div style={{ background: "#D83A2E", borderRadius: 999, bottom: 64, height: 52, position: "absolute", right: 64, width: 52 }} />
    </div>,
    size,
  );
}
