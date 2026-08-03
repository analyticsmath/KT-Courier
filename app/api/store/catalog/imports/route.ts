import { type NextRequest } from "next/server";
import { storeImportsGet, storeImportsPost } from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest) { return storeImportsGet(request); }
export async function POST(request: NextRequest) { return storeImportsPost(request); }

