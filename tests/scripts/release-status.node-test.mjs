import assert from "node:assert/strict";
import test from "node:test";
import { informationalReleaseStatus } from "../../scripts/write-release-status.mjs";

test("engineering release status is bound to the exact source and never authorizes launch", () => {
  const sha = "a".repeat(40);
  assert.deepEqual(informationalReleaseStatus(sha, sha), { schemaVersion: 1, sourceSha: sha, releaseStatus: "RELEASE_NOT_AUTHORIZED", launchAuthorized: false, approvalEvaluated: false });
  for (const [observed, expected] of [[sha, null], [sha, "a"], ["a", "a"], [sha, "b".repeat(40)]]) assert.throws(() => informationalReleaseStatus(observed, expected));
});
