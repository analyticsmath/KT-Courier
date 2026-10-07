/** Explicit browser origins for a single disposable E2E application. */
export function disposableBrowserOrigins(appPort) {
  if (!Number.isInteger(appPort) || appPort < 1 || appPort > 65535) {
    throw new Error("Invalid disposable application port.");
  }
  return `http://localhost:${appPort},http://127.0.0.1:${appPort}`;
}
