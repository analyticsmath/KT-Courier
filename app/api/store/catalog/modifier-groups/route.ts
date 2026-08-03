import { type NextRequest } from "next/server";
import { storeModifiersGet, storeModifiersPost } from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest) { return storeModifiersGet(request); }
export async function POST(request: NextRequest) { return storeModifiersPost(request); }

