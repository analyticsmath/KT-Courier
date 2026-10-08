import { sanitize } from "./docker-common.mjs";

/** Persist actionable failure text as each case finishes, even when the
 * deliberate outer process deadline prevents Playwright's final summary. */
export default class E2EFailureReporter {
  onTestEnd(test, result) {
    if (["failed", "timedOut", "interrupted"].includes(result.status)) console.error("E2E_FAILURE " + sanitize(JSON.stringify({ title: test.titlePath(), status: result.status, errors: result.errors.map(error => ({ message: error.message?.replace(/\u001b\[[0-9;]*m/g, "").slice(0, 6000), stack: error.stack?.replace(/\u001b\[[0-9;]*m/g, "").slice(0, 3000) })) })));
  }
}
