import { cpSync, existsSync, mkdirSync } from "node:fs";

/** Only called after the disposable-network runtime guard. Keep the copied
 * immutable seed media alongside the writable per-run catalog upload directory.
 * Never substitute demo bytes in production media delivery. */
export function stageDisposableCatalogMedia(bundledPath, writablePath) {
  if (!existsSync(bundledPath)) throw new Error("Disposable catalog media fixtures are missing from the runtime image.");
  mkdirSync(writablePath, { recursive: true });
  cpSync(bundledPath, writablePath, { recursive: true, force: false, errorOnExist: false });
}
