import { type NextRequest } from "next/server";
import { storeBrandsSearch } from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest) { return storeBrandsSearch(request); }

