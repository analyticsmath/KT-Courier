import test from "node:test";
import assert from "node:assert/strict";
import { classifyReleaseAttempt } from "../../scripts/verify-release-authorization.mjs";

test("manual release requires exact source and a valid non-secret evidence reference", () => {
  const sha = "a".repeat(40);
  for (const input of [
    { releaseSha: "", workflowSha: sha, sourceSha: sha, evidenceReference: "evidence-1" },
    { releaseSha: sha, workflowSha: "b".repeat(40), sourceSha: sha, evidenceReference: "evidence-1" },
    { releaseSha: sha, workflowSha: sha, sourceSha: sha, evidenceReference: "https://secret.example/?token=x" },
  ]) assert.equal(classifyReleaseAttempt(input).releaseAuthorized, false);
  assert.equal(classifyReleaseAttempt({ releaseSha: sha, workflowSha: sha, sourceSha: sha, evidenceReference: "evidence-1" }).reason, "INDEPENDENT_AUTHORITY_UNAVAILABLE");
});
