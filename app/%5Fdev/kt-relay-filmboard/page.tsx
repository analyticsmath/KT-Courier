import { notFound } from "next/navigation";
import { RelayFilmboard } from "@/components/public-v2/lab/RelayFilmboard";
import { publicFontVariables } from "@/app/fonts/public-fonts";

export const metadata = {
  robots: { index: false, follow: false },
  title: "KT Relay filmboard",
};

const filmboardFrames = new Set(["h0", "h1", "h2", "h3", "h4", "h5"]);

export default async function KtRelayFilmboardPage({
  searchParams,
}: {
  searchParams: Promise<{ frame?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const frame = (await searchParams).frame;
  const initialFrame = frame && filmboardFrames.has(frame) ? frame : "h0";

  return <RelayFilmboard fontVariables={publicFontVariables} initialFrame={initialFrame as "h0" | "h1" | "h2" | "h3" | "h4" | "h5"} />;
}
