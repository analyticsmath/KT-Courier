import { type NextRequest } from "next/server";
import { PublicQuoteSchema } from "@/lib/client-platform/contracts";
import {
  deliveryCatalog,
  createPublicQuote,
} from "@/lib/client-platform/delivery.service";
import { mutation, json, failure } from "@/lib/client-platform/api";
import { getCurrentUser } from "@/lib/auth/current-user";
import { storeAccess } from "@/lib/client-platform/store-access";
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
    // Customer/store identity comes from the authenticated session, never a
    // client-supplied account or store ID. Guests always see public tariffs.
    const user=await getCurrentUser();
    let scope:{ownerType:"CUSTOMER"|"STORE";ownerId:string}|null=null;
    if(user?.status==="ACTIVE" && req.headers.get("X-KT-Workspace")==="STORE") {
      const store=await storeAccess(user.id,"deliveries");
      scope={ownerType:"STORE",ownerId:store.store.id};
    } else if(user?.status==="ACTIVE" && user.role==="CUSTOMER") {
      scope={ownerType:"CUSTOMER",ownerId:user.id};
    }
    return json(await createPublicQuote(input.data,scope), 201);
  } catch (e) {
    return failure(e);
  }
}
