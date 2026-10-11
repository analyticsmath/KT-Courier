import { createServer, request } from "node:http";
import { pathToFileURL } from "node:url";

// Fixed upstream only: request headers/absolute URLs cannot select a destination.
// Preserve Host, Origin and cookies so real origin/ownership controls still run.
export function createIngressServer(transport = request) {
return createServer((incoming, outgoing) => {
  if (!incoming.url?.startsWith("/") || incoming.method === "CONNECT") {
    outgoing.writeHead(400).end();
    return;
  }
  const upstream = transport({ hostname: "app", port: 3000, method: incoming.method, path: incoming.url, headers: incoming.headers }, (response) => {
    outgoing.writeHead(response.statusCode ?? 502, response.headers);
    response.pipe(outgoing);
  });
  upstream.setTimeout(60_000, () => upstream.destroy());
  upstream.on("error", () => {
    if (!outgoing.headersSent) outgoing.writeHead(502);
    outgoing.end();
  });
  incoming.on("aborted", () => upstream.destroy());
  incoming.pipe(upstream);
}).on("connect", (_request, socket) => socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.KT_RUNTIME_ENV !== "e2e") throw new Error("Ingress is restricted to disposable browser infrastructure.");
  createIngressServer().listen(3000, "0.0.0.0");
}
