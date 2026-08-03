import { type NextRequest } from "next/server";
import { adminDuplicatesGet } from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest) { return adminDuplicatesGet(request); }

