import { type NextRequest } from "next/server";
import { PublicQuoteSchema } from "@/lib/client-platform/contracts";
import {
  deliveryCatalog,
  createPublicQuote,
} from "@/lib/client-platform/delivery.service";
import { mutation, json, failure } from "@/lib/client-platform/api";
export async function GET() {
  try {
    return json(await deliveryCatalog());
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  const body = await mutation(req, "public-delivery-quote");
  if ("response" in body) return body.response;
  const input = PublicQuoteSchema.safeParse(body.body);
  if (!input.success)
    return json(
      { error: "Provide valid addresses, parcel size, weight and service." },
      422,
    );
  try {
    return json(await createPublicQuote(input.data), 201);
  } catch (e) {
    return failure(e);
  }
}
