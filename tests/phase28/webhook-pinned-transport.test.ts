import { EventEmitter } from "node:events";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:https", () => ({ request: mocks.request }));
import { FetchWebhookHttpClient } from "@/lib/developer-api/services";

beforeEach(() => { vi.clearAllMocks(); });
it("connects only to a validated DNS address with redirects disabled", async () => {
  mocks.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
  let pinned = "";
  mocks.request.mockImplementation((_url, options, onResponse) => {
    options.lookup("example.test", {}, (_error: unknown, address: string) => { pinned = address; });
    const req = new EventEmitter() as EventEmitter & { end: () => void };
    req.end = () => { const response = new EventEmitter() as EventEmitter & { statusCode: number; headers: object }; response.statusCode = 200; response.headers = {}; onResponse(response); response.emit("data", Buffer.from("ok")); response.emit("end"); };
    return req;
  });
  const result = await new FetchWebhookHttpClient().send({ url: "https://example.test/hook", headers: {}, body: Buffer.from("{}"), timeoutMs: 1000 });
  expect(result).toMatchObject({ status: 200, body: "ok" });
  expect(pinned).toBe("8.8.8.8");
  expect(mocks.lookup).toHaveBeenCalledTimes(1);
  expect(mocks.request.mock.calls[0][1]).toMatchObject({ agent: false, family: 4 });
});
it("does not connect when DNS includes a private or mapped address", async () => {
  mocks.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }, { address: "::ffff:127.0.0.1", family: 6 }]);
  await expect(new FetchWebhookHttpClient().send({ url: "https://example.test/hook", headers: {}, body: Buffer.from("{}"), timeoutMs: 1000 })).rejects.toMatchObject({ code: "WEBHOOK_ENDPOINT_UNSAFE" });
  expect(mocks.request).not.toHaveBeenCalled();
});
it("stops an oversized response without treating it as success", async () => {
  mocks.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
  const destroy = vi.fn();
  mocks.request.mockImplementation((_url, _options, onResponse) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void };
    req.end = () => { const response = new EventEmitter() as EventEmitter & { statusCode: number; headers: object; destroy: typeof destroy }; response.statusCode = 200; response.headers = {}; response.destroy = destroy; onResponse(response); response.emit("data", Buffer.alloc(32_769)); };
    return req;
  });
  await expect(new FetchWebhookHttpClient().send({ url: "https://example.test/hook", headers: {}, body: Buffer.from("{}"), timeoutMs: 1000 })).rejects.toMatchObject({ code: "WEBHOOK_RESPONSE_TOO_LARGE" });
  expect(destroy).toHaveBeenCalledOnce();
});
