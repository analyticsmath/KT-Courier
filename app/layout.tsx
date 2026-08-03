import type { Metadata } from "next";
import "./globals.css";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { rootSiteMetadata } from "@/lib/public-site/site-metadata";

// Prevent build failures due to Google Fonts network downloads in offline or slow-connection environments
const plusJakarta = {
  variable: "font-plus-jakarta",
};

export const metadata: Metadata = rootSiteMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={plusJakarta.variable}>
      <body className="min-h-screen antialiased">
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
