import { type NextRequest } from "next/server";
import { storeOffersGet, storeOffersPost } from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest) { return storeOffersGet(request); }
export async function POST(request: NextRequest) { return storeOffersPost(request); }

