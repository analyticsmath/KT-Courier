import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { CloudinaryImageStorage } from "@/lib/media/cloudinary-image-storage";
import { CloudinaryPrivateDocumentStorageAdapter } from "@/lib/private-media/private-media-storage";
import { CloudinaryReportArtifactStorage } from "@/lib/reporting/artifact-storage";

const config = { cloudName: "test-cloud", apiKey: "test-key", apiSecret: "test-secret", prefix: "kt-courier/catalog" };
const key = "private-media/12345678-1234-1234-1234-123456789abc";
const json = (value: unknown) => new Response(JSON.stringify(value));
const evidence = { public_id: `${config.prefix}/${key}.pdf`, asset_id: "b".repeat(32), type: "authenticated", resource_type: "raw" };

describe("authenticated document and report storage", () => {
  it("persists PDF originals as authenticated raw assets and verifies the exact bytes", async () => {
    const bytes = Buffer.from("%PDF-1.7\nprotected fixture");
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(json(evidence)).mockResolvedValueOnce(json(evidence)).mockResolvedValueOnce(new Response(bytes));
    await new CloudinaryPrivateDocumentStorageAdapter(new CloudinaryImageStorage(config, request, "raw")).write({ key, bytes, mimeType: "application/pdf" });
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "https://api.cloudinary.com/v1_1/test-cloud/raw/upload",
      "https://api.cloudinary.com/v1_1/test-cloud/raw/explicit",
      "https://api.cloudinary.com/v1_1/test-cloud/asset/download",
    ]);
    const form = request.mock.calls[0][1]!.body as FormData;
    expect(form.get("type")).toBe("authenticated");
    expect(form.get("overwrite")).toBe("false");
    expect(form.get("public_id")).toBe(evidence.public_id);
  });

  it("rejects public delivery evidence and cross-resource metadata", async () => {
    for (const invalid of [{ ...evidence, type: "upload" }, { ...evidence, resource_type: "image" }]) {
      const request = vi.fn<typeof fetch>().mockResolvedValue(json(invalid));
      await expect(new CloudinaryImageStorage(config, request, "raw").read(key, 100)).rejects.toThrow(/mismatched/);
      expect(request).toHaveBeenCalledTimes(1);
    }
  });

  it("does not permit raster bytes, report keys or traversal through the PDF adapter", async () => {
    const request = vi.fn<typeof fetch>();
    const documents = new CloudinaryPrivateDocumentStorageAdapter(new CloudinaryImageStorage(config, request, "raw"));
    await expect(documents.write({ key, bytes: Buffer.from("not a PDF"), mimeType: "application/pdf" })).rejects.toThrow(/validated PDF/);
    expect(() => documents.read("reports/REP-12345678/" + "a".repeat(64) + ".csv")).toThrow(/Invalid private/);
    await expect(documents.delete("../private-media/123")).rejects.toThrow(/Invalid private/);
    expect(request).not.toHaveBeenCalled();
  });

  it("binds report identity to its content and refuses a wrong checksum on retrieval", async () => {
    const bytes = Buffer.from("column\nvalue\n");
    const digest = createHash("sha256").update(bytes).digest("hex");
    const reportKey = `reports/REP-12345678/${digest}.csv`;
    const metadata = { ...evidence, public_id: `${config.prefix}/${reportKey}` };
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(json(metadata)).mockResolvedValueOnce(new Response("tampered"));
    const reports = new CloudinaryReportArtifactStorage(new CloudinaryImageStorage(config, request, "raw"));
    await expect(reports.open(reportKey)).rejects.toThrow(/does not match/);
    await expect(reports.store(reportKey, "different content")).rejects.toThrow(/does not match/);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does not confuse provider outages with a missing report", async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
    const reports = new CloudinaryReportArtifactStorage(new CloudinaryImageStorage(config, request, "raw"));
    await expect(reports.exists(`reports/REP-12345678/${"a".repeat(64)}.json`)).rejects.toThrow(/unavailable/);
  });
});
