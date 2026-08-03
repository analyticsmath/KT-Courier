import { type NextRequest } from "next/server";
import { storeImportAction } from "@/lib/catalog/catalog-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) { return storeImportAction(request, (await params).publicReference, "apply"); }

