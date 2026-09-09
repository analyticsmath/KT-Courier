/* eslint-disable @typescript-eslint/no-unused-vars */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";


const RETIRED_RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "text/plain; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
});

export async function POST(_request?: Request): Promise<Response> {
  return new Response("PayFast ITN integration is permanently retired. Digital payments are Paystack-only.", {
    status: 410,
    headers: RETIRED_RESPONSE_HEADERS,
  });
}

export async function GET(_request?: Request): Promise<Response> {
  return new Response("PayFast ITN integration is permanently retired. Digital payments are Paystack-only.", {
    status: 410,
    headers: RETIRED_RESPONSE_HEADERS,
  });
}

