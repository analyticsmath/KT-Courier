import { type NextRequest } from "next/server";
import { adminOffersGet } from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest) { return adminOffersGet(request); }

