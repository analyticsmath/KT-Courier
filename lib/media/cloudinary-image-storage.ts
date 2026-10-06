import { createHash } from "node:crypto";

/** Server-only Cloudinary operations. Signed requests and original bytes never leave the application server. */
export type CloudinaryImageConfig = Readonly<{ cloudName: string; apiKey: string; apiSecret: string; prefix: string }>;

export class CloudinaryImageStorageError extends Error {
  constructor(readonly code: "NOT_CONFIGURED" | "MISSING" | "FAILURE", message: string) {
    super(message);
    this.name = "CloudinaryImageStorageError";
  }
}

export function cloudinaryImageConfig(env: Record<string, string | undefined> = process.env): CloudinaryImageConfig | null {
  const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim();
  const prefix = (env.CLOUDINARY_CATALOG_PREFIX?.trim() || "kt-courier/catalog").replace(/^\/+|\/+$/g, "");
  if (!cloudName || !/^[A-Za-z0-9_-]+$/.test(cloudName) || !apiKey || !apiSecret || !prefix || prefix.includes("..") || !prefix.split("/").every(p => /^[A-Za-z0-9_-]+$/.test(p))) return null;
  return { cloudName, apiKey, apiSecret, prefix };
}

export function signCloudinaryParameters(parameters: Readonly<Record<string, string>>, secret: string): string {
  const serialized = Object.keys(parameters).sort().map(key => `${key}=${parameters[key]}`).join("&");
  return createHash("sha256").update(serialized + secret).digest("hex");
}

async function boundedBody(response: Response, maximumBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximumBytes) throw new CloudinaryImageStorageError("FAILURE", "Cloudinary object exceeds its size bound.");
  if (!response.body) throw new CloudinaryImageStorageError("FAILURE", "Cloudinary returned no image bytes.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) throw new CloudinaryImageStorageError("FAILURE", "Cloudinary object exceeds its size bound.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  if (!size) throw new CloudinaryImageStorageError("FAILURE", "Cloudinary returned an empty image.");
  return Buffer.concat(chunks, size);
}

export class CloudinaryImageStorage {
  constructor(private readonly config: CloudinaryImageConfig, private readonly request: typeof fetch = fetch) {}

  private publicId(key: string): string {
    if (!/^(catalog-media\/[a-f0-9]{64}|private-media\/[a-f0-9-]{36})$/.test(key)) throw new CloudinaryImageStorageError("FAILURE", "Invalid Cloudinary image identity.");
    return `${this.config.prefix}/${key}`;
  }

  private async post(action: "image/upload" | "image/explicit" | "image/destroy" | "asset/download", parameters: Record<string, string>, file?: Uint8Array): Promise<Response> {
    const signed = { ...parameters, timestamp: String(Math.floor(Date.now() / 1000)) };
    const form = new FormData();
    for (const [key, value] of Object.entries(signed)) form.set(key, value);
    form.set("api_key", this.config.apiKey);
    form.set("signature", signCloudinaryParameters(signed, this.config.apiSecret));
    if (file) form.set("file", new Blob([Buffer.from(file)], { type: "application/octet-stream" }), "image");
    let response: Response;
    try {
      response = await this.request(`https://api.cloudinary.com/v1_1/${this.config.cloudName}/${action}`, { method: "POST", body: form, signal: AbortSignal.timeout(20_000), redirect: "error", cache: "no-store" });
    } catch {
      throw new CloudinaryImageStorageError("FAILURE", "Cloudinary image storage is unavailable.");
    }
    if (response.status === 404) throw new CloudinaryImageStorageError("MISSING", "Cloudinary image is unavailable.");
    if (!response.ok) throw new CloudinaryImageStorageError("FAILURE", "Cloudinary rejected the image operation.");
    return response;
  }

  private async metadata(response: Response, publicId: string): Promise<{ asset_id: string }> {
    const bytes = await boundedBody(response, 64 * 1024);
    let body: { asset_id?: unknown; public_id?: unknown; resource_type?: unknown; type?: unknown };
    try { body = JSON.parse(Buffer.from(bytes).toString("utf8")); } catch { throw new CloudinaryImageStorageError("FAILURE", "Cloudinary returned invalid image evidence."); }
    if (body.public_id !== publicId || body.resource_type !== "image" || body.type !== "authenticated" || typeof body.asset_id !== "string" || !/^[a-f0-9]{32}$/.test(body.asset_id)) throw new CloudinaryImageStorageError("FAILURE", "Cloudinary returned mismatched image evidence.");
    return { asset_id: body.asset_id };
  }

  async write(key: string, bytes: Uint8Array, maximumBytes: number): Promise<void> {
    const publicId = this.publicId(key);
    if (!bytes.byteLength || bytes.byteLength > maximumBytes) throw new CloudinaryImageStorageError("FAILURE", "Image exceeds its upload size bound.");
    await this.metadata(await this.post("image/upload", { public_id: publicId, type: "authenticated", overwrite: "false", unique_filename: "false" }, bytes), publicId);
    // An immutable retry must match the existing original, not merely succeed with overwrite=false.
    const original = await this.read(key, maximumBytes);
    if (createHash("sha256").update(original).digest("hex") !== createHash("sha256").update(bytes).digest("hex")) throw new CloudinaryImageStorageError("FAILURE", "Stored image does not match the upload checksum.");
  }

  async read(key: string, maximumBytes: number): Promise<Uint8Array> {
    const publicId = this.publicId(key);
    const metadata = await this.metadata(await this.post("image/explicit", { public_id: publicId, type: "authenticated" }), publicId);
    const response = await this.post("asset/download", { asset_id: metadata.asset_id, expires_at: String(Math.floor(Date.now() / 1000) + 60) });
    // No format/quality/transformation is requested: publication hashes bind the original bytes.
    return boundedBody(response, maximumBytes);
  }

  async delete(key: string): Promise<boolean> {
    const response = await this.post("image/destroy", { public_id: this.publicId(key), type: "authenticated", invalidate: "true" });
    const bytes = await boundedBody(response, 16 * 1024);
    let result: unknown;
    try { result = JSON.parse(Buffer.from(bytes).toString("utf8")).result; } catch { throw new CloudinaryImageStorageError("FAILURE", "Cloudinary returned invalid deletion evidence."); }
    if (result !== "ok" && result !== "not found") throw new CloudinaryImageStorageError("FAILURE", "Cloudinary did not confirm image deletion.");
    return result === "ok";
  }
}
