import { type NextRequest } from "next/server";
import { adminModerationGet } from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest) { return adminModerationGet(request); }

