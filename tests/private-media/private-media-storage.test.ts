import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalPrivateMediaStorageAdapter, PrivateMediaStorageError } from "@/lib/private-media/private-media-storage";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("LocalPrivateMediaStorageAdapter", () => {
  it("stores private bytes outside public paths and deletes idempotently", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "kt-private-media-"));
    roots.push(root);
    const storage = new LocalPrivateMediaStorageAdapter(root);
    const key = `private-media/${randomUUID()}`;
    const bytes = new Uint8Array([1, 2, 3]);
    await storage.write({ key, bytes });
    expect(Array.from(await storage.read(key))).toEqual([1, 2, 3]);
    await storage.delete(key);
    await storage.delete(key);
    await expect(storage.read(key)).rejects.toMatchObject({ code: "PRIVATE_MEDIA_STORAGE_MISSING" } satisfies Partial<PrivateMediaStorageError>);
  });

  it("rejects traversal and malformed object keys", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "kt-private-media-"));
    roots.push(root);
    const storage = new LocalPrivateMediaStorageAdapter(root);
    await expect(storage.read("../public/secret")).rejects.toMatchObject({ code: "PRIVATE_MEDIA_STORAGE_FAILURE" } satisfies Partial<PrivateMediaStorageError>);
  });
});
