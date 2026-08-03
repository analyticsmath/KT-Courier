import { type NextRequest } from "next/server";
import { storePricesPost } from "@/lib/catalog/catalog-route-handlers";
export async function POST(request: NextRequest) { return storePricesPost(request); }

