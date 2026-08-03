import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "KT Couriers — courier services";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ background: "#F3F5F3", color: "#101210", display: "flex", height: "100%", padding: "72px 82px", position: "relative", width: "100%" }}>
      <div style={{ alignItems: "center", display: "flex", gap: 24 }}>
        <div style={{ alignItems: "center", background: "#101210", display: "flex", height: 104, justifyContent: "center", position: "relative", width: 104 }}>
          <div style={{ color: "#FFFFFF", display: "flex", fontFamily: "Arial, sans-serif", fontSize: 45, fontWeight: 800, letterSpacing: -6 }}>KT</div>
          <div style={{ background: "#D83A2E", borderRadius: 999, bottom: 13, height: 12, position: "absolute", right: 13, width: 12 }} />
        </div>
        <div style={{ display: "flex", fontFamily: "Arial, sans-serif", fontSize: 64, fontWeight: 800, letterSpacing: -4 }}>KT Couriers</div>
      </div>
      <div style={{ bottom: 112, display: "flex", fontFamily: "Georgia, serif", fontSize: 58, lineHeight: 1.1, position: "absolute" }}>Courier services, clearly coordinated.</div>
      <div style={{ alignItems: "center", bottom: 68, display: "flex", gap: 18, position: "absolute", right: 82 }}>
        <div style={{ background: "#101210", borderRadius: 999, height: 12, width: 12 }} />
        <div style={{ background: "#AEB7B0", height: 2, width: 210 }} />
        <div style={{ background: "#D83A2E", borderRadius: 999, height: 18, width: 18 }} />
        <div style={{ background: "#AEB7B0", height: 2, width: 110 }} />
        <div style={{ border: "3px solid #101210", borderRadius: 999, height: 20, width: 20 }} />
      </div>
    </div>,
    size,
  );
}
