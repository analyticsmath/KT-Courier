import { NextResponse } from "next/server";
import { listLaunchableDeliveryServices } from "@/lib/services/shipping-governance.service";
export async function GET() { return NextResponse.json({ services: await listLaunchableDeliveryServices() }); }
