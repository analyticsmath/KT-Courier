import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { PAYMENT_API_BODY_LIMIT, readBoundedPaymentJsonRequest } from "@/lib/payments/customer-api-policy";

function request(input: BodyInit, extraHeaders: Record<string, string> = {}) {
  return new NextRequest("https://ktcouriers.test/api/orders/order-1/payment", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
    body: input,
  });
}

describe("payment JSON transport: bounded, HTTP/2 compatible", () => {
  it("accepts valid JSON without Content-Length and keeps the operation value intact", async () => {
    const req = request(JSON.stringify({ operationId: "payment-op-12345", walletAmount: "0.00" }));
    expect(req.headers.get("content-length")).toBeNull();
    const result = await readBoundedPaymentJsonRequest(req);
    expect(result).toEqual({ body: { operationId: "payment-op-12345", walletAmount: "0.00" } });
  });

  it("accepts legal JSON with a valid declared Content-Length", async () => {
    const payload = JSON.stringify({ operationId: "payment-op-12345" });
    expect(await readBoundedPaymentJsonRequest(request(payload, {
      "content-length": String(Buffer.byteLength(payload)),
    }))).toEqual({ body: { operationId: "payment-op-12345" } });
  });

  it("rejects a declared byte overflow without attempting a provider session", async () => {
    const result = await readBoundedPaymentJsonRequest(request("{}", {
      "content-length": String(PAYMENT_API_BODY_LIMIT + 1),
    }));
    expect("response" in result && result.response.status).toBe(413);
  });

  it("accepts chunked HTTP JSON even when no body length is declared", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"operationId":'));
        controller.enqueue(encoder.encode('"payment-op-12345"}'));
        controller.close();
      },
    });
    const result = await readBoundedPaymentJsonRequest(request(stream));
    expect(result).toEqual({ body: { operationId: "payment-op-12345" } });
  });

  it("rejects an undeclared actual byte overflow", async () => {
    const result = await readBoundedPaymentJsonRequest(request(JSON.stringify({
      operationId: "x".repeat(PAYMENT_API_BODY_LIMIT),
    })));
    expect("response" in result && result.response.status).toBe(413);
  });

  it("counts UTF-8 bytes instead of characters", async () => {
    const result = await readBoundedPaymentJsonRequest(request(JSON.stringify({
      operationId: "🚚".repeat(512),
    })));
    expect("response" in result && result.response.status).toBe(413);
  });

  it("rejects a missing or malformed body with a typed response", async () => {
    const empty = await readBoundedPaymentJsonRequest(new NextRequest(
      "https://ktcouriers.test/api/orders/order-1/payment",
      { method: "POST", headers: { "content-type": "application/json" } },
    ));
    expect("response" in empty && empty.response.status).toBe(422);
    const invalid = await readBoundedPaymentJsonRequest(request("{bad"));
    expect("response" in invalid && invalid.response.status).toBe(422);
  });

  it("rejects an invalid content type and forged non-numeric length", async () => {
    const wrongType = await readBoundedPaymentJsonRequest(new NextRequest(
      "https://ktcouriers.test/api/orders/order-1/payment",
      { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" },
    ));
    expect("response" in wrongType && wrongType.response.status).toBe(415);
    const length = await readBoundedPaymentJsonRequest(request("{}", { "content-length": "garbage" }));
    expect("response" in length && length.response.status).toBe(413);
  });
});
