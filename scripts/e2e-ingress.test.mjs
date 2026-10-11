import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { once } from "node:events";
import { spawnSync } from "node:child_process";
import { createIngressServer } from "./e2e-ingress.mjs";

test("disposable ingress preserves mutation origin, cookies, body, path and response", async (t) => {
  let received;
  const backend = createServer(async (req, res) => {
    let body = "";
    for await (const data of req) body += data;
    received = { path: req.url, method: req.method, host: req.headers.host, origin: req.headers.origin, cookie: req.headers.cookie, body };
    res.writeHead(201, { "set-cookie": "result=disposable; HttpOnly", "content-type": "application/json" });
    res.end('{"saved":true}');
  });
  backend.listen(0, "127.0.0.1"); await once(backend, "listening");
  t.after(() => backend.close());
  const ingress = createIngressServer((options, callback) => {
    assert.equal(options.hostname, "app"); assert.equal(options.port, 3000);
    return request({ ...options, hostname: "127.0.0.1", port: backend.address().port }, callback);
  });
  ingress.listen(0, "127.0.0.1"); await once(ingress, "listening");
  t.after(() => ingress.close());
  const response = await new Promise((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port: ingress.address().port, path: "/api/checkout/contact?version=2", method: "PUT", headers: { Host: "localhost:32999", Origin: "http://localhost:32999", Cookie: "owner=disposable" } }, async (res) => {
      let body = ""; for await (const data of res) body += data;
      resolve({ status: res.statusCode, cookie: res.headers["set-cookie"], body });
    });
    req.on("error", reject); req.end('{"recipient":"Disposable"}');
  });
  assert.deepEqual(received, { path: "/api/checkout/contact?version=2", method: "PUT", host: "localhost:32999", origin: "http://localhost:32999", cookie: "owner=disposable", body: '{"recipient":"Disposable"}' });
  assert.equal(response.status, 201); assert.deepEqual(response.cookie, ["result=disposable; HttpOnly"]);
  assert.deepEqual(JSON.parse(response.body), { saved: true });
});

test("absolute destinations and CONNECT cannot turn ingress into an outbound proxy", async (t) => {
  const ingress = createIngressServer(() => { throw new Error("Untrusted destination reached upstream"); });
  ingress.listen(0, "127.0.0.1"); await once(ingress, "listening");
  t.after(() => ingress.close());
  const status = await new Promise((resolve, reject) => {
    request({ hostname: "127.0.0.1", port: ingress.address().port, path: "http://example.test/", method: "GET" }, (res) => { res.resume(); resolve(res.statusCode); }).on("error", reject).end();
  });
  assert.equal(status, 400);
  const connect = await new Promise((resolve, reject) => {
    request({ hostname: "127.0.0.1", port: ingress.address().port, path: "example.test:443", method: "CONNECT" }).on("connect", (res, socket) => { socket.destroy(); resolve(res.statusCode); }).on("error", reject).end();
  });
  assert.equal(connect, 400);
});

test("ingress entry point rejects a production runtime before listening", () => {
  const result = spawnSync(process.execPath, ["scripts/e2e-ingress.mjs"], { env: { ...process.env, KT_RUNTIME_ENV: "production" }, encoding: "utf8" });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /restricted to disposable/);
});
