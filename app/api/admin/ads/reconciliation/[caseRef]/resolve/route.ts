import { type NextRequest } from "next/server";
import { gone } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  void request;
  // Generic manual resolution is deprecated. Replaced with narrow canonical operations.
  return gone("Generic manual resolution has been removed in favor of narrow canonical retry actions.");
}
