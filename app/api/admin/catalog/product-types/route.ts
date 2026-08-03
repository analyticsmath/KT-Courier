import { type NextRequest } from "next/server";
import { adminProductTypesGet, adminProductTypesPost } from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest) { return adminProductTypesGet(request); }
export async function POST(request: NextRequest) { return adminProductTypesPost(request); }

