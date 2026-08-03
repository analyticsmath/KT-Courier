import { type NextRequest } from "next/server";
import { adminDuplicateResolve } from "@/lib/catalog/catalog-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return adminDuplicateResolve(request, (await params).id); }

