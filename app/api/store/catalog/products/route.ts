import { type NextRequest } from "next/server";
import { storeProductsGet, storeProductsPost } from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest) { return storeProductsGet(request); }
export async function POST(request: NextRequest) { return storeProductsPost(request); }

